import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { ACCESSORIES, MOOD_META, moodOf, POMODORO_MINUTES, POMODORO_REWARD, randomLine as baseLine, type PetState, SPECIES, streakMultiplier, STREAK_GOAL } from "@/lib/tracker/gamify";
import { celebrate } from "@/lib/tracker/effects";
import { dateStr } from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";
import { BOSS_REWARD, bossHp } from "@/lib/tracker/boss";
import { ADVANCED_LINES, petTitle, petXpForLevel, TIER_BADGE, tierOf } from "@/lib/tracker/extras";
import { AmbientControl } from "./AmbientControl";
import { useFocusSky } from "./SkyExperience";
import { ting } from "@/lib/tracker/effects";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Bar({ icon, label, value, tone }: { icon: string; label: string; value: number; tone: "hunger" | "happy" }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{icon} {label}</span><span>{value}%</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all duration-700 ${tone === "hunger" ? "bg-hunger" : "bg-happy"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

const randomLine = (pet: PetState) =>
  tierOf(pet.petLevel) > 0 && Math.random() < 0.35 ? ADVANCED_LINES[Math.floor(Math.random() * ADVANCED_LINES.length)]! : baseLine(pet);

export function PetWidget() {
  const setFocus = useFocusSky();
  const { data, finishPomodoro, bossCancel } = useTracker();
  const pet = data.petState;
  const mood = moodOf(pet);
  const [bubble, setBubble] = useState<string | null>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const say = (text: string) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 3500);
  };

  // Speak when a task gets completed.
  const doneCount = data.tasks.filter((t) => t.completed).length;
  const prevDone = useRef(doneCount);
  useEffect(() => {
    if (doneCount > prevDone.current) say(randomLine(pet));
    prevDone.current = doneCount;
  }, [doneCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pomodoro with the pet (wall-clock based).
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(POMODORO_MINUTES * 60);
  const [bossActive, setBossActive] = useState(false);
  useEffect(() => {
    setFocus(endAt ? left : null);
  }, [endAt, left, setFocus]);
  useEffect(() => () => setFocus(null), [setFocus]);
  const bossRef = useRef(false);
  bossRef.current = bossActive;
  const [hit, setHit] = useState(false);
  const hp = bossHp(left, POMODORO_MINUTES * 60);
  useEffect(() => {
    if (!endAt) return;
    const iv = setInterval(() => {
      const r = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setLeft(r);
      if (r <= 0) {
        clearInterval(iv);
        setEndAt(null);
        setLeft(POMODORO_MINUTES * 60);
        const boss = bossRef.current;
        finishPomodoro(boss, POMODORO_MINUTES);
        celebrate();
        if (boss) { celebrate(); ting(true); toast.success(`⚔️ Đã hạ gục Quái Vật Xao Nhãng! +${BOSS_REWARD.catCoins} 😺 +${BOSS_REWARD.lizardGems} 🦎`); }
        else toast.success(`🍅 Xong Pomodoro cùng thú cưng! +${POMODORO_REWARD} 😺`);
        say("Giỏi quá! Mình tự hào về bạn! 🎉");
      }
    }, 500);
    return () => clearInterval(iv);
  }, [endAt, finishPomodoro]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = data.streak;
  const todayDone = s.today.date === dateStr() ? s.today.done : 0;
  const mult = streakMultiplier(s.count);
  const anim = mood === "excited" ? "animate-pet-dance" : mood === "sulky" ? "animate-pet-sulk" : mood === "hungry" ? "animate-pet-droop" : "animate-pet-idle";

  return (
    <section className="glass glass-glow p-5" data-pet-interactions>
      <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <Button type="button" variant="ghost" onClick={() => say(randomLine(pet))} className="relative mx-auto grid size-32 shrink-0 place-items-center rounded-full bg-pet-halo p-0" aria-label="Chạm vào thú cưng">
          {bubble && (
            <span className="animate-pop absolute -top-10 left-1/2 z-10 w-48 -translate-x-1/2 rounded-2xl bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg">
              {bubble}
            </span>
          )}
          <span className={`relative text-7xl leading-none ${anim}`}>
            {SPECIES[pet.species].emoji}
            {pet.accessory && <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-4xl">{ACCESSORIES[pet.accessory].emoji}</span>}
          </span>
          <span className="absolute -bottom-1 -right-1 rounded-full bg-card px-2 py-0.5 text-lg">{MOOD_META[mood].face}</span>
        </Button>

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold">{TIER_BADGE[tierOf(pet.petLevel)]} {petTitle(pet)}</h2>
            <span className="rounded-full bg-xp px-2 py-0.5 text-xs font-bold text-primary-foreground">Lv {pet.petLevel}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{MOOD_META[mood].label}</span>
          </div>
          <Bar icon="🍖" label="Độ no" value={pet.hunger} tone="hunger" />
          <Bar icon="💖" label="Hạnh phúc" value={pet.happiness} tone="happy" />
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>🧬 Tiến hóa</span><span>{pet.petXp}/{petXpForLevel(pet.petLevel)}</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-xp transition-all duration-700" style={{ width: `${Math.min(100, (pet.petXp / petXpForLevel(pet.petLevel)) * 100)}%` }} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-display text-2xl tabular-nums">{fmt(left)}</span>
            {endAt
              ? <Button size="sm" variant="secondary" onClick={() => {
                  if (bossActive) {
                    bossCancel();
                    setHit(true); setTimeout(() => setHit(false), 600);
                    toast.error("👹 Boss phản đòn! Thú cưng mất 15% hạnh phúc");
                    say("Huhu, bị Boss đánh rồi 😢");
                  }
                  setEndAt(null); setLeft(POMODORO_MINUTES * 60);
                }}>⏹ Hủy</Button>
              : <Button size="sm" onClick={() => { setEndAt(Date.now() + left * 1000); say("Cùng tập trung 25 phút nhé! 📚"); }}>🍅 Pomodoro 25p</Button>}
            <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium">
              <input type="checkbox" className="accent-[var(--destructive)]" checked={bossActive} disabled={!!endAt}
                onChange={(e) => setBossActive(e.target.checked)} />
              ⚔️ Thách đấu Boss
            </label>
          </div>
          <AmbientControl />
          {bossActive && (
            <div className={`boss-panel rounded-xl p-3 ${hit ? "animate-boss-hit" : ""}`}>
              <div className="mb-1.5 flex items-center justify-between font-mono text-xs uppercase tracking-wider">
                <span><span className={`inline-block text-2xl ${endAt ? "animate-pet-idle" : ""}`}>{hp > 0 ? "👹" : "💀"}</span> Quái Vật Xao Nhãng</span>
                <span>HP {hp}/100</span>
              </div>
              <div className="boss-hp-track h-4 overflow-hidden">
                <div className="boss-hp-fill h-full transition-all duration-500" style={{ width: `${hp}%` }} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">Thắng: x2 thưởng ({BOSS_REWARD.catCoins} 😺 + {BOSS_REWARD.lizardGems} 🦎). Bỏ cuộc: Boss phản đòn −15% 💖.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-secondary p-4 text-center">
          <div className="text-3xl">🔥</div>
          <div className="font-display text-3xl font-bold">{s.count}</div>
          <div className="text-xs text-muted-foreground">ngày streak</div>
          <div className="mt-2 rounded-full bg-xp px-2 py-0.5 text-xs font-bold text-primary-foreground">x{mult.toFixed(1)}{mult === 2 ? " MAX" : ""}</div>
          <div className="mt-2 text-xs text-muted-foreground">Hôm nay {Math.min(todayDone, STREAK_GOAL)}/{STREAK_GOAL} · 🧊 {data.inventory.freezes}</div>
        </div>
      </div>
    </section>
  );
}
