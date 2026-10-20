import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quickAdd";

describe("parseQuickAdd", () => {
  it("extracts a trailing duration", () => {
    expect(parseQuickAdd("Học Toán 25p")).toEqual({ title: "Học Toán", minutes: 25 });
    expect(parseQuickAdd("Ôn Văn 15 phút")).toEqual({ title: "Ôn Văn", minutes: 15 });
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
});
