/** Study-mode presets: one switch retunes the app for exam cramming or rest days.
 * Pure helpers only — no browser APIs, so it stays testable. */

export type StudyMode = "normal" | "exam" | "rest";

export interface StudyModeMeta {
  key: StudyMode;
  emoji: string;
  label: string;
  desc: string;
}

export const STUDY_MODES: readonly StudyModeMeta[] = [
  {
    key: "normal",
    emoji: "🌿",
    label: "Thường",
    desc: "Đầy đủ quest, boss tuần và mọi mục — chế độ mặc định.",
  },
  {
    key: "exam",
    emoji: "🎯",
    label: "Ôn thi",
    desc: "Ẩn quest/boss để bớt phân tán; sổ điểm, flashcard và kỳ thi vẫn nguyên.",
  },
  {
    key: "rest",
    emoji: "🌙",
    label: "Nghỉ",
    desc: "Ẩn quest/boss, hiện widget thở — ngày nghỉ không đổ lỗi bằng nhiệm vụ.",
  },
];

const KEYS: readonly string[] = STUDY_MODES.map((m) => m.key);

/** Safe on legacy/unknown values from old backup files. */
export function normalizeStudyMode(v: unknown): StudyMode {
  return KEYS.includes(v as string) ? (v as StudyMode) : "normal";
}

/** Quests, raid boss and other gamified cards stay only in the normal mode. */
export function gamifyHidden(mode: StudyMode): boolean {
  return mode !== "normal";
}

export function modeMeta(mode: StudyMode): StudyModeMeta {
  return STUDY_MODES.find((m) => m.key === mode) ?? STUDY_MODES[0]!;
}
