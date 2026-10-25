import { useEffect, useRef, useState } from "react";

/**
 * 2D expedition cutscene: while the pet is away exploring, the 3D room is
 * replaced by this side-scrolling scene. The pet runs in place with a sword,
 * the world scrolls past (grass, dirt, rocks, flowers, trees, mountains,
 * clouds), and every now and then a wild emoji critter charges in from the
 * other side — brief sword clash, then it evaporates in a puff.
 */

const WILD_POOL = [
  "🐺",
  "🐗",
  "🦊",
  "🦇",
  "🕷️",
  "🦂",
  "🐍",
  "🦎",
  "🐊",
  "🐅",
  "🐻",
  "🦌",
  "🐐",
  "🦉",
  "🦔",
  "🐢",
  "🐉",
  "🦖",
  "🐆",
  "🦏",
];

const CLOUDS = [
  { left: "6%", top: "8%", size: 44, dur: 70, delay: 0 },
  { left: "40%", top: "16%", size: 34, dur: 95, delay: -30 },
  { left: "68%", top: "6%", size: 52, dur: 60, delay: -50 },
  { left: "85%", top: "22%", size: 30, dur: 110, delay: -15 },
];

// Ground decorations: x = % across the strip, emoji, size, y offset within the grass band.
const GROUND_ITEMS: Array<{ x: number; emoji: string; size: number; dy: number }> = [
  { x: 3, emoji: "🌼", size: 18, dy: 0 },
  { x: 9, emoji: "🪨", size: 16, dy: 6 },
  { x: 15, emoji: "🌷", size: 20, dy: -2 },
  { x: 22, emoji: "⚪", size: 10, dy: 10 },
  { x: 28, emoji: "🌻", size: 20, dy: -2 },
  { x: 35, emoji: "🌼", size: 16, dy: 2 },
  { x: 41, emoji: "🪨", size: 14, dy: 8 },
  { x: 48, emoji: "⚪", size: 8, dy: 10 },
  { x: 54, emoji: "🌷", size: 18, dy: 0 },
  { x: 61, emoji: "🌼", size: 18, dy: 2 },
  { x: 67, emoji: "🪨", size: 18, dy: 6 },
  { x: 74, emoji: "🌻", size: 18, dy: -2 },
  { x: 81, emoji: "⚪", size: 10, dy: 10 },
  { x: 88, emoji: "🌷", size: 18, dy: 0 },
  { x: 95, emoji: "🪨", size: 12, dy: 8 },
];

// Horizon tree/rock line, scrolls slowly for parallax.
const HORIZON_ITEMS = ["🌲", "🌳", "🌲", "🏞️", "🌲", "🌳", "🌲", "🌲", "🌳", "🌲"];

const MOUNTAINS = ["🏔️", "⛰️", "🏔️"];

type Phase = "run" | "clash" | "poof";
interface Wild {
  id: number;
  emoji: string;
  phase: Phase;
  arrived: boolean;
}

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function ExpeditionScene({
  petEmoji,
  endAt,
  batterySaver = false,
}: {
  petEmoji: string;
  endAt: string;
  batterySaver?: boolean;
}) {
  const [remain, setRemain] = useState(() =>
    Math.max(0, Math.ceil((new Date(endAt).getTime() - Date.now()) / 1000)),
  );
  const [wild, setWild] = useState<Wild | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const i = window.setInterval(
      () => setRemain(Math.max(0, Math.ceil((new Date(endAt).getTime() - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(i);
  }, [endAt]);

  // Wild critter loop: spawn → charge in → clash → evaporate → wait → repeat.
  useEffect(() => {
    let alive = true;
    const schedule = (ms: number, fn: () => void) => {
      const id = window.setTimeout(() => {
        if (alive) fn();
      }, ms);
      timers.current.push(id);
    };
    const spawn = () => {
      const emoji = WILD_POOL[Math.floor(Math.random() * WILD_POOL.length)] ?? "🐺";
      const id = Date.now();
      setWild({ id, emoji, phase: "run", arrived: false });
      schedule(50, () => setWild((w) => (w && w.id === id ? { ...w, arrived: true } : w)));
      schedule(2400, () => setWild((w) => (w && w.id === id ? { ...w, phase: "clash" } : w)));
      schedule(3200, () => setWild((w) => (w && w.id === id ? { ...w, phase: "poof" } : w)));
      schedule(4000, () => {
        setWild(null);
        schedule(2500 + Math.random() * 5500, spawn);
      });
    };
    schedule(1600 + Math.random() * 3000, spawn);
    return () => {
      alive = false;
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  const returnOverlay = remain <= 0;

  return (
    <div
      className="exp-scene relative aspect-[16/9] w-full select-none overflow-hidden rounded-xl"
      role="img"
      aria-label="Thú cưng đang đi thám hiểm trên đồng hoang 2D"
      data-testid="expedition-scene"
    >
      {/* Sky */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#7ec8f7] via-[#a8dcf5] to-[#f6e7c1]" />
      <span
        className="absolute right-[12%] top-[10%] text-3xl"
        style={{ filter: "drop-shadow(0 0 12px rgba(255,220,130,0.9))" }}
        aria-hidden
      >
        ☀️
      </span>
      {CLOUDS.map((c, i) => (
        <span
          key={i}
          className={`absolute text-white/90 ${batterySaver ? "" : "exp-cloud"}`}
          style={{
            left: c.left,
            top: c.top,
            fontSize: c.size,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
          }}
          aria-hidden
        >
          ☁️
        </span>
      ))}

      {/* Far mountains + tree line (slow parallax) */}
      <div className="absolute bottom-[26%] left-0 flex w-[200%] items-end justify-around">
        <div
          className={`flex w-full shrink-0 items-end justify-around ${batterySaver ? "" : "exp-parallax-slow"}`}
        >
          {MOUNTAINS.map((m, i) => (
            <span key={i} className="text-6xl opacity-80" aria-hidden>
              {m}
            </span>
          ))}
          <span className="text-5xl opacity-75" aria-hidden>
            🏞️
          </span>
        </div>
        <div
          className={`flex w-full shrink-0 items-end justify-around ${batterySaver ? "" : "exp-parallax-slow"}`}
        >
          {MOUNTAINS.map((m, i) => (
            <span key={i} className="text-6xl opacity-80" aria-hidden>
              {m}
            </span>
          ))}
          <span className="text-5xl opacity-75" aria-hidden>
            🏞️
          </span>
        </div>
      </div>
      <div className="absolute bottom-[20%] left-0 flex w-[200%] items-end">
        <div
          className={`flex w-full shrink-0 items-end justify-around ${batterySaver ? "" : "exp-parallax-mid"}`}
        >
          {HORIZON_ITEMS.map((t, i) => (
            <span key={i} className="text-3xl" aria-hidden>
              {t}
            </span>
          ))}
        </div>
        <div
          className={`flex w-full shrink-0 items-end justify-around ${batterySaver ? "" : "exp-parallax-mid"}`}
        >
          {HORIZON_ITEMS.map((t, i) => (
            <span key={i} className="text-3xl" aria-hidden>
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Ground: grass → dirt → rocky base */}
      <div className="absolute bottom-0 left-0 h-[22%] w-full">
        <div className="h-[36%] w-full bg-gradient-to-b from-[#66bb4a] to-[#4c9a3a]" />
        <div className="h-[42%] w-full bg-gradient-to-b from-[#8a6239] to-[#6d4c2a]" />
        <div className="h-[22%] w-full bg-gradient-to-b from-[#7b7f86] to-[#565a60]" />
      </div>

      {/* Scrolling grass-top decorations (flowers, pebbles) */}
      <div className="absolute bottom-[16.5%] left-0 flex h-[9%] w-[200%]">
        <div className={`relative w-full shrink-0 ${batterySaver ? "" : "exp-scroll"}`}>
          {GROUND_ITEMS.map((g, i) => (
            <span
              key={i}
              className="absolute"
              style={{ left: `${g.x}%`, bottom: `${g.dy}px`, fontSize: g.size }}
              aria-hidden
            >
              {g.emoji}
            </span>
          ))}
        </div>
        <div className={`relative w-full shrink-0 ${batterySaver ? "" : "exp-scroll"}`}>
          {GROUND_ITEMS.map((g, i) => (
            <span
              key={i}
              className="absolute"
              style={{ left: `${g.x}%`, bottom: `${g.dy}px`, fontSize: g.size }}
              aria-hidden
            >
              {g.emoji}
            </span>
          ))}
        </div>
      </div>

      {/* Pet: runs in place, sword in hand, dust kicking up behind */}
      <div
        className={`absolute bottom-[15%] left-[14%] ${batterySaver ? "" : "exp-run"}`}
        data-testid="expedition-pet"
      >
        <span className="relative block text-5xl leading-none" aria-hidden>
          {petEmoji}
          <span className="absolute -right-5 bottom-0 text-2xl" aria-hidden>
            ⚔️
          </span>
        </span>
        {!batterySaver && (
          <>
            <span className="exp-dust absolute bottom-0 -left-4 text-xs" aria-hidden>
              💨
            </span>
            <span
              className="exp-dust absolute bottom-0 -left-6 text-[10px]"
              style={{ animationDelay: "0.3s" }}
              aria-hidden
            >
              💨
            </span>
            <span
              className="exp-dust absolute bottom-0 -left-2 text-[9px]"
              style={{ animationDelay: "0.6s" }}
              aria-hidden
            >
              💨
            </span>
          </>
        )}
      </div>

      {/* Wild critter charging in from the opposite side */}
      {wild && (
        <div
          className="absolute bottom-[15%]"
          style={{
            left: wild.arrived ? "30%" : "104%",
            transition: wild.phase === "run" && wild.arrived ? "left 2.35s linear" : undefined,
          }}
          data-testid="expedition-wild"
        >
          <span
            className={`relative block text-5xl leading-none ${
              wild.phase === "clash"
                ? "exp-clash"
                : wild.phase === "poof"
                  ? "exp-poof"
                  : "exp-hustle"
            }`}
            aria-hidden
          >
            {wild.emoji}
          </span>
          {wild.phase === "clash" && (
            <span
              className="exp-spark absolute -top-3 left-1/2 -translate-x-1/2 text-2xl"
              aria-hidden
            >
              ⚡
            </span>
          )}
          {wild.phase === "poof" && (
            <span
              className="absolute -top-2 left-1/2 -translate-x-1/2 text-xl opacity-70"
              aria-hidden
            >
              💨
            </span>
          )}
        </div>
      )}
      {/* Clash flash near the pet's sword */}
      {wild?.phase === "clash" && (
        <span className="exp-spark absolute bottom-[26%] left-[24%] text-2xl" aria-hidden>
          💥
        </span>
      )}

      {/* Expedition caption + countdown */}
      <div className="absolute left-3 top-3 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
        🧭 Chuyến thám hiểm
      </div>
      <div className="absolute right-3 top-3 rounded-full bg-black/35 px-3 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur-sm">
        {returnOverlay ? "🏠 Đang trở về nơi ở…" : `⏳ ${fmt(remain)}`}
      </div>
    </div>
  );
}
