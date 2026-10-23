// Pure rules for exam events and countdowns. No browser APIs here, so it is testable.

export interface ExamEvent {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  buoi?: string; // "Sáng" | "Chiều" | "" (optional session, Vietnamese school style)
  gioBatDau?: string; // "07:30" (optional start time)
  thoiGian?: string; // free text, e.g. "90 phút" (optional duration)
  khoi?: string; // free text, e.g. "8, 9" (optional grade)
}

export const defaultExams = (): ExamEvent[] => [];

let examSeq = 0;
export const newExamId = () => `exam_${Date.now().toString(36)}_${(examSeq++).toString(36)}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;
const capStr = (v: unknown, max: number): string | undefined => {
  if (typeof v !== "string") return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};

/** Parses Vietnamese "dd/mm/yyyy" (also dd-mm-yyyy, dd.mm.yyyy, dd/mm/yy) into YYYY-MM-DD. */
export function parseDateVN(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (DATE_RE.test(t)) return t;
  const m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d ? iso : null;
}

/** Formats YYYY-MM-DD as Vietnamese "dd/mm/yyyy" ("" when the input is not ISO). */
export function formatDateVN(iso: string): string {
  const m = iso.match(DATE_RE);
  if (!m) return "";
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
}

/** Accepts old/new JSON and keeps only well-formed exam events. */
export function normalizeExams(raw: unknown): ExamEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => !!e && typeof e === "object")
    .map((e): ExamEvent | null => {
      const r = e as {
        id?: unknown;
        name?: unknown;
        date?: unknown;
        buoi?: unknown;
        gioBatDau?: unknown;
        thoiGian?: unknown;
        khoi?: unknown;
      };
      const date = typeof r.date === "string" && DATE_RE.test(r.date) ? r.date : "";
      if (date === "") return null;
      const out: ExamEvent = {
        id: typeof r.id === "string" && r.id ? r.id : newExamId(),
        name: String(r.name ?? "Kỳ thi"),
        date,
      };
      const buoi = capStr(r.buoi, 8);
      const thoiGian = capStr(r.thoiGian, 20);
      const khoi = capStr(r.khoi, 20);
      const time =
        typeof r.gioBatDau === "string" && TIME_RE.test(r.gioBatDau.trim())
          ? r.gioBatDau.trim()
          : "";
      if (buoi) out.buoi = buoi;
      if (time) out.gioBatDau = time;
      if (thoiGian) out.thoiGian = thoiGian;
      if (khoi) out.khoi = khoi;
      return out;
    })
    .filter((e): e is ExamEvent => e !== null);
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

// ---- Exam scores (per subject) ----

export interface ExamScore {
  id: string;
  subject: string;
  title: string; // optional label like "giữa kỳ", "" when none
  date: string; // YYYY-MM-DD
  score: number;
  max: number;
  createdAt: string;
}

export const SCORES_MAX = 60;
export const TREND_RATIO = 0.8; // two scores below 80% of max in a row = needs focus

export function normalizeExamScores(raw: unknown): ExamScore[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, SCORES_MAX)
    .filter((e) => !!e && typeof e === "object")
    .map((e): ExamScore | null => {
      const r = e as Record<string, unknown>;
      const score = Number(r.score);
      const max = Number(r.max);
      const subject = String(r.subject ?? "")
        .trim()
        .slice(0, 24);
      if (!subject || !Number.isFinite(score) || score < 0) return null;
      const capped = Math.min(score, Number.isFinite(max) && max > 0 ? max : 10);
      return {
        id: typeof r.id === "string" && r.id ? r.id : newExamId(),
        subject,
        title: typeof r.title === "string" ? r.title.trim().slice(0, 40) : "",
        date: typeof r.date === "string" && DATE_RE.test(r.date) ? r.date : "",
        score: capped,
        max: Number.isFinite(max) && max > 0 ? max : 10,
        createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date().toISOString(),
      };
    })
    .filter((s): s is ExamScore => s !== null);
}

/** Appends a score. Returns null on a bad subject, score out of range, or a full list. */
export function addExamScore(
  list: ExamScore[],
  input: { subject: string; score: number; max?: number; title?: string; date?: string },
): ExamScore[] | null {
  const subject = input.subject.trim().slice(0, 24);
  const max = Math.max(1, Math.round(input.max ?? 10));
  const score = Math.round(input.score * 100) / 100;
  if (!subject || !Number.isFinite(score) || score < 0 || score > max) return null;
  if (list.length >= SCORES_MAX) return null;
  const item: ExamScore = {
    id: newExamId(),
    subject,
    title: (input.title ?? "").trim().slice(0, 40),
    date:
      input.date && DATE_RE.test(input.date) ? input.date : new Date().toISOString().slice(0, 10),
    score,
    max,
    createdAt: new Date().toISOString(),
  };
  return [...list, item];
}

export function removeExamScore(list: ExamScore[], id: string): ExamScore[] {
  return list.filter((s) => s.id !== id);
}

/** One subject's scores, oldest first. */
export function subjectScores(scores: ExamScore[], subject: string): ExamScore[] {
  return scores
    .filter((s) => s.subject.toLowerCase() === subject.toLowerCase())
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

/** A warning line when the subject's last two scores sit below TREND_RATIO of max. */
export function needsFocusSubject(scores: ExamScore[], subject: string): string | null {
  const list = subjectScores(scores, subject);
  if (list.length < 2) return null;
  const prev = list[list.length - 2]!;
  const last = list[list.length - 1]!;
  if (prev.score / prev.max < TREND_RATIO && last.score / last.max < TREND_RATIO) {
    return `Hai bài liền dưới ${Math.round(TREND_RATIO * 100)}% — ưu tiên ôn môn này`;
  }
  return null;
}
