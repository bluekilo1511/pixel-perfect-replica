import { describe, expect, it } from "vitest";
import { defaultData, makeTask, migrate } from "./model";
import { dueReminders, pruneFiredKeys } from "./reminders";

const today = "2026-10-22";
const task = (over: Partial<Parameters<typeof makeTask>[4]> = {}) =>
  makeTask("Ôn Hóa", "pomodoro", 25, today, { remindAt: "20:00", ...over });

describe("dueReminders", () => {
  it("fires when the time has arrived, once per day", () => {
    const t = task();
    const fired = new Set<string>();
    expect(dueReminders([t], today, 19 * 60, fired)).toHaveLength(0);
    const due = dueReminders([t], today, 20 * 60, fired);
    expect(due).toHaveLength(1);
    expect(due[0]!.hhmm).toBe("20:00");
    expect(due[0]!.key).toBe(`${t.id}@${today}`);
  });

  it("skips completed tasks, other days and invalid times", () => {
    const done = task({ completed: true });
    const otherDay = task();
    otherDay.date = "2026-10-23";
    const bad = task({ remindAt: "25:99" });
    const none = makeTask("Không hẹn giờ", "custom", 0, today, {});
    expect(dueReminders([done, otherDay, bad, none], today, 23 * 59, new Set())).toHaveLength(0);
  });

  it("ignores already-fired keys and sorts by time", () => {
    const a = task({ remindAt: "21:00" });
    const b = task({ remindAt: "19:00" });
    const fired = new Set([`${a.id}@${today}`]);
    const due = dueReminders([a, b], today, 22 * 60, fired);
    expect(due.map((r) => r.hhmm)).toEqual(["19:00"]);
  });
});

describe("pruneFiredKeys", () => {
  it("keeps only today's keys", () => {
    expect(pruneFiredKeys(["a@2026-10-22", "b@2026-10-21"], today)).toEqual(["a@2026-10-22"]);
  });
});

describe("model integration", () => {
  it("stores remindAt through makeTask and survives migrate", () => {
    const data = defaultData();
    const t = task();
    const migrated = migrate({ ...data, tasks: [t] });
    expect(migrated.tasks[0]!.remindAt).toBe("20:00");
  });
});
