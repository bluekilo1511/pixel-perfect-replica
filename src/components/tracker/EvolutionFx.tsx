import { useEffect, useMemo, useState } from "react";
import { useTracker } from "@/lib/tracker/store";

const SPARKS = ["✨", "⭐", "🌟", "💫", "⚡"];

/** Full-screen evolution cutscene: flash, shockwave rings, particle burst, morphing pet form. */
export function EvolutionFx() {
  const { evolution, dismissEvolution } = useTracker();
  const [phase, setPhase] = useState(0); // 0 = charge-up, 1 = reveal
  useEffect(() => {
    if (!evolution) return;
    setPhase(0);
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(dismissEvolution, 5200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evolution]);
  if (!evolution) return null;
  return (
    <button
      type="button"
      aria-label="Nhấn để đóng"
      onClick={dismissEvolution}
      className="fixed inset-0 z-50 grid cursor-pointer place-items-center overflow-hidden bg-black/80 backdrop-blur-sm"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ animation: "evo-shake .5s ease-in-out 3" }}
      >
        {/* white flash */}
        <div
          className="absolute inset-0 bg-white"
          style={{ animation: "evo-flash 1.1s ease-out both" }}
        />
        {/* shockwave rings */}
        {[0, 350, 700, 1050].map((d) => (
          <div
            key={d}
            className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300/80"
            style={{ animation: `evo-ring 1.4s ease-out ${d}ms both` }}
          />
        ))}
        {/* particle burst */}
        <ParticleBurst trigger={evolution} />
      </div>

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <p
          className="text-xs font-bold tracking-[0.35em] text-amber-300 uppercase"
          style={{ animation: "evo-breathe 1.4s ease-in-out infinite" }}
        >
          ⚡ Tiến hoá ⚡
        </p>
        <div className="relative mt-6 flex items-center gap-6 text-6xl sm:text-8xl">
          <span
            className={
              phase === 1 ? "opacity-0 transition-opacity duration-300" : "transition-opacity"
            }
          >
            {evolution.from}
          </span>
          <span className="text-4xl text-amber-300">➜</span>
          <span
            className="relative"
            style={{
              animation: phase === 1 ? "evo-morph 1.2s cubic-bezier(.2,.9,.3,1.2) both" : undefined,
            }}
          >
            {phase === 1 ? evolution.to : ""}
            {phase === 1 && (
              <span
                className="absolute -inset-8 -z-10 rounded-full bg-amber-400/25 blur-2xl"
                style={{ animation: "evo-breathe 1.6s ease-in-out infinite" }}
              />
            )}
          </span>
        </div>
        {phase === 1 && (
          <h2
            className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-300 bg-clip-text mt-8 font-display text-3xl font-bold text-transparent sm:text-5xl"
            style={{ animation: "evo-title .8s ease-out both" }}
          >
            {evolution.title}
          </h2>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          {phase === 1 ? "Dạng mới đã thức tỉnh!" : "Sức mạnh đang dâng lên…"}
        </p>
      </div>
    </button>
  );
}

function ParticleBurst({ trigger }: { trigger: { from: string; to: string; title: string } }) {
  const parts = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        emoji: SPARKS[i % SPARKS.length]!,
        dx: `${Math.cos((i / 22) * Math.PI * 2) * (120 + (i % 5) * 34)}px`,
        dy: `${Math.sin((i / 22) * Math.PI * 2) * (120 + (i % 7) * 26)}px`,
        delay: 900 + (i % 4) * 120,
        size: 18 + (i % 4) * 10,
      })),
    // re-run the burst per evolution
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trigger],
  );
  return (
    <>
      {parts.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 select-none"
          style={{
            fontSize: p.size,
            // @ts-expect-error custom properties
            "--dx": p.dx,
            "--dy": p.dy,
            animation: `evo-particle 1.3s ease-out ${p.delay}ms both`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </>
  );
}
