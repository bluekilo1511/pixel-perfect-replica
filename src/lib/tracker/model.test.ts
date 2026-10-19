import { describe, expect, it } from "vitest";
import { addWaterCup, addXp, completeTask, defaultData, ensureDailyPins, makeTask, migrate, pushDueSlots } from "./model";

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
    d.timetable.days[0]!.slots.push({ id: "s1", start: "07:00", end: "07:25", title: "Học", kind: "pomodoro", minutes: 25 });
    const sunday8am = new Date(2026, 9, 18, 8, 0); // Oct 18 2026 is a Sunday
    d = pushDueSlots(d, sunday8am).data;
    d = pushDueSlots(d, sunday8am).data;
    expect(d.tasks.filter((t) => t.fromSlotId === "s1")).toHaveLength(1);
  });

  it("migrates old files without losing tasks", () => {
    const d = migrate({ tasks: [{ id: "a", title: "Cũ", customMinutes: 10, completed: true }], gameState: { catCoins: 4 } });
    expect(d.tasks[0]!.title).toBe("Cũ");
    expect(d.tasks[0]!.rewardClaimed).toBe(true);
    expect(d.game.catCoins).toBe(4);
    expect(d.game.level).toBe(1);
    expect(d.timetable.days).toHaveLength(7);
  });
});
