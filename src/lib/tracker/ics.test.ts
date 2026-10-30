import { describe, expect, it } from "vitest";
import { buildIcs, escapeIcsText, nextDateFor } from "./ics";
import { emptyTimetable, type ExtraScheduleItem, type Slot } from "./model";

const slot = (over: Partial<Slot>): Slot => ({
  id: "s1",
  start: "19:00",
  end: "20:00",
  title: "Tự học Toán",
  kind: "pomodoro",
  minutes: 25,
  ...over,
});

describe("escapeIcsText", () => {
  it("escapes commas, semicolons, backslashes and newlines", () => {
    expect(escapeIcsText("Học; tập, thử\\n1")).toBe(
      "Hoc\\; tap\\, thu\\\\n1".replace("Hoc", "Học").replace("tap", "tập").replace("thu", "thử"),
    );
  });
});

describe("nextDateFor", () => {
  it("returns the next matching weekday", () => {
    // 2026-10-30 is a Friday (dayIndex 5)
    const now = new Date(2026, 9, 30, 10, 0);
    expect(nextDateFor(5, now)!.toDateString()).toBe(new Date(2026, 9, 30).toDateString());
    expect(nextDateFor(6, now)!.getDate()).toBe(31); // Saturday is tomorrow
    expect(nextDateFor(0, now)!.getDate()).toBe(1); // Sunday
    expect(nextDateFor(9, now)).toBeNull();
  });
});

describe("buildIcs", () => {
  const now = new Date(2026, 9, 30, 10, 0);

  it("emits weekly recurring events for personal slots", () => {
    const tt = emptyTimetable();
    tt.days[5]!.slots = [slot({})];
    const ics = buildIcs(tt, [], now);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Tự học Toán");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=FR");
    expect(ics).toContain("DTSTART:20261030T190000");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("\r\n");
  });

  it("adds the teacher to the summary", () => {
    const tt = emptyTimetable();
    tt.days[1]!.slots = [slot({ title: "Toán", teacher: "Cô Hằng", id: "s2" })];
    const ics = buildIcs(tt, [], now);
    expect(ics).toContain("SUMMARY:Toán (Cô Hằng)");
    expect(ics).toContain("DTSTART:20261102T190000"); // next Monday
  });

  it("skips display-only slots", () => {
    const tt = emptyTimetable();
    tt.days[5]!.slots = [slot({ tracked: false })];
    expect(buildIcs(tt, [], now)).not.toContain("BEGIN:VEVENT");
  });

  it("exports timed and all-day reminders", () => {
    const extras: ExtraScheduleItem[] = [
      {
        id: "e1",
        date: "2026-11-05",
        title: "Học thêm",
        time: "18:30",
        minutes: 90,
        createdAt: "",
      },
      { id: "e2", date: "2026-11-06", title: "Nộp bài", time: null, minutes: 0, createdAt: "" },
    ];
    const ics = buildIcs(emptyTimetable(), extras, now);
    expect(ics).toContain("DTSTART:20261105T183000");
    expect(ics).toContain("DTEND:20261105T200000");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261106");
    expect(ics).toContain("SUMMARY:Nộp bài");
  });

  it("ignores invalid input instead of throwing", () => {
    const extras = [
      { id: "e3", date: "not-a-date", title: "X", time: "99:99", minutes: 0, createdAt: "" },
    ] as unknown as ExtraScheduleItem[];
    const tt = emptyTimetable();
    tt.days[3]!.slots = [slot({ start: "bad", end: "worse" })];
    expect(buildIcs(tt, extras, now)).not.toContain("BEGIN:VEVENT");
  });
});
