import { useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import {
  getStaleTasks,
  sacrificeTask,
  sacrificeAllStale,
  calculateVoidReward,
} from "@/lib/tracker/voidMarket";
import { Button } from "@/components/ui/button";
import { Sparkles, Trash2, Zap, Orbit, Gift } from "lucide-react";
import { MATERIALS } from "@/lib/tracker/extras";

export function VoidMarket() {
  const { data, update } = useTracker();
  const [animating, setAnimating] = useState(false);
  const today = dateStr();
  const stale = getStaleTasks(data, today);

  const triggerVoidVfx = () => {
    try {
      void confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#a855f7", "#6366f1", "#ec4899", "#38bdf8"],
      });
    } catch {
      /* ignore */
    }
  };

  const handleSacrificeOne = (taskId: string, title: string) => {
    setAnimating(true);
    const res = sacrificeTask(data, taskId);
    if (!res.ok || !res.data || !res.reward) {
      toast.error("Không thể hiến tế nhiệm vụ này");
      setAnimating(false);
      return;
    }

    update(() => res.data!);
    triggerVoidVfx();
    const matMsg = res.reward.material
      ? ` và 1 ${MATERIALS[res.reward.material].emoji} ${MATERIALS[res.reward.material].name}`
      : "";
    toast.success(
      `🌀 Đã hiến tế "${title}" vào Hư Không! Nhận +${res.reward.coins} 😺, +${res.reward.xp} XP${matMsg}!`,
    );
    setTimeout(() => setAnimating(false), 500);
  };

  const handleSacrificeAll = () => {
    if (stale.length === 0) return;
    setAnimating(true);
    const res = sacrificeAllStale(data);
    update(() => res.data);
    triggerVoidVfx();

    const matMsg =
      res.materials.length > 0
        ? ` cùng ${res.materials.length} nguyên liệu quý!`
        : "!";
    toast.success(
      `🌌 Hư Không đón nhận toàn bộ ${res.count} nhiệm vụ tồn đọng! Thu về +${res.totalCoins} 😺, +${res.totalXp} XP${matMsg}`,
    );
    setTimeout(() => setAnimating(false), 600);
  };

  return (
    <section className="relative overflow-hidden void-market-shell rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-50/90 via-indigo-50/50 to-purple-100/30 dark:from-[#140b28] dark:via-[#0d071a] dark:to-[#080410] p-6 text-foreground dark:text-white shadow-2xl transition-colors">
      {/* Background Cosmic Portal */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/10 dark:bg-purple-600/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-indigo-500/10 dark:bg-indigo-600/15 blur-3xl"
      />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-purple-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-purple-400/40 bg-purple-100/80 dark:bg-purple-950/60 shadow-[0_0_20px_rgba(168,85,247,0.25)]">
              <Orbit className={`h-6 w-6 text-purple-700 dark:text-purple-300 ${animating ? "animate-spin" : ""}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground dark:text-white">Chợ Hư Không (Void Market)</h2>
                <span className="rounded-full border border-purple-400/30 bg-purple-500/15 dark:bg-purple-500/20 px-2 py-0.5 text-[11px] font-semibold text-purple-900 dark:text-purple-200">
                  V4 Altar
                </span>
              </div>
              <p className="text-xs text-purple-950/75 dark:text-purple-200/60">
                Hiến tế nhiệm vụ tồn đọng đã quá hạn để thanh tẩy tâm trí và đổi lấy Cat Coins & Bụi Sao.
              </p>
            </div>
          </div>

          {stale.length > 0 && (
            <Button
              onClick={handleSacrificeAll}
              disabled={animating}
              className="rounded-full border border-purple-400/40 bg-gradient-to-r from-purple-600 to-indigo-600 px-5 text-xs font-semibold text-white shadow-lg shadow-purple-900/30 hover:from-purple-500 hover:to-indigo-500"
            >
              <Zap className="mr-1.5 h-3.5 w-3.5 fill-current" />
              Hiến tế tất cả ({stale.length})
            </Button>
          )}
        </div>

        {/* Content Area */}
        <div className="mt-5">
          {stale.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-purple-900/10 dark:border-white/5 bg-white/70 dark:bg-white/[0.02] py-10 text-center backdrop-blur-sm">
              <Sparkles className="h-8 w-8 text-purple-600/50 dark:text-purple-300/40 mb-2" />
              <p className="text-sm font-semibold text-foreground dark:text-white/80">Không có nhiệm vụ tồn đọng!</p>
              <p className="max-w-md text-xs text-muted-foreground dark:text-white/40 mt-1">
                Danh sách của bạn đang rất gọn gàng. Khi có việc cũ chưa hoàn thành từ những ngày trước, bạn có thể hiến tế tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-purple-950/70 dark:text-purple-200/60 px-1 font-medium">
                <span>Nhiệm vụ tồn ({stale.length})</span>
                <span>Phần thưởng ước tính: ~{stale.length * 8} 😺 + tỉ lệ rơi nguyên liệu</span>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {stale.map((t) => {
                  const preview = calculateVoidReward(t, () => 0.5);
                  return (
                    <div
                      key={t.id}
                      className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-purple-900/10 dark:border-purple-500/20 bg-white/85 dark:bg-purple-950/30 p-3.5 backdrop-blur-sm transition-all hover:border-purple-400/50 hover:bg-white dark:hover:border-purple-400/40 dark:hover:bg-purple-950/50 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{t.emoji ?? "📝"}</span>
                          <span className="font-semibold text-sm text-foreground dark:text-white/95 truncate">
                            {t.title}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-purple-950/65 dark:text-purple-200/50">
                          <span>Ngày: {t.date}</span>
                          <span>•</span>
                          <span>Thời lượng: {t.minutes}p</span>
                          <span>•</span>
                          <span className="text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1">
                            <Gift className="h-3 w-3" /> +{preview.coins} 😺, +{preview.xp} XP
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSacrificeOne(t.id, t.title)}
                        disabled={animating}
                        className="rounded-xl border-purple-300/70 dark:border-purple-500/40 bg-purple-100/80 dark:bg-purple-900/20 text-purple-900 dark:text-purple-200 hover:bg-purple-600 hover:text-white transition-colors"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Hiến tế
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
