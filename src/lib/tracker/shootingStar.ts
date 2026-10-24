// The catchable shooting star across the nav sky: a tiny surprise bonus.
// +3 coins per catch, at most 3 catches per day — cannot break game balance.

export const SHOOTING_STAR_REWARD = 3; // cat coins
export const SHOOTING_STAR_DAILY_LIMIT = 3;

export interface ShootingStarState {
  date: string | null; // "YYYY-MM-DD" the counter belongs to
  caught: number;
}

export const defaultShootingStar = (): ShootingStarState => ({ date: null, caught: 0 });

export function normalizeShootingStar(raw: unknown): ShootingStarState {
  if (typeof raw !== "object" || raw === null) return defaultShootingStar();
  const o = raw as Record<string, unknown>;
  return {
    date:
      typeof o.date === "string" && /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(o.date)
        ? o.date
        : null,
    caught: Math.max(0, Math.min(SHOOTING_STAR_DAILY_LIMIT, Math.round(Number(o.caught)) || 0)),
  };
}

/** How many catches are left today (counter resets on a new date). */
export function catchesRemaining(state: ShootingStarState, today: string): number {
  const used = state.date === today ? state.caught : 0;
  return Math.max(0, SHOOTING_STAR_DAILY_LIMIT - used);
}

/** Record one catch; returns null when today's limit is already used up. */
export function recordCatch(state: ShootingStarState, today: string): ShootingStarState | null {
  if (catchesRemaining(state, today) <= 0) return null;
  const caught = (state.date === today ? state.caught : 0) + 1;
  return { date: today, caught };
}
