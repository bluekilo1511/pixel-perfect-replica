// Pure spaced-repetition logic for study flashcards (SM-2 lite). No browser APIs, so it is testable.
// A failed card goes back into today's queue; passing cards drift further away over days.

export interface Flashcard {
  id: string;
  subject: string; // matches data.subjects entries
  question: string;
  answer: string;
  ease: number; // 1.3 .. 3.0 (SM-2 style multiplier)
  interval: number; // days until the next review
  reps: number; // consecutive successful reviews
  lapses: number; // times answered "again"
  due: string; // YYYY-MM-DD
  createdAt: string;
}

/** 0 = forgot, 1 = hard, 2 = good, 3 = easy. */
export type Rating = 0 | 1 | 2 | 3;

export const FLASHCARDS_MAX = 200;
export const QUESTION_MAX = 200;
export const ANSWER_MAX = 400;
export const SUBJECT_MAX = 24;

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const MAX_INTERVAL = 180; // days — cap so a card never disappears for half a year

const clampEase = (e: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, Math.round(e * 100) / 100));

export const defaultEase = 2.5;

export function newCardId() {
  return `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newFlashcard(
  subject: string,
  question: string,
  answer: string,
  today: string,
): Flashcard {
  return {
    id: newCardId(),
    subject: subject.trim().slice(0, SUBJECT_MAX),
    question: question.trim().slice(0, QUESTION_MAX),
    answer: answer.trim().slice(0, ANSWER_MAX),
    ease: defaultEase,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: today,
    createdAt: new Date().toISOString(),
  };
}

/** Apply one review and return the updated card (pure). */
export function reviewCard(card: Flashcard, rating: Rating, today: string): Flashcard {
  if (rating === 0) {
    // Forgot: restart the card, ease takes a small hit, due immediately.
    return {
      ...card,
      ease: clampEase(card.ease - 0.2),
      interval: 0,
      reps: 0,
      lapses: card.lapses + 1,
      due: today,
    };
  }
  let interval: number;
  let ease = card.ease;
  if (rating === 1) {
    interval = card.reps === 0 ? 1 : Math.max(1, Math.round(card.interval * 1.2));
    ease = clampEase(ease - 0.15);
  } else if (rating === 2) {
    interval = card.reps === 0 ? 1 : card.reps === 1 ? 3 : Math.round(card.interval * card.ease);
  } else {
    interval = card.reps === 0 ? 4 : Math.round(card.interval * card.ease * 1.3);
    ease = clampEase(ease + 0.15);
  }
  interval = Math.min(MAX_INTERVAL, Math.max(1, interval));
  return { ...card, ease, interval, reps: card.reps + 1, due: dueFrom(today, interval) };
}

function dueFrom(today: string, days: number): string {
  const p = today.split("-").map(Number);
  const dt = new Date(Date.UTC(p[0]!, p[1]! - 1, p[2]! + days));
  return dt.toISOString().slice(0, 10);
}

/** Cards due today or overdue, oldest due first. */
export function dueCards(cards: Flashcard[], today: string): Flashcard[] {
  return cards
    .filter((c) => c.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

export interface DeckStats {
  total: number;
  due: number; // due today or overdue
  upcoming: number; // learned, reviewed later
}

export function deckStats(cards: Flashcard[], today: string): DeckStats {
  let due = 0;
  let upcoming = 0;
  for (const c of cards) {
    if (c.due <= today) due += 1;
    else upcoming += 1;
  }
  return { total: cards.length, due, upcoming };
}

/** Due counts per subject, only subjects with due cards, sorted by due count desc. */
export function dueBySubject(
  cards: Flashcard[],
  today: string,
): Array<{ subject: string; due: number; total: number }> {
  const map = new Map<string, { due: number; total: number }>();
  for (const c of cards) {
    const key = c.subject || "Chung";
    const s = map.get(key) ?? { due: 0, total: 0 };
    s.total += 1;
    if (c.due <= today) s.due += 1;
    map.set(key, s);
  }
  return [...map.entries()]
    .map(([subject, s]) => ({ subject, ...s }))
    .sort((a, b) => b.due - a.due || a.subject.localeCompare(b.subject));
}

/** Normalizes unknown storage data into a valid Flashcard list. */
export function normalizeFlashcards(raw: unknown): Flashcard[] {
  if (!Array.isArray(raw)) return [];
  const out: Flashcard[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, FLASHCARDS_MAX)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const question = typeof o.question === "string" ? o.question.trim().slice(0, QUESTION_MAX) : "";
    const answer = typeof o.answer === "string" ? o.answer.trim().slice(0, ANSWER_MAX) : "";
    if (!question || !answer) continue;
    const id = typeof o.id === "string" && o.id ? o.id : newCardId();
    if (seen.has(id)) continue;
    seen.add(id);
    const due =
      typeof o.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.due)
        ? o.due
        : dueFromTodayFallback();
    out.push({
      id,
      subject: typeof o.subject === "string" ? o.subject.trim().slice(0, SUBJECT_MAX) : "",
      question,
      answer,
      ease: clampEase(typeof o.ease === "number" && Number.isFinite(o.ease) ? o.ease : defaultEase),
      interval: Math.min(MAX_INTERVAL, Math.max(0, Math.round(Number(o.interval) || 0))),
      reps: Math.max(0, Math.round(Number(o.reps) || 0)),
      lapses: Math.max(0, Math.round(Number(o.lapses) || 0)),
      due,
      createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
    });
  }
  return out;
}

function dueFromTodayFallback() {
  return new Date().toISOString().slice(0, 10);
}
