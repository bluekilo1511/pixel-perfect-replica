import { describe, expect, it } from "vitest";
import { addExam, defaultData, makeTask, migrate, removeExam, setTaskExam } from "./model";
import {
  addExamScore,
  daysUntil,
  examLabel,
  needsFocusSubject,
  normalizeExamScores,
  normalizeExams,
  upcomingExams,
} from "./exams";

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
