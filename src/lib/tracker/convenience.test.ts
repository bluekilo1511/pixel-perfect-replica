import { describe, expect, it } from "vitest";
import { CONVENIENCE_ITEMS, buyConvenience, type ConvenienceData } from "./convenience";
import { defaultPet } from "./gamify";

const base = (): ConvenienceData => ({
  game: { level: 1, xp: 0, catCoins: 100 },
  inventory: { freezes: 0 },
  petState: defaultPet(new Date()),
});

describe("convenience", () => {
  it("has five items with positive prices", () => {
    const items = Object.values(CONVENIENCE_ITEMS);
    expect(items).toHaveLength(5);
    for (const it of items) expect(it.price).toBeGreaterThan(0);
  });

  it("charm buys a freeze with coins", () => {
    const r = buyConvenience(base(), "charm");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.inventory.freezes).toBe(1);
    expect(r.data.game.catCoins).toBe(70);
  });

  it("rejects when coins are short", () => {
    const d = base();
    d.game.catCoins = 5;
    const r = buyConvenience(d, "charm");
    expect(r).toEqual({ ok: false, reason: "not-enough-coins" });
  });

  it("feast feeds the pet and clamps at 100", () => {
    const d = base();
    d.petState.hunger = 90;
    d.petState.happiness = 95;
    const r = buyConvenience(d, "feast");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.hunger).toBe(100);
    expect(r.data.petState.happiness).toBe(100);
    expect(r.data.game.catCoins).toBe(90);
  });

  it("carousel lifts happiness", () => {
    const d = base();
    d.petState.happiness = 20;
    const r = buyConvenience(d, "carousel");
    if (!r.ok) throw new Error("buy failed");
    expect(r.data.petState.happiness).toBe(80);
  });

  it("stardust grants user xp and can level up", () => {
    const d = base();
    d.game.xp = 90;
    const r = buyConvenience(d, "stardust");
    if (!r.ok) throw new Error("buy failed");
    expect(r.data.game.level).toBe(2);
    expect(r.data.game.xp).toBe(30);
    expect(r.levelsGained).toBe(1);
  });

  it("honeyMini grants pet xp and can level the pet", () => {
    const d = base();
    d.petState.petXp = 80;
    const r = buyConvenience(d, "honeyMini");
    if (!r.ok) throw new Error("buy failed");
    expect(r.data.petState.petLevel).toBe(2);
    expect(r.data.petState.petXp).toBe(10);
    expect(r.petLevelsGained).toBe(1);
  });
});
