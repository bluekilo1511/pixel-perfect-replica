// Read-only summary of a friend's exported backup JSON. Never mutates the caller's data.
import { migrate } from "./model";
import { SPECIES, type Species } from "./gamify";

export interface FriendSummary {
  ok: true;
  updatedAt: string | null;
  level: number;
  xp: number;
  streakNow: number;
  streakBest: number;
  lifetimeTasks: number;
  lifetimeFocusMin: number;
  lifetimePomodoros: number;
  catCoins: number;
  lizardGems: number;
  petLabel: string;
  tasksCompleted: number; // completed task records inside the file
  activeDays: number; // days with any task or focus minutes
}

export type FriendParseResult = FriendSummary | { ok: false; error: string };

/** Validates a pasted backup file and returns a read-only digest, or a friendly error. */
export function summarizeFriend(raw: unknown): FriendParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Nội dung không phải JSON hợp lệ của app." };
  }
  const r = raw as Record<string, unknown>;
  if (r["app"] !== "local-task-tracker-pro" && !Array.isArray(r["tasks"])) {
    return { ok: false, error: "File này không giống file sao lưu của Task Tracker Pro." };
  }
  const d = migrate(raw);
  const life = d.achievements.lifetime;
  const activeDays = Object.values(d.dailyStats).filter((s) => s.tasks > 0 || s.focusMin > 0).length;
  const s = SPECIES[d.petState.species as Species] ?? SPECIES.cat;
  return {
    ok: true,
    updatedAt: typeof r["updatedAt"] === "string" ? r["updatedAt"] : null,
    level: d.game.level,
    xp: d.game.xp,
    streakNow: d.streak.count,
    streakBest: d.streak.best,
    lifetimeTasks: life.tasks,
    lifetimeFocusMin: life.focusMin,
    lifetimePomodoros: life.pomodoros,
    catCoins: d.game.catCoins,
    lizardGems: d.game.lizardGems,
    petLabel: `${s.emoji} ${s.name} Lv.${Math.max(1, d.petState.petLevel)}`,
    tasksCompleted: d.tasks.filter((t) => t.completed).length,
    activeDays,
  };
}
