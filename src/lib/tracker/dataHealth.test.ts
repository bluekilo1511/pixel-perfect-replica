import { describe, expect, it } from "vitest";
import { cleanupData, dataHealth, removedTotal } from "./dataHealth";
import { dateStr, defaultData, makeTask } from "./model";

const shift = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateStr(d);
};

describe("data health report", () => {
  it("counts stored items and flags stale tasks, missing backup", () => {
    const d = defaultData();
    const old = makeTask("cũ", "pomodoro", 25, shift(30));
    const fresh = makeTask("mới", "pomodoro", 25, dateStr());
    const withTasks = { ...d, tasks: [...d.tasks, old, fresh] };
    const h = dataHealth(withTasks, dateStr());
    expect(h.tasks).toBe(2);
    expect(h.oldTasks).toBe(1);
    expect(h.bytes).toBeGreaterThan(1000);
    expect(h.warnings.some((w) => w.includes("nhiệm vụ quá 14 ngày"))).toBe(true);
    expect(h.warnings.some((w) => w.includes("Chưa sao lưu"))).toBe(true);
  });

  it("stays silent when the file is young and freshly backed up", () => {
    const d = {
      ...defaultData(),
      backup: { lastBackupAt: new Date().toISOString(), lastReminderAt: null },
    };
    expect(dataHealth(d).warnings).toEqual([]);
  });

  it("cleanup prunes stale tasks and trims history without touching user data", () => {
    const d = defaultData();
    let withOld = { ...d, tasks: [...d.tasks, makeTask("cũ", "pomodoro", 25, shift(30))] };
    withOld = {
      ...withOld,
      sessionLog: Array.from({ length: 450 }, (_, i) => ({
        at: new Date(2026, 0, 1, 0, i).toISOString(),
        minutes: 25,
        kind: "pomodoro" as const,
      })),
      dailyStats: Object.fromEntries(
        Array.from({ length: 200 }, (_, i) => [
          shift(i),
          { tasks: 1, focusMin: 25, water: 0, treats: 0, pomodoros: 1 },
        ]),
      ),
    };
    const r = cleanupData(withOld, dateStr());
    expect(removedTotal(r)).toBeGreaterThan(0);
    expect(r.removedSessions).toBe(50); // 450 → 400
    expect(r.removedStatsDays).toBe(20); // 200 → 180
    expect(Object.keys(r.data.dailyStats)).toHaveLength(180);
    expect(r.data.sessionLog).toHaveLength(400);
    expect(r.data.tasks.some((t) => t.date === shift(60))).toBe(false); // stale pruned
    // never touched
    expect(r.data.flashcards).toEqual(d.flashcards);
    expect(r.data.gradeBook).toEqual(d.gradeBook);
    expect(r.data.scratch).toEqual(d.scratch);
    expect(r.data.game.catCoins).toBe(d.game.catCoins);
    // idempotent: second pass removes nothing
    const r2 = cleanupData(r.data, dateStr());
    expect(removedTotal(r2)).toBe(0);
  });
});
