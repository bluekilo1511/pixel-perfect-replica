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
    for (const id of ["lamp", "plant", "shelf", "teddy"] as DecorId[]) pet = buyDecor(pet, id)!;
    for (const id of ["lamp", "plant", "shelf"] as DecorId[]) pet = toggleDecor(pet, id)!.pet;
    expect(pet.decorActive).toHaveLength(MAX_ACTIVE_DECOR);
    const full = toggleDecor(pet, "teddy")!;
    expect(full.placed).toBe(false);
    expect(full.pet.decorActive).toHaveLength(MAX_ACTIVE_DECOR);
    const removed = toggleDecor(full.pet, "lamp")!;
    expect(removed.placed).toBe(false);
    expect(removed.pet.decorActive).toEqual(["plant", "shelf"]);
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
    expect(Object.keys(DECORATIONS)).toHaveLength(6);
  });
});
