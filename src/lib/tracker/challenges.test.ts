import { describe, expect, it } from "vitest";
import { CHALLENGE_POOL, challengeFor, challengeProgress } from "./challenges";
import { claimChallenge, defaultData, makeTask, migrate } from "./model";

const day = "2026-10-30";
const at = (h: number) => new Date(2026, 9, 30, h, 0).toISOString();

describe("challengeFor", () => {
  it("picks a deterministic challenge per day", () => {
    expect(challengeFor("2026-10-30").id).toBe(challengeFor("2026-10-30").id);
    expect(CHALLENGE_POOL.some((c) => c.id === challengeFor("2026-10-30").id)).toBe(true);
  });
});

describe("challengeProgress", () => {
  it("earlyBird counts only pre-7am completions", () => {
    const d = defaultData();
    d.tasks.push(makeTask("Dậy sớm", "custom", 0, day, { completed: true, completedAt: at(6) }));
    expect(challengeProgress(d, CHALLENGE_POOL[0]!, day).done).toBe(true);
    const d2 = defaultData();
    d2.tasks.push(makeTask("Muộn", "custom", 0, day, { completed: true, completedAt: at(8) }));
    expect(challengeProgress(d2, CHALLENGE_POOL[0]!, day).done).toBe(false);
  });

  it("noonRush counts only pre-noon completions", () => {
    const d = defaultData();
    for (let h = 9; h < 12; h++) {
      d.tasks.push(makeTask(`T${h}`, "custom", 0, day, { completed: true, completedAt: at(h) }));
    }
    expect(challengeProgress(d, CHALLENGE_POOL[1]!, day).done).toBe(true);
  });

  it("unbroken requires a >=25min session with zero pauses", () => {
    const d0 = defaultData();
    d0.tasks.push(
      makeTask("Học Toán", "pomodoro", 25, day, { completed: true, completedAt: at(20) }),
    );
    d0.sessionLog.push({ at: at(20), minutes: 25, kind: "pomodoro" });
    expect(challengeProgress(d0, CHALLENGE_POOL[2]!, day).done).toBe(true);
    const dPaused = migrate({
      ...d0,
      sessionLog: d0.sessionLog.map((s) => ({ ...s, interruptions: 1 })),
    });
    expect(challengeProgress(dPaused, CHALLENGE_POOL[2]!, day).done).toBe(false);
  });

  it("marathon needs a 45+ minute session", () => {
    const d = defaultData();
    d.tasks.push(
      makeTask("Học Văn", "pomodoro", 50, day, { completed: true, completedAt: at(20) }),
    );
    d.sessionLog.push({ at: at(20), minutes: 50, kind: "pomodoro" });
    expect(challengeProgress(d, CHALLENGE_POOL[3]!, day).done).toBe(true);
    expect(challengeProgress(defaultData(), CHALLENGE_POOL[3]!, day).done).toBe(false);
  });

  it("owl counts only post-8pm completions", () => {
    const d = defaultData();
    d.tasks.push(makeTask("Tối 1", "custom", 0, day, { completed: true, completedAt: at(21) }));
    d.tasks.push(makeTask("Tối 2", "custom", 0, day, { completed: true, completedAt: at(22) }));
    expect(challengeProgress(d, CHALLENGE_POOL[4]!, day).done).toBe(true);
    expect(challengeProgress(defaultData(), CHALLENGE_POOL[4]!, day).done).toBe(false);
  });

  it("powerSix needs six completions in the day", () => {
    const d = defaultData();
    for (let i = 0; i < 6; i++) {
      d.tasks.push(
        makeTask(`Nhiệm vụ ${i}`, "custom", 0, day, { completed: true, completedAt: at(15) }),
      );
    }
    expect(challengeProgress(d, CHALLENGE_POOL[5]!, day).done).toBe(true);
    expect(challengeProgress(defaultData(), CHALLENGE_POOL[5]!, day).done).toBe(false);
  });
});

describe("claimChallenge", () => {
  it("claims once per day and pays the reward", () => {
    const d = defaultData();
    const def = challengeFor(day);
    // Build data that satisfies EVERY pool entry so the test is date-independent.
    d.tasks.push(makeTask("Sớm", "custom", 0, day, { completed: true, completedAt: at(6) }));
    for (let h = 9; h < 12; h++)
      d.tasks.push(
        makeTask(`Sáng ${h}`, "custom", 0, day, { completed: true, completedAt: at(h) }),
      );
    d.tasks.push(makeTask("Tối 1", "custom", 0, day, { completed: true, completedAt: at(21) }));
    d.tasks.push(makeTask("Tối 2", "custom", 0, day, { completed: true, completedAt: at(22) }));
    for (let i = 0; i < 6; i++)
      d.tasks.push(
        makeTask(`Nhiệm vụ ${i}`, "custom", 0, day, { completed: true, completedAt: at(15) }),
      );
    d.sessionLog.push({ at: at(20), minutes: 50, kind: "pomodoro" });
    const r = claimChallenge(d, new Date(2026, 9, 30, 23, 0));
    expect(r.ok).toBe(true);
    expect(r.data.game.catCoins).toBe(def.reward.catCoins);
    expect(r.data.challenge).toEqual({ date: day, claimed: true });
    const again = claimChallenge(r.data, new Date(2026, 9, 30, 23, 30));
    expect(again.ok).toBe(false);
  });

  it("rejects when the condition is not met", () => {
    const r = claimChallenge(defaultData(), new Date(2026, 9, 30, 21, 0));
    expect(r.ok).toBe(false);
  });
});
