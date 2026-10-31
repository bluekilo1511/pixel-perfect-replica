import { useMemo } from "react";
import { useTracker } from "@/lib/tracker/store";
import { morningBriefing } from "@/lib/tracker/briefing";

/** 🌅 Bản tin buổi sáng — một card duy nhất gói mọi thứ đáng biết hôm nay. */
export function MorningBriefingCard() {
  const { data } = useTracker();
  const items = useMemo(() => {
    const now = new Date();
    if (now.getHours() >= 12) return null; // chỉ là "bản tin buổi sáng"
    return morningBriefing(data, now);
  }, [data]);
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
