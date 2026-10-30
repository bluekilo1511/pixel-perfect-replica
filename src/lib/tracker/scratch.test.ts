import { describe, expect, it } from "vitest";
import { defaultData, migrate, normalizeScratch, SCRATCH_MAX } from "./model";
import { addScratch, clearScratch, promoteScratch, removeScratch } from "./scratch";

const base = () => defaultData();

describe("mid-focus scratch notes", () => {
  it("adds trimmed notes capped at 20, ignoring empty text", () => {
    let d = base();
    expect(addScratch(d, "   ")).toBe(d);
    for (let i = 0; i < SCRATCH_MAX + 5; i++) d = addScratch(d, `nhớ ${i}`);
    expect(d.scratch).toHaveLength(SCRATCH_MAX);
    expect(d.scratch[0]!.text).toBe("nhớ 5"); // oldest dropped
    expect(d.scratch.at(-1)!.text).toBe("nhớ 24");
  });

  it("removes single notes and clears all only when non-empty", () => {
    let d = addScratch(base(), "mua ngọc rồng");
    const id = d.scratch[0]!.id;
    d = removeScratch(d, id);
    expect(d.scratch).toHaveLength(0);
    expect(clearScratch(d)).toBe(d); // already empty → same object
    d = addScratch(d, "gọi mẹ");
    d = clearScratch(d);
    expect(d.scratch).toHaveLength(0);
  });

  it("promotes a note into a no-timer task for today and drops the note", () => {
    const d = addScratch(base(), "Ôn chương 4 Hoá");
    const id = d.scratch[0]!.id;
    const promoted = promoteScratch(d, id, "2026-10-30");
    expect(promoted).not.toBeNull();
    expect(promoted!.scratch).toHaveLength(0);
    const task = promoted!.tasks.at(-1)!;
    expect(task.title).toBe("Ôn chương 4 Hoá");
    expect(task.kind).toBe("custom");
    expect(task.minutes).toBe(0);
    expect(task.date).toBe("2026-10-30");
    expect(task.emoji).toBe("📝");
    expect(promoteScratch(d, "ghost-id")).toBeNull();
  });

  it("migration keeps at most 20 valid notes and drops broken ones", () => {
    const raw = [
      { id: "a", text: "ok", at: "2026-10-30T01:00:00Z", date: "2026-10-30" },
      { text: "  " }, // empty → dropped
      { text: "no date", at: "2026-10-29T10:00:00.000Z" }, // date inferred
      "junk", // not an object → dropped
    ];
    const d = migrate({ scratch: raw });
    expect(d.scratch).toHaveLength(2);
    expect(d.scratch[1]!.text).toBe("no date");
    expect(d.scratch[1]!.date).toBe("2026-10-29");
    expect(migrate({ scratch: "junk" }).scratch).toEqual([]);
    expect(normalizeScratch(raw).map((n) => n.id)).toContain("a");
  });
});
