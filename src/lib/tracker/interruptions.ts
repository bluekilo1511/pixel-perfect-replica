// Distraction analytics: how often sessions were paused or the tab was left,
// per day (14-day bar chart) and per hour (the "danger zone" of the day).
import type { AppData } from "./model";

export interface InterruptionDay {
  date: string; // YYYY-MM-DD
  sessions: number; // sessions finished that day
  interruptions: number; // pauses + break-ins attributed to that day
}

export interface InterruptionSummary {
  days: InterruptionDay[]; // oldest first, exactly `days` entries
  total: number;
  worstDay: InterruptionDay | null; // only among days that had interruptions
  worstHour: number | null; // 0..23 with the most logged pauses
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Summarizes pauses and break-ins over the last `days` days (default 14). */
export function interruptionSummary(
  data: AppData,
  now = new Date(),
  days = 14,
): InterruptionSummary {
  const list: InterruptionDay[] = [];
  const byDate = new Map<string, InterruptionDay>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dayKey(d);
    const row: InterruptionDay = { date: key, sessions: 0, interruptions: 0 };
    list.push(row);
    byDate.set(key, row);
  }
  for (const s of data.sessionLog) {
    const row = byDate.get(s.at.slice(0, 10));
    // Interruptions come from interruptionLog only — sessionLog.interruptions
    // mirrors the same pauses (for the unbroken challenge), so counting both
    // would double every event.
    if (row) row.sessions += 1;
  }
  // Break-ins and pause timestamps (stored as ISO strings) count for their day + hour.
  const hours = new Map<number, number>();
  for (const iso of data.interruptionLog) {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    const row = byDate.get(dayKey(t));
    if (row) row.interruptions += 1;
    hours.set(t.getHours(), (hours.get(t.getHours()) ?? 0) + 1);
  }
  const total = list.reduce((n, r) => n + r.interruptions, 0);
  const worstDay =
    list.filter((r) => r.interruptions > 0).sort((a, b) => b.interruptions - a.interruptions)[0] ??
    null;
  let worstHour: number | null = null;
  let best = 0;
  for (const [h, n] of [...hours.entries()].sort((a, b) => a[0] - b[0])) {
    if (n > best) {
      best = n;
      worstHour = h;
    }
  }
  return { days: list, total, worstDay, worstHour };
}
