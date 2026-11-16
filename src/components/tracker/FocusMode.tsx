import { useEffect, useState } from "react";
import {
  ACCESSORIES,
  ACCESSORY_UI,
  MOOD_META,
  moodOf,
  SPECIES,
  type PetState,
} from "@/lib/tracker/gamify";
import { PetAura } from "./PetAura";
import { accessoryClass, petEmoji } from "@/lib/tracker/extras";
import { Button } from "@/components/ui/button";
import { BreathWidget } from "@/components/tracker/BreathWidget";
import { AmbientControl } from "./AmbientControl";
import { X, Maximize2, Minimize2, Sparkles, Coffee, AlertTriangle, ShieldAlert } from "lucide-react";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

interface FocusModeProps {
  open: boolean;
  left: number;
  running: boolean;
  pet: PetState;
  bossActive: boolean;
  bossHpPct: number;
  strikes?: number;
  onBreak?: boolean;
  breakLeft?: number;
  onClose: () => void;
}

/** Fullscreen zen overlay: unified modern cosmic ambient aesthetic, breathing aura & companion pedestal. */
export function FocusMode({
  open,
  left,
  running,
  pet,
  bossActive,
  bossHpPct,
  strikes = 0,
  onBreak = false,
  breakLeft = 0,
  onClose,
}: FocusModeProps) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!open) return null;

  const mood = moodOf(pet);
  const displayTime = onBreak ? breakLeft : left;

  const toggleFs = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#050914] text-white select-none backdrop-blur-xl"
      role="dialog"
      aria-label="Chế độ tập trung Zen"
    >
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(56,92,204,0.18)_0%,rgba(15,23,42,0.85)_60%,#030712_100%)]"
      />

      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px] transition-all duration-1000 ${
          onBreak
            ? "h-[450px] w-[450px] bg-emerald-500/15"
            : running
              ? "h-[500px] w-[500px] bg-indigo-500/20"
              : "h-[350px] w-[350px] bg-slate-500/10"
        }`}
      />

      {/* Header bar */}
      <header className="relative z-20 flex w-full items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide backdrop-blur-md ${
              onBreak
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : running
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                onBreak
                  ? "bg-emerald-400"
                  : running
                    ? "bg-indigo-400 animate-pulse"
                    : "bg-amber-400"
              }`}
            />
            {onBreak ? "Nghỉ giải lao" : running ? "Zen Focus" : "Tạm dừng"}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <AmbientControl />
          <button
            type="button"
            onClick={toggleFs}
            aria-label={isFs ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Thu nhỏ"
            className="group flex h-9 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-destructive/20 hover:border-destructive/40 hover:text-destructive"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline font-mono opacity-60 group-hover:opacity-100">
              Esc
            </span>
          </button>
        </div>
      </header>

      {/* Centerpiece */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
        <div className="flex max-w-xl flex-col items-center">
          {/* Companion Pedestal */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <span
              className={`relative block text-7xl sm:text-8xl leading-none ${
                running ? "animate-pet-idle" : "animate-pet-dance"
              }`}
            >
              {pet.accessories.back === "wings" ? (
                <PetAura pet={pet} />
              ) : pet.accessories.back ? (
                <span className={`absolute ${ACCESSORY_UI.back[pet.species]}`} aria-hidden>
                  {ACCESSORIES[pet.accessories.back].emoji}
                </span>
              ) : null}
              <span className="relative">{petEmoji(pet)}</span>
              {(["head", "face"] as const).map((slot) =>
                pet.accessories[slot] ? (
                  <span key={slot} className={`absolute ${accessoryClass(slot, pet)}`}>
                    {ACCESSORIES[pet.accessories[slot]!].emoji}
                  </span>
                ) : null,
              )}
            </span>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70 backdrop-blur-md">
              {MOOD_META[mood].face} {SPECIES[pet.species].name} đang canh chừng để bạn không xao nhãng…
            </div>
          </div>

          {/* Huge Digits */}
          <p className="font-display text-8xl sm:text-9xl md:text-[10rem] font-black tracking-tight text-white drop-shadow-[0_4px_35px_rgba(0,0,0,0.6)] tabular-nums my-2">
            {fmt(displayTime)}
          </p>

          {/* Status Subtitle */}
          {onBreak ? (
            <div className="mt-4 flex flex-col items-center gap-3">
              <p className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-300">
                <Coffee className="h-4 w-4" /> Giờ nghỉ giải lao — thư giãn mắt và hít thở sâu
              </p>
              <div className="mt-2 scale-90">
                <BreathWidget />
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              {strikes > 0 && (
                <p className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/15 px-3 py-1 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" /> Phá đò {strikes}/3 — đừng rời tab nhé!
                </p>
              )}
              {bossActive && running && (
                <p className="flex items-center gap-1.5 rounded-full border border-purple-500/40 bg-purple-500/15 px-3 py-1 text-xs text-purple-300">
                  <ShieldAlert className="h-3.5 w-3.5" /> ⚔️ Quái Vật Xao Nhãng · HP {bossHpPct}%
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 flex w-full items-center justify-center p-6 sm:pb-8">
        <Button
          variant="outline"
          onClick={onClose}
          className="rounded-full border-white/15 bg-white/5 px-6 text-sm text-white/80 hover:bg-white/10 hover:text-white"
        >
          Thu nhỏ (Esc)
        </Button>
      </footer>
    </div>
  );
}
