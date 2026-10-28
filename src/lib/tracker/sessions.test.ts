import { describe, expect, it } from "vitest";
import { goldenHours, goldenSuggestion, sessionsOn, topHours } from "./sessions";
import type { SessionEntry, Task } from "./model";

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

describe("golden hour extras", () => {
  it("ranks top hours best-first with earlier-hour tiebreak", () => {
    const log = [
      ...Array.from({ length: 6 }, () => mkSession("2026-10-28T09:30:00")),
      ...Array.from({ length: 6 }, () => mkSession("2026-10-28T21:30:00")),
      ...Array.from({ length: 2 }, () => mkSession("2026-10-28T07:30:00")),
    ];
    const g = goldenHours(log, new Date("2026-10-28T12:00:00"));
    expect(topHours(g, 3)).toEqual([9, 21, 7]);
    expect(topHours(g, 0)).toEqual([]);
  });

  it("suggests pairing the golden hour with today's longest open task", () => {
    const log = Array.from({ length: 3 }, () => mkSession("2026-10-28T19:30:00"));
    const g = goldenHours(log, new Date("2026-10-28T20:00:00"));
    const tasks = [
      {
        id: "a",
        title: "Uống nước",
        minutes: 0,
        date: "2026-10-28",
        completed: false,
        completedAt: null,
        rewardClaimed: false,
        remainingSeconds: 0,
        kind: "water",
      },
      {
        id: "b",
        title: "Ôn Hóa chương 3",
        minutes: 50,
        date: "2026-10-28",
        completed: false,
        completedAt: null,
        rewardClaimed: false,
        remainingSeconds: 0,
        kind: "pomodoro",
      },
      {
        id: "c",
        title: "Xong rồi",
        minutes: 90,
        date: "2026-10-28",
        completed: true,
        completedAt: null,
        rewardClaimed: false,
        remainingSeconds: 0,
        kind: "pomodoro",
      },
      {
        id: "d",
        title: "Của ngày mai",
        minutes: 120,
        date: "2026-10-29",
        completed: false,
        completedAt: null,
        rewardClaimed: false,
        remainingSeconds: 0,
        kind: "pomodoro",
      },
    ] as unknown as Task[];
    expect(goldenSuggestion(g, tasks, "2026-10-28")).toEqual({
      hour: 19,
      title: "Ôn Hóa chương 3",
    });
    expect(goldenSuggestion(g, [], "2026-10-28")).toBeNull();
    expect(
      goldenSuggestion({ buckets: Array(24).fill(0), best: null, total: 0 }, tasks, "2026-10-28"),
    ).toBeNull();
  });
});

const mkSession = (iso: string, minutes = 25): SessionEntry => ({
  at: new Date(iso).toISOString(),
  minutes,
  kind: "pomodoro",
});
