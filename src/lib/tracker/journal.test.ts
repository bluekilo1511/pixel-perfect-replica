import { describe, expect, it } from "vitest";
import { defaultData } from "./model";
import {
  deleteJournal,
  journalForDate,
  normalizeJournal,
  upsertJournal,
  JOURNAL_MAX,
} from "./journal";

describe("journal", () => {
  it("normalizes junk into nothing", () => {
    expect(normalizeJournal(null)).toEqual([]);
    expect(normalizeJournal("x")).toEqual([]);
    expect(normalizeJournal([{ date: "2026-13-99", text: "hi" }])).toEqual([]);
    expect(normalizeJournal([{ date: "2026-10-21", text: "   " }])).toEqual([]);
  });

  it("keeps one entry per day, newest first, capped", () => {
    const raw = [
      { id: "a", date: "2026-10-20", text: "older" },
      { id: "b", date: "2026-10-20", text: "dup of same day" },
      { date: "2026-10-21", text: "newer" },
    ];
    const out = normalizeJournal(raw);
    expect(out.map((e) => e.date)).toEqual(["2026-10-21", "2026-10-20"]);
    expect(out[1]!.text).toBe("older");
    const many = Array.from({ length: JOURNAL_MAX + 5 }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}-${i}`,
      text: `e${i}`,
    })).filter(() => true);
    expect(
      normalizeJournal(
        many.map((e, i) => ({
          date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
          text: `t${i}`,
        })),
      ).length,
    ).toBeLessThanOrEqual(JOURNAL_MAX);
  });

  it("upserts by day and updates by id", () => {
    const base = defaultData();
    const withEntry = upsertJournal(base, { date: "2026-10-21", text: "Hôm nay học Toán." });
    expect(withEntry?.journal).toHaveLength(1);
    const updated = upsertJournal(withEntry!, {
      id: withEntry!.journal[0]!.id,
      date: "2026-10-21",
      text: "Sửa lại nội dung.",
    });
    expect(updated!.journal).toHaveLength(1);
    expect(updated!.journal[0]!.text).toBe("Sửa lại nội dung.");
    const second = upsertJournal(updated!, { date: "2026-10-22", text: "Ngày mai." });
    expect(second!.journal).toHaveLength(2);
  });

  it("empty text deletes the entry for that day", () => {
    const base = defaultData();
    const withEntry = upsertJournal(base, { date: "2026-10-21", text: "hello" })!;
    const gone = upsertJournal(withEntry, { date: "2026-10-21", text: "   " });
    expect(gone!.journal).toHaveLength(0);
    expect(deleteJournal(gone!, "nope").journal).toHaveLength(0);
  });

  it("journalForDate finds today's entry", () => {
    const base = defaultData();
    const withEntry = upsertJournal(base, { date: "2026-10-21", title: "Sổ", text: "abc" })!;
    expect(journalForDate(withEntry, "2026-10-21")?.text).toBe("abc");
    expect(journalForDate(withEntry, "2026-10-22")).toBeUndefined();
  });
});
