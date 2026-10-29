import { describe, expect, it } from "vitest";
import {
  addExam,
  defaultData,
  makeTask,
  migrate,
  removeExam,
  setTaskExam,
  updateExam,
} from "./model";
import {
  addExamScore,
  daysUntil,
  examLabel,
  formatDateVN,
  needsFocusSubject,
  normalizeExamScores,
  normalizeExams,
  parseDateVN,
  upcomingExams,
} from "./exams";
import type { ExamEvent } from "./exams";
import { addExamPrepTasks, slotSubject } from "./tkb";

describe("exam countdown", () => {
  it("counts whole days until the exam", () => {
    expect(daysUntil("2026-10-20", "2026-10-20")).toBe(0);
    expect(daysUntil("2026-10-21", "2026-10-20")).toBe(1);
    expect(daysUntil("2026-10-19", "2026-10-20")).toBe(-1);
    expect(daysUntil("2026-11-01", "2026-10-20")).toBe(12);
  });

  it("lists upcoming exams soonest first and drops past ones", () => {
    const exams = [
      { id: "a", name: "Toán", date: "2026-10-25" },
      { id: "b", name: "Lý", date: "2026-10-21" },
      { id: "c", name: "Hóa", date: "2026-10-19" },
    ];
    const up = upcomingExams(exams, "2026-10-20");
    expect(up.map((e) => e.id)).toEqual(["b", "a"]);
    expect(up[0]!.daysLeft).toBe(1);
  });

  it("labels countdowns in Vietnamese", () => {
    expect(examLabel(0)).toBe("Hôm nay!");
    expect(examLabel(1)).toBe("Ngày mai!");
    expect(examLabel(5)).toBe("còn 5 ngày");
  });

  it("normalizeExams keeps only well-formed events and fills ids", () => {
    expect(normalizeExams(null)).toEqual([]);
    expect(normalizeExams("junk")).toEqual([]);
    const out = normalizeExams([
      { name: "Toán", date: "2026-11-02" }, // id filled
      { id: "keep", name: "Lý", date: "not-a-date" }, // dropped
      "junk", // dropped
      { id: "ok", name: "Hóa", date: "2026-11-03" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!.id).toMatch(/^exam_/);
    expect(out.map((e) => e.id)).toContain("ok");
  });
});

describe("Vietnamese date helpers", () => {
  it("parseDateVN reads dd/mm/yyyy (and dd-mm-yyyy, dd.mm.yyyy, dd/mm/yy)", () => {
    expect(parseDateVN("04/11/2026")).toBe("2026-11-04");
    expect(parseDateVN("4-11-26")).toBe("2026-11-04");
    expect(parseDateVN("06.11.2026")).toBe("2026-11-06");
    expect(parseDateVN("2026-11-04")).toBe("2026-11-04"); // ISO passes through
    expect(parseDateVN("")).toBeNull();
    expect(parseDateVN("32/13/2026")).toBeNull();
    expect(parseDateVN("31/02/2026")).toBeNull();
    expect(parseDateVN("hnăm sau")).toBeNull();
  });

  it("formatDateVN renders ISO dates as dd/mm/yyyy", () => {
    expect(formatDateVN("2026-11-04")).toBe("04/11/2026");
    expect(formatDateVN("junk")).toBe("");
  });

  it("normalizeExams keeps the optional session fields", () => {
    const out = normalizeExams([
      {
        name: "Ngữ văn Tin",
        date: "2026-11-04",
        buoi: "Sáng",
        gioBatDau: "07:30",
        thoiGian: "90 phút",
        khoi: "8, 9",
      },
      { name: "Toán", date: "2026-11-05", buoi: "  ", gioBatDau: "không phải giờ" },
    ]);
    expect(out[0]).toMatchObject({
      buoi: "Sáng",
      gioBatDau: "07:30",
      thoiGian: "90 phút",
      khoi: "8, 9",
    });
    expect(out[1]?.buoi).toBeUndefined();
    expect(out[1]?.gioBatDau).toBeUndefined();
  });
});

describe("exam CRUD on the data model", () => {
  it("migrates old files with empty exams and keeps provided ones", () => {
    expect(migrate({}).exams).toEqual([]);
    const data = migrate({ exams: [{ name: "Toán", date: "2026-11-02" }] });
    expect(data.exams).toHaveLength(1);
    expect(data.exams[0]!.name).toBe("Toán");
  });

  it("addExam appends valid events and rejects invalid ones", () => {
    const base = defaultData();
    const added = addExam(base, "  Thi cuối kỳ  ", "2026-11-02");
    expect(added.exams).toHaveLength(1);
    expect(added.exams[0]!.name).toBe("Thi cuối kỳ");
    expect(addExam(base, "", "2026-11-02")).toBe(base);
    expect(addExam(base, "Thi", "11-02")).toBe(base);
  });

  it("addExam stores the optional session details and updateExam edits an event", () => {
    let data = addExam(defaultData(), "Ngữ văn Tin", "2026-11-04", {
      buoi: "Sáng",
      gioBatDau: "07:30",
      thoiGian: "90 phút",
      khoi: "8, 9",
    });
    const exam = data.exams[0]!;
    expect(exam).toMatchObject({
      buoi: "Sáng",
      gioBatDau: "07:30",
      thoiGian: "90 phút",
      khoi: "8, 9",
    });

    data = updateExam(data, exam.id, { date: "2026-11-06", buoi: "Chiều", gioBatDau: "13:30" });
    expect(data.exams[0]).toMatchObject({
      date: "2026-11-06",
      buoi: "Chiều",
      gioBatDau: "13:30",
      thoiGian: "90 phút",
    });

    // unknown id / bad date / blank name are no-ops
    expect(updateExam(data, "nope", { name: "X" })).toBe(data);
    expect(updateExam(data, exam.id, { date: "11-02" })).toBe(data);
    expect(updateExam(data, exam.id, { name: "  " })).toBe(data);
    // clearing optional fields works
    data = updateExam(data, exam.id, { buoi: "", thoiGian: "" });
    expect(data.exams[0]?.buoi).toBeUndefined();
    expect(data.exams[0]?.thoiGian).toBeUndefined();
  });

  it("removeExam deletes the event and untags its tasks", () => {
    let data = addExam(defaultData(), "Toán", "2026-11-02");
    const examId = data.exams[0]!.id;
    const task = makeTask("Ôn Toán", "pomodoro", 25, "2026-10-20", { examId });
    data = { ...data, tasks: [task] };
    const after = removeExam(data, examId);
    expect(after.exams).toHaveLength(0);
    expect(after.tasks[0]!.examId).toBeUndefined();
    expect(removeExam(data, "nope")).toBe(data);
  });

  it("setTaskExam tags a task only with a known exam", () => {
    let data = addExam(defaultData(), "Toán", "2026-11-02");
    const examId = data.exams[0]!.id;
    const task = makeTask("Ôn bài", "pomodoro", 25, "2026-10-20");
    data = { ...data, tasks: [task] };
    data = setTaskExam(data, task.id, examId);
    expect(data.tasks[0]!.examId).toBe(examId);
    expect(setTaskExam(data, task.id, "ghost")).toBe(data);
    data = setTaskExam(data, task.id, null);
    expect(data.tasks[0]!.examId).toBeUndefined();
  });
});

describe("exam scores", () => {
  it("adds and rejects scores per subject", () => {
    expect(addExamScore([], { subject: "Hóa", score: 8.5 })).toHaveLength(1);
    expect(addExamScore([], { subject: "", score: 5 })).toBeNull();
    expect(addExamScore([], { subject: "Toán", score: 12, max: 10 })).toBeNull();
  });

  it("needsFocusSubject warns after two consecutive low scores", () => {
    let list = addExamScore([], { subject: "Hóa", score: 7 })!;
    list = addExamScore(list, { subject: "Hóa", score: 6.5 })!;
    expect(needsFocusSubject(list, "Hóa")).toContain("ưu tiên ôn");
    list = addExamScore(list, { subject: "Hóa", score: 9 })!;
    expect(needsFocusSubject(list, "Hóa")).toBeNull();
    expect(needsFocusSubject(list, "Toán")).toBeNull();
  });

  it("normalizes old data and caps scores at max", () => {
    const list = normalizeExamScores([{ subject: "Toán", score: 15, max: 10 }]);
    expect(list[0]!.score).toBe(10);
    expect(normalizeExamScores("junk")).toEqual([]);
    expect(normalizeExamScores([{ subject: "  ", score: 5 }])).toEqual([]);
  });
});

describe("exam <-> subject link", () => {
  const base = { id: "e1", name: "Giữa kỳ", date: "2026-11-20" };

  it("keeps an optional subject (mon) through normalization", () => {
    const list = normalizeExams([{ ...base, mon: "Tiếng Anh" }]);
    expect(list[0]!.mon).toBe("Tiếng Anh");
    expect(normalizeExams([{ ...base, mon: "   " }])[0]!.mon).toBeUndefined();
  });

  it("set via addExam, edited and cleared via updateExam", () => {
    let d = defaultData();
    d = addExam(d, "Giữa kỳ", "2026-11-20", { mon: "Toán" });
    expect(d.exams[0]!.mon).toBe("Toán");
    d = updateExam(d, d.exams[0]!.id, { mon: "Văn" });
    expect(d.exams[0]!.mon).toBe("Văn");
    d = updateExam(d, d.exams[0]!.id, { mon: "" });
    expect(d.exams[0]!.mon).toBeUndefined();
  });

  it("prep tasks carry the linked exam subject", () => {
    const today = "2026-11-18";
    const exam: ExamEvent = { ...base, mon: "Tiếng Anh" };
    const d = {
      ...defaultData(),
      subjects: ["Toán", "Tiếng Anh"],
      settings: { ...defaultData().settings, pomodoroMinutes: 25 },
    };
    const r = addExamPrepTasks(d, exam, today);
    expect(r.added).toBeGreaterThan(0);
    const prep = r.data.tasks.filter((t) => t.examId === exam.id);
    expect(prep.length).toBe(r.added);
    expect(prep.every((t) => t.subject === "Tiếng Anh")).toBe(true);
  });

  it("prep tasks skip a stale subject binding", () => {
    const today = "2026-11-18";
    const exam: ExamEvent = { ...base, mon: "Đã bị xóa" };
    const d = {
      ...defaultData(),
      subjects: ["Toán"],
      settings: { ...defaultData().settings, pomodoroMinutes: 25 },
    };
    const r = addExamPrepTasks(d, exam, today);
    expect(r.data.tasks.every((t) => t.subject === undefined)).toBe(true);
  });
});

describe("slot <-> subject link", () => {
  it("slotSubject prefers the explicit binding over the title", () => {
    const d = { ...defaultData(), subjects: ["Hóa", "Toán"] };
    const slot = {
      id: "s1",
      start: "08:00",
      end: "08:45",
      title: "KHTN",
      kind: "custom",
      minutes: 45,
      mon: "Hóa",
    };
    expect(slotSubject(d, slot as never)).toBe("Hóa");
    const unbound = { ...slot, mon: undefined, title: "KHTN (Toán)" };
    expect(slotSubject(d, unbound as never)).toBe("Toán");
  });

  it("slotSubject falls back to title matching when the binding is stale", () => {
    const d = { ...defaultData(), subjects: ["Toán"] };
    const slot = {
      id: "s1",
      start: "08:00",
      end: "08:45",
      title: "Toán",
      kind: "custom",
      minutes: 45,
      mon: "Đã xóa",
    };
    expect(slotSubject(d, slot as never)).toBe("Toán");
    expect(slotSubject(d, { ...slot, mon: undefined } as never)).toBe("Toán");
  });
});
