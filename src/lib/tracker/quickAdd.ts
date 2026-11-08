// Pure rules for quick-add and natural-language capture. No browser APIs here, so it is testable.
import type { PriorityLevel } from "./model";

export interface QuickAddParsed {
  title: string;
  minutes: number | null; // duration typed in text, e.g. "25p", "1h", "2 tiếng"
  priority?: PriorityLevel; // "!1".."!4" or "p1".."p4"
  timeRange?: string; // e.g. "20:30", "08:15"
  dateOffsetDays?: number; // 0 for today, 1 for tomorrow ("mai", "ngày mai")
}

const PRIORITY_RE = /(?:^|\s)(?:!([1-4])|[pP]([1-4]))(?=\s|$)/;
const TIME_RE = /(?:^|\s)([01]?\d|2[0-3])(?:h([0-5]\d)|:([0-5]\d)|h)(?=\s|$)/i;
const DURATION_MINUTE_RE = /(\d{1,3})\s*(?:p|phut|phút)(?=\s|$)/i;
const DURATION_HOUR_RE = /(?:^|\s)(\d+(?:\.\d+)?)\s*(?:tiếng|giờ)(?=\s|$)/i;
const DATE_RE = /(?:^|\s)(ngày\s+mai|mai|hôm\s+nay)(?=\s|$)/i;

/**
 * Natural language task quick capture:
 * - "Học Toán 25p !1" -> title "Học Toán", minutes 25, priority "p1"
 * - "Ôn Sử 2 tiếng mai p2 20h30" -> title "Ôn Sử", minutes 120, priority "p2", dateOffsetDays 1, timeRange "20:30"
 *
 * Backward-compatible: If no extra metadata is typed, returns only { title, minutes }.
 * Subjects attach by title match, preserving multi-word titles like "#Tiếng Anh".
 */
export function parseQuickAdd(text: string): QuickAddParsed {
  let raw = text.trim();

  // 1. Priority: !1..4 or p1..4
  let priority: PriorityLevel | undefined;
  const prioMatch = raw.match(PRIORITY_RE);
  if (prioMatch && prioMatch.index !== undefined) {
    const num = prioMatch[1] ?? prioMatch[2];
    if (num === "1") priority = "p1";
    else if (num === "2") priority = "p2";
    else if (num === "3") priority = "p3";
    else if (num === "4") priority = "p4";
    raw = raw.slice(0, prioMatch.index) + " " + raw.slice(prioMatch.index + prioMatch[0].length);
  }

  // 2. Date: "mai" / "ngày mai" (+1) or "hôm nay" (0)
  let dateOffsetDays: number | undefined;
  const dateMatch = raw.match(DATE_RE);
  if (dateMatch && dateMatch.index !== undefined) {
    const kw = dateMatch[1].toLowerCase().replace(/\s+/g, " ");
    if (kw === "mai" || kw === "ngày mai") {
      dateOffsetDays = 1;
    } else if (kw === "hôm nay") {
      dateOffsetDays = 0;
    }
    raw = raw.slice(0, dateMatch.index) + " " + raw.slice(dateMatch.index + dateMatch[0].length);
  }

  // 3. Time: 20h30, 20:30, 8h
  let timeRange: string | undefined;
  const timeMatch = raw.match(TIME_RE);
  if (timeMatch && timeMatch.index !== undefined) {
    const h = parseInt(timeMatch[1], 10);
    const mStr = timeMatch[2] ?? timeMatch[3];
    const m = mStr !== undefined ? parseInt(mStr, 10) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      timeRange = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    raw = raw.slice(0, timeMatch.index) + " " + raw.slice(timeMatch.index + timeMatch[0].length);
  }

  // 4. Duration: 25p, 15 phút, 1 giờ, 2 tiếng
  let minutes: number | null = null;
  const minMatch = raw.match(DURATION_MINUTE_RE);
  const hourMatch = raw.match(DURATION_HOUR_RE);

  if (minMatch && minMatch.index !== undefined) {
    minutes = Math.max(0, Math.min(600, Math.round(Number(minMatch[1]))));
    raw = raw.slice(0, minMatch.index) + " " + raw.slice(minMatch.index + minMatch[0].length);
  } else if (hourMatch && hourMatch.index !== undefined) {
    minutes = Math.max(0, Math.min(600, Math.round(Number(hourMatch[1]) * 60)));
    raw = raw.slice(0, hourMatch.index) + " " + raw.slice(hourMatch.index + hourMatch[0].length);
  }

  const cleanTitle = raw.replace(/\s+/g, " ").trim();
  const title = cleanTitle || "Nhiệm vụ";

  const result: QuickAddParsed = { title, minutes };
  if (priority !== undefined) result.priority = priority;
  if (timeRange !== undefined) result.timeRange = timeRange;
  if (dateOffsetDays !== undefined) result.dateOffsetDays = dateOffsetDays;
  return result;
}
