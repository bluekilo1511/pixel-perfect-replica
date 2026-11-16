import type { AppData, Task } from "./model";
import { dateStr } from "./model";
import type { MaterialId } from "./extras";

export interface VoidReward {
  coins: number;
  xp: number;
  material?: MaterialId | undefined;
}

export interface VoidSacrificeResult {
  ok: boolean;
  reason?: "task-not-found" | "not-stale" | "task-completed";
  data?: AppData;
  reward?: VoidReward;
}

export interface VoidBatchResult {
  ok: boolean;
  count: number;
  data: AppData;
  totalCoins: number;
  totalXp: number;
  materials: MaterialId[];
}

/** Check if a task is stale (overdue from a previous day, not completed, and not pinned). */
export function isTaskStale(task: Task, today: string): boolean {
  if (task.completed || task.pinned) return false;
  return task.date < today;
}

/** Returns all stale tasks eligible for sacrifice to the Void. */
export function getStaleTasks(data: AppData, today: string): Task[] {
  return data.tasks.filter((t) => isTaskStale(t, today));
}

/** Calculate reward for sacrificing a specific task to the Void. */
export function calculateVoidReward(
  task: Task,
  random: () => number = Math.random,
): VoidReward {
  // Base 6 coins, plus 1 coin per 15 minutes of duration (capped at +10)
  const minuteBonus = Math.min(10, Math.floor(task.minutes / 15));
  const coins = 6 + minuteBonus;
  const xp = 15;

  // 40% chance of dropping a material
  const r = random();
  let material: MaterialId | undefined;
  if (r < 0.2) material = "starShard";
  else if (r < 0.32) material = "magicFeather";
  else if (r < 0.4) material = "mysticHerb";

  return { coins, xp, material };
}

/** Sacrifice one stale task to the Void Altar. */
export function sacrificeTask(
  data: AppData,
  taskId: string,
  now: Date = new Date(),
  random: () => number = Math.random,
): VoidSacrificeResult {
  const today = dateStr(now);
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task) return { ok: false, reason: "task-not-found" };
  if (task.completed) return { ok: false, reason: "task-completed" };
  if (!isTaskStale(task, today)) return { ok: false, reason: "not-stale" };

  const reward = calculateVoidReward(task, random);

  const materials = { ...data.inventory.materials };
  if (reward.material) {
    materials[reward.material] = (materials[reward.material] || 0) + 1;
  }

  const next: AppData = {
    ...data,
    tasks: data.tasks.filter((t) => t.id !== taskId),
    game: {
      ...data.game,
      catCoins: data.game.catCoins + reward.coins,
      xp: data.game.xp + reward.xp,
    },
    inventory: {
      ...data.inventory,
      materials,
    },
  };

  return { ok: true, data: next, reward };
}

/** Sacrifice all stale tasks in one batch. */
export function sacrificeAllStale(
  data: AppData,
  now: Date = new Date(),
  random: () => number = Math.random,
): VoidBatchResult {
  const today = dateStr(now);
  const stale = getStaleTasks(data, today);

  if (stale.length === 0) {
    return { ok: true, count: 0, data, totalCoins: 0, totalXp: 0, materials: [] };
  }

  let totalCoins = 0;
  let totalXp = 0;
  const droppedMaterials: MaterialId[] = [];
  const nextMaterials = { ...data.inventory.materials };

  for (const task of stale) {
    const r = calculateVoidReward(task, random);
    totalCoins += r.coins;
    totalXp += r.xp;
    if (r.material) {
      droppedMaterials.push(r.material);
      nextMaterials[r.material] = (nextMaterials[r.material] || 0) + 1;
    }
  }

  const staleIds = new Set(stale.map((t) => t.id));
  const next: AppData = {
    ...data,
    tasks: data.tasks.filter((t) => !staleIds.has(t.id)),
    game: {
      ...data.game,
      catCoins: data.game.catCoins + totalCoins,
      xp: data.game.xp + totalXp,
    },
    inventory: {
      ...data.inventory,
      materials: nextMaterials,
    },
  };

  return {
    ok: true,
    count: stale.length,
    data: next,
    totalCoins,
    totalXp,
    materials: droppedMaterials,
  };
}
