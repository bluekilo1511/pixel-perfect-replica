import { describe, expect, it } from "vitest";
import { defaultData, addSubject, removeSubject } from "./model";
import {
  normalizeSubjectNotes,
  setSubjectNote,
  setTopicMark,
  weakTopics,
  TOPICS_MAX,
  TOPIC_MARK_META,
} from "./subjectNotes";

describe("subject notes", () => {
  it("normalizes junk into an empty map", () => {
    expect(normalizeSubjectNotes(null)).toEqual({});
    expect(normalizeSubjectNotes({ Toán: "not an object" })).toEqual({});
    expect(normalizeSubjectNotes({ Toán: { note: "   ", topics: [] } })).toEqual({});
    const ok = normalizeSubjectNotes({ " Toán ": { note: " chú trọng hàm ", topics: [{ name: " Hàm số ", mark: "weak" }, { name: "hàm số", mark: "good" }] } });
    expect(ok["Toán"]?.note).toBe("chú trọng hàm");
    expect(ok["Toán"]?.topics).toHaveLength(1);
    expect(ok["Toán"]?.topics![0]!.mark).toBe("weak");
  });

  it("sets and clears a subject note", () => {
    const base = defaultData();
    const withNote = setSubjectNote(base, "Toán", "Môn này cần luyện đề nhiều.")!;
    expect(withNote.subjectNotes["Toán"]?.note).toBe("Môn này cần luyện đề nhiều.");
    const cleared = setSubjectNote(withNote, "Toán", "   ")!;
    expect(cleared.subjectNotes["Toán"]).toBeUndefined();
    expect(setSubjectNote(base, "  ", "x")).toBeNull();
  });

  it("marks topics and clears marks", () => {
    const base = defaultData();
    let d = setTopicMark(base, "Hoá", "Cân bằng phương trình", "redo")!;
    d = setTopicMark(d, "Hoá", "Cân bằng phương trình", "good")!;
    expect(d.subjectNotes["Hoá"]?.topics![0]).toMatchObject({ mark: "good" });
    d = setTopicMark(d, "Hoá", "Hỗn hợp", "weak")!;
    expect(weakTopics(d).map((t) => t.topic)).toEqual(["Hỗn hợp"]);
    const cleared = setTopicMark(d, "Hoá", "Hỗn hợp", null)!;
    expect(weakTopics(cleared)).toHaveLength(0);
  });

  it("caps topics per subject at 12", () => {
    let d = defaultData();
    for (let i = 0; i < TOPICS_MAX + 3; i++) {
      d = setTopicMark(d, "Sử", `Chương ${i}`, "weak") ?? d;
    }
    expect(d.subjectNotes["Sử"]?.topics).toHaveLength(TOPICS_MAX);
  });

  it("removing a subject drops its note", () => {
    const base = addSubject(defaultData(), "Toán")!;
    const withNote = setSubjectNote(base, "Toán", "ghi chú")!;
    const after = removeSubject(withNote, "Toán");
    expect(after.subjects).toHaveLength(0);
    expect(after.subjectNotes["Toán"]).toBeUndefined();
  });

  it("has labels for every mark", () => {
    for (const key of ["redo", "weak", "good"] as const) {
      expect(TOPIC_MARK_META[key].label.length).toBeGreaterThan(0);
    }
  });
});
