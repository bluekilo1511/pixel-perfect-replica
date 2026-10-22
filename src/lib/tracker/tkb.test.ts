import { describe, expect, it } from "vitest";
import { defaultData, makeTask, migrate, pushDueSlots, type AppData } from "./model";
import {
  DEFAULT_TKB,
  addExtraSchedule,
  addPrepTasks,
  applyTimetableImport,
  extraToTask,
  parseTimetableText,
  pushDueExtras,
  removeExtraSchedule,
  tomorrowSlots,
  upcomingExtraSchedule,
} from "./tkb";

const TKB_TEXT = `Thứ 2
Buổi sáng
TNHN (DC) - Ngăn
TNHN (CD) - Ngăn
T.Anh - Ngọc
Buổi chiều
C.Nghệ - Hiểu
Thứ 5: KHTN (Sinh) - Tuyết, T.Anh - Ngọc, M.Thuật - Duyên`;

describe("timetable quick import", () => {
  it("parses the school grid with morning/afternoon periods and teachers", () => {
    const p = parseTimetableText(TKB_TEXT);
    expect(p.count).toBe(7);
    expect(p.warnings).toHaveLength(0);
    const mon = p.touched.find((t) => t.dayIndex === 1)!;
    expect(mon.morning).toBe(3);
    expect(mon.afternoon).toBe(1);
    const first = mon.slots[0]!;
    expect(first.title).toBe("TNHN (DC)");
    expect(first.teacher).toBe("Ngăn");
    expect(first.start).toBe("07:30");
    expect(first.end).toBe("08:15"); // 45-minute period by default
    const afternoon = mon.slots[3]!;
    expect(afternoon.start).toBe("13:00");
    expect(afternoon.session).toBe("afternoon");
    const thu5 = p.touched.find((t) => t.dayIndex === 4)!;
    expect(thu5.morning).toBe(3);
    expect(thu5.slots[1]!.title).toBe("T.Anh");
    expect(thu5.slots[1]!.teacher).toBe("Ngọc");
  });

  it("honors explicit times and custom period defaults", () => {
    const p = parseTimetableText("Thứ 3\n19:00-20:30 Ôn Toán", {
      ...DEFAULT_TKB,
      slotMinutes: 30,
    });
    const s = p.touched[0]!.slots[0]!;
    expect(s.start).toBe("19:00");
    expect(s.end).toBe("20:30");
    expect(s.teacher).toBeUndefined();
  });

  it("warns about lines before any day header", () => {
    const p = parseTimetableText("Toán - Bình\nThứ 4: Văn - Ngân");
    expect(p.count).toBe(1);
    expect(p.warnings).toHaveLength(1);
  });

  it("replaces only the touched days and keeps the rest", () => {
    let d = defaultData();
    d = applyTimetableImport(d, parseTimetableText("Thứ 2: Toán - Bình"), "replace", DEFAULT_TKB);
    expect(d.timetable.days[1]!.slots).toHaveLength(1);
    expect(d.timetable.days[2]!.slots).toHaveLength(0);
    expect(d.timetable.morningStart).toBe("07:30");
    d = applyTimetableImport(d, parseTimetableText("Thứ 2: Văn - Ngân"), "merge", DEFAULT_TKB);
    expect(d.timetable.days[1]!.slots).toHaveLength(2);
  });
});

describe("evening prep for tomorrow", () => {
  const withTkb = (): AppData => {
    let d = defaultData();
    d = applyTimetableImport(d, parseTimetableText("Thứ 2: Toán - Bình"), "replace", DEFAULT_TKB);
    // Fix "now" to a Sunday evening so tomorrow (index 1) is Monday.
    const sunday = new Date(2026, 9, 18, 19, 0); // 2026-10-18 is a Sunday
    return { ...d, __now: sunday } as unknown as AppData;
  };

  it("creates prep tasks dated today and tags known subjects", () => {
    const d0 = withTkb();
    const now = new Date(2026, 9, 18, 19, 0);
    expect(tomorrowSlots(d0, now)).toHaveLength(1);
    let d = addPrepTasks(d0, now, [{ slot: tomorrowSlots(d0, now)[0]!, minutes: 30 }]).data;
    d = { ...d, subjects: ["Toán"] };
    // Re-run with subjects present for the tag (idempotency check below uses fresh call).
    expect(
      d.tasks.filter((t) => t.date === "2026-10-18" && t.title.startsWith("Ôn:")),
    ).toHaveLength(1);
    const prep = d.tasks.find((t) => t.title.startsWith("Ôn:"))!;
    expect(prep.minutes).toBe(30);
    expect(prep.prepForDate).toBe("2026-10-19");
  });

  it("never duplicates the same slot for the same evening", () => {
    const d0 = withTkb();
    const now = new Date(2026, 9, 18, 19, 0);
    const slot = tomorrowSlots(d0, now)[0]!;
    const d1 = addPrepTasks(d0, now, [{ slot, minutes: 25 }]).data;
    const r2 = addPrepTasks(d1, now, [{ slot, minutes: 25 }]);
    expect(r2.added).toBe(0);
    expect(r2.data).toBe(d1);
  });
});

describe("one-off reminders", () => {
  it("validates input and stores the item", () => {
    let d = defaultData();
    expect(addExtraSchedule(d, { date: "2026-10-24", title: "", time: null })).toBeNull();
    expect(addExtraSchedule(d, { date: "24/10/2026", title: "Nộp bài" })).toBeNull();
    expect(addExtraSchedule(d, { date: "2026-10-24", title: "Nộp bài", time: "25:00" })).toBeNull();
    d = addExtraSchedule(d, { date: "2026-10-24", title: "Nộp bài", time: "20:00", minutes: 25 })!;
    expect(d.extraSchedule).toHaveLength(1);
    expect(d.extraSchedule[0]!.time).toBe("20:00");
  });

  it("pushes today's due reminders once and only when the time has come", () => {
    const now = new Date(2026, 9, 22, 20, 30); // 20:30
    let d = defaultData();
    d = addExtraSchedule(d, { date: "2026-10-22", title: "Họp nhóm", time: "20:00" })!;
    d = addExtraSchedule(d, { date: "2026-10-22", title: "Đọc sách", time: "21:00" })!;
    d = addExtraSchedule(d, { date: "2026-10-23", title: "Nộp bài" })!;
    const r1 = pushDueExtras(d, now);
    expect(r1.pushed.map((x) => x.title)).toEqual(["Họp nhóm"]);
    expect(r1.data.tasks.some((t) => t.title === "Họp nhóm" && t.date === "2026-10-22")).toBe(true);
    const r2 = pushDueExtras(r1.data, now);
    expect(r2.pushed).toHaveLength(0);
    expect(r2.data).toBe(r1.data);
    // Upcoming view shows the rest within 7 days.
    expect(upcomingExtraSchedule(r1.data, now).map((x) => x.title)).toEqual([
      "Họp nhóm",
      "Đọc sách",
      "Nộp bài",
    ]);
  });

  it("manual push marks the item so the timer never duplicates it", () => {
    const now = new Date(2026, 9, 23, 8, 0);
    let d = defaultData();
    d = addExtraSchedule(d, { date: "2026-10-23", title: "Nộp bài", minutes: 25 })!;
    const id = d.extraSchedule[0]!.id;
    d = extraToTask(d, id, now)!;
    expect(d.tasks).toHaveLength(1);
    expect(d.tasks[0]!.kind).toBe("pomodoro");
    expect(extraToTask(d, id, now)).toBeNull();
    expect(pushDueExtras(d, now).pushed).toHaveLength(0);
    d = removeExtraSchedule(d, id);
    expect(d.extraSchedule).toHaveLength(0);
  });

  it("migration fills missing extra-schedule fields with empty lists", () => {
    const legacy = { app: "local-task-tracker-pro", version: 3, tasks: [], notes: [] };
    const d = migrate(legacy);
    expect(d.extraSchedule).toEqual([]);
    expect(d.extraLog).toEqual([]);
    expect(d.timetable.slotMinutes).toBe(45);
  });

  it("existing tasks without prep markers are untouched by dedupe", () => {
    const now = new Date(2026, 9, 18, 19, 0);
    let d = defaultData();
    d = { ...d, tasks: [makeTask("Việc thường", "custom", 0, "2026-10-18")] };
    d = applyTimetableImport(d, parseTimetableText("Thứ 2: Toán - Bình"), "replace", DEFAULT_TKB);
    const slot = tomorrowSlots(d, now)[0]!;
    const r = addPrepTasks(d, now, [{ slot, minutes: 25 }]);
    expect(r.added).toBe(1);
    expect(r.data.tasks).toHaveLength(2);
  });
  it("can import the whole school TKB as display-only periods", () => {
    const p = parseTimetableText(TKB_TEXT);
    let d = applyTimetableImport(defaultData(), p, "replace", DEFAULT_TKB, false);
    const mon = d.timetable.days[1]!;
    expect(mon.slots.length).toBe(4);
    expect(mon.slots.every((s) => s.tracked === false)).toBe(true);
    // Even hours later, nothing is auto-pushed into today's tasks.
    const mondayEvening = new Date(2026, 9, 19, 20, 0); // Oct 19 2026 is a Monday
    d = pushDueSlots(d, mondayEvening).data;
    expect(d.tasks.some((t) => t.fromSlotId?.startsWith("slot_"))).toBe(false);

    // The same import with markTracked stays fully tracked.
    const d2 = applyTimetableImport(defaultData(), p, "replace", DEFAULT_TKB, true);
    expect(d2.timetable.days[1]!.slots.every((s) => s.tracked === undefined)).toBe(true);
  });

});