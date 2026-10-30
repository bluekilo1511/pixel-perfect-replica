// Read-only summary of a friend's exported backup JSON. Never mutates the caller's data.
import { migrate, type AppData } from "./model";
import { SPECIES, type Species } from "./gamify";

/** Evolved forms per species/tier, duplicated here so friend files render without extras. */
const TIER_FORM_SAFE = {
  cat: ["🐱", "😼", "🐈‍⬛"],
  lizard: ["🦎", "🦖", "🐉"],
  dog: ["🐶", "🐕", "🐺"],
  owl: ["🦉", "🦉", "🦅"],
  whale: ["🐳", "🐳", "🐋"],
} as const;

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
  name?: string | null; // display name from a share file
  last7?: ShareDay[]; // last-7-day focus from a share file
}

export type FriendParseResult = FriendSummary | { ok: false; error: string };

/** Validates a pasted backup file and returns a read-only digest, or a friendly error. */
export function summarizeFriend(raw: unknown): FriendParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Nội dung không phải JSON hợp lệ của app." };
  }
  const r = raw as Record<string, unknown>;
  if (r["app"] === "tpp-share") {
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
    const last7 = Array.isArray(r["last7"])
      ? (r["last7"] as unknown[]).filter(
          (x): x is ShareDay =>
            !!x && typeof x === "object" && typeof (x as Record<string, unknown>).date === "string",
        )
      : [];
    return {
      ok: true,
      updatedAt: typeof r["exportedAt"] === "string" ? (r["exportedAt"] as string) : null,
      level: num(r["level"]),
      xp: 0,
      streakNow: num(r["streakNow"]),
      streakBest: num(r["streakBest"]),
      lifetimeTasks: num(r["lifetimeTasks"]),
      lifetimeFocusMin: num(r["lifetimeFocusMin"]),
      lifetimePomodoros: num(r["lifetimePomodoros"]),
      catCoins: 0,
      lizardGems: 0,
      petLabel: typeof r["petLabel"] === "string" ? (r["petLabel"] as string) : "🐾 Bạn bè",
      tasksCompleted: num(r["lifetimeTasks"]),
      activeDays: num(r["activeDays"]),
      name: typeof r["name"] === "string" && r["name"].trim() ? (r["name"] as string) : null,
      last7,
    };
  }
  if (r["app"] !== "local-task-tracker-pro" && !Array.isArray(r["tasks"])) {
    return { ok: false, error: "File này không giống file sao lưu của Task Tracker Pro." };
  }
  const d = migrate(raw);
  const life = d.achievements.lifetime;
  const activeDays = Object.values(d.dailyStats).filter(
    (s) => s.tasks > 0 || s.focusMin > 0,
  ).length;
  const sp = (d.petState.species as Species) in SPECIES ? (d.petState.species as Species) : "cat";
  const s = SPECIES[sp];
  const lvl = Math.max(1, Number(d.petState.petLevel) || 1);
  const tier = lvl >= 6 ? 2 : lvl >= 3 ? 1 : 0;
  const emoji = TIER_FORM_SAFE[sp][tier];
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
    petLabel: `${emoji} ${s.name} Lv.${lvl}`,
    tasksCompleted: d.tasks.filter((t) => t.completed).length,
    activeDays,
  };
}

// ---- View-only share file ----
// A slim, non-importable JSON: only study stats, never grades/journal/notes.
// The app refuses to load it as backup data (the store checks app === "tpp-share").
export interface ShareDay {
  date: string; // YYYY-MM-DD
  focusMin: number;
  tasks: number;
}

export interface SharePayload {
  app: "tpp-share";
  version: 1;
  exportedAt: string;
  name: string | null;
  level: number;
  streakNow: number;
  streakBest: number;
  lifetimeTasks: number;
  lifetimeFocusMin: number;
  lifetimePomodoros: number;
  petLabel: string;
  activeDays: number;
  last7: ShareDay[];
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Builds the share payload for a friend. Contains no grades, journal or notes. */
export function exportShare(data: AppData, now = new Date()): SharePayload {
  const life = data.achievements.lifetime;
  const activeDays = Object.values(data.dailyStats).filter(
    (s) => s.tasks > 0 || s.focusMin > 0,
  ).length;
  const sp =
    (data.petState.species as Species) in SPECIES ? (data.petState.species as Species) : "cat";
  const lvl = Math.max(1, Number(data.petState.petLevel) || 1);
  const tier = lvl >= 6 ? 2 : lvl >= 3 ? 1 : 0;
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    const key = dayKey(d);
    const s = data.dailyStats[key];
    return { date: key, focusMin: s?.focusMin ?? 0, tasks: s?.tasks ?? 0 };
  });
  return {
    app: "tpp-share",
    version: 1,
    exportedAt: now.toISOString(),
    name: data.ownerName?.trim() || null,
    level: data.game.level,
    streakNow: data.streak.count,
    streakBest: data.streak.best,
    lifetimeTasks: life.tasks,
    lifetimeFocusMin: life.focusMin,
    lifetimePomodoros: life.pomodoros,
    petLabel: `${TIER_FORM_SAFE[sp][tier]} ${SPECIES[sp].name} Lv.${lvl}`,
    activeDays,
    last7,
  };
}
