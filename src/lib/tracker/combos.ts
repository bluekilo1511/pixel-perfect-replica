// Pure rules for "môn tổ hợp" — combination subjects like KHTN (Vật lí + Hoá học +
// Sinh học) or LSĐL (Lịch sử + Địa lí).
// In Cấp 2 (THCS, Thông tư 22): KHTN and LS&ĐL are integrated subjects containing
// 4 formative assessment columns (TX) covering the subdisciplines together, plus GK & CK.
import { type AppData, SUBJECTS_MAX } from "./model";
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

// ---------------------------------------------------------------------------
// Secondary School (Cấp 2 / THCS - Thông tư 22) Integrated Combo Definitions
// ---------------------------------------------------------------------------

export interface SubDisciplineConfig {
  name: string;
  short: string;
  aliases: string[];
  badge: string;
  color: "blue" | "emerald" | "amber" | "purple" | "orange" | "teal";
}

export interface Cap2SubjectConfig {
  key: "KHTN" | "LSDL";
  name: string;
  aliases: string[];
  subDisciplines: SubDisciplineConfig[];
  targetTxCount: number;
  defaultColumns: {
    title: string;
    sub: string;
  }[];
}

export const CAP2_SUBJECT_CONFIGS: Record<"KHTN" | "LSDL", Cap2SubjectConfig> = {
  KHTN: {
    key: "KHTN",
    name: "KHTN",
    aliases: [
      "khtn",
      "khoa học tự nhiên",
      "khoa hoc tu nhien",
      "khtn cấp 2",
      "khoa học tn",
      "khoa hoc tn",
    ],
    targetTxCount: 4,
    subDisciplines: [
      {
        name: "Vật lí",
        short: "Lí",
        aliases: ["lí", "lý", "vật lí", "vật lý", "vat li", "vat ly", "phy", "physics"],
        badge: "🔵 Lí",
        color: "blue",
      },
      {
        name: "Hoá học",
        short: "Hóa",
        aliases: ["hóa", "hoá", "hóa học", "hoá học", "hoa", "hoa hoc", "chem", "chemistry"],
        badge: "🟢 Hóa",
        color: "emerald",
      },
      {
        name: "Sinh học",
        short: "Sinh",
        aliases: ["sinh", "sinh học", "sinh hoc", "bio", "biology"],
        badge: "🟡 Sinh",
        color: "amber",
      },
      {
        name: "Đánh giá chung",
        short: "Chung",
        aliases: ["chung", "thực hành", "thuc hanh", "tổng hợp", "tong hop", "đề án", "de an"],
        badge: "🟣 Chung",
        color: "purple",
      },
    ],
    defaultColumns: [
      { title: "Vật lí", sub: "Lí" },
      { title: "Hoá học", sub: "Hóa" },
      { title: "Sinh học", sub: "Sinh" },
      { title: "Đánh giá chung", sub: "Chung" },
    ],
  },
  LSDL: {
    key: "LSDL",
    name: "LS&ĐL",
    aliases: [
      "ls&đl",
      "lsđl",
      "ls&dl",
      "lsdl",
      "lịch sử và địa lí",
      "lịch sử và địa lý",
      "lịch sử & địa lí",
      "lịch sử & địa lý",
      "lich su va dia li",
      "lich su va dia ly",
      "sử địa",
      "su dia",
      "sử & địa",
      "su & dia",
    ],
    targetTxCount: 4,
    subDisciplines: [
      {
        name: "Lịch sử",
        short: "Sử",
        aliases: ["sử", "lịch sử", "su", "lich su", "history"],
        badge: "🟠 Sử",
        color: "orange",
      },
      {
        name: "Địa lí",
        short: "Địa",
        aliases: ["địa", "địa lý", "địa lí", "dia", "dia ly", "dia li", "geography"],
        badge: "🌐 Địa",
        color: "teal",
      },
    ],
    defaultColumns: [
      { title: "Lịch sử (TX1)", sub: "Sử" },
      { title: "Lịch sử (TX2)", sub: "Sử" },
      { title: "Địa lí (TX1)", sub: "Địa" },
      { title: "Địa lí (TX2)", sub: "Địa" },
    ],
  },
};

/** Checks if a subject name corresponds to a Cấp 2 integrated combo subject (KHTN or LS&ĐL). */
export function matchCap2Config(subjectName: string): Cap2SubjectConfig | null {
  if (!subjectName) return null;
  const s = subjectName.trim().toLowerCase();
  for (const cfg of Object.values(CAP2_SUBJECT_CONFIGS)) {
    if (cfg.aliases.some((a) => a.toLowerCase() === s)) return cfg;
  }
  return null;
}

/** Detects which subdiscipline a text label (column title or note) refers to. */
/** Detects which subdiscipline a text label (column title, note or subject name) refers to. */
export function detectSubDiscipline(
  cfg: Cap2SubjectConfig,
  text: string,
): SubDisciplineConfig | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();

  // 1. Exact match against any alias
  for (const sub of cfg.subDisciplines) {
    if (sub.aliases.some((a) => t === a.toLowerCase())) {
      return sub;
    }
  }

  // 2. Token / word boundary match
  const tokens = t.split(/[\s()[\]:,_\-]+/).filter(Boolean);
  for (const sub of cfg.subDisciplines) {
    for (const a of sub.aliases) {
      const aLower = a.toLowerCase();
      if (aLower.includes(" ")) {
        if (t.includes(aLower)) return sub;
      } else {
        if (tokens.includes(aLower)) {
          // If checking KHTN, avoid matching "lí" in "địa lí" or "địa lý"
          if (cfg.key === "KHTN" && (tokens.includes("địa") || t.includes("địa lí") || t.includes("địa lý"))) {
            continue;
          }
          return sub;
        }
      }
    }
  }

  return null;
}

/** Checks if a subject name corresponds to a Cấp 2 subdiscipline of KHTN or LS&ĐL (excluding the combo itself). */
export function getCap2ParentConfig(
  subjectName: string,
): { config: Cap2SubjectConfig; sub: SubDisciplineConfig } | null {
  if (!subjectName) return null;
  // If it matches the combo itself, it is NOT a subdiscipline
  if (matchCap2Config(subjectName)) return null;

  for (const cfg of Object.values(CAP2_SUBJECT_CONFIGS)) {
    const sub = detectSubDiscipline(cfg, subjectName);
    if (sub) {
      return { config: cfg, sub };
    }
  }
  return null;
}

/** True when subjectName is an individual subdiscipline of KHTN or LS&ĐL (e.g. Lí, Hóa, Sinh, Sử, Địa). */
export function isCap2Subdiscipline(subjectName: string): boolean {
  return getCap2ParentConfig(subjectName) !== null;
}

export interface DetectedCap2Merge {
  targetSubject: string;
  config: Cap2SubjectConfig;
  orphanSubjects: string[];
}

/** Detects if the user has standalone subdiscipline subjects alongside KHTN or LS&ĐL. */
export const STANDARD_CAP2_SUBJECTS = [
  "Toán",
  "Ngữ văn",
  "Tiếng Anh",
  "KHTN",
  "LS&ĐL",
  "GDCD",
  "Tin học",
  "Công nghệ",
];

export function seedCap2Subjects(data: AppData): AppData {
  const existingLower = data.subjects.map((s) => s.trim().toLowerCase());
  const toAdd = STANDARD_CAP2_SUBJECTS.filter((s) => !existingLower.includes(s.toLowerCase()));
  if (toAdd.length === 0) return data;
  return {
    ...data,
    subjects: [...data.subjects, ...toAdd].slice(0, SUBJECTS_MAX),
  };
}

/** Detects if the user has standalone subdiscipline subjects alongside KHTN or LS&ĐL. */
export function detectCap2Merges(
  data: Pick<AppData, "subjects">,
  allSubjectNames: string[] = [],
): DetectedCap2Merge[] {
  const allNames = Array.from(
    new Set([...data.subjects, ...allSubjectNames.map((s) => s.trim())]),
  ).filter(Boolean);
  const results: DetectedCap2Merge[] = [];

  for (const cfg of Object.values(CAP2_SUBJECT_CONFIGS)) {
    const existingTarget = allNames.find((n) =>
      cfg.aliases.some((a) => a.toLowerCase() === n.trim().toLowerCase()),
    );
    const target = existingTarget || cfg.name;

    const orphans = allNames.filter((n) => {
      const lower = n.trim().toLowerCase();
      if (lower === target.trim().toLowerCase()) return false;
      if (existingTarget && lower === existingTarget.trim().toLowerCase()) return false;
      return cfg.subDisciplines.some((sub) =>
        sub.aliases.some((a) => a.toLowerCase() === lower),
      );
    });

    if (orphans.length > 0) {
      results.push({
        targetSubject: target,
        config: cfg,
        orphanSubjects: orphans,
      });
    }
  }

  return results;
}

/** Merges orphan sub-discipline subjects into their Cấp 2 integrated target subject. */
export function mergeCap2Integrated(
  data: AppData,
  merge: DetectedCap2Merge,
  options: { keepSubdisciplines?: boolean } = {},
): AppData {
  const { targetSubject, config, orphanSubjects } = merge;
  const orphanLowers = orphanSubjects.map((s) => s.trim().toLowerCase());
  const targetLower = targetSubject.trim().toLowerCase();
  const keep = !!options.keepSubdisciplines;

  // Ensure target is in subjects. If keepSubdisciplines is true, keep orphans for learning & timers!
  const filteredSubjects = keep
    ? data.subjects
    : data.subjects.filter((s) => !orphanLowers.includes(s.trim().toLowerCase()));

  const nextSubjects = filteredSubjects.concat(
    filteredSubjects.some((s) => s.trim().toLowerCase() === targetLower) ? [] : [targetSubject],
  );

  // Migrate gradeBook entries
  const nextGradeBook = data.gradeBook.map((entry) => {
    const entrySubLower = entry.subject.trim().toLowerCase();
    if (!orphanLowers.includes(entrySubLower)) return entry;

    const matchedOrphan = orphanSubjects.find(
      (o) => o.trim().toLowerCase() === entrySubLower,
    );
    const subMeta = matchedOrphan
      ? detectSubDiscipline(config, matchedOrphan)
      : null;
    const tag = subMeta ? subMeta.short : matchedOrphan || "";

    const existingTitle = (entry.title || "").trim();
    const hasTagAlready = tag && existingTitle.toLowerCase().includes(tag.toLowerCase());
    const nextTitle = hasTagAlready
      ? existingTitle
      : existingTitle
        ? `${existingTitle} (${tag})`
        : tag;

    return {
      ...entry,
      subject: targetSubject,
      title: nextTitle.slice(0, 30),
    };
  });

  // Migrate gradeExtras
  const nextGradeExtras = data.gradeExtras.map((extra) => {
    const extraSubLower = extra.subject.trim().toLowerCase();
    if (!orphanLowers.includes(extraSubLower)) return extra;
    const matchedOrphan = orphanSubjects.find(
      (o) => o.trim().toLowerCase() === extraSubLower,
    );
    const label = (extra.label || "").trim();
    const nextLabel = matchedOrphan && !label.toLowerCase().includes(matchedOrphan.toLowerCase())
      ? `${label} (${matchedOrphan})`
      : label;

    return {
      ...extra,
      subject: targetSubject,
      label: nextLabel.slice(0, 60),
    };
  });

  // Migrate tasks only if keepSubdisciplines is false
  const nextTasks = keep
    ? data.tasks
    : data.tasks.map((task) => {
        if (!task.subject) return task;
        if (orphanLowers.includes(task.subject.trim().toLowerCase())) {
          return { ...task, subject: targetSubject };
        }
        return task;
      });

  // Clean subjectCombos: remove orphan subjects, and remove target from combos if it was one
  const nextCombos = { ...(data.subjectCombos ?? {}) };
  delete nextCombos[targetSubject];
  for (const orphan of orphanSubjects) {
    delete nextCombos[orphan];
  }
  for (const [key, members] of Object.entries(nextCombos)) {
    nextCombos[key] = members.filter((m) => !orphanLowers.includes(m.trim().toLowerCase()));
    if (nextCombos[key].length < COMBO_MEMBERS_MIN) {
      delete nextCombos[key];
    }
  }

  // Migrate targets
  const nextTargets = { ...data.gradeTargets };
  if (nextTargets[targetSubject] === undefined) {
    for (const orphan of orphanSubjects) {
      if (nextTargets[orphan] !== undefined) {
        nextTargets[targetSubject] = nextTargets[orphan];
        break;
      }
    }
  }
  for (const orphan of orphanSubjects) {
    delete nextTargets[orphan];
  }

  // Migrate notes
  const nextNotes = { ...data.subjectNotes };
  const targetNote = nextNotes[targetSubject] ?? { note: "", topics: [] };
  const combinedTopics = [...(targetNote.topics ?? [])];
  for (const orphan of orphanSubjects) {
    const orphanNote = nextNotes[orphan];
    if (orphanNote) {
      for (const t of orphanNote.topics ?? []) {
        if (!combinedTopics.some((x) => x.name.toLowerCase() === t.name.toLowerCase())) {
          combinedTopics.push(t);
        }
      }
      delete nextNotes[orphan];
    }
  }
  if (nextNotes[targetSubject] || combinedTopics.length > 0) {
    nextNotes[targetSubject] = {
      note: targetNote.note || "",
      topics: combinedTopics.slice(0, 16),
    };
  }

  return {
    ...data,
    subjects: nextSubjects,
    gradeBook: nextGradeBook,
    gradeExtras: nextGradeExtras,
    tasks: nextTasks,
    subjectCombos: nextCombos,
    gradeTargets: nextTargets,
    subjectNotes: nextNotes,
  };
}

/** Merges all detected Cấp 2 combination subjects in one step. */
export function mergeAllCap2(
  data: AppData,
  allSubjectNames: string[] = [],
  options: { keepSubdisciplines?: boolean } = {},
): AppData {
  let current = data;
  const merges = detectCap2Merges(current, allSubjectNames);
  for (const m of merges) {
    current = mergeCap2Integrated(current, m, options);
  }
  return current;
}
