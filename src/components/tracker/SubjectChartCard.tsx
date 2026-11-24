import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import {
  enrichedSubjectChartRows,
  SUBJECT_COLORS,
  type SubjectChartMode,
} from "@/lib/tracker/subjectStats";
import { mondayOf } from "@/lib/tracker/weeklyReport";
import { Button } from "@/components/ui/button";

/** Per-subject focus bar chart for the Statistics tab.
 * Supports viewing both individual subjects and combo aggregation (KHTN = Lý + Hóa + Sinh, LS&ĐL = Sử + Địa). */
export function SubjectChartCard() {
  const { data } = useTracker();
  const [range, setRange] = useState<"week" | "all">("week");
  const [mode, setMode] = useState<SubjectChartMode>("all");

  const rows = enrichedSubjectChartRows(data, range, mondayOf, mode);

  return (
    <section className="glass p-5 space-y-4" aria-label="Biểu đồ theo môn">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span>📚</span> Ôn bài theo môn
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Thống kê thời gian tập trung theo từng môn lẻ và môn tổ hợp.
          </p>
        </div>

        {/* Range filter buttons */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/60">
          <Button
            size="sm"
            variant={range === "week" ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => setRange("week")}
          >
            Tuần này
          </Button>
          <Button
            size="sm"
            variant={range === "all" ? "secondary" : "ghost"}
            className="h-7 px-2.5 text-xs font-medium"
            onClick={() => setRange("all")}
          >
            Tất cả
          </Button>
        </div>
      </div>

      {/* View Mode switcher: Tất cả / Môn tổ hợp / Chi tiết môn lẻ */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1">Chế độ xem:</span>
        <button
          type="button"
          onClick={() => setMode("all")}
          className={`px-2.5 py-1 rounded-md transition text-xs font-medium border ${
            mode === "all"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-secondary/60 text-secondary-foreground hover:bg-secondary border-border/60"
          }`}
        >
          🌟 Tất cả (Lẻ & Tổ hợp)
        </button>
        <button
          type="button"
          onClick={() => setMode("combos")}
          className={`px-2.5 py-1 rounded-md transition text-xs font-medium border ${
            mode === "combos"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-secondary/60 text-secondary-foreground hover:bg-secondary border-border/60"
          }`}
        >
          🧬 Gộp tổ hợp Cấp 2
        </button>
        <button
          type="button"
          onClick={() => setMode("standalone")}
          className={`px-2.5 py-1 rounded-md transition text-xs font-medium border ${
            mode === "standalone"
              ? "bg-primary text-primary-foreground border-primary shadow-xs"
              : "bg-secondary/60 text-secondary-foreground hover:bg-secondary border-border/60"
          }`}
        >
          📚 Chi tiết môn lẻ
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground space-y-1">
          <p className="text-sm font-medium">Chưa có phiên học nào được ghi nhận.</p>
          <p className="text-xs">
            Hãy gắn môn (Lí, Hóa, Sinh, Sử, Địa, Toán...) ở tab Hôm nay rồi bấm timer nhé!
          </p>
        </div>
      ) : (
        <ul className="space-y-3 pt-1">
          {rows.map((r, i) => {
            const isCombo = r.isCombo;
            const isSub = r.isSubdiscipline;
            const color = SUBJECT_COLORS[i % SUBJECT_COLORS.length];

            return (
              <li
                key={`${r.label}-${r.isCombo ? "combo" : "sub"}`}
                className={`rounded-xl transition p-2.5 space-y-1.5 border ${
                  isCombo
                    ? "border-primary/40 bg-primary/5 shadow-2xs"
                    : isSub
                      ? "border-border/60 bg-muted/30 ml-2"
                      : "border-border/60 bg-card/60"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isCombo ? (
                      <span className="text-sm">🧬</span>
                    ) : isSub ? (
                      <span className="text-muted-foreground text-xs font-mono">↳</span>
                    ) : (
                      <span className="text-sm">📘</span>
                    )}

                    <span className="font-semibold text-foreground truncate">
                      {r.label}
                    </span>

                    {isCombo && (
                      <span className="rounded-full bg-primary/15 text-primary border border-primary/30 px-2 py-0.2 text-[10px] font-bold">
                        Môn tổ hợp
                      </span>
                    )}

                    {isSub && r.parentCombo && (
                      <span className="rounded-md bg-secondary text-secondary-foreground px-1.5 py-0.2 text-[10px] text-muted-foreground font-medium">
                        Phân môn {r.parentCombo}
                      </span>
                    )}
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <span className="font-bold tabular-nums text-foreground">{r.minutes}</span>
                    <span className="text-muted-foreground text-[11px] ml-1">phút</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted/80">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${r.pct}%`,
                      backgroundColor: isCombo ? "#6366f1" : color,
                    }}
                  />
                </div>

                {/* Breakdown details for combo subjects */}
                {isCombo && r.subBreakdown && r.subBreakdown.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">Thành phần:</span>
                    {r.subBreakdown.map((item) => (
                      <span
                        key={item.label}
                        className="rounded-md bg-background/80 border border-border/60 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                      >
                        {item.label}: <strong>{item.minutes}p</strong> ({item.pctOfCombo}%)
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2">
        <span>💡</span>
        <span>
          Môn tổ hợp (KHTN, LS&ĐL) tự động bằng tổng thời gian của các phân môn lẻ bạn đã ôn bài. Bạn có thể học riêng từng môn lẻ, app sẽ tự động tổng hợp!
        </span>
      </div>
    </section>
  );
}
