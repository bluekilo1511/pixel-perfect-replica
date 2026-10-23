import { describe, expect, it } from "vitest";
import { completePomodoroSession, completeTask, defaultData, makeTask, migrate } from "./model";
import {
  BOSS_MAX_HP,
  BOSS_REWARD,
  DAILY_BOSS_TASK_DAMAGE,
  dailyBossHpLeft,
  defaultDailyBoss,
} from "./boss";

const dayA = new Date(2026, 9, 23, 10, 0); // 2026-10-23
const dayB = new Date(2026, 9, 24, 10, 0); // 2026-10-24

const dataWithTasks = (n: number) => {
  const d = defaultData();
  const tasks = Array.from({ length: n }, (_, i) =>
    makeTask(`Việc ${i + 1}`, "custom", 0, "2026-10-23"),
  );
  return { ...d, tasks };
};

describe("daily boss from tasks", () => {
  it("each task deals damage; 5 tasks defeat the boss exactly once", () => {
    let d = dataWithTasks(6);
    const coinsBefore = d.game.catCoins;
    let defeatedCount = 0;
    for (let i = 0; i < 6; i++) {
      const t = d.tasks.find((x) => !x.completed)!;
      const r = completeTask(d, t.id, dayA);
      d = r.data;
      if (r.bossDefeated) defeatedCount++;
    }
    expect(DAILY_BOSS_TASK_DAMAGE * 5).toBe(BOSS_MAX_HP);
    expect(defeatedCount).toBe(1);
    expect(d.dailyBoss).toEqual({ date: "2026-10-23", defeated: true });
    // task rewards (1 coin each) + one boss bonus
    expect(d.game.catCoins).toBe(coinsBefore + 6 * 1 + BOSS_REWARD.catCoins);
    expect(d.game.lizardGems).toBe(BOSS_REWARD.lizardGems);
  });

  it("a boss Pomodoro session after task defeat marks the day without extra boss reward path", () => {
    // store-level guard lives in finishPomodoro; here the session itself stays reward-neutral
    let d = dataWithTasks(5);
    for (let i = 0; i < 5; i++) {
      const t = d.tasks.find((x) => !x.completed)!;
      d = completeTask(d, t.id, dayA).data;
    }
    expect(d.dailyBoss.defeated).toBe(true);
    const r = completePomodoroSession(d, 25, dayA);
    expect(r.data.dailyBoss.defeated).toBe(true);
  });

  it("resets on a new day", () => {
    let d = dataWithTasks(1);
    const t0 = d.tasks[0]!;
    d = completeTask(d, t0.id, dayA).data;
    expect(d.dailyBoss.defeated).toBe(false);
    const t1 = makeTask("Việc ngày mới", "custom", 0, "2026-10-24");
    d = { ...d, tasks: [...d.tasks, t1] };
    const r = completeTask(d, t1.id, dayB);
    expect(r.bossDefeated).toBe(false);
    expect(d.dailyBoss.date).toBe("2026-10-23");
    expect(r.data.dailyBoss).toEqual({ date: "2026-10-24", defeated: false });
  });

  it("dailyBossHpLeft reflects tasks, defeat and day reset", () => {
    const boss = defaultDailyBoss();
    expect(dailyBossHpLeft(boss, "2026-10-23", 0)).toBe(BOSS_MAX_HP);
    expect(dailyBossHpLeft(boss, "2026-10-23", 3)).toBe(BOSS_MAX_HP - 60);
    expect(dailyBossHpLeft(boss, "2026-10-23", 9)).toBe(0);
    expect(dailyBossHpLeft({ date: "2026-10-23", defeated: true }, "2026-10-23", 0)).toBe(0);
    expect(dailyBossHpLeft({ date: "2026-10-22", defeated: true }, "2026-10-23", 0)).toBe(
      BOSS_MAX_HP,
    );
  });

  it("migrate keeps the daily boss state", () => {
    const m = migrate({
      ...defaultData(),
      dailyBoss: { date: "2026-10-23", defeated: true },
    });
    expect(m.dailyBoss).toEqual({ date: "2026-10-23", defeated: true });
    expect(migrate({}).dailyBoss).toEqual(defaultDailyBoss());
  });
});
