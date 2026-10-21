// Pure weekly-summary logic for the Today panel (no browser APIs, so it is testable).
import type { AppData } from "./model";
import { emptyDay } from "./extras";

export interface WeekTotals {
  focusMin: number;
  tasks: number;
  pomodoros: number;
  activeDays: number;
}

export interface SubjectTotal {
  label: string;
  minutes: number;
}

export interface WeekSummary {
  weekStart: string; // Monday, YYYY-MM-DD
  label: string;
  thisWeek: WeekTotals;
  lastWeek: WeekTotals;
  diffMin: number; // thisWeek.focusMin - lastWeek.focusMin
  diffPct: number | null; // % change in focus minutes vs last week (null when last week was 0)
  diffTasks: number; // thisWeek.tasks - lastWeek.tasks
  diffDays: number; // thisWeek.activeDays - lastWeek.activeDays
  bestDay: { date: string; focusMin: number } | null;
  topSubjects: SubjectTotal[]; // up to 3 subjects by focus minutes this week
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

  // Focus minutes per subject: completed timed tasks this week, grouped by title.
  const weekDates = new Set<string>(Array.from({ length: 7 }, (_, i) => shiftDays(weekStart, i)));
  const byLabel = new Map<string, number>();
  for (const t of data.tasks) {
    if (!t.completed || !(t.minutes > 0) || !weekDates.has(t.date)) continue;
    const label = t.title.replace(/\s*\(\d+\s*phút\)\s*$/, "").trim() || "Việc hoàn thành";
    byLabel.set(label, (byLabel.get(label) ?? 0) + t.minutes);
  }
  const topSubjects: SubjectTotal[] = [...byLabel.entries()]
    .map(([subj, minutes]) => ({ label: subj, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label))
    .slice(0, 3);

  return {
    weekStart,
    label,
    thisWeek,
    lastWeek,
    diffMin: thisWeek.focusMin - lastWeek.focusMin,
    diffPct:
      lastWeek.focusMin > 0
        ? Math.round(((thisWeek.focusMin - lastWeek.focusMin) / lastWeek.focusMin) * 100)
        : null,
    diffTasks: thisWeek.tasks - lastWeek.tasks,
    diffDays: thisWeek.activeDays - lastWeek.activeDays,
    bestDay,
    topSubjects,
  };
}
