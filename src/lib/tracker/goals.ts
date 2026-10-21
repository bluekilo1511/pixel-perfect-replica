// Pure weekly-goal pinning ("ghim mục tiêu cho cả tuần"). No browser APIs, so it is testable.
import type { AppData } from "./model";

export const WEEK_GOALS_MAX = 6;
export const WEEK_GOAL_TITLE_MAX = 120;

export interface WeekGoal {
  id: string;
  title: string;
  weekStart: string; // Monday, YYYY-MM-DD
  doneAt: string | null; // ISO when the user checked the goal off for this week
  createdAt: string;
}

const newId = () => `wg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

/** Monday of the given date (same rule as weeklyReport.mondayOf, kept local to avoid import cycles). */
export function mondayOf(d: Date): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

/** Accepts any old/new JSON; keeps at most WEEK_GOALS_MAX well-formed rows. */
export function normalizeWeekGoals(raw: unknown): WeekGoal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is Record<string, unknown> => !!g && typeof g === "object")
    .filter(
      (g) =>
        isDate(g["weekStart"]) && typeof g["title"] === "string" && (g["title"] as string).trim(),
    )
    .map((g) => ({
      id: typeof g["id"] === "string" && g["id"].trim() ? g["id"] : newId(),
      title: (g["title"] as string).trim().slice(0, WEEK_GOAL_TITLE_MAX),
      weekStart: g["weekStart"] as string,
      doneAt: isDate(g["doneAt"]) ? g["doneAt"] : null,
      createdAt: typeof g["createdAt"] === "string" ? g["createdAt"] : new Date().toISOString(),
    }))
    .slice(0, WEEK_GOALS_MAX);
}

/** Goals pinned for the week containing `now` (older weeks stay in data but are not shown). */
export function currentWeekGoals(data: AppData, now = new Date()): WeekGoal[] {
  const week = mondayOf(now);
  return data.weekGoals.filter((g) => g.weekStart === week);
}

/** Pins a task's title as a goal for the current week. Null when duplicated, empty or the list is full. */
export function pinTaskAsWeekGoal(data: AppData, taskId: string, now = new Date()): AppData | null {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return null;
  return addWeekGoal(data, task.title, now);
}

/** Adds a custom goal for the current week. Null when duplicated, empty or the list is full. */
export function addWeekGoal(data: AppData, title: string, now = new Date()): AppData | null {
  const clean = title.trim().slice(0, WEEK_GOAL_TITLE_MAX);
  if (!clean) return null;
  const week = mondayOf(now);
  if (
    data.weekGoals.some(
      (g) => g.weekStart === week && g.title.toLowerCase() === clean.toLowerCase(),
    )
  )
    return null;
  const mine = data.weekGoals.filter((g) => g.weekStart === week);
  if (mine.length >= WEEK_GOALS_MAX) return null;
  const goal: WeekGoal = {
    id: newId(),
    title: clean,
    weekStart: week,
    doneAt: null,
    createdAt: now.toISOString(),
  };
  return { ...data, weekGoals: [...data.weekGoals, goal] };
}

/** Checks a week goal off (or back on). */
export function toggleWeekGoalDone(data: AppData, goalId: string, now = new Date()): AppData {
  return {
    ...data,
    weekGoals: data.weekGoals.map((g) =>
      g.id === goalId ? { ...g, doneAt: g.doneAt ? null : now.toISOString() } : g,
    ),
  };
}

export function removeWeekGoal(data: AppData, goalId: string): AppData {
  return { ...data, weekGoals: data.weekGoals.filter((g) => g.id !== goalId) };
}
