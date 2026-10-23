import { describe, expect, it } from "vitest";
import { claimDailySalary, dailySalary, defaultData, dateStr } from "./model";

describe("dailySalary", () => {
  it("scales with level and caps at 15", () => {
    expect(dailySalary(1)).toBe(2);
    expect(dailySalary(5)).toBe(6);
    expect(dailySalary(10)).toBe(11);
    expect(dailySalary(14)).toBe(15);
    expect(dailySalary(99)).toBe(15);
  });
});

describe("claimDailySalary", () => {
  it("pays once, then refuses the same day", () => {
    const d = defaultData();
    const today = dateStr();
    const r1 = claimDailySalary(d, today);
    expect(r1.coins).toBe(2); // level 1
    expect(r1.data.game.catCoins).toBe(2);
    expect(r1.data.game.lastSalaryDate).toBe(today);
    const r2 = claimDailySalary(r1.data, today);
    expect(r2.coins).toBe(0);
    expect(r2.data).toBe(r1.data); // unchanged object
  });

  it("pays again the next day, scaled to the new level", () => {
    const d = defaultData();
    const r1 = claimDailySalary(d, "2026-03-01");
    r1.data.game.level = 7;
    const r2 = claimDailySalary(r1.data, "2026-03-02");
    expect(r2.coins).toBe(8);
    expect(r2.data.game.catCoins).toBe(10);
  });
});
