import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { BOSS_MAX_HP, bossHp } from "@/lib/tracker/boss";
import {
  expeditionStatus,
  petEmoji,
  petTitle,
  petXpForLevel,
  startExpedition,
  TIER_BADGE,
  tierOf,
} from "@/lib/tracker/extras";
import { moodOf, MOOD_META } from "@/lib/tracker/gamify";
import { WATER_GOAL } from "@/lib/tracker/model";
import { requestTimerFullscreen } from "./TimerFullscreen";
import { Button } from "@/components/ui/button";

interface Props {
  onSelectTask?: (id: string) => void;
}

export function CompanionZenHud({ onSelectTask }: Props) {
  const { data, update, activeTaskId, startTimer, pauseTimer, drinkWater } = useTracker();
  const pet = data.pet;
  const game = data.game;
  const mood = moodOf(pet);
  const moodMeta = MOOD_META[mood];
  const tier = tierOf(pet.level);
  const tierBadge = TIER_BADGE[tier];
  const neededXp = petXpForLevel(pet.level);
  const xpPercent = Math.min(100, Math.round((pet.xp / neededXp) * 100));

  // Focus timer task
  const activeTask = data.tasks.find((t) => t.id === activeTaskId);
  const nextTask = activeTask ?? data.tasks.find((t) => !t.completed && t.minutes > 0);

  // Expedition status
  const exp = expeditionStatus(data);

  // Boss status
  const boss = bossHp(data);
  const bossPercent = Math.max(0, Math.min(100, Math.round((boss.hp / BOSS_MAX_HP) * 100)));

  const handleStartExpedition = () => {
    const res = startExpedition(data);
    if (!res.ok) {
      toast.error(res.reason);
      return;
    }
    update(() => res.data);
    toast.success("Pet đã lên đường thám hiểm! 🧭");
  };

  const handleFeedPet = () => {
    if (game.inventory.catTreats <= 0 && game.catCoins < 10) {
      toast.error("Bạn không có đồ ăn cho pet. Hãy ghé Cửa hàng!");
      return;
    }
    update((d) => {
      const treats = d.game.inventory.catTreats;
      const coins = d.game.catCoins;
      const newTreats = treats > 0 ? treats - 1 : 0;
      const newCoins = treats > 0 ? coins : Math.max(0, coins - 10);
      const newHunger = Math.min(100, d.pet.hunger + 30);
      const newHappy = Math.min(100, d.pet.happiness + 20);
      return {
        ...d,
        game: {
          ...d.game,
          catCoins: newCoins,
          inventory: { ...d.game.inventory, catTreats: newTreats },
        },
        pet: {
          ...d.pet,
          hunger: newHunger,
          happiness: newHappy,
          xp: d.pet.xp + 25,
        },
      };
    });
    toast.success("Đã cho pet ăn no nê! 🍖 (+25 XP)");
  };

  return (
    <aside className="flex h-full flex-col border-l border-border bg-card/60 p-4 backdrop-blur-md space-y-4 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Bạn đồng hành & Góc tập trung
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
          Lv.{pet.level} {tierBadge}
        </span>
      </div>

      {/* Pet Card */}
      <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-3xl shadow-inner">
            <span>{petEmoji(pet.species, pet.level)}</span>
            <span className="absolute -bottom-1 -right-1 text-xs" title={moodMeta.label}>
              {moodMeta.emoji}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-sm">{data.settings.petName || "Pet cưng"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {petTitle(pet.species, pet.level)}
            </p>
            {/* XP bar */}
            <div className="mt-1.5 space-y-0.5">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>XP</span>
                <span>
                  {pet.xp}/{neededXp}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Pet Stats & Quick Feed */}
        <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
          <div className="flex gap-2 text-[11px]">
            <span title="Độ no">🍖 {pet.hunger}%</span>
            <span title="Độ vui vẻ">💖 {pet.happiness}%</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] px-2"
            onClick={handleFeedPet}
          >
            🍖 Cho ăn
          </Button>
        </div>
      </div>

      {/* Mini Focus Controller */}
      <div className="rounded-2xl border border-border/80 bg-secondary/15 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold flex items-center gap-1.5">
            <span>⏱️ Phiên tập trung</span>
          </span>
          {activeTask && (
            <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse" />
          )}
        </div>

        {nextTask ? (
          <div className="space-y-2">
            <div
              className="rounded-xl border border-border/60 bg-background/80 p-2 text-xs cursor-pointer hover:border-primary transition"
              onClick={() => onSelectTask?.(nextTask.id)}
            >
              <p className="font-semibold truncate">{nextTask.title}</p>
              <div className="flex justify-between text-[11px] text-muted-foreground mt-0.5">
                <span>{nextTask.subject ? `📚 ${nextTask.subject}` : "Tự do"}</span>
                <span className="font-mono font-bold text-foreground">
                  {Math.floor(nextTask.remainingSeconds / 60)}:
                  {String(nextTask.remainingSeconds % 60).padStart(2, "0")}
                </span>
              </div>
            </div>

            <div className="flex gap-1.5">
              {activeTaskId === nextTask.id ? (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1 h-8 text-xs"
                    onClick={pauseTimer}
                  >
                    ⏸ Dừng
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs px-2.5"
                    onClick={requestTimerFullscreen}
                  >
                    ⛶ Toàn màn
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={() => startTimer(nextTask.id)}
                >
                  ▶ Bắt đầu ({nextTask.minutes}p)
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-1 text-center">
            Chưa có nhiệm vụ hẹn giờ nào hôm nay.
          </p>
        )}
      </div>

      {/* Water Tracking Card */}
      <div className="rounded-2xl border border-border/80 bg-card/40 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold flex items-center gap-1">
            <span>💧 Uống nước</span>
          </span>
          <span className="text-muted-foreground font-mono font-semibold">
            {game.water.cups}/{WATER_GOAL} ly
          </span>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: WATER_GOAL }, (_, i) => {
            const filled = i < game.water.cups;
            return (
              <button
                key={i}
                type="button"
                onClick={drinkWater}
                className={`flex h-7 items-center justify-center rounded-lg border text-sm transition ${
                  filled
                    ? "border-blue-500/40 bg-blue-500/20 text-blue-500 shadow-sm"
                    : "border-border/60 bg-muted/20 opacity-40 hover:opacity-100"
                }`}
                title={`Uống ly nước thứ ${i + 1}`}
              >
                💧
              </button>
            );
          })}
        </div>
      </div>

      {/* Expedition & Raid Boss Progress */}
      <div className="space-y-2.5 pt-1">
        {/* Expedition */}
        <div className="rounded-2xl border border-border/80 bg-background/80 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1">
              <span>🧭 Thám hiểm</span>
            </span>
            <span className="text-[11px] text-muted-foreground">{exp.tripsToday}/3 chuyến</span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Tiến độ focus</span>
              <span>
                {exp.focusMinutesToday}/{exp.thresholdMinutes}p
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((exp.focusMinutesToday / exp.thresholdMinutes) * 100),
                  )}%`,
                }}
              />
            </div>
          </div>

          <Button
            size="sm"
            variant={exp.canStart ? "default" : "outline"}
            disabled={!exp.canStart}
            className="w-full h-7 text-[11px]"
            onClick={handleStartExpedition}
          >
            {exp.canStart
              ? "🧭 Khởi hành ngay"
              : `Cần thêm ${Math.max(0, exp.thresholdMinutes - exp.focusMinutesToday)}p focus`}
          </Button>
        </div>

        {/* Weekly Boss */}
        <div className="rounded-2xl border border-border/80 bg-background/80 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1">
              <span>⚔️ Boss tuần</span>
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              {boss.hp}/{BOSS_MAX_HP} HP
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-destructive transition-all duration-300"
              style={{ width: `${bossPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-0.5">
            Mỗi phút học tập và hoàn thành việc sẽ gây sát thương lên boss.
          </p>
        </div>
      </div>
    </aside>
  );
}
