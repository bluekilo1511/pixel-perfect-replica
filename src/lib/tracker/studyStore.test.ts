import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

// jsdom has no IndexedDB globals; fake-indexeddb supplies both via injection.
(globalThis as { IDBKeyRange?: unknown }).IDBKeyRange = IDBKeyRange;
import { newFlashcard, type Flashcard } from "./flashcards";
import { newMindmap } from "./mindmap";
import { addFolder, addSubject, defaultLibrary, type Library } from "./library";
import {
  deleteDeckCards,
  deleteMap,
  dueCountAll,
  loadAllCards,
  loadDeckCards,
  loadLibrary,
  loadMaps,
  mergeLegacy,
  saveDeck,
  saveLibrary,
  saveMap,
  setStudyDbFactory,
  studyStats,
} from "./studyStore";

beforeEach(() => setStudyDbFactory(new IDBFactory()));

const today = "2026-11-04";

const deckTree = async (): Promise<{ lib: Library; deckId: string }> => {
  let lib = addFolder(defaultLibrary(), "Năm lớp 9")!;
  lib = addSubject(lib, lib.folders[0]!.id, "Toán")!;
  const res = (await import("./library")).addDeck(
    lib,
    lib.folders[0]!.id,
    lib.folders[0]!.subjects[0]!.id,
    null,
    "Bộ ôn tập",
  )!;
  await saveLibrary(res.library);
  return { lib: res.library, deckId: res.deckId };
};

describe("studyStore (IndexedDB)", () => {
  it("saves and loads one deck's cards as its own record", async () => {
    const { deckId } = await deckTree();
    const cards = [
      newFlashcard("Toán", "Q1", "A1", today),
      newFlashcard("Toán", "Q2", "A2", today),
    ];
    await saveDeck(deckId, cards);
    expect(await loadDeckCards(deckId)).toHaveLength(2);
    expect(await loadAllCards()).toHaveLength(2);
    const stats = await studyStats(today);
    expect(stats).toMatchObject({ cards: 2, due: 2, decks: 1, maps: 0 });
  });

  it("keeps the card index fresh so due counts stay right", async () => {
    const { deckId } = await deckTree();
    await saveDeck(deckId, [newFlashcard("Toán", "Q1", "A1", today)]);
    expect(await dueCountAll(today)).toBe(1);
    // Re-save with one card moved into the future and one removed.
    const later = { ...newFlashcard("Toán", "Q2", "A2", today), due: "2026-12-01" };
    await saveDeck(deckId, [later]);
    expect(await dueCountAll(today)).toBe(0);
    expect(await studyStats(today)).toMatchObject({ cards: 1, due: 0 });
    await deleteDeckCards(deckId);
    expect(await loadAllCards()).toHaveLength(0);
    expect(await dueCountAll(today)).toBe(0);
  });

  it("deleting a deck's record leaves other decks untouched", async () => {
    const { lib, deckId } = await deckTree();
    const other = (await import("./library")).addDeck(
      lib,
      lib.folders[0]!.id,
      lib.folders[0]!.subjects[0]!.id,
      null,
      "Bộ hai",
    )!;
    await saveLibrary(other.library);
    await saveDeck(deckId, [newFlashcard("Toán", "Q1", "A1", today)]);
    await saveDeck(other.deckId, [newFlashcard("Toán", "Q9", "A9", today)]);
    await deleteDeckCards(deckId);
    const rest = await loadAllCards();
    expect(rest).toHaveLength(1);
    expect(rest[0]!.question).toBe("Q9");
  });

  it("merges legacy cards once per id (no duplicates on re-run)", async () => {
    const legacy = [
      { ...newFlashcard("Toán", "Q1", "A1", today) },
      { ...newFlashcard("Văn", "Q2", "A2", today) },
    ];
    expect(await mergeLegacy(legacy, [])).toBe(2);
    expect(await mergeLegacy(legacy, [])).toBe(0);
    const lib = await loadLibrary();
    expect(lib!.folders).toHaveLength(1);
    const subjects = lib!.folders[0]!.subjects.map((s) => s.name).sort();
    expect(subjects).toEqual(["Toán", "Văn"]);
    const all = await loadAllCards();
    expect(all.every((c: Flashcard) => c.deckId)).toBe(true);
    expect(all).toHaveLength(2);
  });

  it("mergeLegacy restores an old backup without duplicating", async () => {
    const legacy = [{ ...newFlashcard("Toán", "Q1", "A1", today) }];
    await mergeLegacy(legacy, []);
    // User restores an older backup that still carries the same cards in AppData.
    await mergeLegacy(legacy.concat([{ ...newFlashcard("Sử", "Q3", "A3", today) }]), []);
    const all = await loadAllCards();
    expect(all).toHaveLength(2);
    expect(all.filter((c) => c.id === legacy[0]!.id)).toHaveLength(1);
  });

  it("stores mindmaps one record each with dedupe on merge", async () => {
    const m = newMindmap("Sơ đồ 1");
    expect(await mergeLegacy([], [m])).toBe(1);
    expect(await mergeLegacy([], [m])).toBe(0);
    expect((await loadMaps()).map((x) => x.id)).toContain(m.id);
    await deleteMap(m.id);
    expect(await loadMaps()).toHaveLength(0);
  });

  it("saveMap overwrites the same record", async () => {
    const m = newMindmap("Sơ đồ");
    await saveMap(m);
    await saveMap({ ...m, title: "Đổi tên" });
    const maps = await loadMaps();
    expect(maps).toHaveLength(1);
    expect(maps[0]!.title).toBe("Đổi tên");
  });
});
