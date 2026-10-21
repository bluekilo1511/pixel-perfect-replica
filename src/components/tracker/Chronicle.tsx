import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import {
  ACHIEVEMENTS,
  petTitle,
  TIER_BADGE,
  tierOf,
  weekSummary,
  type AchievementId,
} from "@/lib/tracker/extras";
import { SPECIES } from "@/lib/tracker/gamify";
import { Button } from "@/components/ui/button";
import { useWeather, WEATHER_LABEL } from "./WeatherLayer";
import { ConstellationMap } from "./ConstellationMap";

const dm = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

function Stat({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="border-l-2 border-foreground/40 px-3 py-2">
      <div className="text-2xl">{icon}</div>
      <div className="font-display text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

export function Chronicle() {
  const { data } = useTracker();
  const card = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const weather = useWeather();
  const today = dateStr();
  const w = weekSummary(data.dailyStats, today);
  const pet = data.petState;
  const headline =
    w.tasks >= 15
      ? "CHỦ NHÂN LẬP KỶ LỤC TUẦN!"
      : w.tasks >= 5
        ? "MỘT TUẦN CHĂM CHỈ ĐÁNG KHEN"
        : "VƯƠNG QUỐC CHỜ NGƯỜI HÙNG TRỞ LẠI";

  const download = async () => {
    if (!card.current) return;
    setBusy(true);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const canvas = await html2canvas(card.current, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `weekly-chronicle-${w.days[0]}.png`;
      a.click();
      toast.success("Đã tải thẻ tuần 📰");
    } catch {
      toast.error("Không xuất được ảnh");
    }
    setBusy(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <div ref={card} className="chronicle rounded-2xl p-6">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Tuần {dm(w.days[0]!)} – {dm(w.days[6]!)} · {WEATHER_LABEL[weather]}
            </p>
            <h2 className="font-display text-4xl font-bold tracking-tight">
              📰 Nhật Báo Phiêu Lưu
            </h2>
            <div className="chronicle-rule my-3" />
            <p className="font-display text-xl font-bold">{headline}</p>
          </div>
          <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon="✅" value={w.tasks} label="Nhiệm vụ" />
            <Stat icon="⏳" value={(w.focusMin / 60).toFixed(1)} label="Giờ tập trung" />
            <Stat icon="💧" value={w.water} label="Ly nước" />
            <Stat icon="🍖" value={w.treats} label="Món thưởng pet" />
          </div>
          <div className="mb-4 flex items-end gap-1.5">
            {w.days.map((d) => {
              const n = data.dailyStats[d]?.tasks ?? 0;
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{ height: `${8 + Math.min(80, n * 12)}px`, opacity: n ? 1 : 0.25 }}
                  />
                  <span className="text-[10px] text-muted-foreground">{dm(d)}</span>
                </div>
              );
            })}
          </div>
          <div className="chronicle-rule mb-3" />
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <p>
              <b>
                Phóng viên {SPECIES[pet.species].emoji} {petTitle(pet)}
              </b>{" "}
              (Lv {pet.petLevel}) đưa tin: chuỗi streak đang là <b>🔥 {data.streak.count} ngày</b>,{" "}
              {w.pomodoros} trận Pomodoro đã diễn ra.
            </p>
            <p>
              {w.bestDay ? (
                <>
                  Ngày rực rỡ nhất: <b>{dm(w.bestDay)}</b> với {data.dailyStats[w.bestDay]?.tasks}{" "}
                  nhiệm vụ.
                </>
              ) : (
                "Chưa có trận chiến nào được ghi nhận tuần này."
              )}{" "}
              Thành tựu: {Object.keys(data.achievements.unlocked).length}/
              {Object.keys(ACHIEVEMENTS).length} 🏆
            </p>
          </div>
        </div>
        <Button onClick={download} disabled={busy}>
          {busy ? "Đang xuất…" : "⬇️ Tải thẻ PNG"}
        </Button>
      </div>

      <div className="space-y-5">
        <section className="glass p-5">
          <h2 className="mb-3 text-lg font-semibold">🏛️ Đại Sảnh Danh Vọng</h2>
          <ul className="space-y-2">
            {(Object.keys(ACHIEVEMENTS) as AchievementId[]).map((id) => {
              const a = ACHIEVEMENTS[id];
              const at = data.achievements.unlocked[id];
              return (
                <li
                  key={id}
                  className={`flex items-center gap-3 rounded-xl p-3 ${at ? "bg-secondary glass-glow" : "bg-muted opacity-60 grayscale"}`}
                >
                  <span className="text-3xl">{at ? a.emoji : "❓"}</span>
                  <div className="text-sm">
                    <p className="font-medium">{at ? a.name : "Thành tựu ẩn"}</p>
                    <p className="text-xs text-muted-foreground">
                      {at ? `${a.desc} · ${new Date(at).toLocaleDateString("vi-VN")}` : a.clue}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <ConstellationMap />
        <section className="glass p-5">
          <h2 className="mb-3 text-lg font-semibold">
            📔 Nhật ký phiêu lưu của {TIER_BADGE[tierOf(pet.petLevel)]} {SPECIES[pet.species].name}
          </h2>
          {data.adventureLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sang ngày mới, thú cưng sẽ tự viết nhật ký về ngày hôm trước.
            </p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-auto pr-1">
              {data.adventureLog.map((e) => (
                <li key={e.date} className="rounded-xl bg-muted p-3 text-sm">
                  {e.mood === "great" ? "🌟" : e.mood === "lonely" ? "🌧️" : "🌤️"} {e.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
