import { useEffect, useMemo, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { morningBriefing } from "@/lib/tracker/briefing";
import { dueCountAll } from "@/lib/tracker/studyStore";
import { dateStr } from "@/lib/tracker/model";

/** 🌅 Bản tin buổi sáng — một card duy nhất gói mọi thứ đáng biết hôm nay. */
export function MorningBriefingCard() {
  const { data } = useTracker();
  // Flashcards live in IndexedDB now, so the due count arrives async.
  const [dueCount, setDueCount] = useState(0);
  useEffect(() => {
    let alive = true;
    dueCountAll(dateStr())
      .then((n) => {
        if (alive) setDueCount(n);
      })
      .catch(() => {
        if (alive) setDueCount(0);
      });
    return () => {
      alive = false;
    };
  }, []);
  const items = useMemo(() => {
    const now = new Date();
    if (now.getHours() >= 12) return null; // chỉ là "bản tin buổi sáng"
    return morningBriefing(data, now, { dueFlashcards: dueCount });
  }, [data, dueCount]);
  if (!items) return null;
  return (
    <section className="glass p-5" aria-label="Bản tin buổi sáng">
      <h2 className="mb-3 font-display text-lg font-semibold">🌅 Bản tin buổi sáng</h2>
      <ul className="space-y-1.5 text-sm">
        {items.map((it) => (
          <li key={it.text} className="flex items-start gap-2">
            <span aria-hidden>{it.emoji}</span>
            <span className="min-w-0 flex-1">{it.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
