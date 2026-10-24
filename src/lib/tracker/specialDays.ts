// Special days: solar Vietnamese holidays and personal birthdays (yours or friends').
// Purely informational — no XP, coins or streak effects, so nothing can be gamed.

export type SpecialDayKind = "holiday" | "birthday";

export interface SpecialDay {
  id: string;
  name: string;
  kind: SpecialDayKind;
  month: number; // 1-12
  day: number; // 1-31
}

export const MAX_SPECIAL_DAYS = 60;

export const DEFAULT_SPECIAL_DAYS: SpecialDay[] = [
  { id: "hol-tetduong", name: "Tết Dương lịch", kind: "holiday", month: 1, day: 1 },
  { id: "hol-phunuqt", name: "Ngày Quốc tế Phụ nữ", kind: "holiday", month: 3, day: 8 },
  { id: "hol-giaiphong", name: "Ngày Giải phóng miền Nam", kind: "holiday", month: 4, day: 30 },
  { id: "hol-laodong", name: "Ngày Quốc tế Lao động", kind: "holiday", month: 5, day: 1 },
  { id: "hol-quockhanh", name: "Ngày Quốc khánh", kind: "holiday", month: 9, day: 2 },
  { id: "hol-phunuvn", name: "Ngày Phụ nữ Việt Nam", kind: "holiday", month: 10, day: 20 },
  { id: "hol-nhagiao", name: "Ngày Nhà giáo Việt Nam", kind: "holiday", month: 11, day: 20 },
  { id: "hol-giangsinh", name: "Ngày Giáng sinh", kind: "holiday", month: 12, day: 24 },
];

/** Validate + clamp a raw special-days list; falls back to the VN defaults. */
export function normalizeSpecialDays(raw: unknown): SpecialDay[] {
  if (!Array.isArray(raw)) return [...DEFAULT_SPECIAL_DAYS];
  const out: SpecialDay[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id.slice(0, 40) : "";
    const name = typeof o.name === "string" ? o.name.trim().slice(0, 40) : "";
    const kind: SpecialDayKind = o.kind === "birthday" ? "birthday" : "holiday";
    const month = Math.round(Number(o.month));
    const day = Math.round(Number(o.day));
    if (!id || !name || seen.has(id)) continue;
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) continue;
    seen.add(id);
    out.push({ id, name, kind, month, day });
    if (out.length >= MAX_SPECIAL_DAYS) break;
  }
  return out;
}

/** Next occurrence of a recurring MM-DD date, at or after `today` (year of `today`). */
export function nextOccurrence(item: SpecialDay, today: Date): Date {
  const y = today.getFullYear();
  const todayDate = new Date(y, today.getMonth(), today.getDate());
  const cand = new Date(y, item.month - 1, item.day);
  if (cand < todayDate) return new Date(y + 1, item.month - 1, item.day);
  return cand;
}

/** Whole days until the next occurrence (0 = today). */
export function daysUntil(item: SpecialDay, today: Date): number {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((nextOccurrence(item, today).getTime() - base.getTime()) / 86400000);
}

/** Items happening today. */
export function specialToday(list: SpecialDay[], today: Date): SpecialDay[] {
  return list.filter((i) => daysUntil(i, today) === 0);
}

export interface UpcomingSpecialDay {
  item: SpecialDay;
  inDays: number;
}

/** Next occurrences within `horizon` days, soonest first. */
export function upcomingSpecialDays(
  list: SpecialDay[],
  today: Date,
  horizon = 30,
): UpcomingSpecialDay[] {
  return list
    .map((item) => ({ item, inDays: daysUntil(item, today) }))
    .filter((x) => x.inDays <= horizon)
    .sort((a, b) => a.inDays - b.inDays || a.item.name.localeCompare(b.item.name, "vi"));
}

export function describeCountdown(inDays: number): string {
  if (inDays <= 0) return "Hôm nay! 🎉";
  if (inDays === 1) return "Ngày mai";
  return `Còn ${inDays} ngày`;
}
