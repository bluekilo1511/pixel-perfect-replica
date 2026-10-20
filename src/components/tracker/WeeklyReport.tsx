import { useTracker } from "@/lib/tracker/store";
import { weekSummary } from "@/lib/tracker/weeklyReport";

const fmtMin = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}p` : ""}` : `${m}p`;

export function WeeklyReportCard() {
  const { data } = useTracker();
  const s = weekSummary(data);
  const up = s.diffMin > 0;
  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📊 Tổng kết tuần</h2>
        <span className="text-sm text-muted-foreground">{s.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-border bg-muted p-3">
          <p className="font-display text-2xl">{fmtMin(s.thisWeek.focusMin)}</p>
          <p className="text-xs text-muted-foreground">phút tập trung</p>
        </div>
        <div className="rounded-xl border border-border bg-muted p-3">
          <p className="font-display text-2xl">{s.thisWeek.tasks}</p>
          <p className="text-xs text-muted-foreground">việc hoàn thành</p>
        </div>
        <div className="rounded-xl border border-border bg-muted p-3">
          <p className="font-display text-2xl">{s.thisWeek.activeDays}/7</p>
          <p className="text-xs text-muted-foreground">ngày hoạt động</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span
          className={
            s.diffMin === 0 ? "text-muted-foreground" : up ? "text-success" : "text-destructive"
          }
        >
          {s.diffMin === 0
            ? "➖ Ngang tuần trước"
            : `${up ? "📈" : "📉"} ${up ? "+" : "−"}${fmtMin(Math.abs(s.diffMin))} so với tuần trước`}
        </span>
        {s.bestDay && (
          <span className="text-muted-foreground">
            🔥 Ngày tốt nhất: {s.bestDay.date.slice(5)} ({fmtMin(s.bestDay.focusMin)})
          </span>
        )}
      </div>
      {s.topSubjects.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          📚 Tập trung nhiều nhất:{" "}
          {s.topSubjects.map((x) => `${x.label} (${fmtMin(x.minutes)})`).join(" · ")}
        </p>
      )}
    </section>
  );
}
