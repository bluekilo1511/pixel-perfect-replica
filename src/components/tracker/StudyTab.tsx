import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from "react";
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
  addChildNode,
  buildMindPuzzle,
  connectorEnds,
  connectorPath,
  deleteMindNode,
  MINDMAPS_MAX,
  MIND_CANVAS_H,
  mindCanvasSize,
  MIND_CANVAS_W,
  MIND_NODE_H_MAX,
  MIND_NODE_H_MIN,
  MIND_NODES_MAX,
  MIND_COLORS,
  MIND_TEXT_MAX,
  MIND_NODE_W_MAX,
  MIND_NODE_W_MIN,
  moveMindNode,
  newMindmap,
  resetMindNodeSize,
  touchMap,
  updateMindNode,
  type Mindmap,
  type MindNode,
  type MindPuzzle,
} from "@/lib/tracker/mindmap";
import {
  blankMatches,
  buildBlankRound,
  buildMatchRound,
  buildQuizRound,
  type BlankQuestion,
  buildTrueFalseRound,
  deleteCard,
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
import {
  addDeck,
  addFolder,
  addSubject,
  addTerm,
  allDecks,
  countDecks,
  deckLabel,
  deckSubjectName,
  findDeck,
  FOLDERS_MAX,
  removeNode,
  renameNode,
  type Library,
} from "@/lib/tracker/library";
import {
  deleteDeckCards,
  deleteMap as deleteMapRecord,
  loadAllCards,
  loadLibrary,
  loadMaps,
  mergeLegacy,
  saveDeck,
  saveLibrary,
  saveMap as saveMapRecord,
} from "@/lib/tracker/studyStore";
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
  blank: { emoji: "🕳️", label: "Điền từ" },
  flashcards: { emoji: "🃏", label: "Flashcards" },
  mindpuzzle: { emoji: "🗺️", label: "Lược đồ khuyết" },
};

type View = "learn" | "games" | "history" | "maps";

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
  // Cards, mindmaps and the library tree live in IndexedDB (one record per deck,
  // see studyStore.ts) — no longer inside the single AppData JSON file.
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [maps, setMaps] = useState<Mindmap[]>([]);
  const [library, setLibrary] = useState<Library | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [view, setView] = useState<View>(() =>
    readStored<View>("ppr.studyView", ["learn", "games", "history"], "learn"),
  );
  const [activeDeck, setActiveDeck] = useState<string>(
    () => localStorage.getItem("ppr.studyDeck") ?? "",
  );
  const [gameDeckId, setGameDeckId] = useState<string>("");
  const [reviewMode, setReviewMode] = useState<"free" | "srs">("free");
  const [libOpen, setLibOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportText, setExportText] = useState("");

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
  const [fcGame, setFcGame] = useState(false); // flashcards round running inside 🎮 Trò chơi
  const [blank, setBlank] = useState<{
    qs: BlankQuestion[];
    i: number;
    inputs: string[];
    checked: boolean[] | null; // per-blank correctness once checked
    correct: number;
  } | null>(null);
  const [mp, setMp] = useState<{
    puzzle: MindPuzzle;
    filled: Record<string, string>; // holeId -> filled candidate text
    triedWrong: Set<string>; // hole ids with at least one wrong attempt
    picked: string | null; // currently selected candidate text
  } | null>(null);

  // Mind-map editor state.
  const [mapId, setMapId] = useState<string>(""); // "" = list view
  const [selNode, setSelNode] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    dx: number;
    dy: number;
    x: number;
    y: number;
  } | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number; x: number; y: number } | null>(null);
  const [resz, setResz] = useState<{ id: string; w: number; h: number } | null>(null);
  const reszRef = useRef<{
    id: string;
    w: number;
    h: number;
    cx: number;
    cy: number;
  } | null>(null);

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
  const pickDeck = (deckId: string) => {
    setActiveDeck(deckId);
    persist("ppr.studyDeck", deckId);
  };

  // Load the IndexedDB study library once. Legacy AppData arrays are merged in
  // by card id first (restoring an old backup never duplicates), then cleared.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const merged = await mergeLegacy(data.flashcards, data.mindmaps);
        if (merged > 0) update((d) => ({ ...d, flashcards: [], mindmaps: [] }));
        const [lib, allCards, allMaps] = await Promise.all([
          loadLibrary(),
          loadAllCards(),
          loadMaps(),
        ]);
        if (!alive) return;
        setLibrary(lib);
        setCards(allCards);
        setMaps(allMaps);
        const last = localStorage.getItem("ppr.studyDeck") ?? "";
        if (last && !findDeck(lib ?? { folders: [] }, last)) {
          setActiveDeck("");
          persist("ppr.studyDeck", "");
        }
      } catch {
        if (alive) {
          // Degraded mode without IndexedDB: show whatever AppData still holds.
          setLibrary({ folders: [] });
          setCards(data.flashcards);
          setMaps(data.mindmaps);
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deckTitle = useMemo(
    () => (library && activeDeck ? deckLabel(library, activeDeck) : activeDeck),
    [library, activeDeck],
  );
  const subjLabel = useMemo(
    () => (library && activeDeck ? deckSubjectName(library, activeDeck) : activeDeck),
    [library, activeDeck],
  );

  // Every card mutation funnels through here: update the in-memory pool and
  // rewrite just this deck's record in IndexedDB (the "file" for this deck).
  const persistDeck = (deckId: string, deckList: Flashcard[]) => {
    setCards((cs) => {
      const others = cs.filter((c) => (c.deckId ?? c.subject) !== deckId);
      return [...others, ...deckList];
    });
    void saveDeck(deckId, deckList);
  };

  // ---- Review runner ----
  const startReview = (filterSubject?: string, filterDeckId?: string, forceAll = false) => {
    const byIdNow = new Map(cards.map((c) => [c.id, c]));
    let pool = forceAll ? cards : dueCards(cards, today);
    if (filterDeckId) {
      pool = pool.filter((c) => (c.deckId ?? c.subject) === filterDeckId);
    } else if (filterSubject) {
      pool = pool.filter((c) => (c.subject || "Chung") === filterSubject);
    }
    if (!pool.length) {
      toast("Không có thẻ nào để ôn!");
      return;
    }
    setQueue(pool.map((c) => c.id));
    setQi(0);
    setRevealed(false);
    setSession({ good: 0, again: 0, done: 0 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const moveCard = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= deckCards.length) return;
    const a = deckCards[idx]!;
    const b = deckCards[targetIdx]!;
    let tA = new Date(a.createdAt).getTime();
    let tB = new Date(b.createdAt).getTime();
    if (isNaN(tA)) tA = Date.now();
    if (isNaN(tB)) tB = Date.now();
    if (tA === tB) {
      tB = tA + (dir > 0 ? 1000 : -1000);
    }
    const updatedA = { ...a, createdAt: new Date(tB).toISOString() };
    const updatedB = { ...b, createdAt: new Date(tA).toISOString() };
    const nextList = [...deckCards];
    nextList[idx] = updatedB;
    nextList[targetIdx] = updatedA;
    persistDeck(activeDeck, nextList);
  };

  const doExport = () => {
    if (!deckCards.length) {
      toast.error("Bộ này chưa có thẻ nào!");
      return;
    }
    const lines = deckCards.map((c) => {
      const wrong = c.wrong && c.wrong.length > 0 ? `|${c.wrong.join("; ")}` : "";
      return `${c.question}|${c.answer}${wrong}`;
    });
    const textOut = lines.join("\n");
    setExportText(textOut);
    setExportOpen(true);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(textOut);
      toast.success(`Đã sao chép ${deckCards.length} thẻ vào bộ nhớ tạm!`);
    }
  };

  const startDeckGame = (g: StudyGame) => {
    if (!deckCards.length) {
      toast.error("Bộ này chưa có thẻ nào!");
      return;
    }
    setGameDeckId(activeDeck);
    pickView("games");
    startGame(g, deckCards);
  };

  const rate = (rating: Rating) => {
    if (!queue) return;
    const id = queue[qi]!;
    const card = byId.get(id);
    if (!card) return;
    const updated = reviewCard(card, rating, today);
    const deckId = card.deckId ?? (card.subject || "Chung");
    persistDeck(
      deckId,
      cards
        .filter((c) => (c.deckId ?? c.subject) === deckId)
        .map((c) => (c.id === id ? updated : c)),
    );
    setSession((s) => ({
      good: s.good + (rating > 0 ? 1 : 0),
      again: s.again + (rating === 0 ? 1 : 0),
      done: s.done + 1,
    }));
    if (qi + 1 < queue.length) {
      setQi(qi + 1);
      setRevealed(false);
    } else {
      const good = session.good + (rating > 0 ? 1 : 0);
      const again = session.again + (rating === 0 ? 1 : 0);
      setQueue(null);
      setRevealed(false);
      if (fcGame) {
        setFcGame(false);
        setGame(null);
        finishRound("flashcards", good, session.done + 1);
      } else {
        toast.success(`🃏 Xong lượt ôn! ${good} nhớ, ${again} cần ôn lại`);
      }
    }
  };

  // ---- Deck editing ----
  const deckCards = useMemo(() => {
    const list = activeDeck ? cards.filter((c) => (c.deckId ?? c.subject) === activeDeck) : [];
    return [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [cards, activeDeck]);

  const commitRow = (card: Flashcard) => {
    const draft = drafts[card.id];
    if (!draft) return;
    const q = draft.q.trim();
    const a = draft.a.trim();
    if (!q || !a) return; // never blank out a card
    const deckId = card.deckId ?? (card.subject || "Chung");
    persistDeck(deckId, updateCard(deckCards, card.id, { question: q, answer: a }));
  };

  const commitWrong = (card: Flashcard) => {
    const draft = wrongDrafts[card.id];
    if (!draft) return;
    const deckId = card.deckId ?? (card.subject || "Chung");
    persistDeck(deckId, updateCard(deckCards, card.id, { wrong: draft }));
  };

  const addRow = () => {
    if (!activeDeck) {
      toast.error("Chọn một bộ thẻ trong thư viện trước đã!");
      return;
    }
    if (deckCards.length >= FLASHCARDS_MAX) {
      toast.error(`Tối đa ${FLASHCARDS_MAX} thẻ mỗi bộ — xoá bớt thẻ cũ nhé!`);
      return;
    }
    const card = {
      ...newFlashcard(subjLabel || activeDeck, "Câu hỏi mới", "Đáp án", today),
      deckId: activeDeck,
    };
    persistDeck(activeDeck, [...deckCards, card]);
  };

  const runImport = () => {
    if (!activeDeck) {
      toast.error("Chọn một bộ thẻ trong thư viện trước đã!");
      return;
    }
    const parsed = parseBulk(importText);
    if (!parsed.length) {
      toast.error("Chưa có dòng hợp lệ nào — mỗi dòng dạng: câu hỏi | đáp án");
      return;
    }
    const res = mergeBulk(deckCards, subjLabel || activeDeck, parsed, today);
    persistDeck(
      activeDeck,
      res.cards.map((c) => ({ ...c, deckId: c.deckId ?? activeDeck })),
    );
    setImportText("");
    setImportOpen(false);
    toast.success(
      `📥 Đã thêm ${res.added} thẻ${res.skipped ? ` (bỏ qua ${res.skipped} trùng)` : ""}`,
    );
  };

  // In-app dialog replaces native prompt/confirm dialogs (blocked in preview iframes)
  type AskDialog =
    | { kind: "name"; title: string; value: string; onOk: (v: string) => void }
    | { kind: "confirm"; title: string; onOk: () => void };
  const [ask, setAsk] = useState<AskDialog | null>(null);

  const removeDeck = () => {
    if (!activeDeck || !library) return;
    setAsk({
      kind: "confirm",
      title: `Xoá bộ "${deckTitle}" cùng toàn bộ thẻ? Không hoàn tác được.`,
      onOk: () => {
        const res = removeNode(library, activeDeck);
        if (!res) return;
        setLibrary(res.library);
        void saveLibrary(res.library);
        void deleteDeckCards(activeDeck);
        setCards((cs) => cs.filter((c) => (c.deckId ?? c.subject) !== activeDeck));
        setActiveDeck("");
        persist("ppr.studyDeck", "");
        toast("🗑️ Đã xoá bộ thẻ");
      },
    });
  };

  // ---- Library tree editing ----
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitTree = (lib: Library) => {
    setLibrary(lib);
    void saveLibrary(lib);
  };

  const doRename = (kind: "folder" | "subject" | "term" | "deck", id: string, current: string) => {
    if (!library) return;
    setAsk({
      kind: "name",
      title: "Đổi tên:",
      value: current,
      onOk: (name) => {
        const res = renameNode(library, kind, id, name);
        if (!res) {
          toast.error("Tên trống hoặc không tìm thấy mục.");
          return;
        }
        commitTree(res);
      },
    });
  };

  const doAddFolder = () => {
    if (!library) return;
    setAsk({
      kind: "name",
      title: "Tên thư mục (vd: Năm lớp 9):",
      value: "",
      onOk: (name) => {
        const res = addFolder(library, name);
        if (!res) {
          toast.error(`Tối đa ${FOLDERS_MAX} thư mục.`);
          return;
        }
        commitTree(res);
        const f = res.folders[res.folders.length - 1]!;
        setExpanded((p) => new Set(p).add(f.id));
      },
    });
  };

  const doAddSubject = (folderId: string) => {
    if (!library) return;
    setAsk({
      kind: "name",
      title: "Tên môn (vd: Toán):",
      value: "",
      onOk: (name) => {
        const res = addSubject(library, folderId, name);
        if (!res) {
          toast.error("Không thêm được môn.");
          return;
        }
        commitTree(res);
        setExpanded((p) => new Set(p).add(folderId));
      },
    });
  };

  const doAddTerm = (folderId: string, subjectId: string) => {
    if (!library) return;
    setAsk({
      kind: "name",
      title: "Tên học kỳ (vd: HK1):",
      value: "",
      onOk: (name) => {
        const res = addTerm(library, folderId, subjectId, name);
        if (!res) {
          toast.error("Không thêm được học kỳ.");
          return;
        }
        commitTree(res);
        setExpanded((p) => new Set(p).add(folderId).add(subjectId));
      },
    });
  };

  const doAddDeck = (folderId: string, subjectId: string, termId: string | null) => {
    if (!library) return;
    setAsk({
      kind: "name",
      title: "Tên bộ thẻ (vd: HK1 - Đại lượng tỉ lệ):",
      value: "",
      onOk: (name) => {
        const res = addDeck(library, folderId, subjectId, termId, name);
        if (!res) {
          toast.error("Không thêm được bộ thẻ.");
          return;
        }
        commitTree(res.library);
        const ex = new Set(expanded).add(folderId).add(subjectId);
        if (termId) ex.add(termId);
        setExpanded(ex);
        pickDeck(res.deckId);
      },
    });
  };

  const doRemove = (id: string, name: string) => {
    if (!library) return;
    setAsk({
      kind: "confirm",
      title: `Xoá "${name}" cùng mọi nội dung bên trong? Không hoàn tác được.`,
      onOk: () => {
        const res = removeNode(library, id);
        if (!res) return;
        commitTree(res.library);
        for (const deckId of res.deckIds) void deleteDeckCards(deckId);
        const gone = new Set(res.deckIds);
        setCards((cs) => cs.filter((c) => !(c.deckId && gone.has(c.deckId))));
        if (activeDeck && gone.has(activeDeck)) {
          setActiveDeck("");
          persist("ppr.studyDeck", "");
        }
      },
    });
  };

  // ---- Games ----
  const libraryDecks = useMemo(() => (library ? allDecks(library) : []), [library]);

  const gamePool = useMemo(() => {
    let pool = cards;
    if (gameDeckId) {
      pool = pool.filter((c) => (c.deckId ?? c.subject) === gameDeckId);
    } else if (gameSubject) {
      pool = pool.filter((c) => (c.subject || "Chung") === gameSubject);
    }
    return pool;
  }, [cards, gameDeckId, gameSubject]);

  const finishRound = (g: StudyGame, correct: number, total: number) => {
    const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
    const result = { date: today, game: g, subject: gameSubject, correct, total, seconds };
    let coinsEarned = 0;
    let remainingRewards = 0;
    update((d) => {
      const rw = grantStudyReward(d.studyRewards, today);
      coinsEarned = rw.coins;
      remainingRewards = STUDY_REWARD_MAX_DAY - rw.state.count;
      return {
        ...d,
        studyRewards: rw.state,
        studyHistory: recordStudy(d.studyHistory, result),
        game: rw.coins > 0 ? { ...d.game, catCoins: d.game.catCoins + rw.coins } : d.game,
      };
    });
    if (coinsEarned > 0) {
      toast.success(
        `🎉 ${GAME_META[g].label}: ${correct}/${total} · +${coinsEarned} 😺 (còn ${remainingRewards} lượt thưởng hôm nay)`,
      );
    } else {
      toast(`🎉 ${GAME_META[g].label}: ${correct}/${total} — đã hết 3 lượt thưởng hôm nay`);
    }
  };

  const startGame = (g: StudyGame, poolOverride?: Flashcard[]) => {
    const pool = poolOverride ?? gamePool;
    if (!pool.length) {
      toast.error("Cần có thẻ trước — soạn bộ ở mục Bài học nhé!");
      return;
    }
    setGame(g);
    setStartedAt(Date.now());
    if (g === "blank") {
      const qs = buildBlankRound(pool, 6);
      if (!qs.length) {
        toast.error("Cần thẻ có đáp án từ 2 từ trở lên — thêm thẻ ở mục Bài học nhé!");
        setGame(null);
        return;
      }
      setBlank({ qs, i: 0, inputs: qs[0]!.blanks.map(() => ""), checked: null, correct: 0 });
      return;
    }
    if (g === "flashcards") {
      let fpool = dueCards(pool, today);
      if (!fpool.length) fpool = [...pool].sort(() => Math.random() - 0.5).slice(0, 10);
      if (!fpool.length) {
        toast.error("Chưa có thẻ nào — soạn bộ ở mục Bài học nhé!");
        setGame(null);
        return;
      }
      setQueue(fpool.map((c) => c.id));
      setQi(0);
      setRevealed(false);
      setSession({ good: 0, again: 0, done: 0 });
      setFcGame(true);
      return;
    }
    if (g === "mindpuzzle") {
      if (pool.length < 6) {
        toast.error("Cần ít nhất 6 thẻ để dựng lược đồ có đủ đáp án nhiễu — thêm thẻ nhé!");
        setGame(null);
        return;
      }
      const puzzle = buildMindPuzzle(pool);
      if (!puzzle) {
        toast.error("Cần ít nhất 6 thẻ để dựng lược đồ có đủ đáp án nhiễu — thêm thẻ nhé!");
        setGame(null);
        return;
      }
      setMp({ puzzle, filled: {}, triedWrong: new Set(), picked: null });
      return;
    }
    if (g === "quiz") {
      const qs = buildQuizRound(pool, QUIZ_LEN);
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
      const qs = buildTrueFalseRound(pool, TRUE_FALSE_LEN);
      if (!qs.length) {
        toast.error("Cần ít nhất 2 thẻ khác nhau để chơi Đúng/Sai.");
        setGame(null);
        return;
      }
      setTf({ qs, i: 0, picked: null, correct: 0 });
      setQuiz(null);
      setMatch(null);
    } else {
      const pairs = buildMatchRound(pool, 6);
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

  // Blank helpers
  const blankCurrent = blank ? blank.qs[blank.i]! : null;
  const setBlankInput = (bi: number, v: string) => {
    if (!blank) return;
    setBlank({ ...blank, inputs: blank.inputs.map((x, i) => (i === bi ? v : x)) });
  };
  const checkBlank = () => {
    if (!blank || blank.checked) return;
    const q = blank.qs[blank.i]!;
    const checked = q.blanks.map((bl, i) => blankMatches(bl.answer, blank.inputs[i] ?? ""));
    setBlank({ ...blank, checked, correct: blank.correct + (checked.every(Boolean) ? 1 : 0) });
  };
  const nextBlank = () => {
    if (!blank) return;
    if (blank.i + 1 < blank.qs.length) {
      const nq = blank.qs[blank.i + 1]!;
      setBlank({ ...blank, i: blank.i + 1, inputs: nq.blanks.map(() => ""), checked: null });
    } else {
      finishRound("blank", blank.correct, blank.qs.length);
      setBlank(null);
      setGame(null);
    }
  };

  // Mind-puzzle helpers
  const pickCandidate = (text: string) => {
    if (!mp) return;
    setMp({ ...mp, picked: mp.picked === text ? null : text });
  };
  const fillHole = (holeId: string) => {
    if (!mp || !mp.picked) return;
    const hole = mp.puzzle.nodes.find((n) => n.id === holeId);
    if (!hole || mp.filled[holeId]) return;
    if (hole.holeOf === mp.picked) {
      const filled = { ...mp.filled, [holeId]: mp.picked };
      const allDone = mp.puzzle.holes.every((h) => filled[h]);
      setMp({ ...mp, filled, picked: null });
      if (allDone) {
        const clean = mp.puzzle.holes.filter((h) => !mp.triedWrong.has(h)).length;
        finishRound("mindpuzzle", clean, mp.puzzle.holes.length);
        setMp(null);
        setGame(null);
      }
    } else {
      setMp({ ...mp, triedWrong: new Set(mp.triedWrong).add(holeId), picked: null });
    }
  };

  // Mind-map editor helpers — each map is its own IndexedDB record.
  const mapsRef = useRef<Mindmap[]>([]);
  mapsRef.current = maps;
  const curMap: Mindmap | null = maps.find((m) => m.id === mapId) ?? null;
  const patchMap = useCallback(
    (fn: (m: Mindmap) => Mindmap) => {
      const next = mapsRef.current.map((m) => (m.id === mapId ? touchMap(fn(m)) : m));
      mapsRef.current = next;
      setMaps(next);
      const cur = next.find((m) => m.id === mapId);
      if (cur) void saveMapRecord(cur);
    },
    [mapId],
  );
  const createMap = () => {
    if (maps.length >= MINDMAPS_MAX) {
      toast.error(`Tối đa ${MINDMAPS_MAX} sơ đồ — xoá bớt nhé!`);
      return;
    }
    const m = newMindmap(`Sơ đồ ${maps.length + 1}`);
    setMaps((ms) => [...ms, m]);
    void saveMapRecord(m);
    setMapId(m.id);
    setSelNode(null);
  };
  const removeMap = (id: string) => {
    setAsk({
      kind: "confirm",
      title: "Xoá sơ đồ này? Không hoàn tác được.",
      onOk: () => {
        setMaps((ms) => ms.filter((m) => m.id !== id));
        void deleteMapRecord(id);
        if (id === mapId) {
          setMapId("");
          setSelNode(null);
        }
      },
    });
  };
  const deselectNode = useCallback(() => {
    if (selNode && drafts[selNode]) {
      patchMap((m) => updateMindNode(m, selNode, { text: drafts[selNode]!.q }));
      setDrafts((m) => {
        const next = { ...m };
        delete next[selNode];
        return next;
      });
    }
    setSelNode(null);
  }, [selNode, drafts, patchMap]);

  const addChildHere = () => {
    if (!curMap || !selNode) return;
    if (drafts[selNode]) {
      patchMap((m) => updateMindNode(m, selNode, { text: drafts[selNode]!.q }));
      setDrafts((m) => {
        const next = { ...m };
        delete next[selNode];
        return next;
      });
    }
    const next = addChildNode(curMap, selNode);
    if (!next) {
      toast.error(
        curMap.nodes.length >= MIND_NODES_MAX
          ? `Tối đa ${MIND_NODES_MAX} ô — xoá bớt nhé!`
          : "Không thêm được ô con.",
      );
      return;
    }
    patchMap(() => next);
    // Giữ nguyên ô đang chọn để người dùng có thể tạo 5 nhánh liên tiếp mà không bị nhảy panel
  };
  const removeSelNode = () => {
    if (!curMap || !selNode) return;
    const node = curMap.nodes.find((x) => x.id === selNode);
    if (!node) return;
    if (!node.parentId) {
      removeMap(curMap.id);
      return;
    }
    patchMap((m) => deleteMindNode(m, selNode));
    setSelNode(null);
  };
  const nodePos = (n: MindNode): { x: number; y: number } =>
    drag && drag.id === n.id ? { x: drag.x, y: drag.y } : { x: n.x, y: n.y };
  const nodeEls = useRef(new Map<string, HTMLButtonElement>());
  const [nodeSizes, setNodeSizes] = useState<Record<string, { w: number; h: number }>>({});
  const sizeKeys = useMemo(
    () => (curMap ? curMap.nodes.map((n) => `${n.id}:${n.text.length}:${n.shape}`).join("|") : ""),
    [curMap],
  );
  useLayoutEffect(() => {
    setNodeSizes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, el] of nodeEls.current) {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        if (!prev[id] || prev[id]!.w !== w || prev[id]!.h !== h) {
          next[id] = { w, h };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sizeKeys]);
  // Effective node size: a live resize wins, then a stored custom size (either
  // dimension may be customized alone), then the measured auto-fit size.
  const nodeSize = useCallback(
    (n: MindNode): { w: number; h: number } => {
      if (resz && resz.id === n.id) return { w: resz.w, h: resz.h };
      const m = nodeSizes[n.id] ?? { w: 170, h: 44 };
      return { w: n.w ?? m.w, h: n.h ?? m.h };
    },
    [resz, nodeSizes],
  );
  // Canvas hugs the mindmap content so there is no dead scroll space, fills the
  // visible editor width, and grows live while a node is dragged outward.
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(0);
  useEffect(() => {
    const el = scrollBoxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const mindSize = useMemo(() => {
    if (!curMap) return { w: 560, h: 360 };
    const pos = (n: MindNode) =>
      drag && drag.id === n.id ? { x: drag.x, y: drag.y } : { x: n.x, y: n.y };
    const sizes: Record<string, { w: number; h: number }> = {};
    for (const n of curMap.nodes) sizes[n.id] = nodeSize(n);
    const base = mindCanvasSize(
      curMap.nodes.map((n) => ({ id: n.id, x: pos(n).x, y: pos(n).y })),
      sizes,
    );
    // Never wider than the farthest a node can legally reach + padding.
    const maxW = MIND_CANVAS_W - 40 + 85 + 60;
    return {
      w: Math.min(maxW, Math.max(base.w, boxW, 560)),
      h: Math.max(base.h, 360),
    };
  }, [curMap, nodeSize, boxW, drag]);
  // Track the pointer on window so a drag keeps working even when the cursor
  // leaves the canvas, the browser window, or a scroll edge interrupts it.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const r = reszRef.current;
      if (r) {
        const w = Math.min(
          MIND_NODE_W_MAX,
          Math.max(MIND_NODE_W_MIN, Math.round(r.w + (e.clientX - r.cx))),
        );
        const h = Math.min(
          MIND_NODE_H_MAX,
          Math.max(MIND_NODE_H_MIN, Math.round(r.h + (e.clientY - r.cy))),
        );
        reszRef.current = { ...r, w, h, cx: e.clientX, cy: e.clientY };
        setResz({ id: r.id, w, h });
        return;
      }
      const d = dragRef.current;
      if (!d) return;
      const x = Math.min(MIND_CANVAS_W - 40, Math.max(40, e.clientX - d.dx));
      const y = Math.min(MIND_CANVAS_H - 30, Math.max(30, e.clientY - d.dy));
      dragRef.current = { ...d, x, y };
      setDrag(dragRef.current);
    };
    const up = () => {
      const r = reszRef.current;
      if (r) {
        reszRef.current = null;
        setResz(null);
        patchMap((m) => updateMindNode(m, r.id, { w: r.w, h: r.h }));
        return;
      }
      const d = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (d) patchMap((m) => moveMindNode(m, d.id, d.x, d.y));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [patchMap]);
  const onNodePointerDown = (e: RPointerEvent<HTMLButtonElement>, n: MindNode) => {
    e.preventDefault();
    e.stopPropagation(); // Ngăn sự kiện nổi lên canvas gây bỏ chọn nhầm
    setSelNode(n.id);
    const d = { id: n.id, dx: e.clientX - n.x, dy: e.clientY - n.y, x: n.x, y: n.y };
    dragRef.current = d;
    setDrag(d);
  };
  const onResizeStart = (e: RPointerEvent<HTMLElement>, n: MindNode) => {
    e.preventDefault();
    e.stopPropagation(); // grab the handle without also dragging the node
    const size = nodeSize(n);
    reszRef.current = { id: n.id, w: size.w, h: size.h, cx: e.clientX, cy: e.clientY };
    setResz({ id: n.id, w: size.w, h: size.h });
  };

  // Nhấn Escape để bỏ chọn ô và tắt viền
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        deselectNode();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deselectNode]);

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
            ["maps", "🗺️ Sơ đồ"],
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

      {library && view === "learn" && (
        <>
          {queue && current ? (
            <div className="mb-4 rounded-2xl border border-primary/30 bg-card/70 p-4 shadow-md backdrop-blur-md">
              {/* Header & Mode Switch */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">
                    📖 {current.subject || "Chung"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Thẻ {qi + 1}/{queue.length} · ✅ {session.good} 😵 {session.again}
                  </span>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-secondary/80 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setReviewMode("free")}
                    className={`rounded-full px-2.5 py-1 font-medium transition ${
                      reviewMode === "free"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    📖 Duyệt tự do
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewMode("srs")}
                    className={`rounded-full px-2.5 py-1 font-medium transition ${
                      reviewMode === "srs"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    🧠 Chấm điểm (SRS)
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.round(((qi + 1) / queue.length) * 100)}%` }}
                />
              </div>

              {/* 3D Flip Card */}
              <div
                role="button"
                tabIndex={0}
                aria-label="Lật thẻ bài"
                onClick={() => setRevealed((v) => !v)}
                onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setRevealed((v) => !v)}
                className="group relative mx-auto my-2 w-full max-w-xl cursor-pointer select-none [perspective:1000px] outline-none"
              >
                <div
                  className={`relative min-h-[200px] w-full rounded-2xl border p-6 text-center shadow-lg transition-all duration-500 [transform-style:preserve-3d] ${
                    revealed
                      ? "border-primary/60 bg-primary/10 shadow-primary/10"
                      : "border-border/80 bg-background/90 hover:border-primary/50"
                  }`}
                >
                  {!revealed ? (
                    <div className="flex min-h-[150px] flex-col items-center justify-center space-y-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                        ❓ Câu hỏi (chạm để lật)
                      </span>
                      <p className="text-base font-semibold sm:text-lg text-foreground leading-relaxed">
                        {current.question}
                      </p>
                      <span className="text-[11px] text-muted-foreground/75">
                        Chạm vào thẻ hoặc bấm phím Cách để xem đáp án
                      </span>
                    </div>
                  ) : (
                    <div className="flex min-h-[150px] flex-col items-center justify-center space-y-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-500">
                        💡 Đáp án
                      </span>
                      <p className="text-base font-medium sm:text-lg text-foreground whitespace-pre-wrap leading-relaxed">
                        {current.answer}
                      </p>
                      <span className="text-[11px] text-muted-foreground/75">
                        Chạm lại để lật về mặt câu hỏi
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              {reviewMode === "free" ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={qi === 0}
                    onClick={() => {
                      setQi((i) => Math.max(0, i - 1));
                      setRevealed(false);
                    }}
                  >
                    ◀ Thẻ trước
                  </Button>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setRevealed((v) => !v)}>
                      {revealed ? "Ẩn đáp án" : "👀 Xem đáp án"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Đảo thứ tự ngẫu nhiên"
                      onClick={() => {
                        if (!queue) return;
                        const shuffled = [...queue].sort(() => Math.random() - 0.5);
                        setQueue(shuffled);
                        setQi(0);
                        setRevealed(false);
                        toast("🔀 Đã xáo trộn thứ tự thẻ");
                      }}
                    >
                      🔀 Trộn
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (qi + 1 < queue.length) {
                        setQi((i) => i + 1);
                        setRevealed(false);
                      } else {
                        setQueue(null);
                        toast.success("🎉 Đã xem hết các thẻ trong bộ!");
                      }
                    }}
                  >
                    {qi + 1 < queue.length ? "Thẻ tiếp ▶" : "Xong lượt ôn ✔"}
                  </Button>
                </div>
              ) : (
                /* SRS rating buttons */
                <div className="mt-4 space-y-3 border-t border-border/40 pt-3">
                  {revealed ? (
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
                  ) : (
                    <Button className="w-full" onClick={() => setRevealed(true)}>
                      👀 Lộn thẻ để chấm điểm
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-2 text-center">
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setQueue(null)}
                >
                  Dừng lượt ôn này
                </button>
              </div>
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

          {/* Active Deck Selector Banner (when a deck is open, gives a spacious toggle) */}
          {activeDeck && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bộ đang mở:
                </span>
                <span className="text-sm font-bold text-foreground">🃏 {deckTitle}</span>
                <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                  {deckCards.length} thẻ
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setLibOpen((o) => !o)}
              >
                {libOpen ? "Thu gọn thư viện ▴" : "🗂️ Đổi bộ thẻ / Mở thư viện ▾"}
              </Button>
            </div>
          )}

          {/* Thư viện: Thư mục → Môn → Học kỳ → Bộ thẻ */}
          {(!activeDeck || libOpen) && (
            <div className="mb-4 rounded-2xl border border-primary/20 bg-secondary/30 p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <span>🗂️ Thư viện</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    · {library ? countDecks(library) : 0} bộ thẻ
                  </span>
                </h3>
                <Button size="sm" variant="secondary" onClick={doAddFolder}>
                  ➕ Thư mục mới
                </Button>
              </div>
              {library && !library.folders.length && (
                <p className="text-xs text-muted-foreground">
                  Chưa có thư mục nào — bấm “➕ Thư mục mới” (vd: Năm lớp 9), rồi thêm Môn → Học kỳ
                  (hoặc thêm trực tiếp Bộ thẻ). Mỗi bộ là một “tệp” riêng biệt.
                </p>
              )}
              <div className="space-y-2">
                {library?.folders.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-border/60 bg-background/50 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm font-medium">
                      <button
                        type="button"
                        onClick={() => toggle(f.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left hover:text-primary"
                      >
                        <span className="text-muted-foreground">
                          {expanded.has(f.id) ? "▾" : "▸"}
                        </span>
                        <span>📁</span>
                        <span className="truncate">{f.name}</span>
                        <span className="text-xs text-muted-foreground font-normal">
                          ({f.subjects.length} môn)
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          title="Thêm môn học vào thư mục"
                          onClick={() => doAddSubject(f.id)}
                        >
                          ➕ Môn
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                          title="Đổi tên thư mục"
                          onClick={() => doRename("folder", f.id, f.name)}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                          title="Xoá thư mục"
                          onClick={() => doRemove(f.id, f.name)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>

                    {expanded.has(f.id) && (
                      <div className="mt-2 ml-3 space-y-2 border-l border-border/60 pl-3">
                        {f.subjects.map((sub) => {
                          const totalSubDecks =
                            sub.decks.length +
                            sub.terms.reduce((acc, t) => acc + t.decks.length, 0);
                          return (
                            <div
                              key={sub.id}
                              className="rounded-lg border border-border/40 bg-secondary/20 p-2"
                            >
                              <div className="flex items-center justify-between gap-2 text-sm">
                                <button
                                  type="button"
                                  onClick={() => toggle(sub.id)}
                                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-medium hover:text-primary"
                                >
                                  <span className="text-muted-foreground">
                                    {expanded.has(sub.id) ? "▾" : "▸"}
                                  </span>
                                  <span>📚</span>
                                  <span className="truncate">{sub.name}</span>
                                  <span className="text-xs text-muted-foreground font-normal">
                                    ({totalSubDecks} bộ)
                                  </span>
                                </button>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs font-semibold text-primary"
                                    title="Thêm bộ thẻ trực tiếp dưới môn học này"
                                    onClick={() => doAddDeck(f.id, sub.id, null)}
                                  >
                                    🃏 + Bộ thẻ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    title="Thêm học kỳ"
                                    onClick={() => doAddTerm(f.id, sub.id)}
                                  >
                                    ➕ Học kỳ
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                                    title="Đổi tên môn"
                                    onClick={() => doRename("subject", sub.id, sub.name)}
                                  >
                                    ✏️
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                                    title="Xoá môn"
                                    onClick={() => doRemove(sub.id, sub.name)}
                                  >
                                    🗑️
                                  </Button>
                                </div>
                              </div>

                              {expanded.has(sub.id) && (
                                <div className="mt-2 ml-2 space-y-2 border-l border-border/40 pl-2">
                                  {/* Terms */}
                                  {sub.terms.map((t) => (
                                    <div key={t.id} className="rounded-md bg-background/40 p-1.5">
                                      <div className="flex items-center justify-between gap-1 text-xs">
                                        <button
                                          type="button"
                                          onClick={() => toggle(t.id)}
                                          className="flex min-w-0 flex-1 items-center gap-1 text-left font-medium hover:text-primary"
                                        >
                                          <span className="text-muted-foreground">
                                            {expanded.has(t.id) ? "▾" : "▸"}
                                          </span>
                                          <span>🗂️</span>
                                          <span className="truncate">{t.name}</span>
                                          <span className="text-muted-foreground font-normal">
                                            ({t.decks.length} bộ)
                                          </span>
                                        </button>
                                        <div className="flex items-center gap-0.5">
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 px-1.5 text-[11px] font-semibold text-primary"
                                            title="Thêm bộ thẻ vào học kỳ này"
                                            onClick={() => doAddDeck(f.id, sub.id, t.id)}
                                          >
                                            🃏 + Bộ
                                          </Button>
                                          <button
                                            type="button"
                                            title="Đổi tên học kỳ"
                                            onClick={() => doRename("term", t.id, t.name)}
                                            className="px-1 text-xs opacity-60 hover:opacity-100"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            type="button"
                                            title="Xoá học kỳ"
                                            onClick={() => doRemove(t.id, t.name)}
                                            className="px-1 text-xs text-destructive opacity-60 hover:opacity-100"
                                          >
                                            🗑️
                                          </button>
                                        </div>
                                      </div>

                                      {expanded.has(t.id) && (
                                        <div className="mt-1.5 ml-2 flex flex-wrap gap-1.5 border-l border-border/40 py-1 pl-2">
                                          {t.decks.map((d) => {
                                            const count = cards.filter(
                                              (c) => (c.deckId ?? c.subject) === d.id,
                                            ).length;
                                            return (
                                              <span
                                                key={d.id}
                                                className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/50 py-0.5 pr-1.5 pl-2 text-xs"
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    pickDeck(d.id);
                                                    setLibOpen(false);
                                                  }}
                                                  className={`font-medium ${
                                                    activeDeck === d.id
                                                      ? "text-primary font-bold"
                                                      : "hover:text-primary"
                                                  }`}
                                                >
                                                  🃏 {d.name} ({count})
                                                </button>
                                                <button
                                                  type="button"
                                                  title="Đổi tên bộ thẻ"
                                                  onClick={() => doRename("deck", d.id, d.name)}
                                                  className="text-[10px] opacity-60 hover:opacity-100"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  type="button"
                                                  title="Xoá bộ thẻ"
                                                  onClick={() => doRemove(d.id, d.name)}
                                                  className="text-[10px] text-destructive opacity-60 hover:opacity-100"
                                                >
                                                  🗑️
                                                </button>
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}

                                  {/* Direct subject decks */}
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {sub.decks.map((d) => {
                                      const count = cards.filter(
                                        (c) => (c.deckId ?? c.subject) === d.id,
                                      ).length;
                                      return (
                                        <span
                                          key={d.id}
                                          className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/50 py-0.5 pr-1.5 pl-2 text-xs"
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              pickDeck(d.id);
                                              setLibOpen(false);
                                            }}
                                            className={`font-medium ${
                                              activeDeck === d.id
                                                ? "text-primary font-bold"
                                                : "hover:text-primary"
                                            }`}
                                          >
                                            🃏 {d.name} ({count})
                                          </button>
                                          <button
                                            type="button"
                                            title="Đổi tên bộ thẻ"
                                            onClick={() => doRename("deck", d.id, d.name)}
                                            className="text-[10px] opacity-60 hover:opacity-100"
                                          >
                                            ✏️
                                          </button>
                                          <button
                                            type="button"
                                            title="Xoá bộ thẻ"
                                            onClick={() => doRemove(d.id, d.name)}
                                            className="text-[10px] text-destructive opacity-60 hover:opacity-100"
                                          >
                                            🗑️
                                          </button>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Deck Editor */}
          {activeDeck && (
            <div className="rounded-2xl border border-primary/20 bg-card/40 p-4 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Đang soạn bộ thẻ:
                  </span>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <span>📖 {deckTitle}</span>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-normal text-primary">
                      {deckCards.length} thẻ
                    </span>
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => startReview(undefined, activeDeck, true)}
                    disabled={!deckCards.length}
                    title="Lật thẻ ôn tập bộ này ngay lập tức"
                  >
                    ▶️ Lật thẻ ôn ({deckCards.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!deckCards.length}
                    onClick={() => startDeckGame("quiz")}
                    title="Luyện trắc nghiệm với bộ thẻ này"
                  >
                    🎯 Trắc nghiệm
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!deckCards.length}
                    onClick={() => startDeckGame("match")}
                    title="Ghép cặp nhanh với bộ thẻ này"
                  >
                    🧩 Ghép cặp
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setImportOpen((o) => !o)}>
                    📥 Nhập
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={doExport}
                    disabled={!deckCards.length}
                  >
                    📤 Xuất
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={removeDeck}
                    title="Xoá toàn bộ thẻ này"
                  >
                    🗑️
                  </Button>
                </div>
              </div>

              {importOpen && (
                <div className="mb-4 grid gap-2 rounded-xl border border-primary/20 bg-secondary/30 p-3">
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

              {/* Cards List */}
              <div className="space-y-2.5">
                {deckCards.map((card, idx) => {
                  const draft = drafts[card.id] ?? { q: card.question, a: card.answer };
                  const wd = wrongDrafts[card.id] ?? card.wrong ?? [];
                  return (
                    <div
                      key={card.id}
                      className="rounded-xl border border-border/70 bg-secondary/20 p-3 transition hover:border-primary/40"
                    >
                      <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] items-center">
                        <span className="w-8 text-center font-mono text-xs font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <Input
                          value={draft.q}
                          placeholder="Câu hỏi / Thuật ngữ"
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
                          placeholder="Đáp án / Định nghĩa"
                          onChange={(e) =>
                            setDrafts((m) => ({ ...m, [card.id]: { ...draft, a: e.target.value } }))
                          }
                          onBlur={() => commitRow(card)}
                          onKeyDown={(e) => e.key === "Enter" && commitRow(card)}
                          maxLength={ANSWER_MAX}
                          aria-label={`Đáp án thẻ ${card.id}`}
                          className="h-9 text-sm"
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-1.5 text-xs"
                            disabled={idx === 0}
                            title="Chuyển lên trên"
                            aria-label="Chuyển thẻ lên"
                            onClick={() => moveCard(idx, -1)}
                          >
                            ▲
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-1.5 text-xs"
                            disabled={idx === deckCards.length - 1}
                            title="Chuyển xuống dưới"
                            aria-label="Chuyển thẻ xuống"
                            onClick={() => moveCard(idx, 1)}
                          >
                            ▼
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-xs"
                            title="Đảo chiều hỏi ↔ đáp"
                            aria-label="Đảo chiều thẻ"
                            onClick={() => {
                              const deckId = card.deckId ?? (card.subject || "Chung");
                              persistDeck(deckId, reverseCard(deckCards, card.id));
                            }}
                          >
                            ⇄
                          </Button>
                          <Button
                            size="sm"
                            variant={
                              wrongFor === card.id
                                ? "default"
                                : card.wrong && card.wrong.length > 0
                                  ? "secondary"
                                  : "ghost"
                            }
                            className="h-8 px-2 text-xs font-medium"
                            title="Nhập đáp án sai để thẻ này biến thành câu trắc nghiệm"
                            aria-label="Đáp án sai trắc nghiệm"
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
                            {card.wrong && card.wrong.length > 0
                              ? `🎯 ${card.wrong.length} đáp án sai`
                              : "+ Lựa chọn sai"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-destructive hover:bg-destructive/10"
                            aria-label={`Xoá thẻ ${card.id}`}
                            title="Xoá thẻ này"
                            onClick={() => {
                              const deckId = card.deckId ?? (card.subject || "Chung");
                              persistDeck(deckId, deleteCard(deckCards, card.id));
                            }}
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>
                      {wrongFor === card.id && (
                        <div className="mt-2.5 grid gap-2 sm:grid-cols-3 rounded-lg border border-primary/20 bg-background/60 p-2.5">
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
                              placeholder={`Đáp án sai ${i + 1} (lựa chọn gây nhiễu)`}
                              aria-label={`Đáp án sai ${i + 1} thẻ ${card.id}`}
                              className="h-8 text-xs"
                            />
                          ))}
                          <p className="text-[11px] text-muted-foreground sm:col-span-3">
                            💡 Thẻ có ít nhất 1 đáp án sai sẽ ưu tiên dùng làm câu hỏi Trắc nghiệm;
                            nếu để trống, app sẽ tự lấy đáp án của thẻ khác trong bộ làm đáp án
                            nhiễu.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
                <Button size="sm" variant="secondary" className="w-full sm:w-auto" onClick={addRow}>
                  ➕ Thêm thẻ mới
                </Button>
              </div>
            </div>
          )}

          {/* Export Dialog */}
          {exportOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl">
                <h3 className="mb-2 text-base font-bold">📤 Xuất bộ thẻ dạng text</h3>
                <p className="mb-3 text-xs text-muted-foreground">
                  Đã sao chép vào bộ nhớ tạm. Bạn có thể lưu lại hoặc chia sẻ cho bạn bè để họ nhập
                  vào app.
                </p>
                <Textarea readOnly value={exportText} className="min-h-[160px] font-mono text-xs" />
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard?.writeText(exportText);
                      toast.success("Đã sao chép lại!");
                    }}
                  >
                    📋 Sao chép lại
                  </Button>
                  <Button size="sm" onClick={() => setExportOpen(false)}>
                    Đóng
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {library && view === "games" && (
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
                  setBlank(null);
                  setMp(null);
                  setFcGame(false);
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
          {/* Môn filter */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Môn học:</span>
            <button
              type="button"
              onClick={() => {
                setGameSubject("");
                setGameDeckId("");
              }}
              className={
                gameSubject === "" && gameDeckId === ""
                  ? "rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground shadow-sm"
                  : "rounded-full px-3 py-1 text-xs bg-secondary/70 hover:bg-secondary"
              }
            >
              🌐 Tất cả môn
            </button>
            {subjects
              .filter((s) => cards.some((c) => (c.subject || "Chung") === s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setGameSubject(s);
                    setGameDeckId("");
                  }}
                  className={
                    gameSubject === s && gameDeckId === ""
                      ? "rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground shadow-sm"
                      : "rounded-full px-3 py-1 text-xs bg-secondary/70 hover:bg-secondary"
                  }
                >
                  📚 {s}
                </button>
              ))}
          </div>

          {/* Bộ thẻ filter */}
          <div className="mb-3.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Bộ thẻ:</span>
            <button
              type="button"
              onClick={() => setGameDeckId("")}
              className={
                gameDeckId === ""
                  ? "rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground shadow-sm"
                  : "rounded-full px-3 py-1 text-xs bg-secondary/70 hover:bg-secondary"
              }
            >
              🃏 {gameSubject ? `Tất cả bộ trong môn ${gameSubject}` : "Tất cả bộ thẻ"}
            </button>
            {libraryDecks
              .filter((d) => !gameSubject || d.subject === gameSubject)
              .map((d) => {
                const count = cards.filter((c) => (c.deckId ?? c.subject) === d.id).length;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setGameDeckId(d.id)}
                    className={
                      gameDeckId === d.id
                        ? "rounded-full px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground shadow-sm"
                        : "rounded-full px-3 py-1 text-xs bg-secondary/70 hover:bg-secondary"
                    }
                  >
                    🃏 {d.name} ({count})
                  </button>
                );
              })}
          </div>

          {(!game || (!quiz && !tf && !match && !blank && !mp && !fcGame)) && (
            <div className="rounded-2xl border border-primary/20 bg-secondary/30 p-4 text-sm shadow-sm">
              <div className="mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {GAME_META[game ?? "quiz"].emoji} {GAME_META[game ?? "quiz"].label}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {gameDeckId && library
                    ? `Đang chọn bộ: "${deckLabel(library, gameDeckId)}" (${gamePool.length} thẻ)`
                    : gameSubject
                      ? `Đang chọn môn: "${gameSubject}" (${gamePool.length} thẻ)`
                      : `Tổng hợp tất cả bộ thẻ (${gamePool.length} thẻ)`}
                  . Mỗi lượt hoàn thành được thưởng +5 xu, tối đa 3 lượt/ngày (còn {rewardsLeft} hôm
                  nay).
                </p>
              </div>
              <Button
                onClick={() => startGame(game ?? "quiz")}
                disabled={!gamePool.length}
                className="w-full sm:w-auto"
              >
                ▶️ Bắt đầu chơi {GAME_META[game ?? "quiz"].label} ({gamePool.length} thẻ)
              </Button>
              {!gamePool.length && (
                <p className="mt-2 text-xs text-amber-500">
                  ⚠️ Chưa có thẻ nào trong bộ/môn này — hãy chọn bộ khác hoặc soạn thêm thẻ ở mục
                  Bài học nhé!
                </p>
              )}
            </div>
          )}

          {game === "blank" && blank && blankCurrent && (
            <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4">
              <p className="mb-1 text-xs text-muted-foreground">
                🕳️ Câu {blank.i + 1}/{blank.qs.length} · ✅ {blank.correct}
              </p>
              <p className="mb-3 text-base font-medium">{blankCurrent.question}</p>
              <p className="mb-3 text-sm leading-relaxed">
                {blankCurrent.parts.map((w, wi) => {
                  const bi = blankCurrent.blanks.findIndex((b) => b.index === wi);
                  if (bi === -1) return <span key={wi}>{w} </span>;
                  if (!blank.checked)
                    return (
                      <span
                        key={wi}
                        className="mx-1 inline-block rounded bg-primary/20 px-2 text-primary"
                      >
                        {"_".repeat(Math.max(4, w.length))}
                      </span>
                    );
                  return (
                    <span
                      key={wi}
                      className={`mx-1 inline-block rounded px-2 ${
                        blank.checked[bi]
                          ? "bg-emerald-600/70 text-white"
                          : "bg-destructive/80 text-white"
                      }`}
                    >
                      {blank.inputs[bi] || "—"}
                    </span>
                  );
                })}
              </p>
              {!blank.checked ? (
                <div className="flex flex-wrap items-center gap-2">
                  {blankCurrent.blanks.map((_, bi) => (
                    <Input
                      key={bi}
                      value={blank.inputs[bi] ?? ""}
                      onChange={(e) => setBlankInput(bi, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && checkBlank()}
                      placeholder={`Từ ${bi + 1}`}
                      maxLength={40}
                      aria-label={`Điền chỗ trống ${bi + 1}`}
                      className="h-9 w-44 text-sm"
                      autoFocus={bi === 0}
                    />
                  ))}
                  <Button size="sm" onClick={checkBlank}>
                    ✔️ Kiểm tra
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  {blank.checked.some((c) => !c) && (
                    <span className="text-xs text-muted-foreground">
                      Đáp án đúng: {blankCurrent.parts.join(" ")}
                    </span>
                  )}
                  <Button size="sm" onClick={nextBlank}>
                    {blank.i + 1 < blank.qs.length ? "➡️ Câu tiếp" : "🏁 Tổng kết"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {game === "flashcards" && fcGame && queue && current && (
            <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                🃏 {current.subject || "Chung"} · thẻ {qi + 1}/{queue.length} · ✅ {session.good} 😵{" "}
                {session.again} · đánh giá như ôn thường, thẻ nhớ giãn dần
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
                onClick={() => {
                  setQueue(null);
                  setFcGame(false);
                  setGame(null);
                }}
              >
                Dừng lượt này
              </button>
            </div>
          )}

          {game === "mindpuzzle" && mp && (
            <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4">
              <p className="mb-2 text-xs text-muted-foreground">
                🗺️ Bấm một thẻ phía dưới rồi bấm vào ô trống trên sơ đồ để điền. Còn{" "}
                {mp.puzzle.holes.length - Object.keys(mp.filled).length} ô trống.
              </p>
              <div className="mb-3 space-y-2">
                {[0, 1, 2].map((lvl) => (
                  <div
                    key={lvl}
                    className={`flex flex-wrap gap-2 ${lvl > 0 ? "ml-5 border-l-2 border-border/60 pl-4" : ""}`}
                  >
                    {mp.puzzle.nodes
                      .filter((n) => n.level === lvl)
                      .map((n) => {
                        const isHole = mp.puzzle.holes.includes(n.id);
                        const filled = mp.filled[n.id];
                        const wrong = isHole && !filled && mp.triedWrong.has(n.id);
                        return (
                          <button
                            key={n.id}
                            type="button"
                            disabled={!isHole || !!filled || !mp.picked}
                            onClick={() => fillHole(n.id)}
                            className={`max-w-[260px] truncate rounded-lg border px-2.5 py-1.5 text-xs ${
                              filled
                                ? "border-emerald-500/60 bg-emerald-600/20"
                                : wrong
                                  ? "border-destructive/60 bg-destructive/15"
                                  : isHole
                                    ? "border-dashed border-primary/50 bg-primary/10"
                                    : "border-border/60 bg-secondary/30"
                            } ${mp.picked && isHole && !filled ? "cursor-pointer hover:border-primary" : ""}`}
                            title={filled ?? n.text ?? "Ô trống — chọn thẻ đúng để điền"}
                          >
                            {lvl === 0 ? "🎯 " : lvl === 1 ? "❓ " : "💡 "}
                            {filled ?? n.text ?? "❓"}
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {mp.puzzle.candidates
                  .filter((c) => !Object.values(mp.filled).includes(c.text))
                  .map((c) => (
                    <button
                      key={c.text}
                      type="button"
                      onClick={() => pickCandidate(c.text)}
                      className={
                        mp.picked === c.text
                          ? "max-w-[260px] truncate rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                          : "max-w-[260px] truncate rounded-full bg-secondary/70 px-3 py-1.5 text-xs hover:bg-secondary"
                      }
                    >
                      {c.text}
                    </button>
                  ))}
              </div>
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

      {library && view === "maps" && (
        <>
          {!curMap ? (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Vẽ sơ đồ tư duy của bạn: thêm nhánh, kéo ô, chọn hình và màu. {maps.length}/
                  {MINDMAPS_MAX} sơ đồ.
                </p>
                <Button size="sm" onClick={createMap}>
                  ➕ Sơ đồ mới
                </Button>
              </div>
              {maps.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Chưa có sơ đồ nào — bấm ➕ Sơ đồ mới để bắt đầu.
                </p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {maps.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-border/60 bg-secondary/20 p-3"
                    >
                      <p className="mb-1 truncate text-sm font-semibold">{m.title}</p>
                      <p className="mb-2 text-xs text-muted-foreground">
                        {m.nodes.length} ô · sửa {new Date(m.updatedAt).toLocaleDateString("vi-VN")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setMapId(m.id);
                            setSelNode(null);
                          }}
                        >
                          ✏️ Mở
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeMap(m.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sticky top-0 z-20 space-y-2 rounded-xl border border-border/60 bg-background/95 p-2 backdrop-blur-md shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      deselectNode();
                      setMapId("");
                    }}
                  >
                    ← Danh sách
                  </Button>
                  <Input
                    value={curMap.title}
                    onChange={(e) =>
                      patchMap((m) => ({ ...m, title: e.target.value.slice(0, 40) }))
                    }
                    maxLength={40}
                    aria-label="Tên sơ đồ"
                    className="h-9 w-48 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={addChildHere}
                    disabled={!selNode}
                    title={
                      selNode
                        ? "Thêm nhánh con từ ô này (bấm liên tiếp để tạo nhiều nhánh)"
                        : "Chọn một ô trước khi thêm nhánh con"
                    }
                  >
                    ➕ Nhánh con
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={removeSelNode}
                    disabled={!selNode}
                  >
                    🗑️ Xoá ô
                  </Button>
                  <Button
                    size="sm"
                    variant={curMap.curve !== false ? "default" : "secondary"}
                    onClick={() => patchMap((m) => touchMap({ ...m, curve: !(m.curve !== false) }))}
                    aria-label="Đổi nét nối cong/thẳng"
                    title="Bật/tắt đường nối uốn cong"
                  >
                    〰️ Nét cong
                  </Button>
                  {selNode && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto h-8 gap-1 text-xs"
                      onClick={deselectNode}
                      title="Bỏ chọn ô (Esc hoặc bấm ra vùng trống)"
                    >
                      ✕ Bỏ chọn
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-secondary/30 p-2">
                  <span className="text-xs text-muted-foreground">
                    Ô đang chọn:{" "}
                    <strong>
                      {selNode
                        ? curMap.nodes.find((n) => n.id === selNode)?.text || "(trống)"
                        : "chưa chọn"}
                    </strong>
                  </span>
                  <Input
                    value={
                      selNode
                        ? (drafts[selNode]?.q ??
                          curMap.nodes.find((n) => n.id === selNode)?.text ??
                          "")
                        : ""
                    }
                    onChange={(e) =>
                      selNode &&
                      setDrafts((m) => ({
                        ...m,
                        [selNode]: { q: e.target.value, a: m[selNode]?.a ?? "" },
                      }))
                    }
                    onBlur={() => {
                      if (selNode && drafts[selNode]) {
                        patchMap((m) => updateMindNode(m, selNode, { text: drafts[selNode]!.q }));
                        setDrafts((m) => {
                          const next = { ...m };
                          delete next[selNode];
                          return next;
                        });
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    disabled={!selNode}
                    placeholder="Nội dung ô đang chọn"
                    maxLength={MIND_TEXT_MAX}
                    aria-label="Nội dung ô"
                    className="h-9 w-56 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">Hình:</span>
                  {(
                    [
                      ["rect", "▭"],
                      ["ellipse", "◯"],
                      ["diamond", "◇"],
                    ] as const
                  ).map(([shape, icon]) => (
                    <button
                      key={shape}
                      type="button"
                      disabled={!selNode}
                      onClick={() =>
                        selNode && patchMap((m) => updateMindNode(m, selNode, { shape }))
                      }
                      className={`rounded px-2 py-1 text-sm ${
                        selNode && curMap.nodes.find((n) => n.id === selNode)?.shape === shape
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/60 hover:bg-secondary"
                      } disabled:opacity-40`}
                      aria-label={`Hình ${shape}`}
                    >
                      {icon}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground">Màu:</span>
                  {MIND_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!selNode}
                      onClick={() =>
                        selNode && patchMap((m) => updateMindNode(m, selNode, { color: c }))
                      }
                      className={`h-6 w-6 rounded-full border-2 ${
                        selNode && curMap.nodes.find((n) => n.id === selNode)?.color === c
                          ? "border-foreground"
                          : "border-transparent"
                      } disabled:opacity-40`}
                      style={{ background: c }}
                      aria-label={`Màu ${c}`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground">Cỡ ô:</span>
                  {(() => {
                    const sel = selNode ? curMap.nodes.find((n) => n.id === selNode) : null;
                    const size = sel ? nodeSize(sel) : { w: 170, h: 44 };
                    return (
                      <>
                        <input
                          type="range"
                          min={MIND_NODE_W_MIN}
                          max={MIND_NODE_W_MAX}
                          value={Math.min(
                            MIND_NODE_W_MAX,
                            Math.max(MIND_NODE_W_MIN, Math.round(size.w)),
                          )}
                          onChange={(e) =>
                            selNode &&
                            patchMap((m) =>
                              updateMindNode(m, selNode, { w: Number(e.target.value) }),
                            )
                          }
                          disabled={!selNode}
                          aria-label="Độ rộng ô"
                          className="w-20 accent-primary"
                        />
                        <input
                          type="range"
                          min={MIND_NODE_H_MIN}
                          max={MIND_NODE_H_MAX}
                          value={Math.min(
                            MIND_NODE_H_MAX,
                            Math.max(MIND_NODE_H_MIN, Math.round(size.h)),
                          )}
                          onChange={(e) =>
                            selNode &&
                            patchMap((m) =>
                              updateMindNode(m, selNode, { h: Number(e.target.value) }),
                            )
                          }
                          disabled={!selNode}
                          aria-label="Chiều cao ô"
                          className="w-20 accent-primary"
                        />
                        <button
                          type="button"
                          disabled={!selNode}
                          onClick={() => selNode && patchMap((m) => resetMindNodeSize(m, selNode))}
                          className="rounded px-2 py-1 text-xs bg-secondary/60 hover:bg-secondary disabled:opacity-40"
                          aria-label="Về cỡ tự động"
                          title="Về cỡ tự động theo chữ"
                        >
                          ↺ auto
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div
                ref={scrollBoxRef}
                className="overflow-auto rounded-xl border border-border/60 bg-background/40"
                style={{ maxHeight: 560 }}
                onPointerDown={(e) => {
                  if (e.target === e.currentTarget) deselectNode();
                }}
              >
                <div
                  className="relative cursor-default"
                  style={{ width: mindSize.w, height: mindSize.h }}
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) deselectNode();
                  }}
                >
                  <svg
                    className="absolute inset-0"
                    width={mindSize.w}
                    height={mindSize.h}
                    onPointerDown={(e) => {
                      if (e.target === e.currentTarget) deselectNode();
                    }}
                  >
                    {curMap.nodes.map((n) => {
                      if (!n.parentId) return null;
                      const par = curMap.nodes.find((x) => x.id === n.parentId);
                      if (!par) return null;
                      const a = nodePos(par);
                      const b = nodePos(n);
                      const sa = nodeSize(par);
                      const sb = nodeSize(n);
                      const ends = connectorEnds(
                        a.x,
                        a.y,
                        sa.w,
                        sa.h,
                        par.shape,
                        b.x,
                        b.y,
                        sb.w,
                        sb.h,
                        n.shape,
                      );
                      return (
                        <path
                          key={n.id}
                          d={connectorPath(
                            ends.x1,
                            ends.y1,
                            ends.x2,
                            ends.y2,
                            curMap.curve !== false,
                          )}
                          stroke={n.color}
                          strokeWidth={2}
                          fill="none"
                        />
                      );
                    })}
                  </svg>
                  {curMap.nodes.map((n) => {
                    const pos = nodePos(n);
                    const isSel = selNode === n.id;
                    const fixedW = resz && resz.id === n.id ? resz.w : n.w;
                    const fixedH = resz && resz.id === n.id ? resz.h : n.h;
                    const pad =
                      fixedW && fixedH
                        ? "p-0"
                        : n.shape === "diamond"
                          ? "px-7 py-3"
                          : n.shape === "ellipse"
                            ? "px-5 py-2"
                            : "px-3 py-1.5";
                    const roundedClass =
                      n.shape === "ellipse"
                        ? "rounded-full"
                        : n.shape === "diamond"
                          ? "rounded-sm"
                          : "rounded-xl";
                    return (
                      <button
                        key={n.id}
                        type="button"
                        ref={(el) => {
                          if (el) nodeEls.current.set(n.id, el);
                          else nodeEls.current.delete(n.id);
                        }}
                        onPointerDown={(e) => onNodePointerDown(e, n)}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 touch-none select-none overflow-hidden text-xs font-medium leading-snug text-foreground ${roundedClass} ${pad} ${
                          isSel ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                        } ${fixedW ? "" : "max-w-[170px]"} ${
                          fixedW && fixedH ? "flex items-center justify-center" : ""
                        }`}
                        style={{
                          left: pos.x,
                          top: pos.y,
                          width: fixedW,
                          height: fixedH,
                        }}
                      >
                        <svg
                          className="absolute inset-0 h-full w-full overflow-visible"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          {n.shape === "ellipse" ? (
                            <ellipse
                              cx="50"
                              cy="50"
                              rx="48.5"
                              ry="48.5"
                              fill={`${n.color}2e`}
                              stroke={n.color}
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          ) : n.shape === "diamond" ? (
                            <polygon
                              points="50,2 98,50 50,98 2,50"
                              fill={`${n.color}2e`}
                              stroke={n.color}
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          ) : (
                            <path
                              d="M10,1 H90 Q99,1 99,10 V90 Q99,99 90,99 H10 Q1,99 1,90 V10 Q1,1 10,1 Z"
                              fill={`${n.color}2e`}
                              stroke={n.color}
                              strokeWidth="2"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                        </svg>
                        <span className="relative">{n.text || "…"}</span>
                        <span
                          onPointerDown={(e) => onResizeStart(e, n)}
                          className={`absolute bottom-0 right-0 h-3 w-3 rounded-tl-md bg-primary/90 ${
                            isSel ? "block" : "hidden"
                          }`}
                          style={{ cursor: "nwse-resize" }}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Kéo ô để sắp xếp · bấm ô để chỉnh (giữ nguyên ô cha để bấm ➕ thêm nhiều nhánh liên
                tiếp) · bấm vùng trống hoặc phím Esc để bỏ chọn · kéo góc phải-dưới để chỉnh cỡ · 〰️
                đổi nét cong/thẳng.
              </p>
            </>
          )}
        </>
      )}

      {library && view === "history" && (
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

      {/* Hộp thoại thêm/đổi tên/xoá (thay window.prompt/confirm bị chặn trong iframe) */}
      {ask && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAsk(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-primary/30 bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-medium">{ask.title}</p>
            {ask.kind === "name" && (
              <input
                autoFocus
                maxLength={60}
                className="mb-3 w-full rounded-lg border border-primary/30 bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary"
                value={ask.value}
                onChange={(e) => setAsk({ ...ask, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && ask.value.trim()) {
                    const v = ask.value.trim();
                    setAsk(null);
                    ask.onOk(v);
                  }
                  if (e.key === "Escape") setAsk(null);
                }}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setAsk(null)}>
                Huỷ
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (ask.kind === "name") {
                    const v = ask.value.trim();
                    if (!v) return;
                    setAsk(null);
                    ask.onOk(v);
                  } else {
                    setAsk(null);
                    ask.onOk();
                  }
                }}
              >
                {ask.kind === "name" ? "Lưu" : "Xoá"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
