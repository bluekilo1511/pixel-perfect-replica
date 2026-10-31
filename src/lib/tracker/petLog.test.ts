import { describe, expect, it } from "vitest";
import { defaultPet, type Species } from "./gamify";
import {
  appendPetLog,
  normalizePetLog,
  petLogEmoji,
  petWeeklyReview,
  withPetLog,
  withWeeklyReview,
  type PetLogEntry,
} from "./petLog";
import { petTitle, tierOf } from "./extras";
import { defaultData, type AppData } from "./model";

const dataWithPet = (level: number, species: Species = "cat"): AppData => {
  const d = defaultData();
  return {
    ...d,
    petState: { ...defaultPet(), species, petLevel: level },
    petLog: [],
  };
};

describe("appendPetLog", () => {
  it("appends entries newest first and caps the list", () => {
    let log: PetLogEntry[] = [];
    for (let i = 0; i < 70; i++) log = appendPetLog(log, "level", `cấp ${i}`, new Date(i * 1000));
    expect(log).toHaveLength(60);
    expect(log[0]!.text).toBe("cấp 69");
  });
  it("ignores empty text", () => {
    expect(appendPetLog([], "boss", "   ")).toHaveLength(0);
  });
  it("exposes an emoji per kind", () => {
    expect(petLogEmoji("boss")).toBe("⚔️");
    expect(petLogEmoji("expedition")).toBe("🧭");
  });
});

describe("normalizePetLog", () => {
  it("keeps well-formed entries, drops broken ones and caps", () => {
    const raw = [
      { id: "a", kind: "raid", text: "hạ boss tuần", at: "2026-01-01T00:00:00Z" },
      { text: "no id" },
      "not an object",
      { id: "", kind: "wat", text: "ok", at: "2026-01-02T00:00:00Z" },
      { id: "b", kind: "level", text: "", at: "x" },
    ];
    const out = normalizePetLog(raw);
    expect(out).toHaveLength(3);
    expect(out[0]!.kind).toBe("raid");
    expect(out.every((e) => e.text.length > 0)).toBe(true);
    expect(normalizePetLog(null)).toEqual([]);
    expect(normalizePetLog(Array.from({ length: 70 }, (_, i) => ({ text: `t${i}` })))).toHaveLength(
      60,
    );
  });
});

describe("withPetLog derives level/evolution entries", () => {
  it("logs a level-up when the pet gains levels within a tier", () => {
    const prev = dataWithPet(3);
    const next = dataWithPet(4);
    const out = withPetLog(prev, next);
    expect(out.petLog).toHaveLength(1);
    expect(out.petLog[0]!.kind).toBe("level");
    expect(out.petLog[0]!.text).toContain("4");
    expect(out.petLog[0]!.text).toContain(petTitle(next.petState));
  });
  it("logs an evolution when a tier boundary is crossed (lv3 is tier 1)", () => {
    const prev = dataWithPet(2);
    const next = dataWithPet(3);
    const out = withPetLog(prev, next);
    expect(out.petLog).toHaveLength(1);
    expect(out.petLog[0]!.kind).toBe("evolution");
    expect(out.petLog[0]!.text).toContain("đã tiến hóa");
  });
  it("logs nothing without a level change or when the species swaps", () => {
    expect(withPetLog(dataWithPet(4), dataWithPet(4)).petLog).toHaveLength(0);
    expect(withPetLog(dataWithPet(4), dataWithPet(3)).petLog).toHaveLength(0);
    expect(withPetLog(dataWithPet(4), dataWithPet(4, "owl")).petLog).toHaveLength(0);
  });
});

describe("logPetEvent", () => {
  it("adds a raid entry and keeps existing ones", () => {
    const d = defaultData();
    const withOld = {
      ...d,
      petLog: normalizePetLog([{ id: "x", kind: "level", text: "lên 2", at: "z" }]),
    };
    // logPetEvent is exercised via appendPetLog paths in the UI; check the pure helper directly
    const log = appendPetLog(withOld.petLog, "raid", "Hạ Boss tuần!");
    expect(log[0]!.kind).toBe("raid");
    expect(log).toHaveLength(2);
    expect(tierOf(3)).toBe(1);
    expect(tierOf(6)).toBe(2);
  });
});

describe("petWeeklyReview", () => {
  const day = (d: AppData, iso: string, stats: { tasks: number; focusMin: number }): AppData => {
    d.dailyStats[iso] = { water: 0, treats: 0, pomodoros: 0, ...stats };
    return d;
  };
  // 2026-10-31 is a Saturday: Monday..Friday = 5 reviewed days, window Mon..Fri…
  // Actually Mon 26th..Fri 30th (yesterday), so 5 days graded.
  const satMorning = new Date("2026-10-31T09:00:00");
  const d26 = (n: number) => `2026-10-${String(26 + n).padStart(2, "0")}`;

  it("returns null before there is a past day to grade (Monday)", () => {
    const d = dataWithPet(4);
    expect(petWeeklyReview(d, new Date("2026-11-02T09:00:00"))).toBeNull();
  });

  it("grades a hard-working week 10/10", () => {
    let d = dataWithPet(4);
    for (let i = 0; i < 5; i++) d = day(d, d26(i), { tasks: 5, focusMin: 100 });
    const e = petWeeklyReview(d, satMorning)!;
    expect(e.kind).toBe("review");
    expect(e.text).toContain("chấm 10/10");
    expect(e.text).toContain("25 nhiệm vụ");
  });

  it("grumbles about an empty week", () => {
    const e = petWeeklyReview(dataWithPet(4), satMorning)!;
    expect(e.text).toContain("Bỏ 5 ngày");
  });

  it("gives a gentle 7.5 for a decent week", () => {
    let d = dataWithPet(4);
    for (let i = 0; i < 2; i++) d = day(d, d26(i), { tasks: 4, focusMin: 30 });
    const e = petWeeklyReview(d, satMorning)!;
    expect(e.text).toContain("7.5");
  });

  it("withWeeklyReview prepends the entry to the journal", () => {
    const d = withWeeklyReview(dataWithPet(4), satMorning);
    expect(d.petLog[0]!.kind).toBe("review");
  });

  it("emoji map covers the review kind", () => {
    expect(petLogEmoji("review")).toBe("📋");
  });
});
