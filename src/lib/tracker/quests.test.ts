import { describe, expect, it } from "vitest";
import { dailyQuests, defaultRaid, RAID_HP, raidStatus, raidWeekKey } from "./quests";
import type { DayStats } from "./extras";

const day = (focusMin = 0, pomodoros = 0): DayStats => ({
  tasks: 0,
  focusMin,
  water: 0,
  treats: 0,
  pomodoros,
});

describe("daily quests", () => {
  it("picks 3 deterministic quests per date", () => {
    expect(dailyQuests("2026-10-26")).toHaveLength(3);
    expect(dailyQuests("2026-10-26")).toEqual(dailyQuests("2026-10-26"));
  });
});

describe("raid week key", () => {
  it("returns the Monday of the week", () => {
    expect(raidWeekKey("2026-10-26")).toBe("2026-10-26"); // Monday
    expect(raidWeekKey("2026-10-25")).toBe("2026-10-19"); // Sunday → previous Monday
    expect(raidWeekKey("2026-10-31")).toBe("2026-10-26"); // Saturday
  });
});

describe("raidStatus", () => {
  it("needs ~7 hours (420 focus minutes) to defeat the boss", () => {
    const raid = defaultRaid();
    const stats: Record<string, DayStats> = {
      "2026-10-26": day(120, 5),
      "2026-10-27": day(60, 2),
    };
    const st = raidStatus(stats, "2026-10-28", raid);
    expect(st.focusMin).toBe(180);
    expect(st.hpLeft).toBe(RAID_HP - 180);
    expect(st.defeated).toBe(false);
  });
  it("falls with any session length once the week hits 420 focus minutes", () => {
    const raid = defaultRaid();
    const stats: Record<string, DayStats> = {
      "2026-10-26": day(300, 6),
      "2026-10-27": day(120, 5),
    };
    const st = raidStatus(stats, "2026-10-28", raid);
    expect(st.focusMin).toBe(420);
    expect(st.hpLeft).toBe(0);
    expect(st.defeated).toBe(true);
    expect(st.claimable).toBe(true);
  });
  it("is claimable only once per week", () => {
    const claimed = { weekStart: "2026-10-26", claimed: true };
    const stats: Record<string, DayStats> = { "2026-10-26": day(500, 20) };
    const st = raidStatus(stats, "2026-10-28", claimed);
    expect(st.defeated).toBe(true);
    expect(st.claimable).toBe(false);
  });
  it("resets next week", () => {
    const claimed = { weekStart: "2026-10-19", claimed: true };
    const stats: Record<string, DayStats> = { "2026-10-26": day(500, 20) };
    const st = raidStatus(stats, "2026-10-26", claimed);
    expect(st.claimable).toBe(true);
  });
  it("damage never goes above the boss HP", () => {
    const stats: Record<string, DayStats> = { "2026-10-26": day(2000, 80) };
    const st = raidStatus(stats, "2026-10-28", defaultRaid());
    expect(st.damage).toBe(RAID_HP);
    expect(st.hpLeft).toBe(0);
  });
});
