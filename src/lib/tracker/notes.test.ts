import { describe, expect, it } from "vitest";
import {
  addNote,
  defaultData,
  migrate,
  NOTES_MAX,
  normalizeNotes,
  notesDoneCount,
  removeNote,
  renameNote,
  toggleNote,
  type AppData,
} from "./model";

const base = (): AppData => defaultData();

describe("routine notes (no timer)", () => {
  it("adds a trimmed note and ignores empty or over-limit ones", () => {
    let d = base();
    d = addNote(d, "  Dậy sớm 6h  ");
    expect(d.notes).toHaveLength(1);
    expect(d.notes[0]!.title).toBe("Dậy sớm 6h");
    expect(d.notes[0]!.lastDoneDate).toBeNull();
    expect(addNote(d, "   ")).toBe(d);
    for (let i = d.notes.length; i < NOTES_MAX; i++) d = addNote(d, `note ${i}`);
    expect(addNote(d, "one more")).toBe(d);
    expect(d.notes).toHaveLength(NOTES_MAX);
  });

  it("toggles today's check without touching xp, streak or coins", () => {
    const today = "2026-10-21";
    let d = base();
    d = addNote(d, "Dậy sớm");
    d = toggleNote(d, d.notes[0]!.id, today);
    expect(notesDoneCount(d.notes, today)).toBe(1);
    expect(d.game.xp).toBe(0);
    expect(d.streak.count).toBe(0);
    d = toggleNote(d, d.notes[0]!.id, today);
    expect(notesDoneCount(d.notes, today)).toBe(0);
  });

  it("keeps yesterday's check visible as not-done today", () => {
    let d = base();
    d = addNote(d, "Đọc 10 trang");
    d = toggleNote(d, d.notes[0]!.id, "2026-10-20");
    expect(notesDoneCount(d.notes, "2026-10-20")).toBe(1);
    expect(notesDoneCount(d.notes, "2026-10-21")).toBe(0);
  });

  it("renames and removes notes, rejecting blank titles", () => {
    let d = base();
    d = addNote(d, "Uống nước sáng");
    const id = d.notes[0]!.id;
    d = renameNote(d, id, "  Uống nước 7h  ");
    expect(d.notes[0]!.title).toBe("Uống nước 7h");
    expect(renameNote(d, id, "   ")).toBe(d);
    d = removeNote(d, id);
    expect(d.notes).toHaveLength(0);
  });

  it("migrates old files: drops malformed rows, repairs ids, caps at the limit", () => {
    const rows = [
      { title: "Dậy sớm", lastDoneDate: "2026-10-20" },
      { id: "note_keep", title: "  Giữ id  " },
      { title: "   " },
      null,
      { title: 42 },
    ];
    const migrated = migrate({ notes: rows });
    expect(migrated.notes).toHaveLength(2);
    expect(migrated.notes[0]!.title).toBe("Dậy sớm");
    expect(typeof migrated.notes[0]!.id).toBe("string");
    expect(migrated.notes[1]!.id).toBe("note_keep");
    expect(migrated.notes[1]!.title).toBe("Giữ id");
    expect(normalizeNotes("nope")).toEqual([]);
    expect(migrate({}).notes).toEqual([]);
  });
});
