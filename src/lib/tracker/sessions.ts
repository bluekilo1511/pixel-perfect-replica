// Pure golden-hour analytics over the focus-session log (no browser APIs, so it is testable).
import type { SessionEntry, Task } from "./model";

export interface GoldenHours {
  buckets: number[]; // focus minutes per hour 0..23 (local time)
  best: number | null; // hour with the most focus minutes, null when there is no data
  total: number; // total focus minutes inside the window
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Focus minutes by hour-of-day across the last `days` days (today included). */
export function goldenHours(log: SessionEntry[], now = new Date(), days = 14): GoldenHours {
  const fromKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  const buckets: number[] = Array.from({ length: 24 }, () => 0);
  for (const s of log) {
    const at = new Date(s.at);
    if (Number.isNaN(at.getTime()) || dayKey(at) < fromKey) continue;
    buckets[at.getHours()]! += Math.max(0, s.minutes);
  }
  const total = buckets.reduce((a, b) => a + b, 0);
  let best: number | null = null;
  for (let h = 0; h < 24; h++) {
    if (buckets[h]! > 0 && (best === null || buckets[h]! > buckets[best]!)) best = h;
  }
  return { buckets, best, total };
}

/** Session entries finished on the given local day (YYYY-MM-DD), oldest first. */
export function sessionsOn(log: SessionEntry[], date: string): SessionEntry[] {
  return log.filter((s) => {
    const at = new Date(s.at);
    return !Number.isNaN(at.getTime()) && dayKey(at) === date;
  });
}

/** Hours with any focus, best first (ties keep the earlier hour). */
export function topHours(g: GoldenHours, n = 3): number[] {
  const hours = g.buckets.map((v, h) => ({ v, h })).filter((x) => x.v > 0);
  hours.sort((a, b) => b.v - a.v || a.h - b.h);
  return hours.slice(0, n).map((x) => x.h);
}

/**
 * Pairs the golden hour with today's longest unfinished task — "put your hardest
 * task at your best hour". Returns null when either side is missing.
 */
export function goldenSuggestion(
  g: GoldenHours,
  tasks: Task[],
  today: string,
): { hour: number; title: string } | null {
  if (g.best === null || g.total <= 0) return null;
  const open = tasks
    .filter((t) => t.date === today && !t.completed && t.title.trim())
    .sort((a, b) => b.minutes - a.minutes);
  const task = open[0];
  if (!task) return null;
  return { hour: g.best, title: task.title.trim() };
}
