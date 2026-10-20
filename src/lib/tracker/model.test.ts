import { describe, expect, it } from "vitest";
import {
  addWaterCup,
  addXp,
  completePomodoroSession,
  completeTask,
  defaultData,
  editTask,
  ensureDailyPins,
  makeTask,
  markWaterNudged,
  migrate,
  needsBackupReminder,
  pushDueSlots,
  shouldNudgeWater,
} from "./model";

describe("tracker rules", () => {
  it("timetable starts on Sunday with 7 days", () => {
    const d = defaultData();
    expect(d.timetable.days[0]!.label).toBe("Chủ Nhật");
    expect(d.timetable.days[6]!.label).toBe("Thứ Bảy");
  });

  it("completing a task rewards once and cannot be re-triggered", () => {
    let d = defaultData();
    const t = makeTask("Học", "pomodoro", 25, "2026-10-18");
    d = { ...d, tasks: [t] };
    const a = completeTask(d, t.id);
    expect(a.rewarded).toBe(true);
    expect(a.data.game.spinTickets).toBe(1);
    const b = completeTask(a.data, t.id);
    expect(b.rewarded).toBe(false);
    expect(b.data.game.xp).toBe(a.data.game.xp);
  });

  it("levels up when XP bar is full", () => {
    const r = addXp(defaultData().game, 120);
    expect(r.game.level).toBe(2);
    expect(r.game.xp).toBe(20);
  });

  it("water goal is 8 cups", () => {
    let d = defaultData();
    for (let i = 0; i < 10; i++) d = addWaterCup(d).data;
    expect(d.game.water.cups).toBe(8);
  });

  it("pins 3 exercise sessions once per day", () => {
    const d = ensureDailyPins(ensureDailyPins(defaultData(), "2026-10-18"), "2026-10-18");
    expect(d.tasks.filter((t) => t.kind === "exercise" && t.minutes === 5)).toHaveLength(3);
  });

  it("pushes due slot into today once", () => {
    let d = defaultData();
    d.timetable.days[0]!.slots.push({
      id: "s1",
      start: "07:00",
      end: "07:25",
      title: "Học",
      kind: "pomodoro",
      minutes: 25,
    });
    const sunday8am = new Date(2026, 9, 18, 8, 0); // Oct 18 2026 is a Sunday
    d = pushDueSlots(d, sunday8am).data;
    d = pushDueSlots(d, sunday8am).data;
    expect(d.tasks.filter((t) => t.fromSlotId === "s1")).toHaveLength(1);
  });

  it("migrates old files without losing tasks", () => {
    const d = migrate({
      tasks: [{ id: "a", title: "Cũ", customMinutes: 10, completed: true }],
      gameState: { catCoins: 4 },
    });
    expect(d.tasks[0]!.title).toBe("Cũ");
    expect(d.tasks[0]!.rewardClaimed).toBe(true);
    expect(d.game.catCoins).toBe(4);
    expect(d.game.level).toBe(1);
    expect(d.timetable.days).toHaveLength(7);
  });

  it("finished Pomodoro records a completed entry without extra rewards", () => {
    const d = defaultData();
    const xpBefore = d.game.xp;
    const r = completePomodoroSession(d, 25, new Date(2026, 9, 18, 10, 0));
    const rec = r.data.tasks.find((t) => t.title.includes("Pomodoro tập trung"));
    expect(rec).toBeDefined();
    expect(rec!.completed).toBe(true);
    expect(rec!.rewardClaimed).toBe(true);
    expect(rec!.date).toBe("2026-10-18");
    expect(r.data.game.xp).toBe(xpBefore); // record only, no XP change
    expect(r.data.dailyStats["2026-10-18"]!.pomodoros).toBe(1);
  });

  it("expedition triggers on cumulative daily focus (2 sessions of 25p)", () => {
    let d = defaultData();
    const day = new Date(2026, 9, 18, 10, 0);
    d = completePomodoroSession(d, 25, day).data;
    expect(d.expedition.startedAt).toBeNull(); // 25p alone is not enough
    d = completePomodoroSession(d, 25, new Date(2026, 9, 18, 14, 0)).data;
    expect(d.expedition.startedAt).not.toBeNull(); // 50p cumulative triggers
    expect(d.expedition.lastTriggerDate).toBe("2026-10-18");
  });

  it("backup reminder fires after 7 days and snoozes for 24h", () => {
    const now = new Date(2026, 9, 20, 12, 0);
    const fresh = defaultData();
    expect(needsBackupReminder(fresh, now)).toBe(true); // never backed up
    const backedUp = {
      ...fresh,
      backup: { lastBackupAt: now.toISOString(), lastReminderAt: null },
    };
    expect(needsBackupReminder(backedUp, now)).toBe(false);
    const stale = {
      ...fresh,
      backup: { lastBackupAt: "2026-10-10T00:00:00.000Z", lastReminderAt: null },
    };
    expect(needsBackupReminder(stale, now)).toBe(true);
    const snoozed = { ...stale, backup: { ...stale.backup, lastReminderAt: now.toISOString() } };
    expect(needsBackupReminder(snoozed, now)).toBe(false);
    const snoozeExpired = {
      ...stale,
      backup: { ...stale.backup, lastReminderAt: "2026-10-18T00:00:00.000Z" },
    };
    expect(needsBackupReminder(snoozeExpired, now)).toBe(true);
  });

  it("old files without backup field migrate safely", () => {
    const m = migrate({ version: 3, tasks: [] });
    expect(m.backup).toEqual({ lastBackupAt: null, lastReminderAt: null });
  });
});

describe("task editing", () => {
  it("edits an unfinished task and resets its countdown", () => {
    let d = defaultData();
    const t = makeTask("Học Toán", "pomodoro", 25, "2026-10-20", { remainingSeconds: 600 });
    d = { ...d, tasks: [t] };
    const next = editTask(d, t.id, { title: "Học Lý", minutes: 50, kind: "custom" });
    expect(next).not.toBeNull();
    const edited = next!.tasks.find((x) => x.id === t.id)!;
    expect(edited.title).toBe("Học Lý");
    expect(edited.kind).toBe("custom");
    expect(edited.minutes).toBe(50);
    expect(edited.remainingSeconds).toBe(50 * 60);
  });

  it("keeps the countdown when only the title changes", () => {
    let d = defaultData();
    const t = makeTask("Học Toán", "pomodoro", 25, "2026-10-20", { remainingSeconds: 600 });
    d = { ...d, tasks: [t] };
    const next = editTask(d, t.id, { title: "  Học Lý  " });
    expect(next!.tasks.find((x) => x.id === t.id)!.title).toBe("Học Lý");
    expect(next!.tasks.find((x) => x.id === t.id)!.remainingSeconds).toBe(600);
  });

  it("moving to another day drops the timetable badge", () => {
    let d = defaultData();
    const t = makeTask("Học", "pomodoro", 25, "2026-10-20", {
      timeRange: "07:30 - 08:15",
      fromSlotId: "s1",
    });
    d = { ...d, tasks: [t] };
    const next = editTask(d, t.id, { date: "2026-10-21" });
    const edited = next!.tasks.find((x) => x.id === t.id)!;
    expect(edited.date).toBe("2026-10-21");
    expect(edited.timeRange).toBeUndefined();
    expect(edited.fromSlotId).toBeUndefined();
  });

  it("refuses to edit a completed task or an unknown id", () => {
    let d = defaultData();
    const t = makeTask("Học", "pomodoro", 25, "2026-10-20");
    d = { ...d, tasks: [{ ...t, completed: true, rewardClaimed: true }] };
    expect(editTask(d, t.id, { title: "X" })).toBeNull();
    expect(editTask(defaultData(), "nope", { title: "X" })).toBeNull();
  });

  it("falls back to the kind label when the title is blank", () => {
    let d = defaultData();
    const t = makeTask("Học", "pomodoro", 25, "2026-10-20");
    d = { ...d, tasks: [t] };
    const next = editTask(d, t.id, { title: "   " });
    expect(next!.tasks.find((x) => x.id === t.id)!.title.length).toBeGreaterThan(0);
  });
});

describe("water nudge", () => {
  const base = (pomodoros: number, cups = 0) => {
    let d = defaultData();
    d = {
      ...d,
      dailyStats: {
        ...d.dailyStats,
        "2026-10-20": { tasks: 0, focusMin: pomodoros * 25, water: cups, treats: 0, pomodoros },
      },
    };
    d = { ...d, game: { ...d.game, water: { date: "2026-10-20", cups, rewarded: false } } };
    return d;
  };
  const now = new Date(2026, 9, 20, 20, 0);

  it("nudges right after every 2nd Pomodoro while the goal is not reached", () => {
    expect(shouldNudgeWater(base(1), now)).toBe(false);
    expect(shouldNudgeWater(base(2), now)).toBe(true);
    expect(shouldNudgeWater(base(3), now)).toBe(false);
    expect(shouldNudgeWater(base(4), now)).toBe(true);
  });

  it("does not repeat the same nudge or nudge after the goal", () => {
    expect(shouldNudgeWater(markWaterNudged(base(2), now), now)).toBe(false);
    expect(shouldNudgeWater(base(2, 8), now)).toBe(false);
  });

  it("marks the nudge for today", () => {
    const d = markWaterNudged(base(2), now);
    expect(d.game.water.lastNudgePomodoros).toBe(2);
    expect(d.game.water.date).toBe("2026-10-20");
  });
});

describe("pomodoro presets", () => {
  it("keeps custom durations and normalizes saved presets", () => {
    const d = migrate({
      settings: { pomodoroMinutes: 90, customPresets: [90, 90, 25, 300, "70"] },
    });
    expect(d.settings.pomodoroMinutes).toBe(90);
    expect(d.settings.customPresets).toEqual([70, 90]);
  });

  it("falls back to defaults on bad values", () => {
    const d = migrate({ settings: { pomodoroMinutes: 9999, customPresets: "nope" } });
    expect(d.settings.pomodoroMinutes).toBe(25);
    expect(d.settings.customPresets).toEqual([]);
  });
});
