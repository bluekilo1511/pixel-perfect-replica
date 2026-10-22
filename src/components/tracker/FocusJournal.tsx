import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import { goldenHours, sessionsOn } from "@/lib/tracker/sessions";

const MOOD_FACES: Record<number, string> = { 1: "😄", 2: "🙂", 3: "😐", 4: "😪" };

/** Focus-session journal: today's logged sessions plus the golden-hours chart. */
export function FocusJournalCard() {
  const { data } = useTracker();
  const now = new Date();
  const sessions = sessionsOn(data.sessionLog, dateStr(now));
  const g = goldenHours(data.sessionLog, now);
  const peak = Math.max(1, ...g.buckets);
  const bestPct = g.best !== null ? Math.round((g.buckets[g.best]! / g.total) * 100) : 0;

  return (
    <section className="glass p-5">
      <h2 className="mb-1 text-lg font-semibold">📒 Sổ tay phiên</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {g.total > 0
          ? `⭐ Giờ vàng: ${g.best}:00 — ${bestPct}% thời lượng focus 14 ngày qua rơi vào khung này`
          : "Chưa có dữ liệu — hoàn thành phiên học để soi ra giờ vàng của bạn."}
      </p>
      {g.total > 0 && (
        <div className="mb-4 flex h-16 items-end gap-[3px]" aria-label="Focus theo giờ trong ngày">
          {g.buckets.map((v, h) => (
            <div
              key={h}
              className="flex flex-1 flex-col items-center"
              title={`${h}:00 — ${v} phút`}
            >
              <div
                className={`w-full rounded-t ${h === g.best ? "bg-xp" : v > 0 ? "bg-muted-foreground/40" : "bg-muted"}`}
                style={{ height: `${v > 0 ? Math.max(8, (v / peak) * 56) : 3}px` }}
              />
            </div>
          ))}
        </div>
      )}
      <ul className="space-y-1.5">
        {sessions
          .slice()
          .reverse()
          .map((s, i) => (
            <li
              key={`${s.at}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-secondary/60 px-2.5 py-1.5 text-sm"
            >
              <span>{s.kind === "warmup" ? "🚀" : "🍅"}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {new Date(s.at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex-1">
                {s.kind === "warmup" ? "Khởi động chống trì hoãn" : "Phiên tập trung"}
              </span>
              <span className="text-xs text-muted-foreground">{s.minutes}p</span>
              {s.mood ? <span>{MOOD_FACES[s.mood]}</span> : null}
            </li>
          ))}
        {!sessions.length && (
          <li className="py-3 text-center text-sm text-muted-foreground">
            Hôm nay chưa ghi phiên nào.
          </li>
        )}
      </ul>
    </section>
  );
}
