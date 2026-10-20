// Pure weekly-summary logic for the Today panel (no browser APIs, so it is testable).
import type { AppData } from "./model";
import { emptyDay } from "./extras";

export interface WeekTotals {
  focusMin: number;
  tasks: number;
  pomodoros: number;
  activeDays: number;
}

export interface WeekSummary {
  weekStart: string; // Monday, YYYY-MM-DD
  label: string;
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
  diffMin: number; // thisWeek.focusMin - lastWeek.focusMin
  bestDay: { date: string; focusMin: number } | null;
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Monday (00:00 local) of the week containing d. */
export function mondayOf(d: Date): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return fmtDate(monday);
}

const shiftDays = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return fmtDate(new Date(y, m - 1, d + n));
};

function totalsFor(data: AppData, start: string): WeekTotals {
  const totals = emptyDay();
  let activeDays = 0;
  for (let i = 0; i < 7; i++) {
    const s = data.dailyStats[shiftDays(start, i)];
    if (!s) continue;
    totals.focusMin += s.focusMin;
    totals.tasks += s.tasks;
    totals.pomodoros += s.pomodoros;
    if (s.tasks > 0 || s.focusMin > 0) activeDays++;
  }
  return {
    focusMin: totals.focusMin,
    tasks: totals.tasks,
    pomodoros: totals.pomodoros,
    activeDays,
  };
}

/** Aggregates this week vs last week from dailyStats. Weeks start on Monday. Never throws on odd data. */
export function weekSummary(data: AppData, now = new Date()): WeekSummary {
  const weekStart = mondayOf(now);
  const thisWeek = totalsFor(data, weekStart);
  const lastWeek = totalsFor(data, shiftDays(weekStart, -7));
  let bestDay: { date: string; focusMin: number } | null = null;
  for (let i = 0; i < 7; i++) {
    const date = shiftDays(weekStart, i);
    const focusMin = data.dailyStats[date]?.focusMin ?? 0;
    if (focusMin > 0 && (!bestDay || focusMin > bestDay.focusMin)) bestDay = { date, focusMin };
  }
  const label = `Tuần ${weekStart.slice(5)} → ${shiftDays(weekStart, 6).slice(5)}`;
  return {
    weekStart,
    label,
    thisWeek,
    lastWeek,
    diffMin: thisWeek.focusMin - lastWeek.focusMin,
    bestDay,
  };
}
