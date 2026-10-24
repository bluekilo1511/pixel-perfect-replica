import { describe, expect, it } from "vitest";
import {
  SHOOTING_STAR_DAILY_LIMIT,
  SHOOTING_STAR_REWARD,
  catchesRemaining,
  defaultShootingStar,
  normalizeShootingStar,
  recordCatch,
} from "./shootingStar";

describe("shootingStar", () => {
  it("starts fresh and normalizes junk", () => {
    expect(defaultShootingStar()).toEqual({ date: null, caught: 0 });
    expect(normalizeShootingStar(undefined)).toEqual({ date: null, caught: 0 });
    expect(normalizeShootingStar({ date: "2026-13-40", caught: 99 })).toEqual({
      date: null,
      caught: SHOOTING_STAR_DAILY_LIMIT,
    });
    expect(normalizeShootingStar({ date: "2026-10-24", caught: 1 })).toEqual({
      date: "2026-10-24",
      caught: 1,
    });
  });

  it("allows 3 catches per day", () => {
    let s = defaultShootingStar();
    const today = "2026-10-24";
    expect(catchesRemaining(s, today)).toBe(SHOOTING_STAR_DAILY_LIMIT);
    for (let i = 0; i < SHOOTING_STAR_DAILY_LIMIT; i++) {
      s = recordCatch(s, today)!;
    }
    expect(catchesRemaining(s, today)).toBe(0);
    expect(recordCatch(s, today)).toBeNull();
  });

  it("resets the counter on a new day", () => {
    const s = recordCatch(defaultShootingStar(), "2026-10-24")!;
    expect(catchesRemaining(s, "2026-10-25")).toBe(SHOOTING_STAR_DAILY_LIMIT);
  });

  it("reward stays small", () => {
    expect(SHOOTING_STAR_REWARD).toBeLessThanOrEqual(5);
  });
});
