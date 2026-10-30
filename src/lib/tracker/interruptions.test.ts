import { describe, expect, it } from "vitest";
import { interruptionSummary } from "./interruptions";
import { defaultData, type AppData } from "./model";

const dataWith = (patch: (d: AppData) => void): AppData => {
  const d = defaultData();
  patch(d);
  return d;
};

describe("interruptionSummary", () => {
  const now = new Date(2026, 9, 30, 21, 0); // 2026-10-30

  it("counts pauses and break-ins per day and hour", () => {
    const d = dataWith((x) => {
      x.sessionLog.push({
        at: "2026-10-30T19:00:00",
        minutes: 25,
        kind: "pomodoro",
        interruptions: 2,
      });
      // Interruption log is the source of truth for the chart.
      x.interruptionLog.push("2026-10-30T19:30:00", "2026-10-30T19:45:00", "2026-10-29T08:00:00");
    });
    const s = interruptionSummary(d, now, 14);
    expect(s.total).toBe(3);
    expect(s.days[13]!).toEqual({ date: "2026-10-30", sessions: 1, interruptions: 2 });
    expect(s.days[12]!).toEqual({ date: "2026-10-29", sessions: 0, interruptions: 1 });
    expect(s.worstDay?.date).toBe("2026-10-30");
    expect(s.worstHour).toBe(19);
  });

  it("returns an empty, well-formed window with no data", () => {
    const s = interruptionSummary(defaultData(), now, 14);
    expect(s.total).toBe(0);
    expect(s.days).toHaveLength(14);
    expect(s.days[0]!.date).toBe("2026-10-17");
    expect(s.days[13]!.date).toBe("2026-10-30");
    expect(s.worstDay).toBeNull();
    expect(s.worstHour).toBeNull();
  });

  it("ignores timestamps outside the window", () => {
    const d = dataWith((x) => {
      x.interruptionLog.push("2026-09-01T10:00:00");
    });
    const s = interruptionSummary(d, now, 14);
    expect(s.total).toBe(0);
  });
});
