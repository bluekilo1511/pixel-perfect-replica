import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { subjectChartRows, SUBJECT_COLORS } from "@/lib/tracker/subjectStats";
import { mondayOf } from "@/lib/tracker/weeklyReport";
import { Button } from "@/components/ui/button";

/** Per-subject focus bar chart for the Statistics tab. */
export function SubjectChartCard() {
  const { data } = useTracker();
  const [range, setRange] = useState<"week" | "all">("week");
  const rows = subjectChartRows(data, range, mondayOf);
  return (
    <section className="glass p-5" aria-label="Biểu đồ theo môn">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📚 Ôn bài theo môn</h2>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={range === "week" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setRange("week")}
          >
            Tuần này
          </Button>
          <Button
            size="sm"
            variant={range === "all" ? "secondary" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setRange("all")}
          >
            Tất cả
          </Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có dữ liệu. Gắn môn ở tab Hôm nay rồi làm vài phiên học nhé!
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.label} className="text-xs">
              <div className="mb-0.5 flex justify-between">
                <span className="font-medium">{r.label}</span>
                <span className="text-muted-foreground">{r.minutes} phút</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${r.pct}%`,
                    backgroundColor: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
