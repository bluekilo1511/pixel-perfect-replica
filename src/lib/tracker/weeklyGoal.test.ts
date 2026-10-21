import { describe, expect, it } from "vitest";
import { defaultData } from "./model";
import { bumpStats } from "./extras";
import { claimWeeklyGoal, setWeeklyGoal, weeklyGoalProgress, weekFocusMinutes } from "./weeklyGoal";

// Wed Oct 21 2026; its Monday is 2026-10-19.
const now = new Date(2026, 9, 21, 12, 0);

describe("weekly goal", () => {
  it("sums focus minutes from Monday of the current week", () => {
    let d = defaultData();
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-19", { focusMin: 120 }) };
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-21", { focusMin: 50 }) };
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-12", { focusMin: 999 }) }; // last week
    expect(weekFocusMinutes(d, now)).toBe(170);
  });

  it("computes progress and completion", () => {
    let d = defaultData();
    d = setWeeklyGoal(d, 100);
    expect(weeklyGoalProgress(d, now)).toMatchObject({
      target: 100,
      done: 0,
      pct: 0,
      complete: false,
    });
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-20", { focusMin: 100 }) };
    const p = weeklyGoalProgress(d, now);
    expect(p.complete).toBe(true);
    expect(p.pct).toBe(100);
  });

  it("claims the reward once per week with coins and a material", () => {
    let d = setWeeklyGoal(defaultData(), 50);
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-19", { focusMin: 60 }) };
    const before = { coins: d.game.catCoins, mats: { ...d.inventory.materials } };
    const r1 = claimWeeklyGoal(d, now);
    expect(r1).not.toBeNull();
    expect(r1!.reward.catCoins).toBe(5);
    const matsAfter = Object.entries(r1!.data.inventory.materials).reduce((a, [, v]) => a + v, 0);
    const matsBefore = Object.entries(before.mats).reduce((a, [, v]) => a + v, 0);
    expect(matsAfter).toBe(matsBefore + 2);
    expect(r1!.data.game.catCoins).toBe(before.coins + 5);
    // second claim is refused
    expect(claimWeeklyGoal(r1!.data, now)).toBeNull();
  });

  it("a new week resets the celebration", () => {
    let d = setWeeklyGoal(defaultData(), 50);
    d = { ...d, weeklyGoal: { ...d.weeklyGoal, celebratedWeek: "2026-10-12" } };
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-19", { focusMin: 60 }) };
    expect(claimWeeklyGoal(d, now)).not.toBeNull();
  });

  it("a target of 0 hides the goal", () => {
    const d = setWeeklyGoal(defaultData(), 0);
    const p = weeklyGoalProgress(d, now);
    expect(p.target).toBe(0);
    expect(p.complete).toBe(false);
  });
});
