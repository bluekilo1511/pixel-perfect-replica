// Pure rules for "môn tổ hợp" — combination subjects like KHTN (Vật lí + Hoá học +
// Sinh học) or LSĐL (Lịch sử + Địa lí). A combo subject is a normal subject in
// data.subjects whose name also maps to 2–3 member subjects. Each member keeps
// its own grades, notes and stats; the combo shows their combined picture.
import type { AppData } from "./model";
import { subjectGrade, type GradeEntry } from "./grades";

export const COMBO_MEMBERS_MIN = 2;
export const COMBO_MEMBERS_MAX = 3;
export const COMBOS_MAX = 6;

/** Members of a combo subject, or undefined when it is not a combo. */
export function comboMembers(
  data: Pick<AppData, "subjectCombos">,
  subject: string,
): string[] | undefined {
  const members = data.subjectCombos?.[subject];
  if (Array.isArray(members) && members.length >= COMBO_MEMBERS_MIN) return members;
  return undefined;
}

/** True when `subject` is already a member of some other combo. */
function isMemberElsewhere(
  combos: Record<string, string[]>,
  subject: string,
  exceptCombo?: string,
): boolean {
  return Object.entries(combos).some(
    ([name, members]) => name !== exceptCombo && members.includes(subject),
  );
}

/** Sets (or replaces) the member list of a combo subject.
 * Returns null on any validation failure:
 * - subject must be an existing subject and not a member of another combo
 * - members must be 2–3 distinct existing subjects, none equal to the combo
 * - a member may not itself be a combo or a member of another combo
 * - max COMBOS_MAX combos overall */
export function setSubjectCombo(data: AppData, subject: string, members: string[]): AppData | null {
  if (!data.subjects.includes(subject)) return null;
  if (Object.keys(data.subjectCombos ?? {}).length >= COMBOS_MAX) return null;
  const clean = [
    ...new Set(members.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean)),
  ];
  if (clean.length < COMBO_MEMBERS_MIN || clean.length > COMBO_MEMBERS_MAX) return null;
  if (clean.includes(subject)) return null;
  for (const m of clean) {
    if (!data.subjects.includes(m)) return null;
    if (data.subjectCombos?.[m]) return null; // member is itself a combo
    if (isMemberElsewhere(data.subjectCombos ?? {}, m, subject)) return null;
  }
  return {
    ...data,
    subjectCombos: { ...data.subjectCombos, [subject]: clean },
  };
}

/** Removes the combo definition; the subject itself stays. */
export function clearSubjectCombo(data: AppData, subject: string): AppData {
  if (!data.subjectCombos?.[subject]) return data;
  const { [subject]: _drop, ...rest } = data.subjectCombos;
  return { ...data, subjectCombos: rest };
}

/** Drops every combo that names `subject` as the combo or as a member. */
export function removeSubjectFromCombos(data: AppData, subject: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [name, members] of Object.entries(data.subjectCombos ?? {})) {
    if (name === subject || members.includes(subject)) continue;
    out[name] = members;
  }
  return out;
}

/** Grade of a combo = mean of the member grades that already have marks,
 * rounded to 0.1; null until at least one member has a grade. */
export function comboGrade(
  gradeBook: GradeEntry[],
  members: string[],
  semester: 1 | 2,
): number | null {
  const grades = members
    .map((m) => subjectGrade(gradeBook, m, semester))
    .filter((g): g is number => g !== null);
  if (grades.length === 0) return null;
  const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
  return Math.round(avg * 10) / 10;
}

/** Normalizes a saved combos map: keeps only valid 2–3 member lists of known subjects. */
export function normalizeSubjectCombos(raw: unknown, subjects: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [name, members] of Object.entries(raw as Record<string, unknown>)) {
    if (!subjects.includes(name)) continue;
    if (!Array.isArray(members)) continue;
    const clean = [
      ...new Set(
        members
          .filter((m): m is string => typeof m === "string")
          .map((m) => m.trim())
          .filter((m) => m && m !== name && subjects.includes(m)),
      ),
    ];
    if (clean.length >= COMBO_MEMBERS_MIN && clean.length <= COMBO_MEMBERS_MAX) {
      out[name] = clean;
    }
  }
  return out;
}
