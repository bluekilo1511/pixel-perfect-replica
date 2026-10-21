import { describe, expect, it } from "vitest";
import { defaultData, addSubject, makeTask, UNTAGGED_LABEL } from "./model";
import { subjectChartRows, subjectMinutes } from "./subjectStats";
import { mondayOf } from "./weeklyReport";

const now = new Date(2026, 9, 21, 12, 0); // Wednesday

function withSessions(d = defaultData()) {
  return {
    ...d,
    sessionLog: [
      { at: "2026-10-19T09:00:00.000Z", minutes: 50, kind: "pomodoro" as const, subject: "Toán" },
      { at: "2026-10-20T09:00:00.000Z", minutes: 25, kind: "pomodoro" as const, subject: "Toán" },
      { at: "2026-10-20T11:00:00.000Z", minutes: 25, kind: "pomodoro" as const, subject: "Lý" },
      { at: "2026-10-20T13:00:00.000Z", minutes: 15, kind: "pomodoro" as const },
      { at: "2026-10-12T09:00:00.000Z", minutes: 90, kind: "pomodoro" as const, subject: "Toán" }, // last week
      { at: "2026-10-20T14:00:00.000Z", minutes: 10, kind: "warmup" as const }, // warmups never count
    ],
  };
}

describe("subject stats", () => {
  it("groups pomodoro minutes by subject, untagged bucket last resort", () => {
    const rows = subjectMinutes(withSessions(), "2026-10-19");
    expect(rows).toEqual([
      { label: "Toán", minutes: 75 },
      { label: "Lý", minutes: 25 },
      { label: UNTAGGED_LABEL, minutes: 15 },
    ]);
  });

  it("range all includes previous weeks", () => {
    const rows = subjectMinutes(withSessions(), null);
    expect(rows[0]).toEqual({ label: "Toán", minutes: 165 });
  });

  it("chart rows carry a bar percentage relative to the leader", () => {
    const rows = subjectChartRows(withSessions(), "week", mondayOf, now);
    expect(rows[0]?.pct).toBe(100);
    expect(rows[1]?.pct).toBe(Math.round((25 / 75) * 100));
  });

  it("task completion tags ride along via the model", () => {
    let d = defaultData();
    d = addSubject(d, "Hoá")!;
    expect(d.subjects).toEqual(["Hoá"]);
    expect(addSubject(d, "hoá")).toBeNull(); // duplicate, case-insensitive
  });

  it("completed pomodoro tasks log a session with their subject", async () => {
    const { completeTask } = await import("./model");
    let d = defaultData();
    d = addSubject(d, "Sử")!;
    const t = makeTask("Học Sử", "pomodoro", 25, "2026-10-21", { subject: "Sử" });
    d = { ...d, tasks: [...d.tasks, t] };
    const r = completeTask(d, t.id, now);
    const last = r.data.sessionLog.at(-1)!;
    expect(last).toMatchObject({ minutes: 25, kind: "pomodoro", subject: "Sử" });
  });
});
