import { describe, expect, it } from "vitest";
import {
  absorbGradeExtra,
  addGradeEntry,
  addGradeExtra,
  convertExamScores,
  gradeAdvice,
  gradeBand,
  gradeTarget,
  guessSemester,
  guessTypeFromTitle,
  groupAverage,
  normalizeGradeEntries,
  normalizeGradeExtras,
  normalizeGradeTargets,
  removeGradeEntry,
  semesterEntries,
  setGradeTarget,
  subjectGrade,
  tenPoint,
} from "./grades";

const entry = (over: Partial<Parameters<typeof addGradeEntry>[1]> & { subject: string }, i = 0) => {
  const list = addGradeEntry([], {
    semester: 1,
    type: "tx",
    score: 7,
    title: "",
    ...over,
  } as Parameters<typeof addGradeEntry>[1])!;
  return list[i] ?? list[list.length - 1]!;
};

const build = (rows: Parameters<typeof addGradeEntry>[1][]): ReturnType<typeof addGradeEntry> =>
  rows.reduce((acc, r) => addGradeEntry(acc ?? [], r), null as ReturnType<typeof addGradeEntry>);

describe("grade book normalize", () => {
  it("keeps well-formed entries and drops broken ones", () => {
    const kept = normalizeGradeEntries([
      {
        id: "a",
        subject: "Toán",
        semester: 1,
        type: "gk",
        score: 8,
        max: 10,
        title: "",
        date: "2026-10-01",
        createdAt: "t",
      },
      { subject: "", score: 5 },
      { subject: "Lý", score: -1 },
      { subject: "Lý", score: 12, max: 10 }, // capped
      { subject: "Hóa", score: 3, max: 0 }, // max falls back to 10
    ]);
    expect(kept).toHaveLength(3);
    expect(kept[1]!.score).toBe(10);
    expect(kept[1]!.type).toBe("tx"); // unknown type → tx
    expect(kept[2]!.max).toBe(10);
  });

  it("keeps extras with a note and optional score, drops empties", () => {
    const kept = normalizeGradeExtras([
      { subject: "Toán", label: "thầy cho làm thêm", score: 1, max: 10 },
      { subject: "Toán", label: "chỉ ghi chú", score: null },
      { subject: "", label: "x" },
      { subject: "Lý", label: "" },
    ]);
    expect(kept).toHaveLength(2);
    expect(kept[1]!.score).toBeNull();
  });
});

describe("grade book add/remove", () => {
  it("rejects out-of-range scores and caps the list", () => {
    expect(
      addGradeEntry([], { subject: "Toán", semester: 1, type: "tx", score: 11, max: 10 }),
    ).toBeNull();
    expect(addGradeEntry([], { subject: "  ", semester: 1, type: "tx", score: 5 })).toBeNull();
  });

  it("removes by id", () => {
    const list = build([
      { subject: "Toán", semester: 1, type: "tx", score: 5 },
      { subject: "Toán", semester: 1, type: "ck", score: 7 },
    ])!;
    expect(removeGradeEntry(list, list[0]!.id)).toHaveLength(1);
  });

  it("adds extras with and without a score", () => {
    const extras = addGradeExtra([], {
      subject: "Toán",
      semester: 1,
      label: "làm thêm",
      score: 0.5,
    })!;
    const note = addGradeExtra(extras, { subject: "Toán", semester: 1, label: "chỉ ghi chú" })!;
    expect(note).toHaveLength(2);
    expect(note[1]!.score).toBeNull();
    expect(addGradeExtra([], { subject: "Toán", semester: 1, label: "  " })).toBeNull();
  });
});

describe("subject grade (Thông tư 22)", () => {
  it("averages column groups: (avgTX + GK + CK)/3, rounded to 0.1", () => {
    const list = build([
      { subject: "Toán", semester: 1, type: "tx", score: 7 },
      { subject: "Toán", semester: 1, type: "tx", score: 9 },
      { subject: "Toán", semester: 1, type: "gk", score: 7 },
      { subject: "Toán", semester: 1, type: "ck", score: 8 },
    ])!;
    // avgTX = 8 → (8 + 7 + 8)/3 = 7.7
    expect(subjectGrade(list, "Toán", 1)).toBe(7.7);
  });

  it("without GK the formula is (avgTX + CK)/2", () => {
    const list = build([
      { subject: "Lý", semester: 1, type: "tx", score: 6 },
      { subject: "Lý", semester: 1, type: "ck", score: 8 },
    ])!;
    expect(subjectGrade(list, "Lý", 1)).toBe(7);
  });

  it("respects the column's own scale (score/max → 10-point)", () => {
    const list = build([
      { subject: "Hóa", semester: 2, type: "tx", score: 8, max: 10 },
      { subject: "Hóa", semester: 2, type: "gk", score: 2, max: 3 },
      { subject: "Hóa", semester: 2, type: "ck", score: 9, max: 10 },
    ])!;
    // tx = 8, gk = 6.67 → (8 + 6.67 + 9)/3 = 7.9
    expect(subjectGrade(list, "Hóa", 2)).toBe(7.9);
  });

  it("is null while TX or CK is missing, and splits semesters", () => {
    const list = build([
      { subject: "Toán", semester: 1, type: "tx", score: 7 },
      { subject: "Toán", semester: 2, type: "ck", score: 9 },
    ])!;
    expect(subjectGrade(list, "Toán", 1)).toBeNull(); // no CK yet
    expect(subjectGrade(list, "Toán", 2)).toBeNull(); // no TX yet
    expect(semesterEntries(list, "Toán", 2)).toHaveLength(1);
  });

  it("band follows the Thông tư 22 thresholds", () => {
    expect(gradeBand(8)).toBe("Tốt");
    expect(gradeBand(6.5)).toBe("Khá");
    expect(gradeBand(5)).toBe("Đạt");
    expect(gradeBand(4.9)).toBe("Chưa đạt");
  });

  it("normalizes on a 10-point scale", () => {
    expect(tenPoint({ score: 2, max: 3 })).toBe(6.67);
    expect(tenPoint({ score: 5, max: 0 })).toBeNull();
  });

  it("computes group averages", () => {
    const list = build([
      { subject: "A", semester: 1, type: "tx", score: 5 },
      { subject: "A", semester: 1, type: "tx", score: 7 },
    ])!;
    expect(groupAverage(list, "tx")).toBe(6);
    expect(groupAverage(list, "ck")).toBeNull();
  });
});

describe("grade advice (cần bao nhiêu?)", () => {
  const txOnly = build([{ subject: "Toán", semester: 1, type: "tx", score: 6 }])!;

  it("with only TX, CK needs (2*target − avgTX) — no GK assumed", () => {
    const a = gradeAdvice(txOnly, "Toán", 1, 8)!;
    expect(a.column).toBe("ck");
    expect(a.need).toBe(10);
    expect(a.done).toBe(false);
    expect(a.impossible).toBe(false);
  });

  it("marks impossible when the needed score exceeds 10", () => {
    const a = gradeAdvice(txOnly, "Toán", 1, 9.5)!;
    expect(a.impossible).toBe(true);
  });

  it("marks done when any score already suffices", () => {
    const a = gradeAdvice(txOnly, "Toán", 1, 3)!;
    expect(a.done).toBe(true);
    expect(a.need).toBe(0);
  });

  it("with GK filled, CK needs (3*target − avgTX − GK)", () => {
    const list = build([
      { subject: "Toán", semester: 1, type: "tx", score: 6 },
      { subject: "Toán", semester: 1, type: "gk", score: 8 },
    ])!;
    const a = gradeAdvice(list, "Toán", 1, 8)!;
    expect(a.column).toBe("ck");
    expect(a.need).toBe(10);
  });

  it("with CK filled, GK needs (3*target − avgTX − CK)", () => {
    const list = build([
      { subject: "Toán", semester: 1, type: "tx", score: 7 },
      { subject: "Toán", semester: 1, type: "ck", score: 7 },
    ])!;
    const a = gradeAdvice(list, "Toán", 1, 8)!;
    expect(a.column).toBe("gk");
    expect(a.need).toBe(10);
  });

  it("marks GK impossible when the needed score exceeds 10", () => {
    const list = build([
      { subject: "Toán", semester: 1, type: "tx", score: 7 },
      { subject: "Toán", semester: 1, type: "ck", score: 7 },
    ])!;
    const a = gradeAdvice(list, "Toán", 1, 9)!;
    expect(a.column).toBe("gk");
    expect(a.impossible).toBe(true);
    expect(a.need).toBe(13);
  });

  it("returns null with no TX or when every column is filled", () => {
    expect(gradeAdvice([], "Toán", 1, 8)).toBeNull();
    const full = build([
      { subject: "Toán", semester: 1, type: "tx", score: 6 },
      { subject: "Toán", semester: 1, type: "gk", score: 7 },
      { subject: "Toán", semester: 1, type: "ck", score: 7 },
    ])!;
    expect(gradeAdvice(full, "Toán", 1, 8)).toBeNull();
    expect(gradeAdvice(txOnly, "Toán", 1, 11)).toBeNull(); // bad target
  });
});

describe("điểm dư promotion", () => {
  it("absorbs a scored extra into the chosen column and drops the extra", () => {
    const extras = addGradeExtra([], {
      subject: "Toán",
      semester: 1,
      label: "thầy cho",
      score: 1.5,
    })!;
    const id = extras[0]!.id;
    const r = absorbGradeExtra([], extras, id, "tx")!;
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]!.type).toBe("tx");
    expect(r.entries[0]!.score).toBe(1.5);
    expect(r.extras).toHaveLength(0);
  });

  it("refuses note-only extras", () => {
    const extras = addGradeExtra([], { subject: "Toán", semester: 1, label: "chỉ ghi chú" })!;
    expect(absorbGradeExtra([], extras, extras[0]!.id, "ck")).toBeNull();
  });
});

describe("legacy migration guesses", () => {
  it("guesses the column type from the old label", () => {
    expect(guessTypeFromTitle("giữa kỳ 1")).toBe("gk");
    expect(guessTypeFromTitle("Bài cuối kỳ")).toBe("ck");
    expect(guessTypeFromTitle("15p")).toBe("tx");
  });

  it("guesses the semester from the month", () => {
    expect(guessSemester("2026-10-01")).toBe(1);
    expect(guessSemester("2026-03-15")).toBe(2);
    expect(guessSemester("bad")).toBe(1);
  });

  it("converts legacy scores into grade entries", () => {
    const rows = convertExamScores([
      {
        id: "x",
        subject: "Toán",
        title: "giữa kỳ",
        date: "2026-11-02",
        score: 8,
        max: 10,
        createdAt: "t",
      },
    ]);
    expect(rows[0]!.type).toBe("gk");
    expect(rows[0]!.semester).toBe(1);
    expect(normalizeGradeEntries(rows)).toHaveLength(1);
  });
});

describe("per-subject grade targets", () => {
  it("keeps one target per subject, independent across subjects", () => {
    let targets = normalizeGradeTargets({ Văn: 7, Toán: 9 });
    expect(gradeTarget(targets, "Văn")).toBe(7);
    expect(gradeTarget(targets, "Toán")).toBe(9);
    targets = setGradeTarget(targets, "Văn", 7.5);
    expect(gradeTarget(targets, "Văn")).toBe(7.5);
    expect(gradeTarget(targets, "Toán")).toBe(9);
  });

  it("defaults to 8 for a subject without a saved target", () => {
    expect(gradeTarget(normalizeGradeTargets({ Văn: 7 }), "Toán")).toBe(8);
    expect(gradeTarget(normalizeGradeTargets(null), "Văn")).toBe(8);
  });

  it("drops malformed targets and ignores invalid setGradeTarget input", () => {
    expect(normalizeGradeTargets({ Văn: 7, Toán: 99, "": 5, X: "abc" })).toEqual({ Văn: 7 });
    expect(normalizeGradeTargets([1])).toEqual({});
    const before = { Văn: 7 };
    expect(setGradeTarget(before, "Toán", 20)).toBe(before);
    expect(setGradeTarget(before, "", 7)).toBe(before);
    expect(setGradeTarget(before, "Toán", Number.NaN)).toBe(before);
  });

  it("rounds stored targets to 0.1", () => {
    expect(setGradeTarget({}, "Toán", 8.55)).toEqual({ Toán: 8.6 });
  });
});
