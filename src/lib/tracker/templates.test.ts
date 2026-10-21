import { describe, expect, it } from "vitest";
import { migrate, removeTemplate, saveTaskAsTemplate, taskFromTemplate } from "./model";
import { normalizeTemplates } from "./templates";

const today = "2026-10-20";

describe("normalizeTemplates", () => {
  it("keeps well-formed templates and fills missing ids", () => {
    const out = normalizeTemplates([
      { id: "t1", title: "Toán", kind: "pomodoro", minutes: 25 },
      { title: "Chạy bộ", kind: "exercise", minutes: 5 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]!).toMatchObject({ id: "t1", title: "Toán", kind: "pomodoro", minutes: 25 });
    expect(out[1]!.id).toBeTruthy();
  });
  it("fixes bad kinds/minutes and drops blank titles", () => {
    const out = normalizeTemplates([
      { title: "   ", kind: "pomodoro", minutes: 10 },
      { title: "X", kind: "weird", minutes: -5 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!).toMatchObject({ title: "X", kind: "custom", minutes: 0 });
  });
  it("returns [] for non-arrays", () => {
    expect(normalizeTemplates(null)).toEqual([]);
    expect(normalizeTemplates("nope")).toEqual([]);
  });
});

describe("saveTaskAsTemplate", () => {
  it("adds a template from a task shape", () => {
    const data = migrate(null);
    const next = saveTaskAsTemplate(data, { title: " Luyện đề ", kind: "pomodoro", minutes: 50 });
    expect(next.templates).toHaveLength(1);
    expect(next.templates[0]!).toMatchObject({ title: "Luyện đề", kind: "pomodoro", minutes: 50 });
  });
  it("ignores blank titles and exact duplicates", () => {
    let data = migrate(null);
    data = saveTaskAsTemplate(data, { title: "Toán", kind: "pomodoro", minutes: 25 });
    expect(
      saveTaskAsTemplate(data, { title: "Toán", kind: "pomodoro", minutes: 25 }).templates,
    ).toHaveLength(1);
    expect(
      saveTaskAsTemplate(data, { title: "   ", kind: "custom", minutes: 0 }).templates,
    ).toHaveLength(1);
  });
});

describe("taskFromTemplate", () => {
  it("creates an uncompleted task for the given date", () => {
    let data = migrate(null);
    data = saveTaskAsTemplate(data, { title: "Đọc sách", kind: "custom", minutes: 0 });
    const r = taskFromTemplate(data, data.templates[0]!.id, today);
    expect(r).not.toBeNull();
    expect(r!.task).toMatchObject({
      title: "Đọc sách",
      kind: "custom",
      minutes: 0,
      date: today,
      completed: false,
    });
    expect(r!.task.remainingSeconds).toBe(0);
    expect(r!.data.tasks.some((t) => t.id === r!.task.id)).toBe(true);
  });
  it("returns null for unknown template ids", () => {
    const data = migrate(null);
    expect(taskFromTemplate(data, "nope", today)).toBeNull();
  });
});

describe("removeTemplate", () => {
  it("removes by id and ignores unknown ids", () => {
    let data = migrate(null);
    data = saveTaskAsTemplate(data, { title: "T1", kind: "custom", minutes: 5 });
    data = saveTaskAsTemplate(data, { title: "T2", kind: "custom", minutes: 10 });
    const first = data.templates[0]!.id;
    const next = removeTemplate(data, first);
    expect(next.templates.map((t) => t.title)).toEqual(["T2"]);
    expect(removeTemplate(next, "ghost").templates).toHaveLength(1);
  });
});

describe("migrate", () => {
  it("fills templates on old files", () => {
    expect(migrate({ app: "local-task-tracker-pro", version: 3, tasks: [] }).templates).toEqual([]);
  });
});
