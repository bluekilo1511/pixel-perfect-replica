import { useEffect, useRef, useState } from "react";

const PHASES = [
  { label: "Hít vào…", seconds: 4, scale: 1.35, hint: "Bơm bụng lên" },
  { label: "Giữ…", seconds: 7, scale: 1.35, hint: "Nín thở nhẹ nhàng" },
  { label: "Thở ra…", seconds: 8, scale: 1, hint: "Xả hết căng thẳng" },
] as const;
const CYCLE = PHASES.reduce((a, p) => a + p.seconds, 0); // 19s

/** 4-7-8 breathing coach for breaks: the orb swells on inhale, holds, then deflates. */
export function BreathWidget({ compact = false }: { compact?: boolean }) {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [tick, setTick] = useState(0);
  const [cycles, setCycles] = useState(0);
  const cycleBoundary = useRef(false);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const t = tick % CYCLE;
  let acc = 0;
  let idx = 0;
  for (let i = 0; i < PHASES.length; i++) {
    if (t < acc + PHASES[i]!.seconds) {
      idx = i;
      break;
    }
    acc += PHASES[i]!.seconds;
  }
  const phase = PHASES[idx]!;
  const left = acc + phase.seconds - t;
  useEffect(() => {
    if (t === 0 && tick > 0 && !cycleBoundary.current) {
      cycleBoundary.current = true;
      setCycles((c) => c + 1);
    }
    if (t !== 0) cycleBoundary.current = false;
  }, [t, tick]);

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-primary/20 bg-secondary/50 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
      aria-label="Bài thở 4-7-8"
    >
      <div
        className="relative shrink-0"
        style={{ width: compact ? 44 : 64, height: compact ? 44 : 64 }}
      >
        <div
          className={`absolute inset-0 rounded-full bg-gradient-to-br from-sky-400/50 to-indigo-500/60 ${
            reduced ? "" : "transition-transform ease-in-out"
          }`}
          style={{
            transform: `scale(${reduced ? 1.1 : phase.scale})`,
            transitionDuration: `${phase.seconds}s`,
          }}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center font-display tabular-nums text-primary-foreground ${
            compact ? "text-xs" : "text-lg"
          }`}
        >
          {left}
        </div>
      </div>
      <div className="min-w-0">
        <p className={`font-medium leading-tight ${compact ? "text-xs" : "text-sm"}`}>
          {phase.label}
        </p>
        <p className={`text-muted-foreground leading-tight ${compact ? "text-[10px]" : "text-xs"}`}>
          {phase.hint} · {cycles > 0 ? `${cycles} nhịp 🌬️` : "4-7-8"}
        </p>
      </div>
    </div>
  );
}
