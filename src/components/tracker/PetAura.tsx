import { AURAS, moodOf, type AuraId, type PetState } from "@/lib/tracker/gamify";

/** Fixed star positions (deterministic — no flicker between renders). */
const STARS = [
  { top: "6%", left: "18%", size: "text-xs", delay: "0s" },
  { top: "14%", left: "80%", size: "text-[10px]", delay: "0.9s" },
  { top: "42%", left: "3%", size: "text-[10px]", delay: "1.6s" },
  { top: "58%", left: "92%", size: "text-xs", delay: "0.5s" },
  { top: "80%", left: "28%", size: "text-[10px]", delay: "2.1s" },
  { top: "84%", left: "68%", size: "text-xs", delay: "1.2s" },
];

export const DEFAULT_AURA: AuraId = "stardust";

/** The aura actually shown — falls back to the free stardust look. */
export function activeAuraOf(pet: PetState): AuraId {
  const id = pet.auraActive;
  return id && (id === "stardust" || pet.auraOwned.includes(id)) ? id : DEFAULT_AURA;
}

/**
 * Cosmic aura worn behind the pet (replaces the 🪽 emoji of the wings accessory).
 * Slowly pulsing glow + twinkling stars. Excited pets glow bigger and brighter;
 * hungry or sulky ones dim down to a faint shimmer.
 */
export function PetAura({ pet }: { pet: PetState }) {
  const aura = AURAS[activeAuraOf(pet)];
  const mood = moodOf(pet);
  const intensity =
    mood === "excited"
      ? "scale-125 opacity-100"
      : mood === "normal"
        ? "scale-100 opacity-70"
        : "scale-90 opacity-40";
  return (
    <span
      aria-hidden
      data-testid="pet-aura"
      className={`pointer-events-none absolute -inset-5 ${intensity} transition-all duration-700`}
    >
      <span
        className="animate-aura-pulse absolute inset-0 rounded-full blur-lg"
        style={{
          background: `radial-gradient(closest-side, ${aura.colors[0]}B3, ${aura.colors[1]}59, transparent)`,
        }}
      />
      {STARS.map((s, i) => (
        <span
          key={i}
          className={`animate-aura-twinkle absolute ${s.size} text-white`}
          style={{ top: s.top, left: s.left, animationDelay: s.delay }}
        >
          ✦
        </span>
      ))}
    </span>
  );
}
