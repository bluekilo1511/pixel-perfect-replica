// Pure weekly-focus-goal logic for the Today panel (no browser APIs, so it is testable).
import type { AppData } from "./model";
import type { MaterialId } from "./extras";
import { addMaterial } from "./model";
import { mondayOf } from "./weeklyReport";

export interface WeeklyGoalProgress {
  target: number; // focus minutes the user aims for this week (0 = goal hidden)
  done: number; // focus minutes already logged this week
  pct: number; // 0..100
  complete: boolean;
  celebrated: boolean; // reward already claimed for this week
  weekStart: string; // Monday, YYYY-MM-DD
}

const shiftDays = (date: string, n: number): string => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** Focus minutes logged between the week's Monday and Sunday, from dailyStats. */
export function weekFocusMinutes(data: AppData, now = new Date()): number {
  const start = mondayOf(now);
  let done = 0;
  for (let i = 0; i < 7; i++) {
    done += data.dailyStats[shiftDays(start, i)]?.focusMin ?? 0;
  }
  return done;
}

export function weeklyGoalProgress(data: AppData, now = new Date()): WeeklyGoalProgress {
  const target = Math.max(0, Math.round(data.weeklyGoal.minutes));
  const done = weekFocusMinutes(data, now);
  const weekStart = mondayOf(now);
  return {
    target,
    done,
    pct: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
    complete: target > 0 && done >= target,
    celebrated: data.weeklyGoal.celebratedWeek === weekStart,
    weekStart,
  };
}

/** Updates the weekly focus-minute target. 0 hides the goal card. */
export function setWeeklyGoal(data: AppData, minutes: number): AppData {
  return {
    ...data,
    weeklyGoal: {
      minutes: Math.min(10080, Math.max(0, Math.round(minutes))),
      celebratedWeek: data.weeklyGoal.celebratedWeek,
    },
  };
}

export interface WeeklyGoalReward {
  catCoins: number;
  material: string | null; // MaterialId of the bonus drop
}

/** Claims the weekly reward once: +5 cat coins and a random material. Returns null when unavailable. */
export function claimWeeklyGoal(
  data: AppData,
  now = new Date(),
  rng: () => number = Math.random,
): { data: AppData; reward: WeeklyGoalReward } | null {
  const p = weeklyGoalProgress(data, now);
  if (!p.complete || p.celebrated) return null;
  // Pool is every material type, even ones currently at zero in the inventory.
  const materials: MaterialId[] = ["magicFeather", "starShard", "mysticHerb"];
  const material = materials[Math.floor(rng() * materials.length)] ?? null;
  let d: AppData = {
    ...data,
    game: { ...data.game, catCoins: data.game.catCoins + 5 },
    weeklyGoal: { ...data.weeklyGoal, celebratedWeek: p.weekStart },
  };
  if (material) d = addMaterial(d, material, 2);
  return { data: d, reward: { catCoins: 5, material } };
}
