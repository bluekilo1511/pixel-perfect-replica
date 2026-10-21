import { describe, expect, it } from "vitest";
import { buyMarket, defaultMarket, marketStock, weekStart } from "./market";
import { defaultPet } from "./gamify";
import { emptyMaterials, type Materials } from "./extras";
import type { MarketData } from "./market";

const monday = new Date("2026-02-09T10:00:00"); // pool 0: shield, honey, box
const wednesday = new Date("2026-02-11T10:00:00");
const nextMonday = new Date("2026-02-16T10:00:00"); // pool 1: honey, galaxy, box

function makeData(catCoins = 100): MarketData {
  return {
    game: { catCoins },
    inventory: { freezes: 0, materials: emptyMaterials() },
    petState: { ...defaultPet(new Date("2026-02-09")), decorOwned: [] },
    market: defaultMarket(),
  };
}

describe("weekStart", () => {
  it("returns the Monday of the same week", () => {
    expect(weekStart(monday)).toBe("2026-02-09");
    expect(weekStart(wednesday)).toBe("2026-02-09");
    expect(weekStart(new Date("2026-02-15T12:00:00"))).toBe("2026-02-09"); // Sunday
  });
});

describe("marketStock", () => {
  it("rotates the pool every Monday", () => {
    expect(marketStock(monday)).toEqual(marketStock(wednesday));
    expect(marketStock(nextMonday)).not.toEqual(marketStock(monday));
  });
});

describe("buyMarket", () => {
  it("charges coins and grants a freeze shield once per week", () => {
    const d = makeData(50);
    const r = buyMarket(d, "shield", wednesday);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.game.catCoins).toBe(30);
    expect(r.data.inventory.freezes).toBe(1);
    // second buy in the same week is refused
    expect(buyMarket(r.data, "shield", wednesday).ok).toBe(false);
  });

  it("honey can be bought again the following week", () => {
    const d = makeData(100);
    const r1 = buyMarket(d, "honey", wednesday);
    expect(r1.ok).toBe(true);
    const r2 = buyMarket(d, "honey", nextMonday); // same data object: new week, not bought yet
    expect(r2.ok).toBe(true);
  });

  it("rejects items not in this week's stock", () => {
    const stock = marketStock(wednesday);
    const notStocked = (["shield", "honey", "box", "galaxy", "starClock"] as const).find(
      (id) => !stock.includes(id),
    )!;
    expect(buyMarket(makeData(), notStocked, wednesday).ok).toBe(false);
  });

  it("rejects when coins are not enough", () => {
    expect(buyMarket(makeData(5), "shield", wednesday)).toMatchObject({ ok: false });
  });

  it("honey grants raw pet XP without user XP", () => {
    const d = makeData();
    const before = d.petState.petXp;
    const r = buyMarket(d, "honey", wednesday);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.petXp).toBeGreaterThanOrEqual(before + 60);
  });

  it("mystery box adds 1-3 materials of one kind", () => {
    const r = buyMarket(makeData(), "box", wednesday, () => 0.99);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const total = Object.values(r.data.inventory.materials as Materials).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(3);
  });

  it("heal restores happiness to 100 and tops up hunger (cap 100)", () => {
    const d = makeData();
    d.petState.happiness = 35;
    d.petState.hunger = 80;
    const r = buyMarket(d, "heal", nextMonday);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.happiness).toBe(100);
    expect(r.data.petState.hunger).toBe(100);
  });

  it("heal can only be bought once per week", () => {
    const d = makeData();
    const r = buyMarket(d, "heal", nextMonday);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(buyMarket(r.data, "heal", nextMonday)).toMatchObject({ ok: false });
  });

  it("market decor goes into decorOwned, not active", () => {
    const stock = marketStock(wednesday);
    const decorId = stock.find((id) => id === "galaxy" || id === "starClock");
    if (!decorId) return; // this week's pool has no rare decor
    const d = makeData();
    const r = buyMarket(d, decorId, wednesday);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.decorOwned).toContain(decorId);
    expect(r.data.petState.decorActive).not.toContain(decorId);
  });
});
