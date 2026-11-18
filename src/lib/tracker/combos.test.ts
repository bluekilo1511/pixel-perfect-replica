import { describe, expect, it } from "vitest";
import {
  clearSubjectCombo,
  comboGrade,
  comboMembers,
  normalizeSubjectCombos,
  removeSubjectFromCombos,
  setSubjectCombo, matchCap2Config, detectSubDiscipline, detectCap2Merges, mergeAllCap2,
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

describe("Cấp 2 (THCS) combination subjects", () => {
  it("matches KHTN and LS&ĐL config and detects subdisciplines", () => {
    const khtnCfg = matchCap2Config("KHTN");
    expect(khtnCfg).not.toBeNull();
    expect(khtnCfg?.name).toBe("KHTN");
    expect(khtnCfg?.targetTxCount).toBe(4);

    const lsdlCfg = matchCap2Config("LS&ĐL");
    expect(lsdlCfg).not.toBeNull();
    expect(lsdlCfg?.name).toBe("LS&ĐL");

    const subLy = detectSubDiscipline(khtnCfg!, "15p Vật lí");
    expect(subLy?.short).toBe("Lí");

    const subHoa = detectSubDiscipline(khtnCfg!, "Kiểm tra Hóa");
    expect(subHoa?.short).toBe("Hóa");

    const subSu = detectSubDiscipline(lsdlCfg!, "Lịch sử bài 1");
    expect(subSu?.short).toBe("Sử");
  });

  it("detects orphan subdisciplines and merges them into integrated subjects", () => {
    let d = migrate({});
    // Setup exact situation from user screenshot:
    for (const s of ["Toán", "Địa lý", "GDCD", "Tin", "Tiếng Anh", "KHTN", "Lí", "Hóa", "Sinh", "LS&ĐL", "Ngữ Văn", "Lịch sử"]) {
      d = addSubject(d, s)!;
    }
    // Add sample grades for orphans
    d = {
      ...d,
      gradeBook: [
        ...d.gradeBook,
        {
          id: "g1",
          subject: "Lí",
          semester: 1,
          type: "tx",
          title: "15p",
          date: "2026-11-01",
          score: 8.5,
          max: 10,
          createdAt: "2026-11-01T00:00:00Z",
        },
        {
          id: "g2",
          subject: "Hóa",
          semester: 1,
          type: "tx",
          title: "",
          date: "2026-11-02",
          score: 9.0,
          max: 10,
          createdAt: "2026-11-02T00:00:00Z",
        },
        {
          id: "g3",
          subject: "Lịch sử",
          semester: 1,
          type: "tx",
          title: "Miệng",
          date: "2026-11-03",
          score: 10,
          max: 10,
          createdAt: "2026-11-03T00:00:00Z",
        },
      ],
    };

    const detected = detectCap2Merges(d);
    expect(detected.length).toBe(2);
    const khtnMerge = detected.find((m) => m.targetSubject === "KHTN");
    expect(khtnMerge?.orphanSubjects).toContain("Lí");
    expect(khtnMerge?.orphanSubjects).toContain("Hóa");
    expect(khtnMerge?.orphanSubjects).toContain("Sinh");

    const lsdlMerge = detected.find((m) => m.targetSubject === "LS&ĐL");
    expect(lsdlMerge?.orphanSubjects).toContain("Địa lý");
    expect(lsdlMerge?.orphanSubjects).toContain("Lịch sử");

    // Perform mergeAllCap2
    const merged = mergeAllCap2(d);

    // Standalone orphan subjects must be removed
    expect(merged.subjects).not.toContain("Lí");
    expect(merged.subjects).not.toContain("Hóa");
    expect(merged.subjects).not.toContain("Sinh");
    expect(merged.subjects).not.toContain("Địa lý");
    expect(merged.subjects).not.toContain("Lịch sử");

    // Target subjects must be preserved
    expect(merged.subjects).toContain("KHTN");
    expect(merged.subjects).toContain("LS&ĐL");
    expect(merged.subjects).toContain("Toán");
    expect(merged.subjects).toContain("Ngữ Văn");

    // Grades migrated to KHTN and LS&ĐL with appropriate sub tags
    const khtnGrades = merged.gradeBook.filter((g) => g.subject === "KHTN");
    expect(khtnGrades.length).toBe(2);
    expect(khtnGrades[0]?.title).toBe("15p (Lí)");
    expect(khtnGrades[1]?.title).toBe("Hóa");

    const lsdlGrades = merged.gradeBook.filter((g) => g.subject === "LS&ĐL");
    expect(lsdlGrades.length).toBe(1);
    expect(lsdlGrades[0]?.title).toBe("Miệng (Sử)");
  });
});
