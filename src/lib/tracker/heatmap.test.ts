import { describe, expect, it } from "vitest";
import { activeDaysOf, focusLevel, heatmapWeeks, HEAT_WEEKS } from "./heatmap";

describe("focusLevel", () => {
  it("maps minutes to 0..4", () => {
    expect(focusLevel(0)).toBe(0);
    expect(focusLevel(14)).toBe(1);
    expect(focusLevel(15)).toBe(2);
    expect(focusLevel(44)).toBe(2);
    expect(focusLevel(45)).toBe(3);
    expect(focusLevel(89)).toBe(3);
    expect(focusLevel(90)).toBe(4);
  });
});

describe("heatmapWeeks", () => {
  it("returns whole Sunday-first weeks ending with today's week", () => {
    const weeks = heatmapWeeks({}, "2026-10-22"); // Thursday
    expect(weeks).toHaveLength(HEAT_WEEKS);
    const last = weeks[weeks.length - 1]!;
    expect(last.cells[0]!.date).toBe("2026-10-18"); // Sunday
    expect(last.cells[4]!.date).toBe("2026-10-22");
    expect(last.cells[6]!.date).toBe("2026-10-24");
  });

  it("flags future days and reads dailyStats", () => {
    const stats = { "2026-10-22": { focusMin: 50, tasks: 3 } };
    const weeks = heatmapWeeks(stats, "2026-10-22", 2);
    const last = weeks[1]!;
    expect(last.cells[4]!.level).toBe(3);
    expect(last.cells[4]!.tasks).toBe(3);
    expect(last.cells[6]!.future).toBe(true);
    expect(last.cells[6]!.focusMin).toBe(0);
  });

  it("counts active days with focus", () => {
    const stats = {
      "2026-10-21": { focusMin: 10 },
      "2026-10-22": { focusMin: 0, tasks: 2 },
    };
    const weeks = heatmapWeeks(stats, "2026-10-22", 1);
    expect(activeDaysOf(weeks)).toBe(1);
  });
});
