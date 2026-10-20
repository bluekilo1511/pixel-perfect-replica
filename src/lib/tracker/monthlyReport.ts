// Pure monthly-summary logic for the PNG report (no browser APIs, so it is testable).
import type { AppData } from "./model";
import { emptyDay, type DayStats } from "./extras";
import { SPECIES, type Species } from "./gamify";

export interface MonthDayStat {
  date: string; // YYYY-MM-DD
  tasks: number;
  focusMin: number;
  pomodoros: number;
  water: number;
}

export interface MonthSummary {
  year: number;
  month: number; // 1-12
  label: string;
  days: MonthDayStat[]; // every day of the month, in order
  totals: DayStats;
  tasksCompleted: number; // completed task records dated inside the month
  activeDays: number; // days with tasks or focus minutes
  bestDay: { date: string; focusMin: number } | null;
  streakNow: number;
  streakBest: number;
  level: number;
  petLabel: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Every date of a month as YYYY-MM-DD, oldest first. */
export function monthDays(year: number, month: number): string[] {
  const total = new Date(year, month, 0).getDate(); // day 0 of next month = last day
  return Array.from({ length: total }, (_, i) => `${year}-${pad2(month)}-${pad2(i + 1)}`);
}

export function monthLabel(year: number, month: number): string {
  return `Tháng ${month}/${year}`;
}

export function petLabelOf(data: AppData): string {
  const s = SPECIES[data.petState.species as Species] ?? SPECIES.cat;
  return `${s.emoji} ${s.name} Lv.${Math.max(1, data.petState.petLevel)}`;
}

/** Aggregates a month's stats from dailyStats and completed tasks. Never throws on odd data. */
export function monthSummary(data: AppData, year: number, month: number): MonthSummary {
  const days = monthDays(year, month).map((date) => {
    const s = data.dailyStats[date];
    return {
      date,
      tasks: s?.tasks ?? 0,
      focusMin: s?.focusMin ?? 0,
      pomodoros: s?.pomodoros ?? 0,
      water: s?.water ?? 0,
    };
  });
  const totals = emptyDay();
  for (const d of days) {
    totals.tasks += d.tasks;
    totals.focusMin += d.focusMin;
    totals.pomodoros += d.pomodoros;
    totals.water += d.water;
  }
  let best: MonthDayStat | null = null;
  let activeDays = 0;
  for (const d of days) {
    if (d.tasks > 0 || d.focusMin > 0) activeDays++;
    if (d.focusMin > 0 && (!best || d.focusMin > best.focusMin)) best = d;
  }
  const inMonth = new Set(days.map((d) => d.date));
  const tasksCompleted = data.tasks.filter((t) => t.completed && inMonth.has(t.date)).length;
  return {
    year,
    month,
    label: monthLabel(year, month),
    days,
    totals,
    tasksCompleted,
    activeDays,
    bestDay: best ? { date: best.date, focusMin: best.focusMin } : null,
    streakNow: data.streak.count,
    streakBest: data.streak.best,
    level: data.game.level,
    petLabel: petLabelOf(data),
  };
}
