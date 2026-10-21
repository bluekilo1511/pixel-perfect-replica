import { describe, expect, it } from "vitest";
import { SPECIES } from "./gamify";
import { petEmoji, petTitle, tierOf } from "./extras";
import { weekSummary } from "./weeklyReport";
import { defaultData, completeTask } from "./model";
import type { PetState } from "./gamify";

const petAt = (level: number, species: PetState["species"] = "cat"): PetState =>
  ({
    species,
    petName: "Bové",
    petLevel: level,
    petXp: 0,
    hunger: 80,
    happiness: 80,
    accessory: null,
    ownedSpecies: [species],
    ownedAccessories: [],
    accessoryOwned: [],
    decorOwned: [],
    decorActive: [],
  }) as unknown as PetState;

describe("pet evolution", () => {
  it("uses the base emoji below tier 1", () => {
    expect(petEmoji(petAt(1))).toBe("🐱");
    expect(petEmoji(petAt(2, "lizard"))).toBe("🦎");
  });

  it("swaps to the evolved form at tier 2 (level 6+)", () => {
    expect(petEmoji(petAt(6, "cat"))).toBe("🐈‍⬛");
    expect(petEmoji(petAt(7, "lizard"))).toBe("🐉");
    expect(petEmoji(petAt(9, "dog"))).toBe("🐺");
    expect(petEmoji(petAt(30, "whale"))).toBe("🐋");
  });

  it("names the evolved forms", () => {
    expect(petTitle(petAt(6, "cat"))).toBe("Mèo Đen Bí Ẩn");
    expect(petTitle(petAt(6, "lizard"))).toBe("Rồng Lửa");
    expect(petTitle(petAt(6, "whale"))).toBe("Cá Voi Tinh Tú");
    expect(tierOf(5)).toBe(1);
  });

  it("includes the blue whale species", () => {
    expect(SPECIES.whale.emoji).toBe("🐳");
    expect(SPECIES.whale.price).toBe(20);
  });
});

describe("weekly report comparison", () => {
  it("reports diffs and percent change", () => {
    const data = defaultData();
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7);
    const day = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    // last week: 100 min focus over 2 days; this week: 150 min over 3 days
    for (let i = 0; i < 2; i++)
      data.dailyStats[day(new Date(monday.getTime() + i * 86400000))] = {
        tasks: 1,
        focusMin: 50,
        pomodoros: 2,
      } as never;
    for (let i = 0; i < 3; i++)
      data.dailyStats[day(new Date(monday.getTime() + (7 + i) * 86400000))] = {
        tasks: 2,
        focusMin: 50,
        pomodoros: 2,
      } as never;
    const s = weekSummary(data, new Date(monday.getTime() + 8 * 86400000));
    expect(s.lastWeek.focusMin).toBe(100);
    expect(s.thisWeek.focusMin).toBe(150);
    expect(s.diffMin).toBe(50);
    expect(s.diffPct).toBe(50);
    expect(s.diffTasks).toBe(4);
    expect(s.diffDays).toBe(1);
  });

  it("gives null percent when last week had no focus", () => {
    const data = defaultData();
    const s = weekSummary(data);
    expect(s.diffPct).toBeNull();
    expect(s.diffMin).toBe(0);
  });
});

describe("evolved pet label", () => {
  it("completeTask still works with an evolved pet in the pipeline", () => {
    const data = defaultData();
    data.petState = { ...petAt(6, "lizard") } as typeof data.petState;
    const t = {
      id: "t1",
      title: "Học Toán",
      kind: "study",
      minutes: 25,
      date: "",
      completed: false,
      rewardClaimed: false,
      remainingSeconds: 0,
    } as never;
    data.tasks = [t];
    const r = completeTask(data, "t1", new Date(), Math.random);
    expect(r.data.tasks[0]!.completed).toBe(true);
  });
});
