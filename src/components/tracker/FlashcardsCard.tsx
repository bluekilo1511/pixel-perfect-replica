import { useMemo, useState } from "react";
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

/** Spaced-repetition study deck: add Q&A cards per subject, review what's due today. */
export function FlashcardsCard() {
  const { data, update } = useTracker();
  const today = dateStr();
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  // Review session = queue of card ids, current index, revealed flag.
  const [queue, setQueue] = useState<string[] | null>(null);
  const [qi, setQi] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [session, setSession] = useState({ good: 0, again: 0, done: 0 });

  const cards = data.flashcards;
  const stats = useMemo(() => {
    const due = dueCards(cards, today).length;
    return { total: cards.length, due, upcoming: cards.length - due };
  }, [cards, today]);
  const decks = useMemo(() => dueBySubject(cards, today), [cards, today]);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const startReview = (filterSubject?: string) => {
    let ids = dueCards(cards, today).map((c) => c.id);
    if (filterSubject) {
      ids = ids.filter((id) => byId.get(id)?.subject === filterSubject);
    }
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
      const good = session.good + (rating > 0 ? 1 : 0);
      const again = session.again + (rating === 0 ? 1 : 0);
      toast.success(`🃏 Xong lượt ôn! ${good} nhớ, ${again} cần ôn lại`);
      setQueue(null);
      setRevealed(false);
    }
  };

  const add = () => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Nhờ viết cả câu hỏi và câu đáp nhé!");
      return;
    }
    if (cards.length >= FLASHCARDS_MAX) {
      toast.error(`Tối đa ${FLASHCARDS_MAX} thẻ — xoá bớt thẻ cũ nhé!`);
      return;
    }
    const card = newFlashcard(subject || "", question, answer, today);
    update((d) => ({ ...d, flashcards: [...d.flashcards, card] }));
    setQuestion("");
    setAnswer("");
    toast.success("🃏 Đã thêm thẻ — sẽ nhắc ôn đúng lúc!");
  };

  const remove = (id: string) => {
    update((d) => ({ ...d, flashcards: d.flashcards.filter((c) => c.id !== id) }));
    toast("🗑️ Đã xoá thẻ");
  };

  const current: Flashcard | null = queue ? (byId.get(queue[qi]!) ?? null) : null;

  return (
    <section className="glass p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🃏 Thẻ ghi nhớ</h2>
        <span className="text-xs text-muted-foreground">
          {stats.total} thẻ · {stats.due} đến hạn hôm nay
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Nhập câu hỏi–đáp cho môn học, app tự lên lịch ôn lặp: nhớ thì giãn dần, quên thì quay lại
        ngay.
      </p>

      {queue && current ? (
        <div className="rounded-xl border border-primary/25 bg-secondary/40 p-4">
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
            onClick={() => {
              setQueue(null);
              setRevealed(false);
            }}
          >
            Dừng lượt ôn này
          </button>
        </div>
      ) : (
        <>
          {stats.due > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => startReview()}>
                🔁 Ôn ngay ({stats.due})
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
          )}

          <div className="mb-4 grid gap-2 rounded-xl border border-primary/20 bg-secondary/30 p-3 sm:grid-cols-[130px_1fr]">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Môn (tùy chọn)"
              maxLength={24}
              list="flashcard-subjects"
              aria-label="Môn học của thẻ"
              className="h-9 text-sm"
            />
            <datalist id="flashcard-subjects">
              {data.subjects.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Câu hỏi — vd: Vì sao NaOH phân hủy nhiệt?"
              maxLength={QUESTION_MAX}
              aria-label="Câu hỏi"
              className="h-9 text-sm"
            />
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Câu đáp — có thể ngắn, có thể công thức"
              maxLength={ANSWER_MAX}
              aria-label="Câu đáp"
              className="min-h-[56px] text-sm sm:col-span-2"
            />
            <Button size="sm" className="sm:col-span-2" onClick={add}>
              ➕ Thêm thẻ
            </Button>
          </div>

          {decks.length > 0 && (
            <ul className="space-y-1.5">
              {decks.map((d) => (
                <li
                  key={d.subject}
                  className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-sm"
                >
                  <span className="flex-1 truncate">{d.subject}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.due > 0 ? `⏰ ${d.due} đến hạn` : "💤 không có đến hạn"} · {d.total} thẻ
                  </span>
                  {d.due > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => startReview(d.subject)}
                    >
                      🔁
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-destructive"
                    aria-label={`Xoá bộ ${d.subject}`}
                    title="Xoá toàn bộ thẻ của môn này"
                    onClick={() => {
                      update((data2) => ({
                        ...data2,
                        flashcards: data2.flashcards.filter(
                          (c) => (c.subject || "Chung") !== d.subject,
                        ),
                      }));
                      toast("🗑️ Đã xoá bộ thẻ của môn này");
                    }}
                  >
                    🗑️
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {!cards.length && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Chưa có thẻ nào — thêm thẻ đầu tiên cho môn đang học nhé!
            </p>
          )}
        </>
      )}
    </section>
  );
}
