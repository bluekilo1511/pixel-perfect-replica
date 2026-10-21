import { useEffect, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { isOriginOpen, setOriginOpen, subscribeOrigin } from "@/lib/tracker/hudBus";
import { Button } from "@/components/ui/button";

const TRIBUTE =
  "Dự án này được khởi đầu bởi Lizard, ban đầu chỉ với một tính năng Streak duy nhất. Cảm ơn vì đã đặt viên gạch đầu tiên.";

/** Secret memorial button at the bottom of the Settings tab. */
export function OriginButton() {
  return (
    <button
      type="button"
      onClick={() => setOriginOpen(true)}
      title="Một viên gạch đầu tiên…"
      aria-label="The Origin (Lizard's Core)"
      className="mx-auto mt-6 flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-3 py-1.5 text-[11px] text-muted-foreground opacity-30 transition hover:opacity-100"
    >
      <span aria-hidden className="text-sm">
        🦎◇
      </span>
      <span className="font-mono">The Origin (Lizard's Core)</span>
    </button>
  );
}

/** The retro full-screen memorial itself — pure props so it is easy to test. */
export function OriginScreen({ streak, onClose }: { streak: number; onClose: () => void }) {
  const [demo, setDemo] = useState(0); // old-style manual day ticks — simulated only, never saved
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="origin-screen fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 p-6 font-mono"
      role="dialog"
      aria-label="The Origin (Lizard's Core)"
    >
      <p className="text-xs tracking-[0.35em] opacity-80">LIZARD'S CORE · v0.0.1 · STREAK_ONLY</p>
      <div className="origin-box flex flex-col items-center gap-4 border border-dashed px-10 py-8 text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] opacity-70">chuỗi streak</p>
        <p className="origin-count text-7xl font-bold tabular-nums" data-testid="origin-streak">
          {streak}
        </p>
        <button
          type="button"
          className="origin-tick border px-4 py-1.5 text-xs uppercase tracking-widest transition"
          onClick={() => setDemo((n) => n + 1)}
        >
          + tích ngày{demo > 0 ? ` (+${demo})` : ""}
        </button>
        {demo > 0 && (
          <p className="max-w-[240px] text-[10px] leading-relaxed opacity-60">
            cũ kỹ thôi — con số này chỉ để nhớ lại thời đầu, không được lưu vào dữ liệu của bạn
          </p>
        )}
      </div>
      <p className="max-w-md text-center text-xs leading-relaxed opacity-80">{TRIBUTE}</p>
      <Button variant="outline" className="origin-return font-mono" onClick={onClose}>
        ⏫ Quay lại hiện tại
      </Button>
    </div>
  );
}

/** Mounted near the app root: reads the real AppData streak when opened. */
export function OriginOverlay() {
  const { data } = useTracker();
  const [open, setOpen] = useState(isOriginOpen);
  useEffect(() => subscribeOrigin(setOpen), []);
  useEffect(() => {
    if (!open) return;
    const prev = document.title;
    document.title = "The Origin — Lizard's Core 🦎";
    return () => {
      if (!isOriginOpen()) document.title = prev;
    };
  }, [open]);
  if (!open) return null;
  return <OriginScreen streak={data.streak.count} onClose={() => setOriginOpen(false)} />;
}
