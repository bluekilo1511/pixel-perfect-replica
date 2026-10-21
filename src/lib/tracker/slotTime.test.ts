import { describe, expect, it } from "vitest";
import { defaultData, nextSlotToday, runningSlotToday } from "./model";

// 2026-02-04 is a Wednesday.
const day = (h: number, m: number) => new Date(2026, 1, 4, h, m);

function dataWithSlots(...slots: { start: string; end: string; title: string }[]) {
  const data = defaultData();
  data.timetable.days[3]!.slots = slots.map((s, i) => ({
    id: `slot-${i}`,
    start: s.start,
    end: s.end,
    title: s.title,
    kind: "pomodoro" as const,
    minutes: 25,
  }));
  return data;
}

describe("nextSlotToday / runningSlotToday", () => {
  it("finds the next slot sorted by start time", () => {
    const d = dataWithSlots(
      { start: "14:00", end: "14:50", title: "Toán" },
      { start: "10:00", end: "10:30", title: "Tiếng Anh" },
    );
    const next = nextSlotToday(d, day(8, 0));
    expect(next?.title).toBe("Tiếng Anh");
  });

  it("returns null when every slot has passed", () => {
    const d = dataWithSlots({ start: "08:00", end: "08:30", title: "Lịch sử" });
    expect(nextSlotToday(d, day(10, 0))).toBeNull();
  });

  it("detects the slot running right now", () => {
    const d = dataWithSlots({ start: "09:00", end: "10:30", title: "Văn" });
    expect(runningSlotToday(d, day(9, 45))?.title).toBe("Văn");
    expect(runningSlotToday(d, day(10, 30))).toBeNull();
  });

  it("treats the running slot as not-next", () => {
    const d = dataWithSlots(
      { start: "09:00", end: "10:30", title: "Văn" },
      { start: "14:00", end: "14:50", title: "Toán" },
    );
    expect(nextSlotToday(d, day(9, 45))?.title).toBe("Toán");
  });
});
