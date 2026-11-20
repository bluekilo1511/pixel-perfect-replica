import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { ACCESSORIES, ACCESSORY_SLOT, SPECIES } from "@/lib/tracker/gamify";
import { petEmoji } from "@/lib/tracker/extras";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  Download,
  Upload,
  Lock,
  Flame,
  Award,
  Clock,
  CheckCircle2,
  FileJson,
} from "lucide-react";

export function DataVault() {
  const { data, update } = useTracker();
  const [activeTab, setActiveTab] = useState<"telemetry" | "wardrobe" | "backup">("telemetry");

  const pet = data.petState;
  const game = data.game;
  const streak = data.streak;

  // Compute telemetry metrics
  const totalTasks = data.tasks.filter((t) => t.completed).length;
  const totalMinutes = Object.values(data.dailyStats).reduce(
    (acc, d) => acc + (d.focusMin ?? d.pomodoros * 25),
    0,
  );
  const totalHours = (totalMinutes / 60).toFixed(1);

  const handleExport = () => {
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `blueliz-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("🛡️ Đã xuất bản sao lưu két sắt an toàn!");
    } catch {
      toast.error("Không thể xuất file sao lưu");
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (parsed && typeof parsed === "object" && parsed.tasks) {
          update(() => parsed);
          toast.success("✨ Đã khôi phục dữ liệu két sắt thành công!");
        } else {
          toast.error("File sao lưu không hợp lệ");
        }
      } catch {
        toast.error("Lỗi đọc file JSON");
      }
    };
    reader.readAsText(file);
  };

  const toggleEquip = (acId: keyof typeof ACCESSORIES) => {
    const slot = ACCESSORY_SLOT[acId];
    update((d) => {
      const current = d.petState.accessories[slot];
      const nextAcc = { ...d.petState.accessories };
      if (current === acId) {
        nextAcc[slot] = null;
      } else {
        nextAcc[slot] = acId;
      }
      return {
        ...d,
        petState: {
          ...d.petState,
          accessories: nextAcc,
        },
      };
    });
    toast(`Đã ${pet.accessories[ACCESSORY_SLOT[acId]] === acId ? "tháo" : "trang bị"} ${ACCESSORIES[acId].name}`);
  };

  return (
    <section className="relative overflow-hidden data-vault-shell rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-cyan-50/90 via-sky-50/50 to-cyan-100/30 dark:from-[#04121a] dark:via-[#020b12] dark:to-[#01060a] p-6 text-foreground dark:text-white shadow-2xl backdrop-blur-2xl transition-colors">
      {/* Neon Security Seal Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-[90px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-blue-500/10 dark:bg-blue-600/15 blur-[90px]"
      />

      <div className="relative z-10">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-100/80 dark:bg-cyan-950/60 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <ShieldCheck className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground dark:text-white">
                  Két Dữ Liệu Tối Mật (Data Vault)
                </h2>
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 dark:bg-cyan-500/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-900 dark:text-cyan-200">
                  Frosted Seal V4
                </span>
              </div>
              <p className="text-xs text-cyan-950/75 dark:text-cyan-200/60">
                Lưu trữ chỉ số học tập, kho bảo vật thú cưng và các bản sao lưu đồng bộ an toàn.
              </p>
            </div>
          </div>

          {/* Navigation Pill */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-cyan-900/10 dark:border-white/10 bg-white/70 dark:bg-white/5 p-1 backdrop-blur-md shadow-sm">
            <button
              type="button"
              onClick={() => setActiveTab("telemetry")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "telemetry"
                  ? "bg-cyan-600 text-white shadow-sm dark:bg-cyan-500/20 dark:text-cyan-300 dark:border dark:border-cyan-400/40"
                  : "text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white"
              }`}
            >
              Chỉ số Telemetry
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wardrobe")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "wardrobe"
                  ? "bg-cyan-600 text-white shadow-sm dark:bg-cyan-500/20 dark:text-cyan-300 dark:border dark:border-cyan-400/40"
                  : "text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white"
              }`}
            >
              Kho Bảo Vật ({pet.ownedAccessories.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("backup")}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "backup"
                  ? "bg-cyan-600 text-white shadow-sm dark:bg-cyan-500/20 dark:text-cyan-300 dark:border dark:border-cyan-400/40"
                  : "text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white"
              }`}
            >
              Sao Lưu & Khôi Phục
            </button>
          </div>
        </div>

        {/* Tab 1: Telemetry */}
        {activeTab === "telemetry" && (
          <div className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-cyan-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-300 text-xs font-bold">
                  <Clock className="h-4 w-4" /> Tổng Giờ Tập Trung
                </div>
                <p className="mt-2 text-3xl font-extrabold text-foreground dark:text-white">{totalHours}h</p>
                <span className="text-[11px] text-muted-foreground dark:text-white/50">{totalMinutes} phút tích lũy</span>
              </div>

              <div className="rounded-2xl border border-cyan-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="h-4 w-4" /> Nhiệm Vụ Hoàn Thành
                </div>
                <p className="mt-2 text-3xl font-extrabold text-foreground dark:text-white">{totalTasks}</p>
                <span className="text-[11px] text-muted-foreground dark:text-white/50">Mục tiêu đã chinh phục</span>
              </div>

              <div className="rounded-2xl border border-cyan-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
                  <Flame className="h-4 w-4" /> Chuỗi Streak Hiện Tại
                </div>
                <p className="mt-2 text-3xl font-extrabold text-foreground dark:text-white">{streak.count} ngày</p>
                <span className="text-[11px] text-muted-foreground dark:text-white/50">Kỷ lục cao nhất: {streak.best} ngày</span>
              </div>

              <div className="rounded-2xl border border-cyan-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4 backdrop-blur-sm shadow-sm">
                <div className="flex items-center gap-2 text-purple-800 dark:text-purple-300 text-xs font-bold">
                  <Award className="h-4 w-4" /> Cấp Độ & Tiến Độ
                </div>
                <p className="mt-2 text-3xl font-extrabold text-foreground dark:text-white">Level {game.level}</p>
                <span className="text-[11px] text-muted-foreground dark:text-white/50">{game.xp} XP tích lũy</span>
              </div>
            </div>

            {/* Pet Status Card inside Vault */}
            <div className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-cyan-200/80 dark:border-cyan-500/20 bg-cyan-50/70 dark:bg-cyan-950/20 p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-300 dark:border-cyan-400/30 bg-white dark:bg-black/40 text-4xl shadow-sm">
                  {petEmoji(pet)}
                </div>
                <div>
                  <h4 className="font-bold text-base text-foreground dark:text-white">
                    {pet.petName ?? SPECIES[pet.species].name} ({SPECIES[pet.species].name})
                  </h4>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground dark:text-white/70">
                    <span>🍖 No: {pet.hunger}/100</span>
                    <span>💖 Hạnh phúc: {pet.happiness}/100</span>
                    <span>⭐ Cấp thú: Lv.{pet.petLevel} ({pet.petXp} XP)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-amber-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200 font-semibold shadow-sm">
                  😺 {game.catCoins} Cat Coins
                </div>
                <div className="rounded-xl border border-cyan-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1.5 text-xs text-cyan-900 dark:text-cyan-200 font-semibold shadow-sm">
                  🧊 {data.inventory.freezes} Lá chắn Băng
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Wardrobe */}
        {activeTab === "wardrobe" && (
          <div className="mt-6 space-y-4">
            <p className="text-xs text-muted-foreground dark:text-white/60">
              Trang bị hoặc tháo gỡ các phụ kiện thần thoại đã rèn trong Lò Luyện Kim hoặc mở từ Két Sắt.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(ACCESSORIES) as (keyof typeof ACCESSORIES)[]).map((acId) => {
                const def = ACCESSORIES[acId];
                const owned = pet.ownedAccessories.includes(acId);
                const slot = ACCESSORY_SLOT[acId];
                const equipped = pet.accessories[slot] === acId;

                return (
                  <div
                    key={acId}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                      equipped
                        ? "border-cyan-500 bg-cyan-100/90 dark:border-cyan-400 dark:bg-cyan-500/20 shadow-md"
                        : owned
                          ? "border-cyan-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 shadow-sm"
                          : "border-cyan-900/5 dark:border-white/5 bg-gray-100/60 dark:bg-black/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{def.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground dark:text-white">{def.name}</span>
                          {equipped && (
                            <span className="rounded bg-cyan-600 text-white dark:bg-cyan-500/30 dark:text-cyan-200 px-1.5 py-0.2 text-[10px] font-bold">
                              Đang đeo
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground dark:text-white/50">Vị trí: {slot}</span>
                      </div>
                    </div>

                    {owned ? (
                      <Button
                        size="sm"
                        variant={equipped ? "outline" : "default"}
                        onClick={() => toggleEquip(acId)}
                        className="rounded-xl text-xs"
                      >
                        {equipped ? "Tháo" : "Đeo"}
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground dark:text-white/40">
                        <Lock className="h-3 w-3" /> Chưa mở
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Backup & Restore */}
        {activeTab === "backup" && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col justify-between rounded-2xl border border-cyan-900/10 dark:border-white/10 bg-white/85 dark:bg-white/5 p-5 shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-300 font-bold text-sm">
                  <Download className="h-4 w-4" /> Xuất Bản Sao Lưu (Export)
                </div>
                <p className="mt-2 text-xs text-muted-foreground dark:text-white/60 leading-relaxed">
                  Tải toàn bộ trạng thái nhiệm vụ, cấp thú cưng, streak và nguyên liệu thành file JSON an toàn trên máy của bạn.
                </p>
              </div>
              <Button onClick={handleExport} className="mt-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-sm">
                <FileJson className="mr-1.5 h-3.5 w-3.5" />
                Tải xuống bản sao lưu (.json)
              </Button>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-cyan-900/10 dark:border-white/10 bg-white/85 dark:bg-white/5 p-5 shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                  <Upload className="h-4 w-4" /> Khôi Phục Dữ Liệu (Import)
                </div>
                <p className="mt-2 text-xs text-muted-foreground dark:text-white/60 leading-relaxed">
                  Chọn file sao lưu JSON trước đây để nạp lại vào két sắt mà không lo mất mát dữ liệu.
                </p>
              </div>
              <label className="mt-4 flex h-9 cursor-pointer items-center justify-center rounded-xl border border-emerald-400/80 dark:border-emerald-500/40 bg-emerald-100 dark:bg-emerald-500/20 text-xs font-bold text-emerald-900 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-colors shadow-sm">
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Chọn file JSON khôi phục
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
