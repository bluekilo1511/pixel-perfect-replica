import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import { activeDaysOf, HEAT_WEEKS, heatmapWeeks, type HeatCell } from "@/lib/tracker/heatmap";

const LEVEL_CLS: Record<HeatCell["level"], string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/45",
  3: "bg-primary/70",
  4: "bg-primary",
};

/** GitHub-style focus heatmap: one square per day, 20 weeks, darker = more focus minutes. */
export function HeatmapCard() {
  const { data } = useTracker();
  const weeks = heatmapWeeks(data.dailyStats, dateStr());
  const activeDays = activeDaysOf(weeks);

  return (
    <section className="glass p-5" aria-label="Heatmap học tập">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🗓️ Heatmap {HEAT_WEEKS} tuần</h2>
        <span className="text-sm text-muted-foreground">{activeDays} ngày có học</span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Ô càng đậm = ngày đó tập trung càng nhiều. Nhìn phát biết tuần nào lười 👀
      </p>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-1" role="img" aria-label="Lưới heatmap 20 tuần">
          {weeks.map((w) => (
            <div key={w.start} className="grid grid-rows-7 gap-1">
              {w.cells.map((c) => (
                <div
                  key={c.date}
                  title={
                    c.future ? c.date : `${c.date}: ${c.focusMin}p tập trung · ${c.tasks} việc`
                  }
                  className={`h-3.5 w-3.5 rounded-[3px] transition ${c.future ? "bg-muted/40" : LEVEL_CLS[c.level]} ${c.focusMin > 0 ? "hover:ring-1 hover:ring-primary" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Ít
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span key={l} className={`h-3 w-3 rounded-[3px] ${LEVEL_CLS[l]}`} />
        ))}
        Nhiều
      </div>
    </section>
  );
}
