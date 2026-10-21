import { describe, expect, it } from "vitest";
import {
  buyDecor,
  DECORATIONS,
  defaultPet,
  MAX_ACTIVE_DECOR,
  normalizePet,
  toggleDecor,
  type DecorId,
} from "./gamify";

describe("pet room decorations", () => {
  it("buyDecor adds once and rejects duplicates", () => {
    let pet = defaultPet();
    expect(pet.decorOwned).toEqual([]);
    pet = buyDecor(pet, "lamp")!;
    expect(pet.decorOwned).toEqual(["lamp"]);
    expect(buyDecor(pet, "lamp")).toBeNull();
  });

  it("toggleDecor places up to the limit and refuses unowned items", () => {
    let pet = defaultPet();
    expect(toggleDecor(pet, "lamp")).toBeNull();
    const all = Object.keys(DECORATIONS) as DecorId[];
    for (const id of all) pet = buyDecor(pet, id)!;
    for (const id of all) pet = toggleDecor(pet, id)!.pet;
    expect(pet.decorActive).toHaveLength(MAX_ACTIVE_DECOR);
    // Already active, toggling lamp removes it
    const removed = toggleDecor(pet, "lamp")!;
    expect(removed.placed).toBe(false);
    expect(removed.pet.decorActive).not.toContain("lamp");
  });

  it("normalizePet migrates old files: keeps owned decor, drops unknown or unowned", () => {
    const pet = normalizePet({
      species: "cat",
      hunger: 50,
      happiness: 50,
      lastDecayAt: "2026-01-01T00:00:00.000Z",
      decorOwned: ["lamp", "ghost", 42],
      decorActive: ["lamp", "ghost", "plant", "fairy", "teddy", "poster"],
    });
    expect(pet.decorOwned).toEqual(["lamp"]);
    expect(pet.decorActive).toEqual(["lamp"]);
    expect(Object.keys(DECORATIONS)).toHaveLength(8); // 6 shop decors + 2 market-only rare decors
  });
});
