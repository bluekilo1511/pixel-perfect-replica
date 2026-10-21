import { useEffect, useState } from "react";

export type FlashbangKind = "breakin" | "done";

interface Flash {
  id: number;
  kind: FlashbangKind;
}

let seq = 0;
const listeners = new Set<(f: Flash) => void>();

/** Fire a full-screen flash notice (break-in alarm or finished Pomodoro). */
export function fireFlashbang(kind: FlashbangKind) {
  const f = { id: ++seq, kind };
  listeners.forEach((fn) => fn(f));
}

const META: Record<FlashbangKind, { icon: string; title: string; sub: string }> = {
  breakin: {
    icon: "🚨",
    title: "PHÁ ĐÒ!",
    sub: "Bạn vừa rời tab giữa phiên tập trung",
  },
  done: {
    icon: "🍅",
    title: "HẾT PHIÊN!",
    sub: "Pomodoro hoàn tất — thời gian nghỉ đây!",
  },
};

/** Renders the pop-up; mount once near the app root. */
export function Flashbang() {
  const [flash, setFlash] = useState<Flash | null>(null);
  useEffect(() => {
    const fn = (f: Flash) => setFlash(f);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(t);
  }, [flash]);
  if (!flash) return null;
  const meta = META[flash.kind];
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div
      key={flash.id}
      className="pointer-events-none fixed inset-0 z-[90] grid place-items-center"
      role="alert"
      aria-live="assertive"
    >
      {!reduced && <div className="flashbang-flash absolute inset-0" />}
      <div className={`flashbang-text text-center ${reduced ? "flashbang-text--calm" : ""}`}>
        <div className="text-6xl">{meta.icon}</div>
        <p className="font-display text-4xl font-black tracking-widest sm:text-5xl">{meta.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{meta.sub}</p>
      </div>
    </div>
  );
}
