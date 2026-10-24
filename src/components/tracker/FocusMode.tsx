import { useEffect } from "react";
import {
  ACCESSORIES,
  ACCESSORY_UI,
  MOOD_META,
  moodOf,
  SPECIES,
  type PetState,
} from "@/lib/tracker/gamify";
import { petEmoji } from "@/lib/tracker/extras";
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
  strikes?: number;
  onBreak?: boolean;
  breakLeft?: number;
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
  strikes = 0,
  onBreak = false,
  breakLeft = 0,
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
          className={`relative block text-8xl leading-none ${running ? "animate-pet-idle" : "animate-pet-dance"}`}
        >
          {pet.accessories.back && (
            <span className={`absolute ${ACCESSORY_UI.back[pet.species]}`} aria-hidden>
              {ACCESSORIES[pet.accessories.back].emoji}
            </span>
          )}
          <span className="relative">{petEmoji(pet)}</span>
          {(["head", "face"] as const).map((slot) =>
            pet.accessories[slot] ? (
              <span key={slot} className={`absolute ${ACCESSORY_UI[slot][pet.species]}`}>
                {ACCESSORIES[pet.accessories[slot]!].emoji}
              </span>
            ) : null,
          )}
        </span>
        <span className="text-sm text-muted-foreground">
          {MOOD_META[mood].face} {SPECIES[pet.species].name} đang canh chừng để bạn không xao nhãng…
        </span>
        <p className="font-display text-8xl tabular-nums sm:text-9xl">
          {fmt(onBreak ? breakLeft : left)}
        </p>
        {onBreak ? (
          <p className="font-mono text-xs uppercase tracking-wider text-hunger">
            ☕ Giờ nghỉ giải lao — nghỉ ngơi đi, sắp nhắc quay lại rồi!
          </p>
        ) : (
          <>
            {strikes > 0 && (
              <p className="font-mono text-xs uppercase tracking-wider text-destructive">
                🚨 Phá đò {strikes}/3 — đừng rời tab nhé!
              </p>
            )}
            {bossActive && running && (
              <p className="font-mono text-xs uppercase tracking-wider text-destructive">
                ⚔️ Quái Vật Xao Nhãng · HP {bossHpPct}%
              </p>
            )}
          </>
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
