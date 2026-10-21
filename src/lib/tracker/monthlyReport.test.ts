import { describe, expect, it } from "vitest";
import { defaultData, makeTask } from "./model";
import { monthDays, monthLabel, monthSummary } from "./monthlyReport";
import { emptyDay } from "./extras";

describe("monthDays", () => {
  it("returns 31 days for January", () => {
    expect(monthDays(2026, 1)).toHaveLength(31);
    expect(monthDays(2026, 1)[0]).toBe("2026-01-01");
    expect(monthDays(2026, 1)[30]).toBe("2026-01-31");
  });
  it("handles leap years and short months", () => {
    expect(monthDays(2024, 2)).toHaveLength(29);
    expect(monthDays(2026, 2)).toHaveLength(28);
    expect(monthDays(2026, 4)).toHaveLength(30);
  });
});

describe("monthSummary", () => {
  it("labels the month in Vietnamese", () => {
    expect(monthLabel(2026, 10)).toBe("Tháng 10/2026");
  });

  it("sums stats, counts active days and finds the best day", () => {
    const data = defaultData();
    data.dailyStats["2026-10-05"] = {
      ...emptyDay(),
      tasks: 3,
      focusMin: 50,
      pomodoros: 2,
      water: 4,
    };
    data.dailyStats["2026-10-06"] = { ...emptyDay(), tasks: 1, focusMin: 75, pomodoros: 3 };
    data.dailyStats["2026-09-30"] = { ...emptyDay(), tasks: 9, focusMin: 999 }; // other month, ignored
    const s = monthSummary(data, 2026, 10);
    expect(s.totals.tasks).toBe(4);
    expect(s.totals.focusMin).toBe(125);
    expect(s.totals.pomodoros).toBe(5);
    expect(s.totals.water).toBe(4);
    expect(s.activeDays).toBe(2);
    expect(s.bestDay).toEqual({ date: "2026-10-06", focusMin: 75 });
    expect(s.days).toHaveLength(31);
    expect(s.days[0]).toEqual({
      date: "2026-10-01",
      tasks: 0,
      focusMin: 0,
      pomodoros: 0,
      water: 0,
    });
  });

  it("counts only completed tasks dated inside the month", () => {
    const data = defaultData();
    data.tasks = [
      makeTask("A", "pomodoro", 25, "2026-10-03", { completed: true, rewardClaimed: true }),
      makeTask("B", "custom", 0, "2026-10-03", { completed: true, rewardClaimed: true }),
      makeTask("C", "custom", 0, "2026-10-04"), // not completed
      makeTask("D", "custom", 0, "2026-09-03", { completed: true, rewardClaimed: true }), // other month
    ];
    const s = monthSummary(data, 2026, 10);
    expect(s.tasksCompleted).toBe(2);
  });

  it("is safe on an empty month", () => {
    const s = monthSummary(defaultData(), 2026, 2);
    expect(s.totals).toEqual(emptyDay());
    expect(s.activeDays).toBe(0);
    expect(s.bestDay).toBeNull();
    expect(s.tasksCompleted).toBe(0);
  });
});
