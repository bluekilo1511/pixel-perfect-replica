import { useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useTracker } from "@/lib/tracker/store";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_REWARD,
  type AchievementId,
  type Constellation,
} from "@/lib/tracker/extras";
import { celebrate } from "@/lib/tracker/effects";
import { Button } from "@/components/ui/button";
import { Sparkles, Star, Award, Compass, Info } from "lucide-react";

interface StarCoord {
  id: AchievementId;
  x: number;
  y: number;
}

const CONSTELLATIONS: Record<
  Constellation,
  {
    name: string;
    english: string;
    emoji: string;
    desc: string;
    color: string;
    accentColor: string;
    stars: StarCoord[];
    lines: [number, number][]; // index pairs to connect
  }
> = {
  eagle: {
    name: "Chòm Đại Bàng",
    english: "Aquila Constellation",
    emoji: "🦅",
    desc: "Tượng trưng cho sự tập trung tối thượng, ý chí sắc bén và khát vọng vươn tới trời cao.",
    color: "from-sky-500/20 via-indigo-950/40 to-blue-950/20",
    accentColor: "#38bdf8",
    stars: [
      { id: "firstFocus", x: 20, y: 70 },
      { id: "focus100", x: 38, y: 50 },
      { id: "pomo10", x: 50, y: 35 },
      { id: "nightOwl", x: 75, y: 25 },
      { id: "pomo25", x: 62, y: 55 },
      { id: "focus500", x: 45, y: 80 },
      { id: "focus1000", x: 82, y: 72 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [1, 5],
      [4, 6],
      [5, 6],
    ],
  },
  whale: {
    name: "Chòm Cá Voi",
    english: "Cetus Constellation",
    emoji: "🐋",
    desc: "Tượng trưng cho sự kiên trì bền bỉ, sức chịu đựng đại dương và chuỗi ngày không ngừng nghỉ.",
    color: "from-teal-500/20 via-cyan-950/40 to-emerald-950/20",
    accentColor: "#2dd4bf",
    stars: [
      { id: "hydroHomie", x: 18, y: 45 },
      { id: "streak3", x: 32, y: 30 },
      { id: "tasks25", x: 48, y: 40 },
      { id: "streak7", x: 65, y: 28 },
      { id: "tasks100", x: 78, y: 50 },
      { id: "streak14", x: 62, y: 72 },
      { id: "neglectfulMaster", x: 35, y: 68 },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 0],
      [2, 6],
    ],
  },
};

export function ConstellationMap() {
  const { data, claimAchievement } = useTracker();
  const [activeConstellation, setActiveConstellation] = useState<Constellation>("eagle");
  const [selectedStar, setSelectedStar] = useState<AchievementId | null>(null);

  const constel = CONSTELLATIONS[activeConstellation];

  // Stats for progress meter
  const unlockedCount = constel.stars.filter((s) => data.achievements.unlocked[s.id]).length;
  const claimedCount = constel.stars.filter(
    (s) => data.claimedAchievements[s.id] ?? data.achievements.claimed[s.id],
  ).length;

  const handleStarClick = (id: AchievementId) => {
    setSelectedStar(id);
    const unlocked = !!data.achievements.unlocked[id];
    const claimed = !!(data.claimedAchievements[id] ?? data.achievements.claimed[id]);

    if (unlocked && !claimed) {
      try {
        void confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.6 },
          colors: ["#38bdf8", "#fbbf24", "#c084fc"],
        });
      } catch {
        /* ignore */
      }
      celebrate();
      claimAchievement(id);
      toast.success(`✨ Đã thắp sáng vì sao "${ACHIEVEMENTS[id].name}" (+${ACHIEVEMENT_REWARD} 🦎)!`);
    } else if (!unlocked) {
      toast.info(`Manh mối: ${ACHIEVEMENTS[id].clue}`);
    }
  };

  const selectedDef = selectedStar ? ACHIEVEMENTS[selectedStar] : null;
  const selectedUnlocked = selectedStar ? !!data.achievements.unlocked[selectedStar] : false;
  const selectedClaimed = selectedStar
    ? !!(data.claimedAchievements[selectedStar] ?? data.achievements.claimed[selectedStar])
    : false;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-sky-500/30 bg-gradient-to-b from-[#060c1c] via-[#040814] to-[#02040a] p-6 text-white shadow-2xl">
      {/* Cosmic Nebulae Background */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-sky-600/10 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-600/10 blur-[100px]"
      />

      <div className="relative z-10">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/30 bg-sky-950/60 shadow-[0_0_20px_rgba(56,189,248,0.25)]">
              <Compass className="h-6 w-6 text-sky-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Bản Đồ Chòm Sao (Constellations)</h2>
                <span className="rounded-full border border-sky-400/30 bg-sky-500/20 px-2 py-0.5 text-[11px] font-semibold text-sky-200">
                  Interactive Star Chart
                </span>
              </div>
              <p className="text-xs text-white/60">
                Thắp sáng các vì sao thành tựu trên bầu trời vũ trụ. Bấm vào vì sao vàng để thu hoạch ngọc 🦎.
              </p>
            </div>
          </div>

          {/* Constellation Switcher Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
            {(Object.keys(CONSTELLATIONS) as Constellation[]).map((key) => {
              const c = CONSTELLATIONS[key];
              const active = activeConstellation === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveConstellation(key);
                    setSelectedStar(null);
                  }}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? "bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <span>{c.emoji}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress HUD */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-base">{constel.emoji}</span>
            <span className="font-semibold text-white/90">{constel.name}</span>
            <span className="text-white/40 font-mono text-[11px]">({constel.english})</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-white/70">
              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
              <span>Đã thắp sáng: <strong className="text-white">{unlockedCount}/{constel.stars.length}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              <span>Đã nhận: <strong className="text-white">{claimedCount}/{constel.stars.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Interactive Star Map Canvas */}
        <div className="relative mt-4 h-80 sm:h-96 w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#081026] via-[#050b1a] to-[#02050e] shadow-inner select-none">
          {/* Subtle star dust grid */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-40 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:24px_24px]"
          />

          {/* SVG Connection Lines */}
          <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {constel.lines.map(([fromIdx, toIdx], idx) => {
              const p1 = constel.stars[fromIdx];
              const p2 = constel.stars[toIdx];
              if (!p1 || !p2) return null;
              const bothUnlocked = !!data.achievements.unlocked[p1.id] && !!data.achievements.unlocked[p2.id];

              return (
                <line
                  key={idx}
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={bothUnlocked ? constel.accentColor : "rgba(255,255,255,0.15)"}
                  strokeWidth={bothUnlocked ? "0.6" : "0.3"}
                  strokeDasharray={bothUnlocked ? "none" : "1,1"}
                  className="transition-colors duration-500"
                />
              );
            })}
          </svg>

          {/* Star Nodes */}
          {constel.stars.map((s) => {
            const ach = ACHIEVEMENTS[s.id];
            const unlocked = !!data.achievements.unlocked[s.id];
            const claimed = !!(data.claimedAchievements[s.id] ?? data.achievements.claimed[s.id]);
            const isSelected = selectedStar === s.id;
            const canClaim = unlocked && !claimed;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStarClick(s.id)}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                aria-label={`${ach.name} - ${unlocked ? (claimed ? "Đã nhận" : "Bấm để nhận") : "Chưa mở"}`}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-transform focus:outline-none ${
                  canClaim ? "animate-pulse scale-125 z-20" : isSelected ? "scale-125 z-20" : "hover:scale-110 z-10"
                }`}
              >
                {/* Aura Ring */}
                <div
                  className={`absolute -inset-2 rounded-full transition-all duration-300 ${
                    canClaim
                      ? "bg-amber-400/30 blur-md animate-ping"
                      : unlocked
                        ? "bg-sky-400/20 blur-sm"
                        : "bg-white/5"
                  }`}
                />

                {/* Node Core */}
                <div
                  className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-colors ${
                    canClaim
                      ? "border-amber-300 bg-amber-500/40 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.6)]"
                      : unlocked
                        ? "border-sky-400/60 bg-sky-950/80 text-sky-200 shadow-[0_0_10px_rgba(56,189,248,0.4)]"
                        : "border-white/10 bg-white/5 text-white/30"
                  }`}
                >
                  <span className="text-sm">{unlocked ? ach.emoji : "✦"}</span>
                </div>

                {/* Quick Label */}
                <span
                  className={`pointer-events-none absolute -bottom-5 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium transition-opacity ${
                    isSelected ? "opacity-100 bg-black/80 text-white" : "opacity-0 group-hover:opacity-100 bg-black/60 text-white/80"
                  }`}
                >
                  {unlocked ? ach.name : "???"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Star Details Panel */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
          {selectedDef ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedUnlocked ? selectedDef.emoji : "❓"}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-white">
                      {selectedUnlocked ? selectedDef.name : "Ngôi Sao Ẩn Danh"}
                    </h4>
                    {selectedUnlocked && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          selectedClaimed
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-amber-500/20 text-amber-300 animate-pulse"
                        }`}
                      >
                        {selectedClaimed ? "Đã nhận thưởng" : "Sẵn sàng nhận"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/60 mt-0.5">
                    {selectedUnlocked ? selectedDef.desc : selectedDef.clue}
                  </p>
                </div>
              </div>

              {selectedUnlocked && !selectedClaimed && selectedStar && (
                <Button
                  size="sm"
                  onClick={() => handleStarClick(selectedStar)}
                  className="rounded-full border border-amber-300 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-semibold hover:from-amber-400 hover:to-yellow-400"
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  Nhận +{ACHIEVEMENT_REWARD} 🦎
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Info className="h-4 w-4" />
              <span>Bấm vào một vì sao bất kỳ trên bầu trời để xem chi tiết và manh mối kích hoạt.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
