// Pure Boss Raid rules (runtime-only state, never persisted to the JSON file).
import { bumpPet, POMODORO_REWARD, type PetState } from "./gamify";

export const BOSS_MAX_HP = 100;
export const BOSS_COUNTER_HAPPINESS = 15;
export const BOSS_REWARD = { catCoins: POMODORO_REWARD * 2, lizardGems: 2 };

export interface BossState { bossActive: boolean; bossHp: number }
export const idleBoss = (): BossState => ({ bossActive: false, bossHp: BOSS_MAX_HP });

/** HP falls linearly with the remaining Pomodoro time. */
export function bossHp(leftSeconds: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, leftSeconds / totalSeconds));
  return Math.round(ratio * BOSS_MAX_HP);
}

export function defeatBoss<G extends { catCoins: number; lizardGems: number }>(game: G): G {
  return { ...game, catCoins: game.catCoins + BOSS_REWARD.catCoins, lizardGems: game.lizardGems + BOSS_REWARD.lizardGems };
}

export const bossCounterAttack = (pet: PetState): PetState => bumpPet(pet, 0, -BOSS_COUNTER_HAPPINESS);
