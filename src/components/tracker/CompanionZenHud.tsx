import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { RAID_HP, raidStatus } from "@/lib/tracker/quests";
import { logPetEvent } from "@/lib/tracker/petLog";
import {
  expeditionStatus,
  grantPetXp,
  petEmoji,
  petTitle,
  petXpForLevel,
  startExpedition,
  TIER_BADGE,
  tierOf,
} from "@/lib/tracker/extras";
import { moodOf, MOOD_META } from "@/lib/tracker/gamify";
import { WATER_GOAL, dateStr } from "@/lib/tracker/model";
import { requestTimerFullscreen } from "./TimerFullscreen";
import { Button } from "@/components/ui/button";

interface Props {
  onSelectTask?: (id: string) => void;
}

export function CompanionZenHud({ onSelectTask }: Props) {
  const { data, update, timer, startTimer, pauseTimer, drinkWater } = useTracker();
  const activeTaskId = timer?.taskId ?? null;
  const today = dateStr();
  const focusToday = data.dailyStats[today]?.focusMin ?? 0;
  const pet = data.petState;
  const game = data.game;
  const mood = moodOf(pet);
  const moodMeta = MOOD_META[mood];
  const tier = tierOf(pet.petLevel || 1);
  const tierBadge = TIER_BADGE[tier];
  const neededXp = petXpForLevel(pet.petLevel || 1);
  const xpPercent = Math.min(100, Math.round(((pet.petXp || 0) / neededXp) * 100));

  // Focus timer task
  const activeTask = data.tasks.find((t) => t.id === activeTaskId);
  const nextTask = activeTask ?? data.tasks.find((t) => !t.completed && t.minutes > 0);
  const nextSecs =
    activeTaskId === nextTask?.id
      ? (timer?.remaining ?? nextTask?.remainingSeconds) || (nextTask ? nextTask.minutes * 60 : 0)
      : nextTask?.remainingSeconds || (nextTask ? nextTask.minutes * 60 : 0);

  // Expedition status
  const exp = expeditionStatus(data.expedition, focusToday);
  const canStart = exp.ready && !exp.away && exp.tripsToday < exp.limit;

  // Boss status
  const raid = raidStatus(data.dailyStats, today, data.raid);
  const bossPercent = Math.max(0, Math.min(100, Math.round((raid.hpLeft / RAID_HP) * 100)));

  const handleStartExpedition = () => {
    if (!canStart) {
      toast.error("Chưa đủ phút tập trung để thám hiểm.");
      return;
    }
    update((d) => {
      const nextExp = startExpedition(d.expedition, focusToday);
      if (nextExp === d.expedition) return d;
      return logPetEvent(
        { ...d, expedition: nextExp },
        "expedition",
        `🧭 ${petTitle(d.petState)} lên đường thám hiểm — hẹn trở lại sau 30 phút!`,
      );
    });
    toast.success("Pet đã lên đường thám hiểm! 🧭");
  };

  const handleFeedPet = () => {
    if (game.catCoins < 10) {
      toast.error("Cần 10 😺 để cho pet ăn. Hãy làm thêm nhiệm vụ!");
      return;
    }
    update((d) => {
      const p = d.petState;
      const fed = {
        ...p,
        hunger: Math.min(100, p.hunger + 30),
        happiness: Math.min(100, p.happiness + 20),
      };
      return {
        ...d,
        game: { ...d.game, catCoins: d.game.catCoins - 10 },
        petState: grantPetXp(fed, 25).pet,
      };
    });
    toast.success("Đã cho pet ăn no nê! 🍖 (+25 XP)");
  };

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-transparent">
      {/* Pinned Top Header - aligned with middle pane header */}
      <div className="flex min-h-[61px] items-center justify-between border-b border-border/60 bg-card/40 px-4 py-3.5 backdrop-blur-md">
        <span
          className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          title="Đồng hành & Góc tập trung"
        >
          Đồng hành & Tập trung
        </span>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
          Lv.{pet.petLevel || 1} {tierBadge}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Pet Card */}
        <div className="rounded-2xl border border-border/80 bg-background/80 p-3.5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-3xl shadow-inner">
              <span>{petEmoji(pet)}</span>
              <span className="absolute -bottom-1 -right-1 text-xs" title={moodMeta.label}>
                {moodMeta.face}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-sm">{pet.petName || "Pet cưng"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{petTitle(pet)}</p>
              {/* XP bar */}
              <div className="mt-1.5 space-y-0.5">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>XP</span>
                  <span>
                    {pet.petXp || 0}/{neededXp}
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
                    {Math.floor(nextSecs / 60)}:{String(nextSecs % 60).padStart(2, "0")}
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
              <span className="text-[11px] text-muted-foreground">
                {exp.tripsToday}/{exp.limit} chuyến
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Tiến độ focus</span>
                <span>
                  {exp.haveMinutes}/{exp.needMinutes}p
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.round((exp.haveMinutes / exp.needMinutes) * 100))}%`,
                  }}
                />
              </div>
            </div>

            <Button
              size="sm"
              variant={canStart ? "default" : "outline"}
              disabled={!canStart}
              className="w-full h-7 text-[11px]"
              onClick={handleStartExpedition}
            >
              {canStart
                ? "🧭 Khởi hành ngay"
                : `Cần thêm ${Math.max(0, exp.needMinutes - exp.haveMinutes)}p focus`}
            </Button>
          </div>

          {/* Weekly Boss */}
          <div className="rounded-2xl border border-border/80 bg-background/80 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-1">
                <span>⚔️ Boss tuần</span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {raid.hpLeft}/{RAID_HP} HP
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
      </div>
    </aside>
  );
}
