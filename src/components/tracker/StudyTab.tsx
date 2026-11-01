import { useEffect, useMemo, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import {
  ANSWER_MAX,
  dueBySubject,
  dueCards,
  FLASHCARDS_MAX,
  newFlashcard,
  QUESTION_MAX,
  reviewCard,
  type Flashcard,
  type Rating,
} from "@/lib/tracker/flashcards";
import {
  buildMatchRound,
  buildQuizRound,
  buildTrueFalseRound,
  deleteCard,
  deleteDeck,
  deckSubjects,
  grantStudyReward,
  mergeBulk,
  parseBulk,
  QUIZ_LEN,
  recordStudy,
  reverseCard,
  STUDY_REWARD_MAX_DAY,
  subjectAccuracy,
  TRUE_FALSE_LEN,
  updateCard,
  type MatchPair,
  type QuizQuestion,
  type StudyGame,
  type TrueFalseQuestion,
} from "@/lib/tracker/study";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const RATINGS: Array<{ rating: Rating; label: string; className: string }> = [
  { rating: 0, label: "😵 Quên", className: "bg-destructive/80 text-white hover:bg-destructive" },
  { rating: 1, label: "😰 Khó", className: "bg-amber-500/80 text-white hover:bg-amber-500" },
  { rating: 2, label: "🙂 Tốt", className: "bg-emerald-600/80 text-white hover:bg-emerald-600" },
  { rating: 3, label: "😎 Dễ", className: "bg-sky-600/80 text-white hover:bg-sky-600" },
];

const GAME_META: Record<StudyGame, { emoji: string; label: string }> = {
  quiz: { emoji: "🧠", label: "Trắc nghiệm" },
  match: { emoji: "🧩", label: "Ghép cặp" },
  tf: { emoji: "⚡", label: "Đúng/Sai" },
};

type View = "learn" | "games" | "history";

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {
    /* storage unavailable */
  }
  return fallback;
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/** 🎓 Học tập: Quizlet-style deck editor + quiz / matching / true-false games + history. */
export function StudyTab() {
  const { data, update } = useTracker();
  const today = dateStr();
  const cards = data.flashcards;

  const [view, setView] = useState<View>(() =>
    readStored<View>("ppr.studyView", ["learn", "games", "history"], "learn"),
  );
  const [subject, setSubject] = useState<string>(
    () => localStorage.getItem("ppr.studySubject") ?? "",
  );
  const [subjectInput, setSubjectInput] = useState("");

  // Review session state (ported from the old flashcards card).
  const [queue, setQueue] = useState<string[] | null>(null);
  const [qi, setQi] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState({ good: 0, again: 0, done: 0 });

  // Editor drafts: committed on blur to avoid rewriting AppData on every keystroke.
  const [drafts, setDrafts] = useState<Record<string, { q: string; a: string }>>({});
  const [wrongFor, setWrongFor] = useState<string | null>(null);
  const [wrongDrafts, setWrongDrafts] = useState<Record<string, string[]>>({});

  // Bulk import.
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  // Game state.
  const [game, setGame] = useState<StudyGame | null>(null);
  const [gameSubject, setGameSubject] = useState<string>("");
  const [quiz, setQuiz] = useState<{
    qs: QuizQuestion[];
    i: number;
    picked: number | null;
    correct: number;
  } | null>(null);
  const [tf, setTf] = useState<{
    qs: TrueFalseQuestion[];
    i: number;
    picked: boolean | null;
    correct: number;
  } | null>(null);
  const [match, setMatch] = useState<{
    pairs: MatchPair[];
    right: Array<{ cardId: string; text: string }>;
    leftId: string | null;
    matched: Set<string>;
    wrong: number;
    startedAt: number;
    tick: number;
  } | null>(null);
  const [startedAt, setStartedAt] = useState(0);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const decks = useMemo(() => dueBySubject(cards, today), [cards, today]);
  const stats = useMemo(() => {
    const due = dueCards(cards, today).length;
    return { total: cards.length, due, upcoming: cards.length - due };
  }, [cards, today]);
  const subjects = useMemo(() => {
    const list = [...new Set([...deckSubjects(cards), ...data.subjects])];
    return list.sort((a, b) => a.localeCompare(b));
  }, [cards, data.subjects]);
  const rewardsLeft = useMemo(() => {
    const st = data.studyRewards;
    const used = st.date === today ? st.count : 0;
    return Math.max(0, STUDY_REWARD_MAX_DAY - used);
  }, [data.studyRewards, today]);

  const pickView = (v: View) => {
    setView(v);
    persist("ppr.studyView", v);
  };
  const pickSubject = (s: string) => {
    setSubject(s);
    persist("ppr.studySubject", s);
  };

  // ---- Review runner ----
  const startReview = (filterSubject?: string) => {
    const byIdNow = new Map(cards.map((c) => [c.id, c]));
    let ids = dueCards(cards, today).map((c) => c.id);
    if (filterSubject) ids = ids.filter((id) => byIdNow.get(id)?.subject === filterSubject);
    if (!ids.length) return;
    setQueue(ids);
    setQi(0);
    setRevealed(false);
    setSession({ good: 0, again: 0, done: 0 });
  };

  const rate = (rating: Rating) => {
    if (!queue) return;
    const id = queue[qi]!;
    const card = byId.get(id);
    if (!card) return;
    update((d) => ({
      ...d,
      flashcards: d.flashcards.map((c) => (c.id === id ? reviewCard(c, rating, today) : c)),
    }));
    setSession((s) => ({
      good: s.good + (rating > 0 ? 1 : 0),
      again: s.again + (rating === 0 ? 1 : 0),
      done: s.done + 1,
    }));
    if (qi + 1 < queue.length) {
      setQi(qi + 1);
      setRevealed(false);
    } else {
      toast.success(
        `🃏 Xong lượt ôn! ${session.good + (rating > 0 ? 1 : 0)} nhớ, ${session.again + (rating === 0 ? 1 : 0)} cần ôn lại`,
      );
      setQueue(null);
      setRevealed(false);
    }
  };

  // ---- Deck editing ----
  const deckCards = useMemo(() => {
    const list = subject ? cards.filter((c) => (c.subject || "Chung") === subject) : [];
    return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [cards, subject]);

  const commitRow = (card: Flashcard) => {
    const draft = drafts[card.id];
    if (!draft) return;
    const q = draft.q.trim();
    const a = draft.a.trim();
    if (!q || !a) return; // never blank out a card
    update((d) => ({
      ...d,
      flashcards: updateCard(d.flashcards, card.id, { question: q, answer: a }),
    }));
  };

  const commitWrong = (card: Flashcard) => {
    const draft = wrongDrafts[card.id];
    if (!draft) return;
    update((d) => ({ ...d, flashcards: updateCard(d.flashcards, card.id, { wrong: draft }) }));
  };

  const addRow = () => {
    if (!subject) {
      toast.error("Chọn hoặc gõ tên môn trước đã!");
      return;
    }
    if (cards.length >= FLASHCARDS_MAX) {
      toast.error(`Tối đa ${FLASHCARDS_MAX} thẻ — xoá bớt thẻ cũ nhé!`);
      return;
    }
    update((d) => ({
      ...d,
      flashcards: [...d.flashcards, newFlashcard(subject, "Câu hỏi mới", "Đáp án", today)],
    }));
  };

  const runImport = () => {
    if (!subject) {
      toast.error("Chọn hoặc gõ tên môn trước đã!");
      return;
    }
    const parsed = parseBulk(importText);
    if (!parsed.length) {
      toast.error("Chưa có dòng hợp lệ nào — mỗi dòng dạng: câu hỏi | đáp án");
      return;
    }
    const res = mergeBulk(cards, subject, parsed, today);
    update((d) => ({ ...d, flashcards: res.cards }));
    setImportText("");
    setImportOpen(false);
    toast.success(
      `📥 Đã thêm ${res.added} thẻ${res.skipped ? ` (bỏ qua ${res.skipped} trùng)` : ""}`,
    );
  };

  const removeDeck = () => {
    if (!subject) return;
    if (!window.confirm(`Xoá toàn bộ thẻ của môn "${subject}"? Không hoàn tác được.`)) return;
    update((d) => ({ ...d, flashcards: deleteDeck(d.flashcards, subject) }));
    toast("🗑️ Đã xoá bộ thẻ của môn này");
  };

  // ---- Games ----
  const gamePool = useMemo(() => {
    const pool = gameSubject ? cards.filter((c) => (c.subject || "Chung") === gameSubject) : cards;
    return pool;
  }, [cards, gameSubject]);

  const finishRound = (g: StudyGame, correct: number, total: number) => {
    const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const result = { date: today, game: g, subject: gameSubject, correct, total, seconds };
    const rw = grantStudyReward(data.studyRewards, today);
    update((d) => ({
      ...d,
      studyRewards: rw.state,
      studyHistory: recordStudy(d.studyHistory, result),
      game: rw.coins > 0 ? { ...d.game, catCoins: d.game.catCoins + rw.coins } : d.game,
    }));
    if (rw.coins > 0) {
      toast.success(
        `🎉 ${GAME_META[g].label}: ${correct}/${total} · +${rw.coins} xu (còn ${STUDY_REWARD_MAX_DAY - rw.state.count} lượt thưởng hôm nay)`,
      );
    } else {
      toast(`🎉 ${GAME_META[g].label}: ${correct}/${total} — đã hết 3 lượt thưởng hôm nay`);
    }
  };

  const startGame = (g: StudyGame) => {
    if (!gamePool.length) {
      toast.error("Cần có thẻ trước — soạn bộ ở mục Bài học nhé!");
      return;
    }
    setGame(g);
    setStartedAt(Date.now());
    if (g === "quiz") {
      const qs = buildQuizRound(gamePool, QUIZ_LEN);
      if (!qs.length) {
        toast.error(
          "Cần ít nhất một thẻ có 2 lựa chọn trở lên (thêm đáp án sai, hoặc thêm thẻ khác để tự ghép).",
        );
        setGame(null);
        return;
      }
      setQuiz({ qs, i: 0, picked: null, correct: 0 });
      setTf(null);
      setMatch(null);
    } else if (g === "tf") {
      const qs = buildTrueFalseRound(gamePool, TRUE_FALSE_LEN);
      if (!qs.length) {
        toast.error("Cần ít nhất 2 thẻ khác nhau để chơi Đúng/Sai.");
        setGame(null);
        return;
      }
      setTf({ qs, i: 0, picked: null, correct: 0 });
      setQuiz(null);
      setMatch(null);
    } else {
      const pairs = buildMatchRound(gamePool, 6);
      if (pairs.length < 3) {
        toast.error("Cần ít nhất 3 thẻ có đáp án ngắn (≤ 40 ký tự) để chơi Ghép cặp.");
        setGame(null);
        return;
      }
      const right = pairs.map((p) => ({ cardId: p.cardId, text: p.answer }));
      for (let i = right.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [right[i], right[j]] = [right[j]!, right[i]!];
      }
      setMatch({
        pairs,
        right,
        leftId: null,
        matched: new Set(),
        wrong: 0,
        startedAt: Date.now(),
        tick: 0,
      });
      setQuiz(null);
      setTf(null);
    }
  };

  useEffect(() => {
    if (!match || match.pairs.every((p) => match.matched.has(p.cardId))) return;
    const t = setInterval(() => setMatch((m) => (m ? { ...m, tick: m.tick + 1 } : m)), 1000);
    return () => clearInterval(t);
  }, [match?.tick, match?.pairs, match?.matched, match]);

  // Quiz helpers
  const quizCurrent = quiz ? quiz.qs[quiz.i]! : null;
  const pickQuiz = (idx: number) => {
    if (!quiz || quiz.picked !== null) return;
    const correct = quizCurrent!.options[idx] === quizCurrent!.options[quizCurrent!.correctIndex];
    setQuiz({ ...quiz, picked: idx, correct: quiz.correct + (correct ? 1 : 0) });
  };
  const nextQuiz = () => {
    if (!quiz) return;
    if (quiz.i + 1 < quiz.qs.length) setQuiz({ ...quiz, i: quiz.i + 1, picked: null });
    else {
      finishRound("quiz", quiz.correct, quiz.qs.length);
      setQuiz(null);
      setGame(null);
    }
  };

  // True/False helpers
  const tfCurrent = tf ? tf.qs[tf.i]! : null;
  const pickTf = (saidTrue: boolean) => {
    if (!tf || tf.picked !== null) return;
    const correct = saidTrue === tfCurrent!.isTrue;
    setTf({ ...tf, picked: saidTrue, correct: tf.correct + (correct ? 1 : 0) });
  };
  const nextTf = () => {
    if (!tf) return;
    if (tf.i + 1 < tf.qs.length) setTf({ ...tf, i: tf.i + 1, picked: null });
    else {
      finishRound("tf", tf.correct, tf.qs.length);
      setTf(null);
      setGame(null);
    }
  };

  // Match helpers
  const pickLeft = (cardId: string) => setMatch((m) => (m ? { ...m, leftId: cardId } : m));
  const pickRight = (cardId: string) => {
    setMatch((m) => {
      if (!m || !m.leftId || m.matched.has(cardId)) return m;
      if (m.leftId === cardId) {
        const matched = new Set(m.matched);
        matched.add(cardId);
        return { ...m, matched, leftId: null };
      }
      return { ...m, wrong: m.wrong + 1, leftId: null };
    });
  };

  const matchDone = match && match.pairs.every((p) => match.matched.has(p.cardId));
  useEffect(() => {
    if (matchDone && match) {
      const seconds = Math.max(0, Math.round((Date.now() - match.startedAt) / 1000));
      finishRound("match", match.pairs.length, match.pairs.length + match.wrong);
      setMatch(null);
      setGame(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchDone]);

  const accuracy = useMemo(() => subjectAccuracy(data.studyHistory), [data.studyHistory]);
  const current: Flashcard | null = queue ? (byId.get(queue[qi]!) ?? null) : null;

  return (
    <section className="glass p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🎓 Học tập</h2>
        <span className="text-xs text-muted-foreground">
          {stats.total} thẻ · ⏰ {stats.due} đến hạn · 🎁 còn {rewardsLeft} lượt thưởng
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Soạn bộ ôn từng dòng như Quizlet, rủ thẻ thành trắc nghiệm / ghép cặp / đúng–sai. Thẻ nhớ
        thì giãn dần, quên thì quay lại đúng lúc.
      </p>

      <div
        className="mb-4 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Học tập các mục"
      >
        {(
          [
            ["learn", "📚 Bài học"],
            ["games", "🎮 Trò chơi"],
            ["history", "🏆 Lịch sử"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => pickView(key)}
            className={
              view === key
                ? "shrink-0 rounded-full px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow"
                : "shrink-0 rounded-full px-4 py-2 text-sm font-medium bg-secondary/60 text-foreground/75 hover:bg-secondary hover:text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {view === "learn" && (
        <>
          {queue && current ? (
            <div className="mb-4 rounded-xl border border-primary/25 bg-secondary/40 p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                {current.subject || "Chung"} · thẻ {qi + 1}/{queue.length} · ✅ {session.good} 😵{" "}
                {session.again}
              </p>
              <p className="mb-3 text-base font-medium">{current.question}</p>
              {revealed ? (
                <>
                  <div className="mb-3 rounded-lg bg-background/70 p-3 text-sm whitespace-pre-wrap">
                    {current.answer}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {RATINGS.map((r) => (
                      <Button
                        key={r.rating}
                        size="sm"
                        variant="outline"
                        className={r.className}
                        onClick={() => rate(r.rating)}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <Button className="w-full" onClick={() => setRevealed(true)}>
                  👀 Lộn thẻ
                </Button>
              )}
              <button
                className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setQueue(null)}
              >
                Dừng lượt ôn này
              </button>
            </div>
          ) : (
            stats.due > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => startReview()}>
                  🔁 Ôn đến hạn ({stats.due})
                </Button>
                {decks
                  .filter((d) => d.due > 0)
                  .slice(0, 4)
                  .map((d) => (
                    <Button
                      key={d.subject}
                      size="sm"
                      variant="secondary"
                      onClick={() => startReview(d.subject)}
                    >
                      {d.subject} ({d.due})
                    </Button>
                  ))}
              </div>
            )
          )}

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Môn:</span>
            {subjects.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pickSubject(s)}
                className={
                  subject === s
                    ? "rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground"
                    : "rounded-full px-3 py-1 text-xs bg-secondary/60 hover:bg-secondary"
                }
              >
                {s}
              </button>
            ))}
          </div>
          {!subject && (
            <div className="mb-3 grid gap-2 rounded-xl border border-primary/20 bg-secondary/30 p-3 sm:grid-cols-[200px_1fr]">
              <Input
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                placeholder="Gõ tên môn (vd: Toán)"
                maxLength={24}
                aria-label="Tên môn"
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                onClick={() => {
                  const name = subjectInput.trim();
                  if (!name) return;
                  pickSubject(name);
                  setSubjectInput("");
                }}
              >
                📖 Mở bộ soạn
              </Button>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Chọn một môn ở trên, hoặc gõ tên môn mới để soạn bộ đầu tiên.
              </p>
            </div>
          )}

          {subject && (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  📖 Bộ soạn: {subject} · {deckCards.length} thẻ
                </h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setImportOpen((o) => !o)}>
                    📥 Nhập nhanh
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={removeDeck}
                  >
                    🗑️ Xoá bộ
                  </Button>
                </div>
              </div>

              {importOpen && (
                <div className="mb-3 grid gap-2 rounded-xl border border-primary/20 bg-secondary/30 p-3">
                  <Textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder={
                      "Mỗi dòng một thẻ:\nVì sao trời xanh?|Tán xạ Rayleigh|Ánh nắng; Biển\nĐơn vị lực?|N|kg"
                    }
                    aria-label="Nhập thẻ hàng loạt"
                    className="min-h-[120px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dạng: <code>câu hỏi | đáp án | đáp án sai 1; đáp án sai 2</code> (phần đáp án
                    sai tùy chọn). Xem trước: <strong>{parseBulk(importText).length}</strong> thẻ
                    hợp lệ (tự bỏ thẻ trùng).
                  </p>
                  <Button size="sm" onClick={runImport}>
                    ➕ Thêm vào bộ
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                {deckCards.map((card) => {
                  const draft = drafts[card.id] ?? { q: card.question, a: card.answer };
                  const wd = wrongDrafts[card.id] ?? card.wrong ?? [];
                  return (
                    <div
                      key={card.id}
                      className="rounded-lg border border-border/60 bg-secondary/20 p-2"
                    >
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <Input
                          value={draft.q}
                          onChange={(e) =>
                            setDrafts((m) => ({ ...m, [card.id]: { ...draft, q: e.target.value } }))
                          }
                          onBlur={() => commitRow(card)}
                          onKeyDown={(e) => e.key === "Enter" && commitRow(card)}
                          maxLength={QUESTION_MAX}
                          aria-label={`Câu hỏi thẻ ${card.id}`}
                          className="h-9 text-sm"
                        />
                        <Input
                          value={draft.a}
                          onChange={(e) =>
                            setDrafts((m) => ({ ...m, [card.id]: { ...draft, a: e.target.value } }))
                          }
                          onBlur={() => commitRow(card)}
                          onKeyDown={(e) => e.key === "Enter" && commitRow(card)}
                          maxLength={ANSWER_MAX}
                          aria-label={`Đáp án thẻ ${card.id}`}
                          className="h-9 text-sm"
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 px-2"
                            title="Đảo chiều hỏi ↔ đáp"
                            aria-label="Đảo chiều thẻ"
                            onClick={() =>
                              update((d) => ({
                                ...d,
                                flashcards: reverseCard(d.flashcards, card.id),
                              }))
                            }
                          >
                            ⇄
                          </Button>
                          <Button
                            size="sm"
                            variant={wrongFor === card.id ? "secondary" : "ghost"}
                            className="h-9 px-2"
                            title="Đáp án sai để thành câu trắc nghiệm"
                            aria-label="Đáp án sai"
                            onClick={() => {
                              if (wrongFor === card.id) {
                                commitWrong(card);
                                setWrongFor(null);
                              } else {
                                setWrongDrafts((m) => ({
                                  ...m,
                                  [card.id]: [...(card.wrong ?? [])],
                                }));
                                setWrongFor(card.id);
                              }
                            }}
                          >
                            {card.wrong && card.wrong.length > 0 ? "⭐" : "☆"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 px-2 text-destructive"
                            aria-label={`Xoá thẻ ${card.id}`}
                            title="Xoá thẻ này"
                            onClick={() =>
                              update((d) => ({
                                ...d,
                                flashcards: deleteCard(d.flashcards, card.id),
                              }))
                            }
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>
                      {wrongFor === card.id && (
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {[0, 1, 2].map((i) => (
                            <Input
                              key={i}
                              value={wd[i] ?? ""}
                              onChange={(e) => {
                                const next = [...wd];
                                next[i] = e.target.value;
                                setWrongDrafts((m) => ({ ...m, [card.id]: next }));
                              }}
                              onBlur={() => commitWrong(card)}
                              maxLength={80}
                              placeholder={`Đáp án sai ${i + 1}`}
                              aria-label={`Đáp án sai ${i + 1} thẻ ${card.id}`}
                              className="h-8 text-sm"
                            />
                          ))}
                          <p className="text-xs text-muted-foreground sm:col-span-3">
                            Thẻ có ⭐ (≥ 1 đáp án sai) sẽ vào trò Trắc nghiệm; thiếu thì app tự ghép
                            đáp án của thẻ khác làm lựa chọn nhiễu.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button size="sm" variant="secondary" onClick={addRow}>
                  ➕ Thêm thẻ
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {view === "games" && (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(GAME_META) as StudyGame[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGame(g);
                  setQuiz(null);
                  setTf(null);
                  setMatch(null);
                }}
                className={
                  game === g
                    ? "rounded-full px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground"
                    : "rounded-full px-4 py-2 text-sm bg-secondary/60 hover:bg-secondary"
                }
              >
                {GAME_META[g].emoji} {GAME_META[g].label}
              </button>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Môn:</span>
            <button
              type="button"
              onClick={() => setGameSubject("")}
              className={
                gameSubject === ""
                  ? "rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground"
                  : "rounded-full px-3 py-1 text-xs bg-secondary/60 hover:bg-secondary"
              }
            >
              Tổng hợp
            </button>
            {subjects
              .filter((s) => cards.some((c) => (c.subject || "Chung") === s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setGameSubject(s)}
                  className={
                    gameSubject === s
                      ? "rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground"
                      : "rounded-full px-3 py-1 text-xs bg-secondary/60 hover:bg-secondary"
                  }
                >
                  {s}
                </button>
              ))}
          </div>

          {!game && (
            <div className="rounded-xl border border-primary/20 bg-secondary/30 p-4 text-sm">
              <p className="mb-2 text-muted-foreground">
                {gameSubject === ""
                  ? "Tổng hợp: trộn thẻ của tất cả các môn."
                  : `Chỉ dùng thẻ của môn ${gameSubject}.`}{" "}
                Mỗi lượt xong được thưởng +5 xu, tối đa 3 lượt thưởng mỗi ngày (còn {rewardsLeft}{" "}
                hôm nay).
              </p>
              <Button onClick={() => startGame(game ?? "quiz")} disabled={!gamePool.length}>
                ▶️ Bắt đầu {GAME_META[game ?? "quiz"].label}
              </Button>
            </div>
          )}

          {game === "quiz" && quiz && quizCurrent && (
            <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4">
              <p className="mb-1 text-xs text-muted-foreground">
                🧠 Câu {quiz.i + 1}/{quiz.qs.length} · ✅ {quiz.correct}
              </p>
              <p className="mb-3 text-base font-medium">{quizCurrent.question}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {quizCurrent.options.map((opt, idx) => {
                  const isCorrect = idx === quizCurrent.correctIndex;
                  const picked = quiz.picked;
                  const show = picked !== null;
                  const cls = !show
                    ? "bg-secondary/60 hover:bg-secondary text-foreground"
                    : isCorrect
                      ? "bg-emerald-600/80 text-white"
                      : picked === idx
                        ? "bg-destructive/80 text-white"
                        : "bg-secondary/30 text-muted-foreground";
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={show}
                      onClick={() => pickQuiz(idx)}
                      className={`rounded-lg px-3 py-2 text-left text-sm transition-colors ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {quiz.picked !== null && (
                <Button className="mt-3 w-full" onClick={nextQuiz}>
                  {quiz.i + 1 < quiz.qs.length ? "Câu tiếp ➡️" : "Xem kết quả 🎉"}
                </Button>
              )}
            </div>
          )}

          {game === "tf" && tf && tfCurrent && (
            <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4">
              <p className="mb-1 text-xs text-muted-foreground">
                ⚡ Câu {tf.i + 1}/{tf.qs.length} · ✅ {tf.correct}
              </p>
              <p className="mb-1 text-base font-medium">{tfCurrent.question}</p>
              <p className="mb-3 rounded-lg bg-background/70 p-3 text-sm">{tfCurrent.shown}</p>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => pickTf(true)}>
                  ✅ Đúng
                </Button>
                <Button variant="outline" onClick={() => pickTf(false)}>
                  ❌ Sai
                </Button>
              </div>
              {tf.picked !== null && (
                <>
                  <p
                    className={`mb-2 text-sm ${tf.picked === tfCurrent.isTrue ? "text-emerald-500" : "text-destructive"}`}
                  >
                    {tf.picked === tfCurrent.isTrue
                      ? "🎉 Chính xác!"
                      : "😅 Sai rồi — đáp án thật: " + tfCurrent.shown}
                  </p>
                  <Button className="w-full" onClick={nextTf}>
                    {tf.i + 1 < tf.qs.length ? "Câu tiếp ➡️" : "Xem kết quả 🎉"}
                  </Button>
                </>
              )}
            </div>
          )}

          {game === "match" && match && !matchDone && (
            <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                🧩 Ghép cặp · ⏱ {Math.round((Date.now() - match.startedAt) / 1000)}s · 😅{" "}
                {match.wrong}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  {match.pairs.map((p) => {
                    const done = match.matched.has(p.cardId);
                    return (
                      <button
                        key={p.cardId}
                        type="button"
                        disabled={done}
                        onClick={() => pickLeft(p.cardId)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          done
                            ? "bg-emerald-600/20 text-emerald-500 line-through opacity-60"
                            : match.leftId === p.cardId
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary/60 hover:bg-secondary"
                        }`}
                      >
                        {p.question}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-2">
                  {match.right.map((r) => {
                    const done = match.matched.has(r.cardId);
                    return (
                      <button
                        key={`${r.cardId}-right`}
                        type="button"
                        disabled={done}
                        onClick={() => pickRight(r.cardId)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          done
                            ? "bg-emerald-600/20 text-emerald-500 line-through opacity-60"
                            : "bg-secondary/60 hover:bg-secondary"
                        }`}
                      >
                        {r.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {view === "history" && (
        <div className="space-y-3">
          {accuracy.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {accuracy.map((a) => {
                const pct = a.total ? Math.round((a.correct / a.total) * 100) : 0;
                return (
                  <div key={a.subject} className="rounded-lg bg-secondary/40 p-2 text-sm">
                    <div className="mb-1 flex justify-between">
                      <span>{a.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        {pct}% ({a.correct}/{a.total})
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-background/70">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {data.studyHistory.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Chưa có lượt chơi nào — vào 🎮 Trò chơi thử một lượt nhé!
            </p>
          ) : (
            <ul className="space-y-1.5">
              {data.studyHistory.map((r, i) => (
                <li
                  key={`${r.date}-${r.game}-${i}`}
                  className="flex items-center gap-2 rounded-lg bg-secondary/40 px-2.5 py-1.5 text-sm"
                >
                  <span>{GAME_META[r.game].emoji}</span>
                  <span className="flex-1 truncate">{r.subject || "Tổng hợp"}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.date} · {r.correct}/{r.total} · {r.seconds}s
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
