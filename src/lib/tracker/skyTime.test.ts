import { describe, expect, it } from "vitest";
import { skyBand } from "./skyTime";

describe("skyBand", () => {
  it("maps hours to bands", () => {
    expect(skyBand(0)).toBe("night");
    expect(skyBand(4)).toBe("night");
    expect(skyBand(5)).toBe("dawn");
    expect(skyBand(7)).toBe("dawn");
    expect(skyBand(8)).toBe("day");
    expect(skyBand(12.5)).toBe("day");
    expect(skyBand(16)).toBe("day");
    expect(skyBand(17)).toBe("dusk");
    expect(skyBand(19)).toBe("dusk");
    expect(skyBand(20)).toBe("night");
    expect(skyBand(23)).toBe("night");
  });
  it("handles invalid input", () => {
    expect(skyBand(NaN)).toBe("day");
    expect(skyBand(-1)).toBe("night");
  });
});
