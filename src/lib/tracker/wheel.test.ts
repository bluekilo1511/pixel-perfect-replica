import { describe, expect, it } from "vitest";
import {
  JACKPOT_PRIZE,
  JACKPOT_TICKETS,
  MEGA_PRIZES,
  PITY_LIMIT,
  SPIN_COST,
  SPIN_SELL_COINS,
  WHEEL_PRIZES,
  applyPrize,
  autoSpinModes,
  beginSpin,
  canSpin,
  dateStr,
  defaultGame,
  isWeekend,
  recordSpin,
  rollWheel,
  sellSpinTickets,
} from "./model";

const rng0 = () => 0; // always the first segment, never jackpot

describe("rollWheel", () => {
  it("returns a normal prize when the roll lands inside the segments", () => {
    const r = rollWheel("normal", 0, rng0);
    expect(r.jackpot).toBe(false);
    expect(WHEEL_PRIZES).toContain(r.prize);
  });

  it("mega mode rolls from the doubled prize list", () => {
    const r = rollWheel("mega", 0, rng0);
    expect(MEGA_PRIZES).toContain(r.prize);
  });

  it("guarantees the jackpot when pity reaches the limit", () => {
    const r = rollWheel("normal", PITY_LIMIT - 1, () => 0.999);
    expect(r).toEqual({ prize: JACKPOT_PRIZE, jackpot: true });
  });

  it("can roll the jackpot by chance", () => {
    const r = rollWheel("normal", 0, () => 0.999);
    expect(r.jackpot).toBe(true);
  });
});

describe("free daily spin", () => {
  it("works without tickets, once per day", () => {
    const g = defaultGame("2026-10-22");
    g.spinTickets = 0;
    expect(canSpin(g, "free", new Date("2026-10-22T10:00:00"))).toBe(true);
    const b = beginSpin(g, "free", new Date("2026-10-22T10:00:00"), rng0);
    expect(b.game.spinTickets).toBe(0); // free: no ticket consumed
    expect(b.game.freeSpinDate).toBe("2026-10-22");
    expect(canSpin(b.game, "free", new Date("2026-10-22T15:00:00"))).toBe(false);
    expect(canSpin(b.game, "free", new Date("2026-10-23T10:00:00"))).toBe(true);
  });
});

describe("mega weekend spin", () => {
  it("is blocked on weekdays and allowed on weekends", () => {
    const g = defaultGame("2026-10-22");
    g.spinTickets = 5;
    expect(isWeekend(new Date("2026-10-22T10:00:00"))).toBe(false); // Thursday
    expect(canSpin(g, "mega", new Date("2026-10-22T10:00:00"))).toBe(false);
    expect(isWeekend(new Date("2026-10-25T10:00:00"))).toBe(true); // Sunday
    expect(canSpin(g, "mega", new Date("2026-10-25T10:00:00"))).toBe(true);
  });

  it("costs two tickets", () => {
    const g = defaultGame("2026-10-25");
    g.spinTickets = 5;
    const b = beginSpin(g, "mega", new Date("2026-10-25T10:00:00"), rng0);
    expect(b.game.spinTickets).toBe(3);
  });

  it("is blocked without enough tickets", () => {
    const g = defaultGame("2026-10-25");
    g.spinTickets = 1;
    expect(canSpin(g, "mega", new Date("2026-10-25T10:00:00"))).toBe(false);
  });
});

describe("recordSpin", () => {
  it("counts pity, totals and history", () => {
    const g = defaultGame("2026-10-22");
    g.spinTickets = 3;
    const b = beginSpin(g, "normal", new Date("2026-10-22T10:00:00"), rng0);
    const r = recordSpin(b.game, b.prize, b.jackpot, "normal", "2026-10-22T10:00:05");
    expect(r.game.wheelPity).toBe(1);
    expect(r.game.totalSpins).toBe(1);
    expect(r.game.jackpotsWon).toBe(0);
    expect(r.game.spinHistory[0]!.prize).toBe(b.prize);
    expect(r.game.spinHistory[0]!.mode).toBe("normal");
  });

  it("jackpot grants tickets and resets pity", () => {
    const g = defaultGame("2026-10-22");
    g.spinTickets = 1;
    g.wheelPity = PITY_LIMIT - 1;
    const b = beginSpin(g, "normal", new Date("2026-10-22T10:00:00")); // pity guarantee
    expect(b.prize).toBe(JACKPOT_PRIZE);
    const r = recordSpin(b.game, b.prize, b.jackpot, "normal");
    expect(r.game.spinTickets).toBe(JACKPOT_TICKETS); // 1 - 1 cost + 10 jackpot
    expect(r.game.wheelPity).toBe(0);
    expect(r.game.jackpotsWon).toBe(1);
  });
});

describe("applyPrize", () => {
  it("parses the jackpot as extra spin tickets", () => {
    const g = defaultGame("2026-10-22");
    const r = applyPrize(g, JACKPOT_PRIZE);
    expect(r.game.spinTickets).toBe(JACKPOT_TICKETS);
  });

  it("still handles the classic prizes", () => {
    const g = defaultGame("2026-10-22");
    expect(applyPrize(g, "+10 XP").game.xp).toBeGreaterThan(0);
    expect(applyPrize(g, "+2 😺").game.catCoins).toBe(2);
    expect(applyPrize(g, "+2 🎡").game.spinTickets).toBe(2);
    expect(WHEEL_PRIZES).toContain("+2 🎡"); // spin prize now gives 2 tickets (net +1 after the paid spin)
    expect(MEGA_PRIZES).toContain("+4 🎡");
  });
});

describe("sellSpinTickets", () => {
  it("sells every ticket at the balanced rate and adds catCoins", () => {
    const g = { ...defaultGame(), spinTickets: 5, catCoins: 10 };
    const r = sellSpinTickets(g);
    expect(r.sold).toBe(5);
    expect(r.coins).toBe(5 * SPIN_SELL_COINS);
    expect(r.game.spinTickets).toBe(0);
    expect(r.game.catCoins).toBe(10 + 5 * SPIN_SELL_COINS);
  });

  it("sells a partial amount and never goes below zero", () => {
    const g = { ...defaultGame(), spinTickets: 3 };
    expect(sellSpinTickets(g, 99).sold).toBe(3);
    expect(sellSpinTickets(g, 1).game.spinTickets).toBe(2);
    expect(sellSpinTickets(g, 0).sold).toBe(0);
    expect(sellSpinTickets({ ...g, spinTickets: 0 }).sold).toBe(0);
  });

  it("keeps the free spin available after selling everything", () => {
    const g = { ...defaultGame(), spinTickets: 4 };
    const r = sellSpinTickets(g);
    expect(canSpin(r.game, "free")).toBe(true);
  });
});

describe("autoSpinModes", () => {
  it("spins the free spin first, then keeps 2 tickets for weekend MEGA on a weekday", () => {
    const modes = autoSpinModes({ ...defaultGame(), spinTickets: 3 }, false);
    expect(modes[0]).toBe("free");
    expect(modes.filter((m) => m === "normal")).toHaveLength(1);
  });

  it("leaves exactly 2 tickets untouched on a weekday", () => {
    const modes = autoSpinModes(
      { ...defaultGame(), freeSpinDate: dateStr(new Date()), spinTickets: 2 },
      false,
    );
    expect(modes).toEqual([]);
  });

  it("prefers MEGA pairs on the weekend and spends the leftover normally", () => {
    const modes = autoSpinModes(
      { ...defaultGame(), freeSpinDate: dateStr(new Date()), spinTickets: 5 },
      true,
    );
    expect(modes.filter((m) => m === "mega")).toHaveLength(2);
    expect(modes.filter((m) => m === "normal")).toHaveLength(1);
  });

  it("returns nothing when the free spin is used and there are no tickets", () => {
    const modes = autoSpinModes({ ...defaultGame(), freeSpinDate: dateStr(new Date()) }, false);
    expect(modes).toEqual([]);
  });

  it("matches SPIN_COST so a weekday never dips into the MEGA reserve", () => {
    const modes = autoSpinModes(
      { ...defaultGame(), freeSpinDate: dateStr(new Date()), spinTickets: SPIN_COST.mega },
      false,
    );
    expect(modes).toEqual([]);
  });
});
