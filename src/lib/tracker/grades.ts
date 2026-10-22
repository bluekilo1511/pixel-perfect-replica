// Pure grade-book rules (no browser APIs, so it is testable).
//
// Vietnamese grade book (Thông tư 22, chương trình 2018): each subject has one
// grade per semester built from three column groups — ĐG thường xuyên (TX, any
// number of columns), giữa kỳ (GK, one column) and cuối kỳ (CK, one column).
// The subject grade is the average of the column groups, rounded to 0.1:
//   with GK:  ĐMH = (avgTX + GK + CK) / 3
//   without GK: ĐMH = (avgTX + CK) / 2
// Every column group value is the mean of its own columns on a 10-point scale.

import type { ExamScore } from "./exams";

export type GradeType = "tx" | "gk" | "ck";

export const GRADE_TYPE_META: Record<GradeType, { label: string; short: string }> = {
  tx: { label: "Thường xuyên", short: "TX" },
  gk: { label: "Giữa kỳ", short: "GK" },
  ck: { label: "Cuối kỳ", short: "CK" },
};

export type Semester = 1 | 2;

/** One confirmed column entry — the score counts toward the subject grade. */
export interface GradeEntry {
  id: string;
  subject: string;
  semester: Semester;
  type: GradeType;
  title: string; // optional column label, e.g. "15p bài old" or "" when none
  date: string; // YYYY-MM-DD
  score: number; // on the column's own scale
  max: number; // > 0, default 10
  createdAt: string;
}

/** "Điểm dư" — extra points the teacher handed out without a firm column yet. Sits aside until the user promotes one into a column. */
export interface GradeExtra {
  id: string;
  subject: string;
  semester: Semester;
  label: string; // why the point exists, e.g. "thầy cho làm thêm bài"
  score: number | null; // null = a pure note, no point yet
  max: number;
  createdAt: string;
}

export const GRADE_ENTRIES_MAX = 200;
export const GRADE_EXTRAS_MAX = 50;
export const TITLE_MAX = 24;
export const SUBJECT_FIELD_MAX = 24;

export const newGradeId = () =>
  `gr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Score on a 10-point scale, or null when the entry is malformed. */
export const tenPoint = (e: { score: number; max: number }): number | null =>
  e.max > 0 ? Math.round((e.score / e.max) * 1000) / 100 : null;

const round1 = (n: number) => Math.round(n * 10) / 10;

const normalizeType = (v: unknown): GradeType => (v === "gk" || v === "ck" ? v : "tx");

const normalizeSemester = (v: unknown): Semester => (v === 2 ? 2 : 1);

/** Accepts old/new JSON and keeps only well-formed entries. */
export function normalizeGradeEntries(raw: unknown): GradeEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, GRADE_ENTRIES_MAX)
    .filter((e) => !!e && typeof e === "object")
    .map((e): GradeEntry | null => {
      const r = e as Record<string, unknown>;
      const subject = String(r.subject ?? "")
        .trim()
        .slice(0, SUBJECT_FIELD_MAX);
      const score = Number(r.score);
      const max = Number(r.max);
      if (!subject || !Number.isFinite(score) || score < 0) return null;
      const goodMax = Number.isFinite(max) && max > 0 ? max : 10;
      const capped = Math.min(score, goodMax);
      return {
        id: typeof r.id === "string" && r.id ? r.id : newGradeId(),
        subject,
        semester: normalizeSemester(r.semester),
        type: normalizeType(r.type),
        title: typeof r.title === "string" ? r.title.trim().slice(0, TITLE_MAX) : "",
        date: typeof r.date === "string" && DATE_RE.test(r.date) ? r.date : "",
        score: capped,
        max: goodMax,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      };
    })
    .filter((e): e is GradeEntry => e !== null);
}

/** Accepts old/new JSON and keeps only well-formed extras. */
export function normalizeGradeExtras(raw: unknown): GradeExtra[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, GRADE_EXTRAS_MAX)
    .filter((e) => !!e && typeof e === "object")
    .map((e): GradeExtra | null => {
      const r = e as Record<string, unknown>;
      const subject = String(r.subject ?? "")
        .trim()
        .slice(0, SUBJECT_FIELD_MAX);
      const label = String(r.label ?? "")
        .trim()
        .slice(0, 60);
      if (!subject || !label) return null;
      const scoreRaw = Number(r.score);
      const hasScore = r.score !== null && r.score !== undefined && r.score !== "";
      const maxRaw = Number(r.max);
      const max = Number.isFinite(maxRaw) && maxRaw > 0 ? maxRaw : 10;
      const score =
        hasScore && Number.isFinite(scoreRaw) && scoreRaw >= 0 ? Math.min(scoreRaw, max) : null;
      return {
        id: typeof r.id === "string" && r.id ? r.id : newGradeId(),
        subject,
        semester: normalizeSemester(r.semester),
        label,
        score,
        max,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      };
    })
    .filter((e): e is GradeExtra => e !== null);
}

const subjectKey = (s: string) => s.trim().toLowerCase();

/** Adds a column entry. Returns null on a bad subject/score or a full list. */
export function addGradeEntry(
  list: GradeEntry[],
  input: {
    subject: string;
    semester: Semester;
    type: GradeType;
    score: number;
    max?: number;
    title?: string;
    date?: string;
  },
): GradeEntry[] | null {
  const subject = input.subject.trim().slice(0, SUBJECT_FIELD_MAX);
  const max = Math.max(1, Math.round(input.max ?? 10));
  const score = Math.round(input.score * 100) / 100;
  if (!subject || !Number.isFinite(score) || score < 0 || score > max) return null;
  if (list.length >= GRADE_ENTRIES_MAX) return null;
  return [
    ...list,
    {
      id: newGradeId(),
      subject,
      semester: input.semester,
      type: input.type,
      title: (input.title ?? "").trim().slice(0, TITLE_MAX),
      date: input.date && DATE_RE.test(input.date) ? input.date : "",
      score,
      max,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function removeGradeEntry(list: GradeEntry[], id: string): GradeEntry[] {
  return list.filter((e) => e.id !== id);
}

/** Adds a "điểm dư" side note. Returns null on a bad subject/label or a full list. */
export function addGradeExtra(
  list: GradeExtra[],
  input: {
    subject: string;
    semester: Semester;
    label: string;
    score?: number | null;
    max?: number;
  },
): GradeExtra[] | null {
  const subject = input.subject.trim().slice(0, SUBJECT_FIELD_MAX);
  const label = input.label.trim().slice(0, 60);
  if (!subject || !label) return null;
  if (list.length >= GRADE_EXTRAS_MAX) return null;
  const max = Math.max(1, Math.round(input.max ?? 10));
  const score =
    input.score === null || input.score === undefined || input.score === ("" as unknown)
      ? null
      : Math.min(Math.max(0, Number(input.score) || 0), max);
  return [
    ...list,
    {
      id: newGradeId(),
      subject,
      semester: input.semester,
      label,
      score: Number.isFinite(score as number) ? (score as number | null) : null,
      max,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function removeGradeExtra(list: GradeExtra[], id: string): GradeExtra[] {
  return list.filter((e) => e.id !== id);
}

/** Promotes a "điểm dư" into a confirmed column and drops the extra. Returns null when the extra has no score. */
export function absorbGradeExtra(
  entries: GradeEntry[],
  extras: GradeExtra[],
  extraId: string,
  type: GradeType,
): { entries: GradeEntry[]; extras: GradeExtra[] } | null {
  const extra = extras.find((e) => e.id === extraId);
  if (!extra || extra.score === null) return null;
  const added = addGradeEntry(entries, {
    subject: extra.subject,
    semester: extra.semester,
    type,
    score: extra.score,
    max: extra.max,
    title: extra.label.slice(0, TITLE_MAX),
  });
  if (!added) return null;
  return { entries: added, extras: removeGradeExtra(extras, extraId) };
}

/** One subject's confirmed entries of one semester, oldest first. */
export function semesterEntries(
  entries: GradeEntry[],
  subject: string,
  semester: Semester,
): GradeEntry[] {
  const key = subjectKey(subject);
  return entries
    .filter((e) => subjectKey(e.subject) === key && e.semester === semester)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Mean of a column group on a 10-point scale, or null when the group is empty. */
export function groupAverage(entries: GradeEntry[], type: GradeType): number | null {
  const values = entries
    .filter((e) => e.type === type)
    .map(tenPoint)
    .filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, v) => a + v, 0) / values.length;
}

/** The subject grade for a semester, or null while TX or CK is still missing. */
export function subjectGrade(
  entries: GradeEntry[],
  subject: string,
  semester: Semester,
): number | null {
  const list = semesterEntries(entries, subject, semester);
  const tx = groupAverage(list, "tx");
  const ck = groupAverage(list, "ck");
  if (tx === null || ck === null) return null;
  const gk = groupAverage(list, "gk");
  return round1(gk === null ? (tx + ck) / 2 : (tx + gk + ck) / 3);
}

/** Xếp loại theo Thông tư 22 (per-subject hint, not the official report). */
export function gradeBand(grade: number): string {
  if (grade >= 8.0) return "Tốt";
  if (grade >= 6.5) return "Khá";
  if (grade >= 5.0) return "Đạt";
  return "Chưa đạt";
}

export interface GradeAdvice {
  column: GradeType; // the missing column the advice is about
  need: number; // 10-point score the column must reach for the target
  done: boolean; // need <= 0 — the target is already safe
  impossible: boolean; // need > 10 — the target is out of reach
}

/** "Cần bao nhiêu?" — the score the still-missing column must reach for the target grade. Returns null while TX is empty or every column is filled. */
export function gradeAdvice(
  entries: GradeEntry[],
  subject: string,
  semester: Semester,
  target: number,
): GradeAdvice | null {
  if (!Number.isFinite(target) || target <= 0 || target > 10) return null;
  const list = semesterEntries(entries, subject, semester);
  const tx = groupAverage(list, "tx");
  if (tx === null) return null;
  const gk = groupAverage(list, "gk");
  const ck = groupAverage(list, "ck");
  const clamp = (need: number): GradeAdvice => ({
    column: ck === null ? "ck" : "gk",
    need: Math.max(0, round1(need)),
    done: need <= 0,
    impossible: need > 10,
  });
  if (ck === null && gk === null) return clamp(target * 2 - tx);
  if (ck === null) return clamp(target * 3 - tx - (gk as number));
  if (gk === null) return clamp(target * 3 - tx - (ck as number));
  return null;
}

/** Guesses the column type from a legacy score label ("giữa kỳ" → gk, "cuối kỳ" → ck, else tx). */
export function guessTypeFromTitle(title: string): GradeType {
  const t = title.toLowerCase();
  if (t.includes("giữa") || t.includes("giua") || t.includes("gk")) return "gk";
  if (t.includes("cuối") || t.includes("cuoi") || t.includes("ck")) return "ck";
  return "tx";
}

/** Guesses the semester from a date: months 8-12 belong to kỳ 1, the rest to kỳ 2 of the running school year. */
export function guessSemester(date: string): Semester {
  const month = Number(date.slice(5, 7));
  if (!Number.isFinite(month) || month < 1 || month > 12) return 1;
  return month >= 8 ? 1 : 2;
}

/** One-way migration of legacy ExamScore rows into grade-book entries. */
export function convertExamScores(scores: ExamScore[]): GradeEntry[] {
  return scores.map((s) => ({
    id: newGradeId(),
    subject: s.subject,
    semester: guessSemester(s.date),
    type: guessTypeFromTitle(s.title),
    title: s.title.slice(0, TITLE_MAX),
    date: s.date,
    score: s.score,
    max: s.max,
    createdAt: s.createdAt,
  }));
}
