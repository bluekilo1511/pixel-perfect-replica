import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quickAdd";

describe("parseQuickAdd", () => {
  it("extracts a trailing duration", () => {
    expect(parseQuickAdd("Học Toán 25p")).toEqual({
      title: "Học Toán",
      minutes: 25,
      subject: null,
    });
    expect(parseQuickAdd("Ôn Văn 15 phút")).toEqual({
      title: "Ôn Văn",
      minutes: 15,
      subject: null,
    });
    expect(parseQuickAdd("Học Toán25p")).toEqual({ title: "Học Toán", minutes: 25, subject: null });
  });
  it("keeps the rest of the title", () => {
    expect(parseQuickAdd("Học Toán 25p rồi đi ngủ")).toEqual({
      title: "Học Toán rồi đi ngủ",
      minutes: 25,
      subject: null,
    });
  });
  it("returns null minutes without a duration", () => {
    expect(parseQuickAdd("Đi ngủ")).toEqual({ title: "Đi ngủ", minutes: null, subject: null });
    expect(parseQuickAdd("")).toEqual({ title: "Nhiệm vụ", minutes: null, subject: null });
  });
  it("clamps minutes", () => {
    expect(parseQuickAdd("Học 999p").minutes).toBe(600);
    expect(parseQuickAdd("Học 0p").minutes).toBe(0);
  });
});

describe("subject tags", () => {
  it("parses #tag and attaches it", () => {
    expect(parseQuickAdd("Học Toán #Math 25p")).toEqual({
      title: "Học Toán",
      minutes: 25,
      subject: "Math",
    });
  });
  it("parses Vietnamese tags and leaves title untouched", () => {
    expect(parseQuickAdd("#Toán học")).toEqual({
      title: "học",
      minutes: null,
      subject: "Toán",
    });
  });
  it("ignores stray # with no word", () => {
    const r = parseQuickAdd("Học #");
    expect(r.subject).toBeNull();
    expect(r.title).toBe("Học");
  });
});
