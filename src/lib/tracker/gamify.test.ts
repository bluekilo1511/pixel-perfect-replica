import { describe, expect, it } from "vitest";
import { checkStreak, decayPet, defaultInventory, defaultPet, defaultStreak, moodOf, recordCompletion, streakMultiplier } from "./gamify";
import { defaultData, ensureDailyPins, makeTask, migrate, syncTodaySlots, upcomingSlots } from "./model";

describe("gamification rules", () => {
  it("first completion removes active frost without prematurely increasing the streak", () => {
    const s = { ...defaultStreak("2026-10-18"), count: 5, lastQualifiedDate: "2026-10-17" };
    const saved = checkStreak(s, { ...defaultInventory(), freezes: 1 }, "2026-10-19");
    expect(saved.streak.freezeActive).toBe(true);
    const reclaimed = recordCompletion(saved.streak, "2026-10-20");
    expect(reclaimed.freezeActive).toBe(false);
    expect(reclaimed.count).toBe(5);
    expect(reclaimed.today.done).toBe(1);
  });
  it("old JSON safely defaults frost off and only accepts a boolean active freeze", () => {
    expect(migrate({ version: 3, streak: {} }).streak.freezeActive).toBe(false);
    expect(migrate({ streak: { freezeActive: "true" } }).streak.freezeActive).toBe(false);
    expect(migrate({ streak: { freezeActive: true } }).streak.freezeActive).toBe(true);
  });
  it("pet loses 5% hunger and 3% happiness per hour", () => {
    const p = { ...defaultPet(new Date(2026, 0, 1, 8)), hunger: 80, happiness: 80 };
    const d = decayPet(p, new Date(2026, 0, 1, 10, 30));
    expect(d.hunger).toBe(70);
    expect(d.happiness).toBe(74);
  });

  it("moods follow thresholds", () => {
    const p = defaultPet();
    expect(moodOf({ ...p, hunger: 90, happiness: 90 })).toBe("excited");
    expect(moodOf({ ...p, hunger: 60, happiness: 60 })).toBe("normal");
    expect(moodOf({ ...p, hunger: 30, happiness: 60 })).toBe("hungry");
    expect(moodOf({ ...p, hunger: 60, happiness: 20 })).toBe("sulky");
  });

  it("streak multipliers", () => {
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(2)).toBe(1.2);
    expect(streakMultiplier(3)).toBe(1.2);
    expect(streakMultiplier(4)).toBe(1.5);
    expect(streakMultiplier(6)).toBe(1.5);
    expect(streakMultiplier(7)).toBe(2);
    expect(streakMultiplier(30)).toBe(2);
  });

  it("streak grows only after 3 tasks in a day", () => {
    let s = defaultStreak("2026-10-18");
    s = recordCompletion(recordCompletion(s, "2026-10-18"), "2026-10-18");
    expect(s.count).toBe(0);
    s = recordCompletion(s, "2026-10-18");
    expect(s.count).toBe(1);
    for (let i = 0; i < 3; i++) s = recordCompletion(s, "2026-10-19");
    expect(s.count).toBe(2);
  });

  it("freeze saves streak after missing exactly one day", () => {
    const s = { ...defaultStreak("2026-10-17"), count: 5, lastQualifiedDate: "2026-10-17", lastCheckDate: "2026-10-17" };
    const saved = checkStreak(s, { ...defaultInventory(), freezes: 1 }, "2026-10-19");
    expect(saved.streak.count).toBe(5);
    expect(saved.inventory.freezes).toBe(0);
    const broken = checkStreak(s, defaultInventory(), "2026-10-20");
    expect(broken.streak.count).toBe(0);
  });

  it("pinned tasks carry to the next day uncompleted", () => {
    const t = { ...makeTask("Đọc sách", "custom", 0, "2026-10-18", { pinned: true }), completed: true, rewardClaimed: true };
    const d = ensureDailyPins({ ...defaultData(), tasks: [t] }, "2026-10-19");
    const moved = d.tasks.find((x) => x.title === "Đọc sách")!;
    expect(moved.date).toBe("2026-10-19");
    expect(moved.completed).toBe(false);
  });

  it("quick sync adds today's slots with a time badge, once", () => {
    let d = defaultData();
    d.timetable.days[0]!.slots.push({ id: "s1", start: "07:30", end: "08:15", title: "Toán", kind: "custom", minutes: 0 });
    const sun = new Date(2026, 9, 18, 6, 0);
    d = syncTodaySlots(d, sun).data;
    expect(syncTodaySlots(d, sun).added).toBe(0);
    expect(d.tasks.find((t) => t.fromSlotId === "s1")!.timeRange).toBe("07:30 - 08:15");
  });

  it("reminds 5 minutes before a class", () => {
    const d = defaultData();
    d.timetable.days[0]!.slots.push({ id: "s1", start: "07:30", end: "08:15", title: "Toán", kind: "custom", minutes: 0 });
    expect(upcomingSlots(d, new Date(2026, 9, 18, 7, 25))).toHaveLength(1);
    expect(upcomingSlots(d, new Date(2026, 9, 18, 7, 20))).toHaveLength(0);
  });
});
