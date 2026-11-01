import { describe, expect, it } from "vitest";
import {
  buildMatchRound,
  buildQuizQuestion,
  buildQuizRound,
  buildTrueFalseRound,
  clampWrong,
  deckSubjects,
  deleteCard,
  deleteDeck,
  grantStudyReward,
  mergeBulk,
  parseBulk,
  recordStudy,
  reverseCard,
  STUDY_HISTORY_MAX,
  STUDY_REWARD_MAX_DAY,
  subjectAccuracy,
  updateCard,
  QUIZ_LEN,
  type StudyResult,
} from "./study";
import { newFlashcard, type Flashcard } from "./flashcards";

const rng = () => 0.42; // deterministic-enough for shuffle coverage
const today = "2026-11-01";

function card(subject: string, question: string, answer: string, wrong: string[] = []): Flashcard {
  const c = newFlashcard(subject, question, answer, today);
  c.wrong = wrong;
  return c;
}

describe("parseBulk", () => {
  it("parses question|answer lines and optional wrong choices", () => {
    const out = parseBulk(
      "Vì sao trời xanh?|Tán xạ Rayleigh|sai 1; sai 2\nH2O là gì|Nước\nkhông có ký tự\n|trống\n",
    );
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      question: "Vì sao trời xanh?",
      answer: "Tán xạ Rayleigh",
      wrong: ["sai 1", "sai 2"],
    });
    expect(out[1]).toEqual({ question: "H2O là gì", answer: "Nước", wrong: [] });
  });
  it("caps wrong choices at 3", () => {
    const out = parseBulk("Q|A|w1;w2;w3;w4");
    expect(out[0]!.wrong).toHaveLength(3);
  });
});

describe("mergeBulk", () => {
  it("appends and dedupes", () => {
    const existing = [card("Toán", "1+1", "2")];
    const { cards, added, skipped } = mergeBulk(existing, "Toán", parseBulk("1+1|2\n2+2|4"), today);
    expect(added).toBe(1);
    expect(skipped).toBe(1);
    expect(cards).toHaveLength(2);
    expect(cards[1]!.wrong).toEqual([]);
  });
  it("never exceeds FLASHCARDS_MAX", () => {
    const many = Array.from({ length: 498 }, (_, i) => card("Toán", `q${i}`, `a${i}`));
    const { cards, added } = mergeBulk(many, "Toán", parseBulk("x1|y1\nx2|y2\nx3|y3"), today);
    expect(cards).toHaveLength(500);
    expect(added).toBe(2);
  });
});

describe("card helpers", () => {
  it("updates, deletes, reverses, deletes deck", () => {
    const a = card("Toán", "1+1", "2");
    const b = card("Toán", "2+2", "4");
    const c = card("Văn", "q", "a");
    expect(updateCard([a, b, c], b.id, { question: "2+2=?", wrong: ["5", "3"] })[1]!.question).toBe(
      "2+2=?",
    );
    expect(updateCard([a, b, c], b.id, { wrong: ["5", "3", "1", "9"] })[1]!.wrong).toHaveLength(3);
    expect(deleteCard([a, b, c], a.id)).toHaveLength(2);
    const rev = reverseCard([a], a.id);
    expect(rev[0]!.question).toBe("2");
    expect(rev[0]!.answer).toBe("1+1");
    expect(deleteDeck([a, b, c], "Toán")).toHaveLength(1);
    expect(deleteDeck([a, b, c], "Chung")).toHaveLength(3);
  });
  it("lists subjects", () => {
    expect(deckSubjects([card("Văn", "q", "a"), card("", "q2", "a2")])).toEqual(["Chung", "Văn"]);
  });
});

describe("quiz round", () => {
  const pool = [
    card("Toán", "1+1=?", "2", ["3", "4", "5"]),
    card("Toán", "2+2=?", "4", ["5"]),
    card("Văn", "Tác giả Tấm Cám?", "Nguyễn Đồng", ["Nam Cao", "Nguyễn Du"]),
    card("Lý", "Đơn vị lực?", "N", ["kg", "J"]),
    card("Lý", "Không có đáp án sai nào", "X"),
  ];
  it("builds questions with correct option present", () => {
    const round = buildQuizRound(pool, 10, rng);
    expect(round.length).toBeGreaterThan(3);
    for (const q of round) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(q.options.length).toBeLessThanOrEqual(5);
      expect(q.options).toContainEqual(expect.any(String));
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.options[q.correctIndex]).toBeDefined();
    }
    expect(new Set(round.map((q) => q.cardId)).size).toBe(round.length);
  });
  it("honors requested count cap", () => {
    const round = buildQuizRound(pool, 2, rng);
    expect(round.length).toBe(2);
  });
});

describe("true/false round", () => {
  const pool = [card("Toán", "1+1", "2"), card("Toán", "2+2", "4"), card("Lý", "g", "9.8")];
  it("pairs answers from the pool and marks truth", () => {
    const round = buildTrueFalseRound(pool, 3, rng);
    expect(round.length).toBe(3);
    for (const q of round) {
      if (q.isTrue) expect(q.shown).toBe(pool.find((c) => c.id === q.cardId)!.answer);
      else expect(q.shown).not.toBe(pool.find((c) => c.id === q.cardId)!.answer);
    }
  });
});

describe("match round", () => {
  it("picks short-answer pairs up to size", () => {
    const pool = [
      card("Toán", "q1", "a1"),
      card("Toán", "q2", "a2"),
      card("Lý", "q3", "9.8"),
      card(
        "Lý",
        "q4",
        "way too long answer exceeding the forty character limit for matching pairs!",
      ),
      card("Lý", "q5", "a5"),
    ];
    const round = buildMatchRound(pool, 4, rng);
    expect(round.length).toBe(4);
    expect(round.every((p) => p.answer.length <= 40)).toBe(true);
  });
});

describe("rewards", () => {
  it("caps 3 rewarded rounds per day and resets next day", () => {
    let state = grantStudyReward(undefined, today);
    expect(state.coins).toBe(5);
    state = grantStudyReward(state.state, today);
    state = grantStudyReward(state.state, today);
    expect(state.coins).toBe(5);
    expect(state.state.count).toBe(STUDY_REWARD_MAX_DAY);
    expect(grantStudyReward(state.state, today).coins).toBe(0);
    expect(grantStudyReward(state.state, "2026-11-02").coins).toBe(5);
  });
});

describe("history", () => {
  it("prepends and caps, aggregates accuracy", () => {
    let h: StudyResult[] = [];
    for (let i = 0; i < STUDY_HISTORY_MAX + 5; i++) {
      h = recordStudy(h, {
        date: today,
        game: "quiz",
        subject: "Toán",
        correct: 1,
        total: 2,
        seconds: 30,
      });
    }
    expect(h).toHaveLength(STUDY_HISTORY_MAX);
    const acc = subjectAccuracy([
      { date: today, game: "quiz", subject: "Toán", correct: 8, total: 10, seconds: 60 },
    ]);
    expect(acc[0]).toEqual({ subject: "Toán", correct: 8, total: 10 });
    expect(subjectAccuracy([])).toEqual([]);
  });
});

describe("clampWrong", () => {
  it("trims, drops empties, caps", () => {
    expect(clampWrong([" a ", "", "b", "c", "d"])).toEqual(["a", "b", "c"]);
  });
});

describe("buildQuizQuestion minimum decoys", () => {
  it("builds a 2-choice question from one card with a single wrong choice", () => {
    const card = newFlashcard("Lý", "Đơn vị lực?", "N", "2026-01-01");
    card.wrong = ["kg"];
    const q = buildQuizQuestion(card, [card], Math.random);
    expect(q).not.toBeNull();
    expect(q!.options).toHaveLength(2);
    expect(new Set(q!.options)).toEqual(new Set(["N", "kg"]));
    expect(q!.options[q!.correctIndex]).toBe("N");
  });

  it("still refuses a question with no decoy available", () => {
    const card = newFlashcard("Lý", "Đơn vị lực?", "N", "2026-01-01");
    expect(buildQuizQuestion(card, [card], Math.random)).toBeNull();
  });

  it("round builder serves a single good card", () => {
    const card = newFlashcard("Lý", "Đơn vị lực?", "N", "2026-01-01");
    card.wrong = ["kg"];
    const round = buildQuizRound([card], QUIZ_LEN);
    expect(round).toHaveLength(1);
    expect(round[0]!.options).toContain("kg");
  });
});
