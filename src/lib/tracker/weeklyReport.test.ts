import { describe, expect, it } from "vitest";
import { defaultData } from "./model";
import { mondayOf, weekSummary } from "./weeklyReport";
import { bumpStats } from "./extras";

// Oct 20 2026 is a Tuesday.
const now = new Date(2026, 9, 20, 12, 0);

describe("weekly report", () => {
  it("weeks start on Monday", () => {
    expect(mondayOf(new Date(2026, 9, 18, 9, 0))).toBe("2026-10-12"); // Sunday belongs to the week that started the Monday before
    expect(mondayOf(now)).toBe("2026-10-19");
  });

  it("totals this week, compares with last week and finds the best day", () => {
    let d = defaultData();
    d = {
      ...d,
      dailyStats: bumpStats(d.dailyStats, "2026-10-19", { focusMin: 50, tasks: 2, pomodoros: 2 }),
    };
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-20", { focusMin: 25, pomodoros: 1 }) };
    d = { ...d, dailyStats: bumpStats(d.dailyStats, "2026-10-12", { focusMin: 100, tasks: 1 }) };
    const s = weekSummary(d, now);
    expect(s.weekStart).toBe("2026-10-19");
    expect(s.thisWeek.focusMin).toBe(75);
    expect(s.thisWeek.tasks).toBe(2);
    expect(s.thisWeek.pomodoros).toBe(3);
    expect(s.thisWeek.activeDays).toBe(2);
    expect(s.lastWeek.focusMin).toBe(100);
    expect(s.diffMin).toBe(-25);
    expect(s.bestDay).toEqual({ date: "2026-10-19", focusMin: 50 });
  });

  it("is safe on empty data", () => {
    const s = weekSummary(defaultData(), now);
    expect(s.thisWeek.focusMin).toBe(0);
    expect(s.lastWeek.focusMin).toBe(0);
    expect(s.bestDay).toBeNull();
  });
});
