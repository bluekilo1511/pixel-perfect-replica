import { describe, expect, it } from "vitest";
import { defaultData, rewardFor, dateStr, sellSpinTickets } from "../lib/tracker/model";
import {
  buyMarket,
  startHaggle,
  resolveHaggle,
  marketStock,
  MARKET_ITEMS,
} from "../lib/tracker/market";
import { buyConvenience } from "../lib/tracker/convenience";
import { grantStudyReward } from "../lib/tracker/study";

describe("currency synchronization & consistency", () => {
  it("never produces negative currencies during purchases", () => {
    const data = defaultData();
    data.game.catCoins = 5;

    // Buying convenience costing 30 coins should fail and keep balance intact
    const failConv = buyConvenience(data, "charm");
    expect(failConv.ok).toBe(false);
    expect(data.game.catCoins).toBe(5);

    // Buying market item currently in stock without enough coins should fail with not-enough-coins
    const now = new Date();
    const stock = marketStock(now);
    const itemInStock = stock[0]!;
    const itemPrice = MARKET_ITEMS[itemInStock]!.price;
    data.game.catCoins = Math.max(0, itemPrice - 10);
    const failMarket = buyMarket(data, itemInStock, now);
    expect(failMarket.ok).toBe(false);
    expect(failMarket.reason).toBe("not-enough-coins");
  });

  it("handles sequential rewards without losing coin increments", () => {
    let data = defaultData();
    data.game.catCoins = 10;
    const today = dateStr();

    // Reward 1: study game reward
    const rw1 = grantStudyReward(data.studyRewards, today);
    data = {
      ...data,
      studyRewards: rw1.state,
      game: { ...data.game, catCoins: data.game.catCoins + rw1.coins },
    };
    expect(data.game.catCoins).toBe(15);

    // Reward 2: study game reward again
    const rw2 = grantStudyReward(data.studyRewards, today);
    data = {
      ...data,
      studyRewards: rw2.state,
      game: { ...data.game, catCoins: data.game.catCoins + rw2.coins },
    };
    expect(data.game.catCoins).toBe(20);

    // Reward 3: study game reward (hits 3/3 daily cap)
    const rw3 = grantStudyReward(data.studyRewards, today);
    data = {
      ...data,
      studyRewards: rw3.state,
      game: { ...data.game, catCoins: data.game.catCoins + rw3.coins },
    };
    expect(data.game.catCoins).toBe(25);

    // Reward 4: beyond daily cap -> 0 extra coins
    const rw4 = grantStudyReward(data.studyRewards, today);
    expect(rw4.coins).toBe(0);
    data = {
      ...data,
      studyRewards: rw4.state,
      game: { ...data.game, catCoins: data.game.catCoins + rw4.coins },
    };
    expect(data.game.catCoins).toBe(25);
  });

  it("sells spin tickets accurately and syncs to wallet", () => {
    const game = {
      catCoins: 50,
      lizardGems: 10,
      spinTickets: 7,
      userXp: 100,
      userLevel: 2,
    };

    // Sells 5 tickets @ 8 coins = 40 coins
    const res = sellSpinTickets(game, 5);
    expect(res.sold).toBe(5);
    expect(res.coins).toBe(40);
    expect(res.game.catCoins).toBe(90);
    expect(res.game.spinTickets).toBe(2);
  });

  it("rewards from Pomodoro task give coins, gems and spins", () => {
    const r = rewardFor("pomodoro");
    expect(r.cat).toBe(1);
    expect(r.lizard).toBe(1);
    expect(r.spins).toBe(1);
    expect(r.xp).toBe(30);
  });

  it("haggling preserves item pricing and applies cleanly", () => {
    const data = defaultData();
    data.game.catCoins = 100;
    data.game.level = 10;
    const now = new Date("2026-04-15T10:00:00Z");
    const stock = marketStock(now);
    const item = stock[0]!;
    const originalPrice = MARKET_ITEMS[item]!.price;

    const d1 = startHaggle(data, item, now);
    const h = d1.market!.haggle![item];
    // Simulate winning pick
    const d2 = resolveHaggle(d1, item, h.win);
    expect(d2.market!.haggle![item].picked).toBe(h.win);

    // Now buying with 20% discount
    const expectedDiscounted = Math.max(1, Math.floor(originalPrice * 0.8));
    const buyRes = buyMarket(d2, item, now);
    expect(buyRes.ok).toBe(true);
    expect(buyRes.data.game.catCoins).toBe(100 - expectedDiscounted);
  });
});
