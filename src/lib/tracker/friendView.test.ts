import { describe, expect, it } from "vitest";
import { defaultData, makeTask } from "./model";
import { emptyDay } from "./extras";
import { exportShare, summarizeFriend } from "./friendView";

describe("summarizeFriend", () => {
  it("rejects non-objects", () => {
    expect(summarizeFriend(null)).toMatchObject({ ok: false });
    expect(summarizeFriend("hello")).toMatchObject({ ok: false });
    expect(summarizeFriend([1, 2])).toMatchObject({ ok: false });
  });

  it("rejects JSON that is not a tracker backup", () => {
    expect(summarizeFriend({ hello: "world" })).toMatchObject({ ok: false });
  });

  it("accepts a full backup file and digests it", () => {
    const data = defaultData();
    data.game.level = 7;
    data.game.xp = 42;
    data.game.catCoins = 12;
    data.game.lizardGems = 3;
    data.streak.count = 9;
    data.streak.best = 14;
    data.petState.petLevel = 4;
    data.achievements.lifetime = { tasks: 120, focusMin: 3100, pomodoros: 90 };
    data.dailyStats["2026-10-01"] = { ...emptyDay(), tasks: 5, focusMin: 125 };
    data.dailyStats["2026-10-02"] = { ...emptyDay(), focusMin: 25 };
    data.tasks = [
      makeTask("A", "pomodoro", 25, "2026-10-01", { completed: true, rewardClaimed: true }),
    ];
    const r = summarizeFriend(data);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.level).toBe(7);
    expect(r.xp).toBe(42);
    expect(r.streakNow).toBe(9);
    expect(r.streakBest).toBe(14);
    expect(r.lifetimeTasks).toBe(120);
    expect(r.lifetimeFocusMin).toBe(3100);
    expect(r.lifetimePomodoros).toBe(90);
    expect(r.catCoins).toBe(12);
    expect(r.lizardGems).toBe(3);
    expect(r.petLabel).toContain("Lv.4");
    expect(r.tasksCompleted).toBe(1);
    expect(r.activeDays).toBe(2);
  });

  it("tolerates old files without app marker but with tasks", () => {
    const r = summarizeFriend({ tasks: [], version: 2 });
    expect(r.ok).toBe(true);
  });
});

describe("share files", () => {
  it("exports only study stats (no grades, journal, notes or coins)", () => {
    const d = defaultData();
    d.ownerName = "Tuấn";
    d.game.catCoins = 999;
    d.dailyStats["2026-10-30"] = { tasks: 3, focusMin: 75, water: 2, treats: 1, pomodoros: 2 };
    const payload = exportShare(d, new Date(2026, 9, 30, 20, 0));
    expect(payload.app).toBe("tpp-share");
    expect(payload.name).toBe("Tuấn");
    expect(payload.last7).toHaveLength(7);
    expect(payload.last7[6]).toEqual({ date: "2026-10-30", focusMin: 75, tasks: 3 });
    const json = JSON.stringify(payload);
    expect(json).not.toContain("gradeBook");
    expect(json).not.toContain("journal");
    expect(json).not.toContain("catCoins");
  });

  it("summarizeFriend reads a share payload", () => {
    const d = defaultData();
    d.ownerName = "Lan";
    d.dailyStats["2026-10-30"] = { tasks: 2, focusMin: 50, water: 0, treats: 0, pomodoros: 2 };
    const r = summarizeFriend(exportShare(d, new Date(2026, 9, 30, 20, 0)));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.name).toBe("Lan");
      expect(r.last7?.[6]?.focusMin).toBe(50);
      expect(r.catCoins).toBe(0);
    }
  });

  it("summarizeFriend still accepts old backup files", () => {
    const d = defaultData();
    d.tasks.push(makeTask("Học", "pomodoro", 25, "2026-10-30", { completed: true }));
    const r = summarizeFriend(JSON.parse(JSON.stringify(d)));
    expect(r.ok).toBe(true);
  });
});
