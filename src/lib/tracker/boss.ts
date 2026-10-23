// Pure Boss Raid rules (runtime-only state, never persisted to the JSON file).
import { bumpPet, POMODORO_REWARD, type PetState } from "./gamify";

export const BOSS_MAX_HP = 100;
export const BOSS_COUNTER_HAPPINESS = 8;
export const BOSS_REWARD = { catCoins: POMODORO_REWARD * 2, lizardGems: 2 };

export interface BossState {
  bossActive: boolean;
  bossHp: number;
}
export const idleBoss = (): BossState => ({ bossActive: false, bossHp: BOSS_MAX_HP });

/** HP falls linearly with the remaining Pomodoro time. */
export function bossHp(leftSeconds: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, leftSeconds / totalSeconds));
  return Math.round(ratio * BOSS_MAX_HP);
}

export function defeatBoss<G extends { catCoins: number; lizardGems: number }>(game: G): G {
  return {
    ...game,
    catCoins: game.catCoins + BOSS_REWARD.catCoins,
    lizardGems: game.lizardGems + BOSS_REWARD.lizardGems,
  };
}

export const bossCounterAttack = (pet: PetState): PetState =>
  bumpPet(pet, 0, -BOSS_COUNTER_HAPPINESS);

// ---- Daily boss: completed tasks deal damage too, one reward per day ----
export const DAILY_BOSS_TASK_DAMAGE = 20; // 5 tasks defeat the daily boss
export interface DailyBossState {
  date: string | null;
  defeated: boolean;
}
export const defaultDailyBoss = (): DailyBossState => ({ date: null, defeated: false });

/** HP left on the daily boss from tasks completed today (100 → 0). */
export function dailyBossHpLeft(
  boss: DailyBossState,
  today: string,
  tasksDoneToday: number,
): number {
  if (boss.date === today && boss.defeated) return 0;
  return Math.max(0, BOSS_MAX_HP - tasksDoneToday * DAILY_BOSS_TASK_DAMAGE);
}
