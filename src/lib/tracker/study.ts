// Study games hub: Quizlet-style deck editing data helpers + quiz / matching /
// true-false round builders + light daily-capped rewards. Pure logic, no browser
// APIs, so everything is testable.
import {
  ANSWER_MAX,
  FLASHCARDS_MAX,
  newCardId,
  QUESTION_MAX,
  SUBJECT_MAX,
  type Flashcard,
} from "./flashcards";

export const STUDY_REWARD_COINS = 5;
export const STUDY_REWARD_MAX_DAY = 3;
export const STUDY_HISTORY_MAX = 30;
export const MATCH_SIZE = 6;
export const MATCH_ANSWER_MAX = 40; // answers longer than this are hard to pair on screen
export const QUIZ_LEN = 10;
export const TRUE_FALSE_LEN = 10;
export const WRONG_CHOICES_MAX = 3;
export const WRONG_MAX = 80; // per wrong-choice text

export type StudyGame = "quiz" | "match" | "tf";
export type StudyRoundKind = StudyGame | "review";

export interface StudyResult {
  date: string; // YYYY-MM-DD
  game: StudyGame;
  subject: string; // "" = tổng hợp
  correct: number;
  total: number;
  seconds: number;
}

export interface StudyRewardState {
  date: string | null; // last rewarded day
  count: number; // rewarded rounds that day
}

export const defaultStudyRewards = (): StudyRewardState => ({ date: null, count: 0 });

/** Per-round payload the UI plays through. */
export interface QuizQuestion {
  cardId: string;
  subject: string;
  question: string;
  options: string[]; // 3..5 shuffled choices
  correctIndex: number;
}
export interface TrueFalseQuestion {
  cardId: string;
  subject: string;
  question: string;
  shown: string;
  isTrue: boolean;
}
export interface MatchPair {
  cardId: string;
  question: string;
  answer: string;
}

export const clampWrong = (list: string[]): string[] =>
  list
    .map((w) => w.trim().slice(0, WRONG_MAX))
    .filter(Boolean)
    .slice(0, WRONG_CHOICES_MAX);

/** Parse the bulk import textarea: one card per line "question | answer | wrong1;wrong2". */
export function parseBulk(
  text: string,
): Array<{ question: string; answer: string; wrong: string[] }> {
  const out: Array<{ question: string; answer: string; wrong: string[] }> = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("|");
    if (parts.length < 2) continue;
    const question = parts[0]!.trim().slice(0, QUESTION_MAX);
    const answer = parts.slice(1, 2)[0]!.trim().slice(0, ANSWER_MAX);
    if (!question || !answer) continue;
    const wrong = parts.length > 2 ? clampWrong(parts.slice(2).join("|").split(";")) : [];
    out.push({ question, answer, wrong });
  }
  return out;
}

/** Append parsed cards to a deck, skipping duplicates already present. Pure. */
export function mergeBulk(
  cards: Flashcard[],
  subject: string,
  parsed: Array<{ question: string; answer: string; wrong: string[] }>,
  today: string,
): { cards: Flashcard[]; added: number; skipped: number } {
  const subjectKey = subject.trim().slice(0, SUBJECT_MAX);
  const seen = new Set(
    cards.map((c) => `${c.subject || "Chung"}\u0000${c.question}\u0000${c.answer}`),
  );
  const added: Flashcard[] = [];
  let skipped = 0;
  for (const p of parsed) {
    const key = `${subjectKey || "Chung"}\u0000${p.question}\u0000${p.answer}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    added.push({
      id: newCardId(),
      subject: subjectKey,
      question: p.question,
      answer: p.answer,
      wrong: clampWrong(p.wrong),
      ease: 2.5,
      interval: 0,
      reps: 0,
      lapses: 0,
      due: today,
      createdAt: new Date().toISOString(),
    });
  }
  // Respect the global card budget: keep existing cards first.
  const room = Math.max(0, FLASHCARDS_MAX - cards.length);
  const kept = added.slice(0, room);
  return {
    cards: [...cards, ...kept],
    added: kept.length,
    skipped: skipped + added.length - kept.length,
  };
}

export function updateCard(
  cards: Flashcard[],
  id: string,
  patch: Partial<Pick<Flashcard, "question" | "answer" | "wrong">>,
): Flashcard[] {
  return cards.map((c) =>
    c.id === id
      ? {
          ...c,
          question:
            patch.question !== undefined
              ? patch.question.trim().slice(0, QUESTION_MAX) || c.question
              : c.question,
          answer:
            patch.answer !== undefined
              ? patch.answer.trim().slice(0, ANSWER_MAX) || c.answer
              : c.answer,
          wrong: patch.wrong !== undefined ? clampWrong(patch.wrong) : c.wrong,
        }
      : c,
  );
}

export function deleteCard(cards: Flashcard[], id: string): Flashcard[] {
  return cards.filter((c) => c.id !== id);
}

export function deleteDeck(cards: Flashcard[], subject: string): Flashcard[] {
  return cards.filter((c) => (c.subject || "Chung") !== subject);
}

export function reverseCard(cards: Flashcard[], id: string): Flashcard[] {
  return cards.map((c) => (c.id === id ? { ...c, question: c.answer, answer: c.question } : c));
}

export function deckSubjects(cards: Flashcard[]): string[] {
  const map = new Map<string, number>();
  for (const c of cards) {
    const key = c.subject || "Chung";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([s]) => s);
}

type Rng = () => number;

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Build one MCQ from a card: wrong choices first, padded with other cards' answers. */
export function buildQuizQuestion(
  card: Flashcard,
  pool: Flashcard[],
  rng: Rng,
): QuizQuestion | null {
  const wrongs = clampWrong(card.wrong ?? []);
  const options: string[] = [];
  const used = new Set<string>([card.answer]);
  for (const w of wrongs) {
    if (!used.has(w)) {
      options.push(w);
      used.add(w);
    }
  }
  for (const other of shuffle(pool, rng)) {
    if (options.length >= WRONG_CHOICES_MAX) break;
    if (!used.has(other.answer)) {
      options.push(other.answer);
      used.add(other.answer);
    }
  }
  // answerable with just the answer + one decoy (2 choices total)
  if (options.length < 1) return null;
  const all = shuffle([card.answer, ...options], rng);
  return {
    cardId: card.id,
    subject: card.subject || "Chung",
    question: card.question,
    options: all,
    correctIndex: all.indexOf(card.answer),
  };
}

export function buildQuizRound(
  pool: Flashcard[],
  count: number,
  rng: Rng = Math.random,
): QuizQuestion[] {
  const cards = shuffle(pool, rng).slice(0, count * 3); // extra candidates for unanswerable cards
  const out: QuizQuestion[] = [];
  for (const card of cards) {
    if (out.length >= count) break;
    const q = buildQuizQuestion(card, pool, rng);
    if (q) out.push(q);
  }
  return out;
}

export function buildTrueFalseRound(
  pool: Flashcard[],
  count: number,
  rng: Rng = Math.random,
): TrueFalseQuestion[] {
  const cards = shuffle(pool, rng).slice(0, count);
  const out: TrueFalseQuestion[] = [];
  for (const card of cards) {
    const isTrue = rng() < 0.5;
    let shown = card.answer;
    if (!isTrue) {
      const others = shuffle(
        pool.filter((c) => c.id !== card.id),
        rng,
      );
      const alt =
        others.find(
          (c) => c.answer !== card.answer && (c.subject || "Chung") === (card.subject || "Chung"),
        ) ?? others.find((c) => c.answer !== card.answer);
      if (!alt) continue;
      shown = alt.answer;
    }
    out.push({
      cardId: card.id,
      subject: card.subject || "Chung",
      question: card.question,
      shown,
      isTrue,
    });
  }
  return out;
}

export function buildMatchRound(
  pool: Flashcard[],
  size: number,
  rng: Rng = Math.random,
): MatchPair[] {
  const eligible = pool.filter((c) => c.answer.length <= MATCH_ANSWER_MAX);
  return shuffle(eligible, rng)
    .slice(0, Math.min(size, eligible.length))
    .map((c) => ({
      cardId: c.id,
      question: c.question,
      answer: c.answer,
    }));
}

/** Grant one rewarded round: +5 coins, at most 3 rewarded rounds per day. Pure. */
export function grantStudyReward(
  state: StudyRewardState | undefined,
  today: string,
): { state: StudyRewardState; coins: number } {
  const base: StudyRewardState = state && state.date === today ? state : { date: today, count: 0 };
  if (base.count >= STUDY_REWARD_MAX_DAY) return { state: base, coins: 0 };
  return { state: { ...base, count: base.count + 1 }, coins: STUDY_REWARD_COINS };
}

/** Prepend a finished round to the history, newest first, capped. Pure. */
export function recordStudy(history: StudyResult[], result: StudyResult): StudyResult[] {
  return [result, ...history].slice(0, STUDY_HISTORY_MAX);
}

/** Correct-rate per subject over recent history, best first. */
export function subjectAccuracy(
  history: StudyResult[],
): Array<{ subject: string; correct: number; total: number }> {
  const map = new Map<string, { correct: number; total: number }>();
  for (const r of history) {
    const key = r.subject || "Tổng hợp";
    const s = map.get(key) ?? { correct: 0, total: 0 };
    s.correct += r.correct;
    s.total += r.total;
    map.set(key, s);
  }
  return [...map.entries()]
    .map(([subject, s]) => ({ subject, ...s }))
    .sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject));
}

export function normalizeStudyRewards(raw: unknown): StudyRewardState {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    date: typeof o.date === "string" ? o.date : null,
    count: Math.max(0, Math.round(Number(o.count) || 0)),
  };
}

export function normalizeStudyHistory(raw: unknown): StudyResult[] {
  if (!Array.isArray(raw)) return [];
  const out: StudyResult[] = [];
  for (const r of raw.slice(0, STUDY_HISTORY_MAX)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const game = o.game === "quiz" || o.game === "match" || o.game === "tf" ? o.game : null;
    if (!game) continue;
    const date = typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : "";
    if (!date) continue;
    out.push({
      date,
      game,
      subject: typeof o.subject === "string" ? o.subject.slice(0, SUBJECT_MAX) : "",
      correct: Math.max(0, Math.round(Number(o.correct) || 0)),
      total: Math.max(0, Math.round(Number(o.total) || 0)),
      seconds: Math.max(0, Math.round(Number(o.seconds) || 0)),
    });
  }
  return out;
}
