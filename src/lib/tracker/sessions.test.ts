import { describe, expect, it } from "vitest";
import { goldenHours, sessionsOn } from "./sessions";
import type { SessionEntry } from "./model";

const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe("goldenHours", () => {
  it("aggregates minutes per hour and finds the best hour", () => {
    const log: SessionEntry[] = [
      { at: at(2026, 10, 20, 8), minutes: 25, kind: "pomodoro" },
      { at: at(2026, 10, 20, 8, 59), minutes: 25, kind: "pomodoro" },
      { at: at(2026, 10, 20, 21), minutes: 25, kind: "pomodoro" },
    ];
    const g = goldenHours(log, new Date(2026, 9, 20, 22, 0));
    expect(g.buckets[8]).toBe(50);
    expect(g.buckets[21]).toBe(25);
    expect(g.best).toBe(8);
    expect(g.total).toBe(75);
  });

  it("ignores entries older than the 14-day window", () => {
    const log: SessionEntry[] = [
      { at: at(2026, 9, 1, 9), minutes: 50, kind: "pomodoro" },
      { at: at(2026, 10, 20, 9), minutes: 25, kind: "pomodoro" },
    ];
    const g = goldenHours(log, new Date(2026, 9, 20, 22, 0));
    expect(g.total).toBe(25);
    expect(g.buckets[9]).toBe(25);
  });

  it("returns best null when there is no data", () => {
    const g = goldenHours([], new Date(2026, 9, 20));
    expect(g.best).toBeNull();
    expect(g.total).toBe(0);
  });
});

describe("sessionsOn", () => {
  it("filters entries by local day", () => {
    const log: SessionEntry[] = [
      { at: at(2026, 10, 19, 23), minutes: 25, kind: "pomodoro" },
      { at: at(2026, 10, 20, 7), minutes: 25, kind: "pomodoro" },
    ];
    const today = sessionsOn(log, "2026-10-20");
    expect(today.length).toBe(1);
    expect(today[0]!.minutes).toBe(25);
  });
});
