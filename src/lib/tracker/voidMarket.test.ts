import { describe, expect, it } from "vitest";
import { defaultData, makeTask } from "./model";
import {
  isTaskStale,
  calculateVoidReward,
  sacrificeTask,
  sacrificeAllStale,
} from "./voidMarket";

describe("voidMarket", () => {
  const today = "2026-11-16";
  const yesterday = "2026-11-15";

  it("identifies stale tasks correctly", () => {
    const fresh = makeTask("Bài tập hôm nay", "pomodoro", 25, today);
    const stale = makeTask("Bài tập hôm qua", "pomodoro", 25, yesterday);
    const pinned = makeTask("Việc ghim hôm qua", "pomodoro", 25, yesterday, { pinned: true });
    const completed = makeTask("Việc xong hôm qua", "pomodoro", 25, yesterday);
    completed.completed = true;

    expect(isTaskStale(fresh, today)).toBe(false);
    expect(isTaskStale(stale, today)).toBe(true);
    expect(isTaskStale(pinned, today)).toBe(false);
    expect(isTaskStale(completed, today)).toBe(false);
  });

  it("calculates rewards with minute bonus and material drops", () => {
    const task = makeTask("Ôn tập lớn", "pomodoro", 60, yesterday);
    // with random() returning 0.1, drops starShard
    const r1 = calculateVoidReward(task, () => 0.1);
    expect(r1.coins).toBe(6 + 4); // 6 + floor(60/15) = 10
    expect(r1.xp).toBe(15);
    expect(r1.material).toBe("starShard");

    // with random() returning 0.9, no material drop
    const r2 = calculateVoidReward(task, () => 0.9);
    expect(r2.material).toBeUndefined();
  });

  it("sacrifices single stale task and removes it from list", () => {
    let d = defaultData();
    const stale = makeTask("Bài cũ", "pomodoro", 30, yesterday);
    const fresh = makeTask("Bài mới", "pomodoro", 25, today);
    d = { ...d, tasks: [stale, fresh] };

    const initialCoins = d.game.catCoins;
    const res = sacrificeTask(d, stale.id, new Date(`${today}T12:00:00`), () => 0.05);

    expect(res.ok).toBe(true);
    if (!res.ok || !res.data || !res.reward) return;

    expect(res.data.tasks.find((t) => t.id === stale.id)).toBeUndefined();
    expect(res.data.tasks.find((t) => t.id === fresh.id)).toBeDefined();
    expect(res.data.game.catCoins).toBeGreaterThan(initialCoins);
    expect(res.data.inventory.materials.starShard).toBe(1);
  });

  it("rejects non-stale or completed tasks", () => {
    let d = defaultData();
    const fresh = makeTask("Bài mới", "pomodoro", 25, today);
    d = { ...d, tasks: [fresh] };

    const res = sacrificeTask(d, fresh.id, new Date(`${today}T12:00:00`));
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("not-stale");
  });

  it("sacrifices all stale tasks in batch", () => {
    let d = defaultData();
    const t1 = makeTask("Cũ 1", "pomodoro", 30, yesterday);
    const t2 = makeTask("Cũ 2", "pomodoro", 45, yesterday);
    const fresh = makeTask("Mới", "pomodoro", 25, today);
    d = { ...d, tasks: [t1, t2, fresh] };

    const res = sacrificeAllStale(d, new Date(`${today}T12:00:00`), () => 0.05);
    expect(res.ok).toBe(true);
    expect(res.count).toBe(2);
    expect(res.data.tasks).toHaveLength(1);
    expect(res.data.tasks[0]?.id).toBe(fresh.id);
    expect(res.totalCoins).toBeGreaterThanOrEqual(16);
  });
});
