import { describe, expect, it } from "vitest";
import {
  addDeck,
  addFolder,
  addSubject,
  addTerm,
  countDecks,
  deckLabel,
  deckSubjectName,
  defaultLibrary,
  findDeck,
  normalizeLibrary,
  removeNode,
  renameNode,
} from "./library";

const libWithDeck = () => {
  let lib = addFolder(defaultLibrary(), "Năm lớp 9")!;
  lib = addSubject(lib, lib.folders[0]!.id, "Toán")!;
  const folderId = lib.folders[0]!.id;
  const subjectId = lib.folders[0]!.subjects[0]!.id;
  return { base: lib, folderId, subjectId };
};

describe("library tree", () => {
  it("creates folders, subjects, terms and decks", () => {
    const { base, folderId, subjectId } = libWithDeck();
    const lib = addTerm(base, folderId, subjectId, "HK1")!;
    const termId = lib.folders[0]!.subjects[0]!.terms[0]!.id;
    const res = addDeck(lib, folderId, subjectId, termId, "Đại lượng tỉ lệ")!;
    expect(res.deckId).toBeTruthy();
    const path = findDeck(res.library, res.deckId)!;
    expect(path.folder.name).toBe("Năm lớp 9");
    expect(path.subject.name).toBe("Toán");
    expect(path.term!.name).toBe("HK1");
    expect(path.deck.name).toBe("Đại lượng tỉ lệ");
    expect(countDecks(res.library)).toBe(1);
  });

  it("allows decks directly under a subject without a term", () => {
    const { base, folderId, subjectId } = libWithDeck();
    const res = addDeck(base, folderId, subjectId, null, "Bộ ôn tập")!;
    const path = findDeck(res.library, res.deckId)!;
    expect(path.term).toBeNull();
    expect(countDecks(res.library)).toBe(1);
  });

  it("labels decks with their full path", () => {
    const { base, folderId, subjectId } = libWithDeck();
    const lib = addTerm(base, folderId, subjectId, "HK1")!;
    const termId = lib.folders[0]!.subjects[0]!.terms[0]!.id;
    const res = addDeck(lib, folderId, subjectId, termId, "Hình học")!;
    expect(deckLabel(res.library, res.deckId)).toBe("Toán · HK1 / Hình học");
    expect(deckSubjectName(res.library, res.deckId)).toBe("Toán");
  });

  it("rejects empty names and caps folders", () => {
    expect(addFolder(defaultLibrary(), "   ")).toBeNull();
    let lib = defaultLibrary();
    for (let i = 0; i < 20; i++) lib = addFolder(lib, `F${i}`)!;
    expect(addFolder(lib, "F21")).toBeNull();
  });

  it("renames nodes in place", () => {
    const { base, folderId, subjectId } = libWithDeck();
    const res = addDeck(base, folderId, subjectId, null, "Bộ cũ")!;
    const lib = renameNode(res.library, "deck", res.deckId, "Bộ mới")!;
    expect(findDeck(lib, res.deckId)!.deck.name).toBe("Bộ mới");
    expect(renameNode(res.library, "deck", res.deckId, "  ")).toBeNull();
    expect(renameNode(res.library, "folder", "nope", "X")).toBeNull();
  });

  it("removes a subject and cascades its decks", () => {
    const { base, folderId, subjectId } = libWithDeck();
    let lib = addTerm(base, folderId, subjectId, "HK1")!;
    const termId = lib.folders[0]!.subjects[0]!.terms[0]!.id;
    const a = addDeck(lib, folderId, subjectId, termId, "A")!;
    const b = addDeck(a.library, folderId, subjectId, null, "B")!;
    lib = b.library;
    const res = removeNode(lib, subjectId)!;
    expect(countDecks(res.library)).toBe(0);
    expect(res.deckIds).toHaveLength(2);
    expect(res.deckIds).toContain(a.deckId);
    expect(res.deckIds).toContain(b.deckId);
  });

  it("removes a single deck only", () => {
    const { base, folderId, subjectId } = libWithDeck();
    const a = addDeck(base, folderId, subjectId, null, "A")!;
    const b = addDeck(a.library, folderId, subjectId, null, "B")!;
    const res = removeNode(b.library, a.deckId)!;
    expect(countDecks(res.library)).toBe(1);
    expect(res.deckIds).toEqual([a.deckId]);
    expect(findDeck(res.library, b.deckId)).not.toBeNull();
  });

  it("normalizes junk input into a valid tree", () => {
    const lib = normalizeLibrary({
      folders: [null, { name: "F", subjects: [{ name: "S", decks: [{ id: "d1", name: "D" }] }] }],
    });
    expect(lib.folders).toHaveLength(1);
    expect(lib.folders[0]!.subjects[0]!.decks[0]!.id).toBe("d1");
    expect(normalizeLibrary(null).folders).toHaveLength(0);
    expect(normalizeLibrary("junk").folders).toHaveLength(0);
  });
});
