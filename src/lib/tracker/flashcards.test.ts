import { describe, expect, it } from "vitest";
import {
  deckStats,
  dueBySubject,
  dueCards,
  FLASHCARDS_MAX,
  newFlashcard,
  normalizeFlashcards,
  reviewCard,
  type Flashcard,
} from "./flashcards";

const T = "2026-10-28";

describe("flashcards", () => {
  it("creates a fresh card due immediately", () => {
    const c = newFlashcard("Hóa", "Vì sao NaOH phân hủy nhiệt?", "2NaOH → Na2O + H2O", T);
    expect(c.due).toBe(T);
    expect(c.interval).toBe(0);
    expect(c.ease).toBe(2.5);
    expect(c.reps).toBe(0);
  });

  it("schedules intervals 1 → 3 → ease-scaled for good reviews", () => {
    let c = newFlashcard("Hóa", "Q", "A", T);
    c = reviewCard(c, 2, T);
    expect(c.interval).toBe(1);
    expect(c.due).toBe("2026-10-29");
    c = reviewCard(c, 2, "2026-10-29");
    expect(c.interval).toBe(3);
    expect(c.due).toBe("2026-11-01");
    c = reviewCard(c, 2, "2026-11-01");
    expect(c.interval).toBe(8); // round(3 * 2.5)
    expect(c.due).toBe("2026-11-09");
  });

  it("forgot resets the card, adds a lapse and keeps it due today", () => {
    let c = newFlashcard("Toán", "Q", "A", T);
    c = reviewCard(c, 2, T);
    c = reviewCard(c, 2, "2026-10-29");
    c = reviewCard(c, 0, "2026-11-01");
    expect(c.reps).toBe(0);
    expect(c.lapses).toBe(1);
    expect(c.interval).toBe(0);
    expect(c.due).toBe("2026-11-01");
    expect(c.ease).toBeCloseTo(2.3, 5);
  });

  it("hard keeps the card close, easy jumps ahead and eases up", () => {
    let c = newFlashcard("Lý", "Q", "A", T);
    c = reviewCard(c, 1, T);
    expect(c.interval).toBe(1);
    expect(c.ease).toBeCloseTo(2.35, 5);
    c = reviewCard(c, 1, "2026-10-29");
    expect(c.interval).toBe(1); // round(1 * 1.2) stays 1 day
    c = reviewCard(c, 3, "2026-10-30");
    expect(c.interval).toBe(3); // round(1 * 2.2 * 1.3)
    expect(c.ease).toBeCloseTo(2.35, 5); // 2.5 - 0.15 - 0.15 + 0.15
  });

  it("caps the interval at 180 days", () => {
    let c: Flashcard = { ...newFlashcard("Toán", "Q", "A", T), interval: 150, reps: 9, ease: 3 };
    c = reviewCard(c, 3, T);
    expect(c.interval).toBe(180);
  });

  it("lists due cards oldest-due first and only due ones", () => {
    const a = { ...newFlashcard("Toán", "Q1", "A1", "2026-10-27"), due: "2026-10-25" };
    const b = { ...newFlashcard("Toán", "Q2", "A2", "2026-10-27"), due: "2026-10-28" };
    const later = { ...newFlashcard("Toán", "Q3", "A3", "2026-10-27"), due: "2026-10-29" };
    const due = dueCards([later, b, a], T);
    expect(due.map((c) => c.id)).toEqual([a.id, b.id]);
  });

  it("counts deck stats per subject", () => {
    const cards = [
      { ...newFlashcard("Hóa", "Q", "A", T), due: T },
      { ...newFlashcard("Hóa", "Q", "A", T), due: "2026-10-30" },
      { ...newFlashcard("Toán", "Q", "A", T), due: T },
    ];
    expect(deckStats(cards, T)).toEqual({ total: 3, due: 2, upcoming: 1 });
    const by = dueBySubject(cards, T);
    expect(by[0]).toEqual({ subject: "Hóa", due: 1, total: 2 });
    expect(by[1]?.subject).toBe("Toán");
  });

  it("normalizes broken storage data", () => {
    const good = newFlashcard("Toán", "Q", "A", T);
    const raw = [
      null,
      { question: "", answer: "x" },
      { question: "ok", answer: "ok", ease: 99, interval: 9999, subject: " Văn  " },
      good,
      good, // duplicate id is dropped
    ];
    const out = normalizeFlashcards(raw);
    expect(out).toHaveLength(2);
    expect(out[0]?.ease).toBe(3);
    expect(out[0]?.interval).toBe(180);
    expect(out[0]?.subject).toBe("Văn");
    expect(normalizeFlashcards(undefined)).toEqual([]);
  });

  it("caps the collection size", () => {
    const many = Array.from({ length: FLASHCARDS_MAX + 10 }, (_, i) =>
      newFlashcard("Toán", `Q${i}`, `A${i}`, T),
    );
    expect(normalizeFlashcards(many)).toHaveLength(FLASHCARDS_MAX);
  });
});
