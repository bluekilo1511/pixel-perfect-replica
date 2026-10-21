import { describe, expect, it } from "vitest";
import {
  addPetXp,
  canCraft,
  checkAchievements,
  defaultAchievements,
  emptyMaterials,
  recordWaterGoal,
  RECIPES,
  rollDrop,
  weatherOf,
  weekSummary,
  writeDiary,
} from "./extras";
import { defaultPet } from "./gamify";
import {
  addWaterCup,
  completeTask,
  defaultData,
  ensureDailyPins,
  makeTask,
  migrate,
} from "./model";

describe("premium extras", () => {
  it("drops a material 20% of the time", () => {
    expect(rollDrop(() => 0.19)).not.toBeNull();
    expect(rollDrop(() => 0.2)).toBeNull();
  });
  it("pet gets 10% of user xp and levels at petLevel*100", () => {
    const r = addPetXp({ ...defaultPet(), petXp: 95 }, 60);
    expect(r.pet.petLevel).toBe(2);
    expect(r.pet.petXp).toBe(1);
    const evo = addPetXp({ ...defaultPet(), petLevel: 2, petXp: 199 }, 10);
    expect(evo.pet.petLevel).toBe(3);
    expect(evo.evolved).toBe(true);
  });
  it("crafting needs the listed materials", () => {
    const wings = RECIPES.find((r) => r.id === "wings")!;
    expect(canCraft(emptyMaterials(), wings)).toBe(false);
    expect(canCraft({ magicFeather: 3, starShard: 2, mysticHerb: 0 }, wings)).toBe(true);
  });
  it("hidden achievements", () => {
    const night = checkAchievements(defaultAchievements(), { pet: defaultPet(), nightOwl: true });
    expect(night.fresh).toEqual(["nightOwl"]);
    expect(
      checkAchievements(defaultAchievements(), { pet: { ...defaultPet(), hunger: 9 } }).fresh,
    ).toEqual(["neglectfulMaster"]);
    expect(
      checkAchievements(defaultAchievements(), { pet: { ...defaultPet(), hunger: 10 } }).fresh,
    ).toEqual([]);
    let a = defaultAchievements();
    a = recordWaterGoal(
      recordWaterGoal(recordWaterGoal(a, "2026-10-16"), "2026-10-17"),
      "2026-10-18",
    );
    expect(checkAchievements(a, { pet: defaultPet() }).fresh).toEqual(["hydroHomie"]);
    const gap = recordWaterGoal(recordWaterGoal(defaultAchievements(), "2026-10-15"), "2026-10-17");
    expect(gap.waterStreak.count).toBe(1);
  });
  it("achievement unlock does not pay until claimed", () => {
    const d = defaultData();
    d.tasks = [makeTask("x", "custom", 0, "2026-10-18")];
    const r = completeTask(d, d.tasks[0]!.id, new Date(2026, 9, 18, 2, 0), () => 0.9);
    expect(r.fresh).toEqual(["nightOwl"]);
    expect(r.data.game.lizardGems).toBe(0);
    expect(r.data.dailyStats["2026-10-18"]!.tasks).toBe(1);
  });
  it("weather rules", () => {
    const pet = defaultPet();
    expect(weatherOf({ todayDone: 4, pomodorosToday: 0, overdue: 0, pet })).toBe("sunny");
    expect(weatherOf({ todayDone: 3, pomodorosToday: 1, overdue: 0, pet })).toBe("sunny");
    expect(weatherOf({ todayDone: 3, pomodorosToday: 0, overdue: 1, pet })).toBe("snowy");
    expect(
      weatherOf({ todayDone: 0, pomodorosToday: 0, overdue: 0, pet: { ...pet, hunger: 39 } }),
    ).toBe("rainy");
    expect(weatherOf({ todayDone: 0, pomodorosToday: 0, overdue: 0, pet })).toBe("foggy");
  });
  it("diary is written for yesterday on a new day", () => {
    const d = {
      ...defaultData(),
      lastDiaryDate: "2026-10-18",
      dailyStats: { "2026-10-18": { tasks: 5, focusMin: 100, water: 8, treats: 2, pomodoros: 2 } },
    };
    const n = ensureDailyPins(d, "2026-10-19");
    expect(n.adventureLog[0]!.date).toBe("2026-10-18");
    expect(n.adventureLog[0]!.mood).toBe("great");
    expect(
      writeDiary("2026-10-19", undefined, { petName: "Mèo", freezeUsed: true, streakBroke: false })
        .text,
    ).toContain("Bình đóng băng");
  });
  it("weekly summary sums Sunday-start week and water counts", () => {
    let d = defaultData();
    d = addWaterCup(d, new Date(2026, 9, 18, 10)).data;
    const w = weekSummary(d.dailyStats, "2026-10-18");
    expect(w.days[0]).toBe("2026-10-18");
    expect(w.water).toBe(1);
  });
  it("old v3 files migrate safely", () => {
    const m = migrate({
      version: 3,
      petState: { species: "dog", hunger: 50 },
      inventory: { freezes: 2 },
    });
    expect(m.petState.petLevel).toBe(1);
    expect(m.inventory.materials).toEqual({ magicFeather: 0, starShard: 0, mysticHerb: 0 });
    expect(m.achievements.unlocked).toEqual({});
    expect(m.adventureLog).toEqual([]);
  });
});
