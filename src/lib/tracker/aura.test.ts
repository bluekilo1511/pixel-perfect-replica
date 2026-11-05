import { describe, expect, it } from "vitest";
import { AURAS, buyAura, defaultPet, normalizePet, toggleAura, type AuraId } from "./gamify";

describe("cosmic aura", () => {
  it("defaults to no auras and the free stardust look", () => {
    const pet = defaultPet();
    expect(pet.auraOwned).toEqual([]);
    expect(pet.auraActive).toBeNull();
  });

  it("buys a color, auto-equips the first one and blocks double purchases", () => {
    let pet = defaultPet();
    pet = buyAura(pet, "ocean")!;
    expect(pet.auraOwned).toEqual(["ocean"]);
    expect(pet.auraActive).toBe("ocean");
    expect(buyAura(pet, "ocean")).toBeNull();
    pet = buyAura(pet, "aurora")!;
    expect(pet.auraOwned).toEqual(["ocean", "aurora"]);
    expect(pet.auraActive).toBe("ocean"); // stays on the current color
  });

  it("toggles owned colors and rejects unowned ones", () => {
    let pet = buyAura(defaultPet(), "cosmic")!;
    pet = toggleAura(pet, "cosmic")!; // deselect
    expect(pet.auraActive).toBeNull();
    pet = toggleAura(pet, "cosmic")!; // reselect
    expect(pet.auraActive).toBe("cosmic");
    expect(toggleAura(pet, "sunset")).toBeNull();
    expect(buyAura(pet, "stardust")).toBeNull(); // free color is not for sale
  });

  it("normalizes legacy data without aura fields and drops invalid values", () => {
    const legacy = normalizePet({
      ...defaultPet(),
      auraOwned: ["ocean", "bogus"],
      auraActive: "sunset",
    });
    expect(legacy.auraOwned).toEqual(["ocean"]);
    expect(legacy.auraActive).toBeNull();
    const pet = normalizePet({ ...defaultPet(), auraOwned: ["ocean"], auraActive: "ocean" });
    expect(pet.auraActive).toBe("ocean");
    const empty = normalizePet(undefined);
    expect(empty.auraOwned).toEqual([]);
    expect(empty.auraActive).toBeNull();
  });

  it("keeps every premium aura multi-color and paid", () => {
    const premium = (Object.keys(AURAS) as AuraId[]).filter((id) => AURAS[id].currency === "gems");
    expect(premium.length).toBeGreaterThanOrEqual(2);
    for (const id of premium) expect(AURAS[id].price).toBeGreaterThan(0);
  });
});
