import { describe, expect, it } from "vitest";
import { defaultData, makeTask } from "./model";
import {
  addWeekGoal,
  currentWeekGoals,
  normalizeWeekGoals,
  pinTaskAsWeekGoal,
  removeWeekGoal,
  toggleWeekGoalDone,
  WEEK_GOALS_MAX,
} from "./goals";

const NOW = new Date("2026-10-21T10:00:00"); // Wednesday
const WEEK = "2026-10-19"; // its Monday

describe("week goals", () => {
  it("pins a task as a goal of the current week", () => {
    const base = defaultData();
    const withTask = { ...base, tasks: [makeTask("Học Toán chương 3", "pomodoro", 25, "2026-10-21")] };
    const pinned = pinTaskAsWeekGoal(withTask, withTask.tasks[0]!.id, NOW)!;
    expect(pinned.weekGoals).toHaveLength(1);
    expect(pinned.weekGoals[0]).toMatchObject({ title: "Học Toán chương 3", weekStart: WEEK, doneAt: null });
  });

  it("rejects duplicates (case-insensitive) and empty titles", () => {
    const base = defaultData();
    const first = addWeekGoal(base, "Dậy sớm cả tuần", NOW)!;
    expect(addWeekGoal(first, "dậy sớm cả tuần", NOW)).toBeNull();
    expect(addWeekGoal(base, "   ", NOW)).toBeNull();
  });

  it("caps goals per week at 6", () => {
    let d = defaultData();
    for (let i = 0; i < WEEK_GOALS_MAX + 2; i++) d = addWeekGoal(d, `Mục tiêu ${i}`, NOW) ?? d;
    expect(currentWeekGoals(d, NOW)).toHaveLength(WEEK_GOALS_MAX);
  });

  it("toggles done and removes", () => {
    const base = defaultData();
    const g = addWeekGoal(base, "Ôn Hoá", NOW)!;
    const done = toggleWeekGoalDone(g, g.weekGoals[0]!.id, NOW);
    expect(done.weekGoals[0]!.doneAt).toBeTruthy();
    const undone = toggleWeekGoalDone(done, g.weekGoals[0]!.id, NOW);
    expect(undone.weekGoals[0]!.doneAt).toBeNull();
    expect(currentWeekGoals(removeWeekGoal(undone, g.weekGoals[0]!.id), NOW)).toHaveLength(0);
  });

  it("only shows goals of the current week", () => {
    const base = defaultData();
    const old = addWeekGoal(base, "Tuần trước", new Date("2026-10-06T10:00:00"))!;
    const both = addWeekGoal(old, "Tuần này", NOW)!;
    expect(currentWeekGoals(both, NOW).map((g) => g.title)).toEqual(["Tuần này"]);
  });

  it("normalizes junk safely", () => {
    expect(normalizeWeekGoals(null)).toEqual([]);
    expect(normalizeWeekGoals([{ weekStart: "nope", title: "x" }])).toEqual([]);
    const ok = normalizeWeekGoals([{ weekStart: WEEK, title: "  Ôn Lí  ", doneAt: "nope" }]);
    expect(ok[0]).toMatchObject({ title: "Ôn Lí", weekStart: WEEK, doneAt: null });
  });
});
