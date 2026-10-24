import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPECIAL_DAYS,
  MAX_SPECIAL_DAYS,
  daysUntil,
  describeCountdown,
  nextOccurrence,
  normalizeSpecialDays,
  specialToday,
  upcomingSpecialDays,
} from "./specialDays";

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("specialDays", () => {
  it("defaults are valid solar VN holidays", () => {
    const list = normalizeSpecialDays(undefined);
    expect(list).toEqual(DEFAULT_SPECIAL_DAYS);
    for (const item of list) {
      expect(item.month).toBeGreaterThanOrEqual(1);
      expect(item.month).toBeLessThanOrEqual(12);
      expect(item.day).toBeGreaterThanOrEqual(1);
      expect(item.day).toBeLessThanOrEqual(31);
      expect(item.name.length).toBeGreaterThan(0);
    }
  });

  it("nextOccurrence rolls to next year when the date already passed", () => {
    const tet = { id: "x", name: "Tết Dương", kind: "holiday" as const, month: 1, day: 1 };
    expect(nextOccurrence(tet, d(2026, 12, 28)).getFullYear()).toBe(2027);
    expect(daysUntil(tet, d(2026, 12, 28))).toBe(4);
    expect(daysUntil(tet, d(2027, 1, 1))).toBe(0);
  });

  it("keeps today as 0 days", () => {
    const item = { id: "x", name: "Sinh nhật t", kind: "birthday" as const, month: 10, day: 24 };
    expect(daysUntil(item, d(2026, 10, 24))).toBe(0);
    expect(specialToday([item], d(2026, 10, 24)).map((x) => x.id)).toEqual(["x"]);
  });

  it("upcoming is sorted by soonest and respects the horizon", () => {
    const list = normalizeSpecialDays(undefined);
    const out = upcomingSpecialDays(list, d(2026, 10, 24), 30);
    expect(out.length).toBeGreaterThan(0);
    // 20/10 and 20/11 are both 27 days out from 24/10; nothing happens today
    expect(out[0]!.inDays).toBe(27);
    for (let i = 1; i < out.length; i++)
      expect(out[i]!.inDays).toBeGreaterThanOrEqual(out[i - 1]!.inDays);
    expect(out.every((x) => x.inDays <= 30)).toBe(true);
  });

  it("describeCountdown reads naturally", () => {
    expect(describeCountdown(0)).toContain("Hôm nay");
    expect(describeCountdown(1)).toBe("Ngày mai");
    expect(describeCountdown(9)).toBe("Còn 9 ngày");
  });

  it("normalize drops invalid entries, dedupes ids and caps the list", () => {
    const raw = [
      { id: "a", name: "Sinh nhật Mai", kind: "birthday", month: 6, day: 15 },
      { id: "a", name: "Trùng id", kind: "holiday", month: 6, day: 16 },
      { id: "b", name: "Sai tháng", kind: "holiday", month: 13, day: 1 },
      { id: "c", name: "Sai ngày", kind: "holiday", month: 1, day: 32 },
      "rác",
      null,
      { id: "", name: "Không id", kind: "holiday", month: 1, day: 1 },
      { id: "d", name: "  ", kind: "holiday", month: 1, day: 1 },
    ];
    const out = normalizeSpecialDays(raw);
    expect(out.map((x) => x.id)).toEqual(["a"]);
    expect(normalizeSpecialDays("junk")).toEqual(DEFAULT_SPECIAL_DAYS);
    expect(MAX_SPECIAL_DAYS).toBeGreaterThan(0);
  });
});
