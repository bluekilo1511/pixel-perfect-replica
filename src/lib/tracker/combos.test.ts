import { describe, expect, it } from "vitest";
import {
  clearSubjectCombo,
  comboGrade,
  comboMembers,
  normalizeSubjectCombos,
  removeSubjectFromCombos,
  setSubjectCombo,
} from "./combos";
import { addGradeEntry, subjectGrade, type GradeEntry } from "./grades";
import { addSubject, migrate, removeSubject } from "./model";
import type { AppData } from "./model";

const base = (): AppData => {
  let d = migrate({});
  for (const s of ["KHTN", "LSĐL", "Lý", "Hóa", "Sinh", "Sử", "Địa"]) d = addSubject(d, s)!;
  return d;
};

const grades = (
  rows: { subject: string; type: "tx" | "gk" | "ck"; score: number }[],
): GradeEntry[] =>
  rows.reduce<GradeEntry[]>(
    (acc, r) => addGradeEntry(acc, { ...r, semester: 1, title: "", date: "2026-10-29" }) ?? acc,
    [],
  );

describe("setSubjectCombo", () => {
  it("stores 2-3 members on an existing subject", () => {
    const d = setSubjectCombo(base(), "KHTN", ["Lý", "Hóa", "Sinh"])!;
    expect(comboMembers(d, "KHTN")).toEqual(["Lý", "Hóa", "Sinh"]);
  });

  it("rejects wrong member counts, unknown subjects and self-membership", () => {
    const d = base();
    expect(setSubjectCombo(d, "KHTN", ["Lý"])).toBeNull();
    expect(setSubjectCombo(d, "KHTN", ["Lý", "Hóa", "Sinh", "Sử"])).toBeNull();
    expect(setSubjectCombo(d, "KHTN", ["Lý", "Chim clergy"])).toBeNull();
    expect(setSubjectCombo(d, "KHTN", ["KHTN", "Lý"])).toBeNull();
    expect(setSubjectCombo(d, "Không có", ["Lý", "Hóa"])).toBeNull();
  });

  it("rejects members that are combos or already belong to another combo", () => {
    let d = setSubjectCombo(base(), "KHTN", ["Lý", "Hóa", "Sinh"])!;
    expect(setSubjectCombo(d, "Sử", ["Lý", "Địa"])).toBeNull(); // Lý is a member elsewhere
    d = setSubjectCombo(d, "LSĐL", ["Sử", "Địa"])!;
    expect(setSubjectCombo(d, "Địa", ["Sử", "Sinh"])).toBeNull(); // Địa already in a combo
    expect(setSubjectCombo(d, "LSĐL2", ["LSĐL", "Sử"])).toBeNull(); // combo as member
  });

  it("allows replacing a combo's own members", () => {
    let d = setSubjectCombo(base(), "KHTN", ["Lý", "Hóa"])!;
    d = setSubjectCombo(d, "KHTN", ["Lý", "Hóa", "Sinh"])!;
    expect(comboMembers(d, "KHTN")).toEqual(["Lý", "Hóa", "Sinh"]);
  });
});

describe("comboGrade", () => {
  it("averages the member grades that exist and rounds to 0.1", () => {
    const gb = grades([
      { subject: "Lý", type: "tx", score: 6 },
      { subject: "Lý", type: "ck", score: 8 },
      { subject: "Hóa", type: "tx", score: 9 },
      { subject: "Hóa", type: "ck", score: 9 },
    ]);
    expect(subjectGrade(gb, "Lý", 1)).toBe(7);
    const d = setSubjectCombo(base(), "KHTN", ["Lý", "Hóa", "Sinh"])!;
    expect(comboGrade({ ...d, gradeBook: gb }.gradeBook, comboMembers(d, "KHTN")!, 1)).toBe(8);
  });

  it("is null until any member has a grade", () => {
    const d = setSubjectCombo(base(), "KHTN", ["Lý", "Hóa"])!;
    expect(comboGrade(d.gradeBook, comboMembers(d, "KHTN")!, 1)).toBeNull();
  });
});

describe("clear & cleanup", () => {
  it("clearSubjectCombo keeps the subject but drops the grouping", () => {
    let d = setSubjectCombo(base(), "KHTN", ["Lý", "Hóa"])!;
    d = clearSubjectCombo(d, "KHTN");
    expect(comboMembers(d, "KHTN")).toBeUndefined();
    expect(d.subjects).toContain("KHTN");
  });

  it("removing a subject drops combos that name it as combo or member", () => {
    let d = setSubjectCombo(base(), "KHTN", ["Lý", "Hóa", "Sinh"])!;
    d = setSubjectCombo(d, "LSĐL", ["Sử", "Địa"])!;
    d = removeSubject(d, "Hóa");
    expect(comboMembers(d, "KHTN")).toBeUndefined();
    expect(comboMembers(d, "LSĐL")).toEqual(["Sử", "Địa"]);
  });
});

describe("normalizeSubjectCombos", () => {
  it("keeps only valid groupings of known subjects", () => {
    const d = base();
    const out = normalizeSubjectCombos(
      {
        KHTN: ["Lý", "Hóa", "Sinh"],
        Rác: ["Lý", "Hóa"], // unknown combo
        LSĐL: ["Sử", "Không có"], // unknown member
        Xấu: ["Lý"], // too few
      },
      d.subjects,
    );
    expect(out).toEqual({ KHTN: ["Lý", "Hóa", "Sinh"] });
  });
});

describe("model integration", () => {
  it("normalizeData defaults subjectCombos and round-trips them", () => {
    const d = setSubjectCombo(base(), "LSĐL", ["Sử", "Địa"])!;
    const back = migrate(JSON.parse(JSON.stringify(d)));
    expect(back.subjectCombos).toEqual({ LSĐL: ["Sử", "Địa"] });
    expect(migrate({}).subjectCombos).toEqual({});
  });
});
