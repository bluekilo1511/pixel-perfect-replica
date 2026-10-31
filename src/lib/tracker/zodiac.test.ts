import { describe, expect, it } from "vitest";
import { DEFAULT_ZODIAC_ID, ZODIAC_LIST, isValidZodiacId, zodiacById } from "./zodiac";
import { applyAdminBoost, isAdminBoostKind, migrate } from "./model";

const TABS = ["today", "stats", "week", "shop", "chronicle", "settings"];

describe("zodiac constellations", () => {
  it("has exactly 12 unique signs", () => {
    expect(ZODIAC_LIST).toHaveLength(12);
    expect(new Set(ZODIAC_LIST.map((z) => z.id)).size).toBe(12);
  });

  it("each constellation covers every tab across its 7 stars", () => {
    for (const z of ZODIAC_LIST) {
      expect(z.name.length).toBeGreaterThan(0);
      expect(z.range).toMatch(/\d+\/\d+/);
      expect(z.stars).toHaveLength(7);
      const tabs = z.stars.map((s) => s.tab);
      // Pet Shop has two stars since the Wheel tab merged into it.
      expect(new Set(tabs)).toEqual(new Set(TABS));
      for (const s of z.stars) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(100);
        expect(s.r).toBeGreaterThan(0);
      }
      for (const [a, b] of z.lines) {
        expect(a).not.toBe(b);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(7);
      }
    }
  });

  it("scorpio is the default and lookups fall back safely", () => {
    expect(DEFAULT_ZODIAC_ID).toBe("scorpio");
    expect(zodiacById("scorpio").name).toBe("Thiên Yết");
    expect(isValidZodiacId("scorpio")).toBe(true);
    expect(isValidZodiacId("nope")).toBe(false);
    // unknown ids fall back to the default constellation
    expect(zodiacById("nope").id).toBe(DEFAULT_ZODIAC_ID);
  });

  it("migration fills zodiac settings and normalizes bad values", () => {
    const data = migrate({});
    expect(data.settings.navZodiac).toBe(DEFAULT_ZODIAC_ID);
    expect(data.settings.admin).toBe(false);

    const weird = migrate({
      settings: {
        navZodiac: "not-a-sign",
        admin: true,
      },
    });
    expect(weird.settings.navZodiac).toBe(DEFAULT_ZODIAC_ID);
    expect(weird.settings.admin).toBe(true);

    const good = migrate({ settings: { navZodiac: "pisces" } });
    expect(good.settings.navZodiac).toBe("pisces");
  });
});

describe("admin boosts", () => {
  const base = migrate({});

  it("recognizes valid kinds only", () => {
    for (const k of ["xp", "catCoins", "lizardGems", "spinTickets", "streak", "petXp"]) {
      expect(isAdminBoostKind(k)).toBe(true);
    }
    expect(isAdminBoostKind("coins2")).toBe(false);
  });

  it("grants xp, coins, gems, tickets", () => {
    expect(applyAdminBoost(base, "xp", 100).game.xp).toBe(base.game.xp + 100);
    expect(applyAdminBoost(base, "catCoins", 100).game.catCoins).toBe(base.game.catCoins + 100);
    expect(applyAdminBoost(base, "lizardGems", 10).game.lizardGems).toBe(base.game.lizardGems + 10);
    expect(applyAdminBoost(base, "spinTickets", 5).game.spinTickets).toBe(
      base.game.spinTickets + 5,
    );
  });

  it("grants streak (with best bump) and pet xp", () => {
    const s = applyAdminBoost(base, "streak", 1).streak;
    expect(s.count).toBe(base.streak.count + 1);
    expect(s.best).toBeGreaterThanOrEqual(s.count);
    expect(applyAdminBoost(base, "petXp", 50).petState.petXp).toBe(base.petState.petXp + 50);
  });

  it("zero boost is a no-op and does not mutate the original", () => {
    const out = applyAdminBoost(base, "xp", 0);
    expect(out).toBe(base);
    expect(out.game.xp).toBe(base.game.xp);
  });
});
