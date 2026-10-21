import { describe, expect, it } from "vitest";
import { bossCounterAttack, bossHp, defeatBoss } from "./boss";
import { defaultPet } from "./gamify";

describe("boss raid", () => {
  it("hp tracks remaining pomodoro time", () => {
    expect(bossHp(1500, 1500)).toBe(100);
    expect(bossHp(750, 1500)).toBe(50);
    expect(bossHp(0, 1500)).toBe(0);
  });
  it("defeat awards 2x coins (10) and 2 gems", () => {
    expect(defeatBoss({ catCoins: 1, lizardGems: 1 })).toEqual({ catCoins: 11, lizardGems: 3 });
  });
  it("cancel reduces pet happiness by 15", () => {
    const p = { ...defaultPet(), happiness: 50 };
    expect(bossCounterAttack(p).happiness).toBe(42);
    expect(bossCounterAttack({ ...p, happiness: 5 }).happiness).toBe(0);
  });
});
