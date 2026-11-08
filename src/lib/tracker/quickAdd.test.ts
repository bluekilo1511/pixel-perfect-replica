import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quickAdd";

describe("parseQuickAdd", () => {
  it("extracts a trailing duration", () => {
    expect(parseQuickAdd("Học Toán 25p")).toEqual({
      title: "Học Toán",
      minutes: 25,
    });
    expect(parseQuickAdd("Ôn Văn 15 phút")).toEqual({
      title: "Ôn Văn",
      minutes: 15,
    });
    expect(parseQuickAdd("Học Toán25p")).toEqual({ title: "Học Toán", minutes: 25 });
  });
  it("keeps the rest of the title", () => {
    expect(parseQuickAdd("Học Toán 25p rồi đi ngủ")).toEqual({
      title: "Học Toán rồi đi ngủ",
      minutes: 25,
    });
  });
  it("returns null minutes without a duration", () => {
    expect(parseQuickAdd("Đi ngủ")).toEqual({ title: "Đi ngủ", minutes: null });
    expect(parseQuickAdd("")).toEqual({ title: "Nhiệm vụ", minutes: null });
  });
  it("clamps minutes", () => {
    expect(parseQuickAdd("Học 999p").minutes).toBe(600);
    expect(parseQuickAdd("Học 0p").minutes).toBe(0);
  });
  it("keeps multi-word subject names intact in the title", () => {
    // "#tag" syntax is gone: the subject now attaches by title match, so a
    // multi-word name like "Tiếng Anh" must survive untouched.
    const r = parseQuickAdd("Ôn #Tiếng Anh");
    expect(r.title).toBe("Ôn #Tiếng Anh");
    expect(r.minutes).toBeNull();
  });
});

describe("parseQuickAdd natural language extensions", () => {
  it("extracts priority !1..4 and p1..4", () => {
    expect(parseQuickAdd("Học Toán 25p !1")).toEqual({
      title: "Học Toán",
      minutes: 25,
      priority: "p1",
    });
    expect(parseQuickAdd("Làm bài p2")).toEqual({
      title: "Làm bài",
      minutes: null,
      priority: "p2",
    });
  });

  it("extracts time of day", () => {
    expect(parseQuickAdd("Học nhóm 20h30")).toEqual({
      title: "Học nhóm",
      minutes: null,
      timeRange: "20:30",
    });
    expect(parseQuickAdd("Đi tập gym 8h")).toEqual({
      title: "Đi tập gym",
      minutes: null,
      timeRange: "08:00",
    });
  });

  it("extracts date offset for mai / ngày mai", () => {
    expect(parseQuickAdd("Nộp đồ án mai !1")).toEqual({
      title: "Nộp đồ án",
      minutes: null,
      priority: "p1",
      dateOffsetDays: 1,
    });
    expect(parseQuickAdd("Làm bài ngày mai 45p")).toEqual({
      title: "Làm bài",
      minutes: 45,
      dateOffsetDays: 1,
    });
  });

  it("parses hour durations (tiếng, giờ)", () => {
    expect(parseQuickAdd("Ôn Sử 2 tiếng")).toEqual({
      title: "Ôn Sử",
      minutes: 120,
    });
    expect(parseQuickAdd("Đọc sách 1.5 giờ")).toEqual({
      title: "Đọc sách",
      minutes: 90,
    });
  });
});
