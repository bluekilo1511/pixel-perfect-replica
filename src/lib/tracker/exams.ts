// Pure rules for exam events and countdowns. No browser APIs here, so it is testable.

export interface ExamEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
}

export const defaultExams = (): ExamEvent[] => [];

let examSeq = 0;
export const newExamId = () => `exam_${Date.now().toString(36)}_${(examSeq++).toString(36)}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Accepts old/new JSON and keeps only well-formed exam events. */
export function normalizeExams(raw: unknown): ExamEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => !!e && typeof e === "object")
    .map((e) => {
      const r = e as { id?: unknown; name?: unknown; date?: unknown };
      return {
        id: typeof r.id === "string" && r.id ? r.id : newExamId(),
        name: String(r.name ?? "Kỳ thi"),
        date: typeof r.date === "string" && DATE_RE.test(r.date) ? r.date : "",
      };
    })
    .filter((e) => e.date !== "");
}

const utcDay = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** Whole days from `today` until the exam (0 = today, negative = already past). */
export function daysUntil(examDate: string, today: string): number {
  return Math.round((utcDay(examDate) - utcDay(today)) / 86400000);
}

export interface ExamCountdown extends ExamEvent {
  daysLeft: number;
}

/** Upcoming exams (today or later), soonest first. */
export function upcomingExams(exams: ExamEvent[], today: string): ExamCountdown[] {
  return exams
    .map((e) => ({ ...e, daysLeft: daysUntil(e.date, today) }))
    .filter((e) => e.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft || a.date.localeCompare(b.date));
}

export function examLabel(daysLeft: number): string {
  if (daysLeft === 0) return "Hôm nay!";
  if (daysLeft === 1) return "Ngày mai!";
  return `còn ${daysLeft} ngày`;
}
