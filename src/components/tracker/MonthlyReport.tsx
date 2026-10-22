import { useMemo, useRef, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { monthSummary, type MonthSummary } from "@/lib/tracker/monthlyReport";
import { Button } from "@/components/ui/button";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 0..4 intensity bucket used by both the HTML heatmap and the PNG. */
function intensity(focusMin: number): 0 | 1 | 2 | 3 | 4 {
  if (focusMin <= 0) return 0;
  if (focusMin <= 25) return 1;
  if (focusMin <= 50) return 2;
  if (focusMin <= 100) return 3;
  return 4;
}

const HEAT = ["bg-muted", "bg-primary/15", "bg-primary/35", "bg-primary/60", "bg-primary"];

function Heatmap({ s }: { s: MonthSummary }) {
  // Weeks as rows, columns = Chủ Nhật..Thứ Bảy (DAY_LABELS order), like Date.getDay().
  const cells: (MonthSummary["days"][number] | null)[] = [];
  const first = new Date(s.year, s.month - 1, 1);
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  cells.push(...s.days);
  while (cells.length % 7 !== 0) cells.push(null);
  const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" aria-hidden>
        {cells.map((c, i) => (
          <div
            key={i}
            title={c ? `${c.date}: ${c.focusMin} phút tập trung` : undefined}
            className={`aspect-square rounded-sm ${c ? HEAT[intensity(c.focusMin)] : "bg-transparent"}`}
          />
        ))}
      </div>
    </div>
  );
}

const COLORS = {
  bg: "#12141d",
  panel: "#1a1d29",
  line: "#2a2e3f",
  text: "#e6e8f0",
  dim: "#8b90a5",
  accent: "#7dd3fc",
  heat: ["#252838", "#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd"],
};

function drawReport(canvas: HTMLCanvasElement, s: MonthSummary, generatedAt: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 1000;
  const H = 640;
  canvas.width = W;
  canvas.height = H;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COLORS.text;
  ctx.font = "600 14px sans-serif";
  ctx.fillText("TASK TRACKER PRO", 40, 48);
  ctx.font = "700 34px sans-serif";
  ctx.fillText(`Báo cáo ${s.label}`, 40, 92);
  ctx.fillStyle = COLORS.dim;
  ctx.font = "13px sans-serif";
  ctx.fillText(
    `Lv.${s.level} · ${s.petLabel} · Chuỗi hiện tại ${s.streakNow} ngày (kỷ lục ${s.streakBest})`,
    40,
    118,
  );

  const stats: [string, string][] = [
    ["Nhiệm vụ hoàn thành", String(s.tasksCompleted)],
    ["Phút tập trung", String(s.totals.focusMin)],
    ["Phiên tập trung", String(s.totals.pomodoros)],
    ["Cốc nước", String(s.totals.water)],
    ["Ngày hoạt động", `${s.activeDays}/${s.days.length}`],
    ["Ngày tốt nhất", s.bestDay ? `${s.bestDay.date.slice(8)} (${s.bestDay.focusMin}p)` : "—"],
  ];
  const bw = (W - 80 - 5 * 12) / 6;
  stats.forEach(([label, value], i) => {
    const x = 40 + i * (bw + 12);
    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(x, 145, bw, 78, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.dim;
    ctx.font = "11px sans-serif";
    ctx.fillText(label, x + 12, 170, bw - 24);
    ctx.fillStyle = COLORS.accent;
    ctx.font = "700 22px sans-serif";
    ctx.fillText(value, x + 12, 205, bw - 24);
  });

  // Heatmap grid: columns Chủ Nhật..Thứ Bảy.
  const gx = 40;
  const gy = 260;
  const cell = 56;
  const gap = 6;
  ctx.fillStyle = COLORS.dim;
  ctx.font = "11px sans-serif";
  ["CN", "T2", "T3", "T4", "T5", "T6", "T7"].forEach((l, i) =>
    ctx.fillText(l, gx + i * (cell + gap) + 20, gy - 8),
  );
  const first = new Date(s.year, s.month - 1, 1);
  const rows = Math.ceil((first.getDay() + s.days.length) / 7);
  s.days.forEach((d, i) => {
    const pos = first.getDay() + i;
    const col = pos % 7;
    const row = Math.floor(pos / 7);
    const x = gx + col * (cell + gap);
    const y = gy + row * (cell + gap);
    ctx.fillStyle = COLORS.heat[intensity(d.focusMin)] ?? COLORS.line;
    ctx.beginPath();
    ctx.roundRect(x, y, cell, cell, 8);
    ctx.fill();
    ctx.fillStyle = COLORS.dim;
    ctx.font = "11px sans-serif";
    ctx.fillText(String(i + 1), x + 6, y + cell - 8);
    if (d.focusMin > 0) {
      ctx.fillStyle = COLORS.text;
      ctx.fillText(`${d.focusMin}p`, x + cell - 30, y + cell - 8);
    }
  });

  ctx.fillStyle = COLORS.dim;
  ctx.font = "12px sans-serif";
  ctx.fillText(
    `Tạo lúc ${generatedAt} · file chỉ để xem/chia sẻ, không phải bản sao lưu dữ liệu`,
    40,
    gy + rows * (cell + gap) + 36,
  );
}

export function MonthlyReportCard() {
  const { data } = useTracker();
  const now = new Date();
  const [offset, setOffset] = useState(0);
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const [year, month] = useMemo(() => {
    const d = new Date(baseYear, baseMonth - offset, 1);
    return [d.getFullYear(), d.getMonth() + 1] as const;
  }, [offset, baseYear, baseMonth]);
  const s = useMemo(() => monthSummary(data, year, month), [data, year, month]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const download = () => {
    const c = canvasRef.current ?? document.createElement("canvas");
    drawReport(c, s, new Date().toLocaleString("vi-VN"));
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bao-cao-${s.year}-${pad2(s.month)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📈 Báo cáo tháng</h2>
        <span className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Tháng trước"
          >
            ‹
          </Button>
          <span className="text-sm text-muted-foreground">{s.label}</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={offset <= 0}
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Tháng sau"
          >
            ›
          </Button>
        </span>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
        {[
          ["✅", `${s.tasksCompleted}`, "nhiệm vụ"],
          ["⏱️", `${s.totals.focusMin}p`, "tập trung"],
          ["🍅", `${s.totals.pomodoros}`, "pomodoro"],
          ["💧", `${s.totals.water}`, "cốc nước"],
          ["📅", `${s.activeDays}/${s.days.length}`, "ngày hoạt động"],
          ["🔥", s.bestDay ? `${s.bestDay.focusMin}p` : "—", "ngày tốt nhất"],
        ].map(([emoji, value, label]) => (
          <div key={label} className="rounded-xl border border-border p-2 text-center">
            <div aria-hidden>{emoji}</div>
            <div className="font-semibold">{value}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>
      <Heatmap s={s} />
      <canvas ref={canvasRef} className="hidden" aria-hidden />
      <Button className="mt-4 w-full" variant="outline" onClick={download}>
        ⬇️ Tải báo cáo tháng này (.png)
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Ảnh chỉ để xem/chia sẻ, không phải bản sao lưu dữ liệu.
      </p>
    </section>
  );
}
