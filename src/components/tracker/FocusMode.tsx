import { useEffect } from "react";
import { MOOD_META, moodOf, ACCESSORIES, SPECIES, type PetState } from "@/lib/tracker/gamify";
import { Button } from "@/components/ui/button";
import { AmbientControl } from "./AmbientControl";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

interface FocusModeProps {
  open: boolean;
  left: number;
  running: boolean;
  pet: PetState;
  bossActive: boolean;
  bossHpPct: number;
  onClose: () => void;
}

/** Fullscreen zen overlay: one big timer, the pet, ambient sound — everything else hidden. */
export function FocusMode({
  open,
  left,
  running,
  pet,
  bossActive,
  bossHpPct,
  onClose,
}: FocusModeProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const mood = moodOf(pet);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6 backdrop-blur-sm"
      role="dialog"
      aria-label="Chế độ tập trung"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Chế độ tập trung
        </span>
        <span
          className={`relative text-8xl leading-none ${running ? "animate-pet-idle" : "animate-pet-dance"}`}
        >
          {SPECIES[pet.species].emoji}
          {pet.accessory && (
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-5xl">
              {ACCESSORIES[pet.accessory].emoji}
            </span>
          )}
        </span>
        <span className="text-sm text-muted-foreground">
          {MOOD_META[mood].face} {SPECIES[pet.species].name} đang canh chừng để bạn không xao nhãng…
        </span>
        <p className="font-display text-8xl tabular-nums sm:text-9xl">{fmt(left)}</p>
        {bossActive && running && (
          <p className="font-mono text-xs uppercase tracking-wider text-destructive">
            ⚔️ Quái Vật Xao Nhãng · HP {bossHpPct}%
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <AmbientControl />
          <Button variant="outline" onClick={onClose}>
            Thu nhỏ (Esc)
          </Button>
        </div>
      </div>
    </div>
  );
}
