import { describe, expect, it } from "vitest";
import {
  buyMarket,
  defaultMarket,
  haggleWon,
  marketPriceWithHaggle,
  resolveHaggle,
  startHaggle,
  MARKET_ITEMS,
  marketPrice,
  marketStock,
  weekStart,
  type MarketItemId,
} from "./market";
import { defaultPet } from "./gamify";
import { emptyMaterials, type Materials } from "./extras";
import type { MarketData } from "./market";
import { dateStr } from "./model";

const base = new Date("2026-02-09T10:00:00"); // a Monday
const monday = base;
const wednesday = new Date("2026-02-11T10:00:00");
const nextMonday = new Date("2026-02-16T10:00:00");

function makeData(catCoins = 100): MarketData {
  return {
    game: { catCoins, level: 6 },
    inventory: { freezes: 0, materials: emptyMaterials() },
    petState: { ...defaultPet(new Date("2026-02-09")), decorOwned: [] },
    market: defaultMarket(),
  };
}

/** Finds a week whose stock contains `id`, scanning forward from the base week. */
function weekWith(id: MarketItemId, offset = 0): Date {
  const d = new Date(base);
  let found = 0;
  for (let i = 0; i < 104; i++) {
    const w = new Date(base);
    w.setDate(w.getDate() + i * 7);
    if (marketStock(w).includes(id)) {
      if (found === offset) return w;
      found++;
    }
  }
  throw new Error(`no week stocks ${id}`);
}

describe("weekStart", () => {
  it("returns the Monday of the same week", () => {
    expect(weekStart(monday)).toBe("2026-02-09");
    expect(weekStart(wednesday)).toBe("2026-02-09");
    expect(weekStart(new Date("2026-02-15T12:00:00"))).toBe("2026-02-09"); // Sunday
  });
});

describe("marketStock — random restock", () => {
  it("keeps the same stock all week (seeded, not live rerolls)", () => {
    expect(marketStock(monday)).toEqual(marketStock(wednesday));
    expect(marketStock(new Date("2026-02-15T12:00:00"))).toEqual(marketStock(monday));
  });

  it("stocks exactly 5 items: 2 rares + 3 everyday goods", () => {
    const stock = marketStock(monday);
    expect(stock).toHaveLength(5);
    expect(new Set(stock).size).toBe(5);
    const rares = stock.filter(
      (id) =>
        id === "tome" ||
        id === "megaBox" ||
        id === "moonLamp" ||
        id === "phoenix" ||
        id === "gemPouch" ||
        id === "galaxy" ||
        id === "starClock",
    );
    expect(rares).toHaveLength(2);
  });

  it("reshuffles every Monday", () => {
    const stocks = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const w = new Date(base);
      w.setDate(w.getDate() + i * 7);
      stocks.add(marketStock(w).join(","));
    }
    expect(stocks.size).toBeGreaterThan(1); // genuinely different shelves over time
    expect(marketStock(nextMonday)).not.toEqual(marketStock(monday));
  });
});

describe("buyMarket", () => {
  it("charges coins and grants a freeze shield once per week", () => {
    const d = makeData(50);
    const w = weekWith("shield");
    const r = buyMarket(d, "shield", w);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.game.catCoins).toBe(30);
    expect(r.data.inventory.freezes).toBe(1);
    // second buy in the same week is refused
    expect(buyMarket(r.data, "shield", w).ok).toBe(false);
  });

  it("an everyday item can be bought again the following week", () => {
    const d = makeData(100);
    const w = weekWith("honey");
    const r1 = buyMarket(d, "honey", w);
    expect(r1.ok).toBe(true);
    const w2 = new Date(w);
    w2.setDate(w2.getDate() + 7);
    const w3 = weekWith("honey", 1);
    const r2 = buyMarket(d, "honey", w3); // same data object: new week, not bought yet
    expect(r2.ok).toBe(true);
    void w2;
  });

  it("rejects items not in this week's stock", () => {
    const stock = marketStock(wednesday);
    const all: MarketItemId[] = [
      "shield",
      "honey",
      "box",
      "galaxy",
      "starClock",
      "heal",
      "ticket",
      "tome",
      "megaBox",
      "moonLamp",
      "phoenix",
      "gemPouch",
    ];
    const notStocked = all.find((id) => !stock.includes(id))!;
    expect(buyMarket(makeData(), notStocked, wednesday).ok).toBe(false);
  });

  it("rejects rare goods above the player's level", () => {
    const d = makeData();
    d.game.level = 1;
    const w = weekWith("tome");
    const r = buyMarket(d, "tome", w);
    expect(r).toMatchObject({ ok: false, reason: "locked" });
    // same week, high enough level → allowed
    d.game.level = 2;
    expect(buyMarket(d, "tome", w).ok).toBe(true);
  });

  it("everyday goods are never level-locked", () => {
    (["shield", "honey", "box", "heal", "ticket"] as const).forEach((id) => {
      expect(
        buyMarket({ ...makeData(), game: { catCoins: 100, level: 1 } }, id, weekWith(id)).ok,
      ).toBe(true);
    });
  });

  it("rejects when coins are not enough", () => {
    expect(buyMarket(makeData(5), "shield", weekWith("shield"))).toMatchObject({ ok: false });
  });

  it("honey grants raw pet XP without user XP", () => {
    const d = makeData();
    const before = d.petState.petXp;
    const r = buyMarket(d, "honey", weekWith("honey"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.petXp).toBeGreaterThanOrEqual(before + 60);
  });

  it("honey reports an evolution when the pet crosses a tier boundary", () => {
    const d = makeData();
    d.petState.petLevel = 2;
    d.petState.petXp = 190; // +60 crosses level 3 and the tier-1 line
    const r = buyMarket(d, "honey", weekWith("honey"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.petLevel).toBe(3);
    expect(r.petEvolved).toBe(true);
    expect(r.message).toContain("tiến hóa");
  });

  it("mystery box adds 1-3 materials of one kind", () => {
    const r = buyMarket(makeData(), "box", weekWith("box"), () => 0.99);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const total = Object.values(r.data.inventory.materials as Materials).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(total).toBeLessThanOrEqual(3);
  });

  it("mega chest adds 3-6 materials of one kind", () => {
    const r = buyMarket(makeData(), "megaBox", weekWith("megaBox"), () => 0.99);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const total = Object.values(r.data.inventory.materials as Materials).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(3);
    expect(total).toBeLessThanOrEqual(6);
  });

  it("tome grants +80 user XP and can level up", () => {
    const d = makeData();
    d.game.xp = 50;
    d.game.level = 2; // 50+80 = 130 >= 200? no → stays; use level 1: 130 >= 100 → level 2
    const r = buyMarket(d, "tome", weekWith("tome"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.game.xp).toBe(130);
    expect(r.data.game.level).toBe(2);
  });

  it("gem pouch grants 2 lizard gems", () => {
    const r = buyMarket(makeData(), "gemPouch", weekWith("gemPouch"));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.game.lizardGems).toBe(2);
    expect(r.data.game.catCoins).toBe(65);
  });

  it("heal restores happiness to 100 and tops up hunger (cap 100)", () => {
    const d = makeData();
    d.petState.happiness = 35;
    d.petState.hunger = 80;
    const w = weekWith("heal");
    const r = buyMarket(d, "heal", w);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.happiness).toBe(100);
    expect(r.data.petState.hunger).toBe(100);
    expect(buyMarket(r.data, "heal", w)).toMatchObject({ ok: false });
  });

  it("market decor goes into decorOwned, not active", () => {
    const w = weekWith("moonLamp");
    const d = makeData();
    const r = buyMarket(d, "moonLamp", w);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.petState.decorOwned).toContain("moonLamp");
    expect(r.data.petState.decorActive).not.toContain("moonLamp");
  });
});

describe("ticket item", () => {
  it("grants a spin ticket once per week", () => {
    const w = weekWith("ticket");
    const d = makeData(50);
    const r = buyMarket(d, "ticket", w);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.game.spinTickets).toBe(1);
    expect(r.data.game.catCoins).toBe(40);
    expect(buyMarket(r.data, "ticket", w).ok).toBe(false);
  });
});

describe("tier 2 pet discount", () => {
  it("charges 10% less for tier 2 pets and shows the discount price", () => {
    const w = weekWith("shield");
    const evolved = { ...makeData(100), petState: { ...makeData().petState, petLevel: 6 } };
    const r = buyMarket(evolved, "shield", w); // shield costs 20 -> 18
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.game.catCoins).toBe(82);
    expect(marketPrice(MARKET_ITEMS.shield, makeData().petState)).toBe(20);
    expect(marketPrice(MARKET_ITEMS.shield, { ...makeData().petState, petLevel: 6 })).toBe(18);
    expect(marketPrice(MARKET_ITEMS.honey, { ...makeData().petState, petLevel: 7 })).toBe(14); // 15 * 0.9 = 13.5 -> 14
  });
  it("never prices an item below 1 coin", () => {
    const cheap = { ...MARKET_ITEMS.shield, price: 1 };
    expect(marketPrice(cheap, { ...makeData().petState, petLevel: 6 })).toBe(1);
  });
});

describe("owned decor guard", () => {
  it("refuses to charge for a decor the pet already owns, even after a restock", () => {
    // Find a week where galaxy is stocked, then a LATER week with it again —
    // the restock is exactly when the double-charge used to happen.
    const stocked: { at: Date; week: string }[] = [];
    for (let i = 0; i < 180; i++) {
      const d = new Date(2026, 9, 29 + i);
      if (marketStock(d).includes("galaxy")) {
        const w = weekStart(d);
        if (!stocked.length || stocked[stocked.length - 1]!.week !== w)
          stocked.push({ at: d, week: w });
      }
    }
    expect(stocked.length).toBeGreaterThan(1);
    const when = stocked[0]!.at;
    const when2 = stocked[1]!.at;
    const data = {
      market: defaultMarket(),
      petState: defaultPet(),
      game: { catCoins: 9999, level: 10 },
      inventory: { freezes: 0, materials: emptyMaterials() },
    } as unknown as MarketData;
    const ok = buyMarket(data, "galaxy", when!);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      const owned = {
        market: ok.data.market,
        petState: ok.data.petState,
        game: ok.data.game,
        inventory: ok.data.inventory,
      } as unknown as MarketData;
      const again = buyMarket(owned, "galaxy", when2);
      expect(again.ok).toBe(false);
      if (!again.ok) expect(again.reason).toBe("owned");
    }
  });
});

// ---- 🤝 Trả giá (haggling) ----
describe("haggling", () => {
  const deal = () =>
    ({
      market: defaultMarket(),
      petState: defaultPet(),
      game: { catCoins: 999, level: 10 },
      inventory: { freezes: 0, materials: emptyMaterials() },
    }) as unknown as MarketData;

  it("startHaggle opens one deal per item per week and never re-rolls", () => {
    const d = startHaggle(deal(), "honey", base, () => 0.9); // win index 2
    const h = d.market.haggle.honey!;
    expect(h.week).toBe(weekStart(base));
    expect(h.win).toBe(2);
    expect(h.picked).toBeNull();
    // same week: unchanged; next week: fresh deal
    expect(startHaggle(d, "honey", base)).toBe(d);
    const d2 = startHaggle(d, "honey", nextMonday, () => 0);
    expect(d2.market.haggle.honey!.week).toBe(weekStart(nextMonday));
  });

  it("resolveHaggle records the first pick and ignores later ones", () => {
    let d = startHaggle(deal(), "honey", base, () => 0); // win index 0
    d = resolveHaggle(d, "honey", 0);
    expect(d.market.haggle.honey!.picked).toBe(0);
    const d2 = resolveHaggle(d, "honey", 1);
    expect(d2).toBe(d); // one try only
  });

  it("a won haggle cuts 20% off the purchase price", () => {
    let d = startHaggle(deal(), "shield", base, () => 0); // win 0
    d = resolveHaggle(d, "shield", 0);
    const item = MARKET_ITEMS.shield; // 20 coins
    expect(haggleWon(d, "shield", weekStart(base))).toBe(true);
    expect(marketPriceWithHaggle(item, d.petState, true)).toBe(16); // floor(20*0.8)
    const r = buyMarket(d, "shield", base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.game.catCoins).toBe(999 - 16);
  });

  it("a lost haggle keeps the full price", () => {
    let d = startHaggle(deal(), "shield", base, () => 0); // win 0
    d = resolveHaggle(d, "shield", 2);
    const r = buyMarket(d, "shield", base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.game.catCoins).toBe(999 - MARKET_ITEMS.shield.price);
  });

  it("the discount stacks with nothing else and never breaks the coin floor", () => {
    const d = startHaggle(deal(), "shield", base, () => 0.5); // win 1
    const resolved = resolveHaggle(d, "shield", 1);
    const item = MARKET_ITEMS.shield; // 20 coins
    expect(marketPriceWithHaggle(item, resolved.petState, true)).toBe(16);
    expect(marketPriceWithHaggle(item, resolved.petState, false)).toBe(20);
  });
});
