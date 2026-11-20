import { useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { WEATHER_CHANGE_EVENT, WEATHER_LABEL } from "./WeatherLayer";
import { type Weather } from "@/lib/tracker/extras";
import { Button } from "@/components/ui/button";
import { Eye, Sun, CloudRain, Snowflake, CloudFog, Sparkles, RefreshCw } from "lucide-react";

type WeatherMode = "auto" | Weather;

const MODES: { id: WeatherMode; label: string; desc: string; icon: typeof Sun; color: string }[] = [
  {
    id: "auto",
    label: "Tự động (Theo Task & Pet)",
    desc: "Thời tiết biến đổi theo tiến độ hoàn thành nhiệm vụ và tâm trạng của thú cưng.",
    icon: RefreshCw,
    color: "from-indigo-100/90 to-purple-100/90 dark:from-indigo-500/20 dark:to-purple-500/20 text-indigo-900 dark:text-indigo-300 border-indigo-400/50",
  },
  {
    id: "sunny",
    label: "Ánh Sao Rực Rỡ",
    desc: "Tia nắng ấm áp và bầu trời sao lấp lánh tiếp thêm năng lượng tích cực.",
    icon: Sun,
    color: "from-amber-100/90 to-yellow-100/90 dark:from-amber-500/20 dark:to-yellow-500/20 text-amber-900 dark:text-amber-300 border-amber-400/50",
  },
  {
    id: "rainy",
    label: "Mưa Tinh Vân Âm Trầm",
    desc: "Tiếng mưa rơi nhẹ nhàng trên bầu không khí tĩnh mịch giúp đi sâu vào dòng chảy tập trung.",
    icon: CloudRain,
    color: "from-blue-100/90 to-sky-100/90 dark:from-blue-500/20 dark:to-sky-500/20 text-sky-900 dark:text-sky-300 border-sky-400/50",
  },
  {
    id: "snowy",
    label: "Bão Tuyết Tinh Thể",
    desc: "Những bông tuyết băng giá trôi êm đềm, làm dịu đi mọi áp lực và lo âu.",
    icon: Snowflake,
    color: "from-cyan-100/90 to-teal-100/90 dark:from-cyan-500/20 dark:to-teal-500/20 text-teal-900 dark:text-cyan-200 border-cyan-400/50",
  },
  {
    id: "foggy",
    label: "Sương Mù Huyền Bí",
    desc: "Làn sương hư ảo che phủ mọi xao nhãng ngoài tầm mắt, chỉ còn lại bạn và mục tiêu.",
    icon: CloudFog,
    color: "from-slate-200/90 to-gray-200/90 dark:from-slate-500/20 dark:to-gray-500/20 text-slate-900 dark:text-slate-300 border-slate-400/50",
  },
];

export function AstralObservatory() {
  const [currentMode, setCurrentMode] = useState<WeatherMode>(() => {
    try {
      const saved = localStorage.getItem("tt-weather-override");
      return (saved as WeatherMode) || "auto";
    } catch {
      return "auto";
    }
  });

  const handleSelectMode = (mode: WeatherMode) => {
    setCurrentMode(mode);
    try {
      if (mode === "auto") {
        localStorage.removeItem("tt-weather-override");
      } else {
        localStorage.setItem("tt-weather-override", mode);
      }
      window.dispatchEvent(
        new CustomEvent(WEATHER_CHANGE_EVENT, { detail: { weather: mode } }),
      );
    } catch {
      /* ignore */
    }

    if (mode === "auto") {
      toast.success("🌀 Đã đưa thời tiết về chế độ nhịp sinh học tự động");
    } else {
      toast.success(`🌌 Đài Thiên Văn chuyển thời tiết: ${WEATHER_LABEL[mode]}`);
    }
  };

  const handleSpawnStars = () => {
    try {
      void confetti({
        particleCount: 45,
        spread: 100,
        origin: { y: 0.2 },
        colors: ["#38bdf8", "#818cf8", "#fcd34d", "#f43f5e"],
      });
      toast("✨ Một đàn sao băng vừa lướt qua bầu trời!");
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="relative overflow-hidden astral-observatory-shell rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-50/90 via-sky-50/50 to-indigo-100/30 dark:from-[#0b0c22] dark:via-[#070817] dark:to-[#04040d] p-6 text-foreground dark:text-white shadow-2xl transition-colors">
      {/* Glow Effects */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-3xl"
      />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/40 bg-indigo-100/80 dark:bg-indigo-950/60 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <Eye className="h-6 w-6 text-indigo-700 dark:text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground dark:text-white">
                  Đài Thiên Văn Tinh Tú (Astral Observatory)
                </h2>
                <span className="rounded-full border border-indigo-400/30 bg-indigo-500/15 dark:bg-indigo-500/20 px-2 py-0.5 text-[11px] font-semibold text-indigo-900 dark:text-indigo-200">
                  Dynamic Weather
                </span>
              </div>
              <p className="text-xs text-indigo-950/75 dark:text-indigo-200/60">
                Điều chỉnh khí hậu và hiệu ứng môi trường vũ trụ để tối ưu hoá sự tập trung của bạn.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleSpawnStars}
            className="rounded-full border border-indigo-300/80 dark:border-indigo-400/40 bg-indigo-100 dark:bg-indigo-600/40 px-4 text-xs font-semibold text-indigo-950 dark:text-indigo-200 hover:bg-indigo-600 hover:text-white shadow-sm"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Thả sao băng
          </Button>
        </div>

        {/* Weather Modes Grid */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = currentMode === m.id;

            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectMode(m.id)}
                className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? `bg-gradient-to-br ${m.color} border-indigo-500 shadow-md`
                    : "border-indigo-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:border-indigo-300 dark:hover:border-white/20 hover:bg-white dark:hover:bg-white/10 shadow-sm"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-900/10 dark:border-white/10 bg-indigo-50/80 dark:bg-black/30">
                      <Icon className="h-5 w-5 text-indigo-700 dark:text-white" />
                    </span>
                    {active && (
                      <span className="rounded-full bg-indigo-600 text-white dark:bg-indigo-500/30 dark:border dark:border-indigo-400/40 px-2 py-0.5 text-[10px] font-bold dark:text-indigo-200">
                        Đang kích hoạt
                      </span>
                    )}
                  </div>
                  <h4 className="mt-3 font-bold text-sm text-foreground dark:text-white">{m.label}</h4>
                  <p className="mt-1 text-xs text-muted-foreground dark:text-white/70 leading-relaxed font-normal">{m.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
