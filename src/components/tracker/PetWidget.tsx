import { BreathWidget } from "@/components/tracker/BreathWidget";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { recordInterruption } from "@/lib/tracker/model";
import {
  ACCESSORIES,
  ACCESSORY_SLOT,
  ACCESSORY_UI,
  DECORATIONS,
  MOOD_META,
  moodOf,
  POMODORO_REWARD,
  randomLine as baseLine,
  toggleDecor,
  toggleRestDay,
  type PetState,
  SPECIES,
  streakMultiplier,
  STREAK_GOAL,
} from "@/lib/tracker/gamify";
import { StudyRoom3D } from "./StudyRoom3D";
import { ExpeditionScene } from "./ExpeditionScene";
import { JournalModal } from "./JournalModal";
import { onPomodoroRequest } from "@/lib/tracker/pomodoroBus";
import { loadSession, saveSession } from "@/lib/tracker/sessionPersist";
import { celebrate } from "@/lib/tracker/effects";
import { logPetEvent, petLogEmoji } from "@/lib/tracker/petLog";
import { dateStr, POMODORO_PRESETS } from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BOSS_MAX_HP,
  BOSS_REWARD,
  DAILY_BOSS_TASK_DAMAGE,
  bossHp,
  dailyBossHpLeft,
} from "@/lib/tracker/boss";
import {
  ADVANCED_LINES,
  expeditionStatus,
  petEmoji,
  petTitle,
  petXpForLevel,
  startExpedition,
  TIER_BADGE,
  tierOf,
} from "@/lib/tracker/extras";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmbientControl } from "./AmbientControl";
import { FocusMode } from "./FocusMode";
import { useFocusSky } from "./SkyExperience";
import { publishHud } from "@/lib/tracker/hudBus";
import { fireFlashbang } from "./Flashbang";
import { ting } from "@/lib/tracker/effects";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Bar({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone: "hunger" | "happy";
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>
          {icon} {label}
        </span>
        <span>{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${tone === "hunger" ? "bg-hunger" : "bg-happy"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

const randomLine = (pet: PetState) =>
  tierOf(pet.petLevel) > 0 && Math.random() < 0.35
    ? ADVANCED_LINES[Math.floor(Math.random() * ADVANCED_LINES.length)]!
    : baseLine(pet);

export function PetWidget() {
  const setFocus = useFocusSky();
  const { data, finishPomodoro, bossCancel, update } = useTracker();

  // Expedition compass: each trip costs 50 × (trips taken today + 1) focus
  // minutes, up to 3 trips per day; pressing it sends the pet exploring
  // (3D room becomes the 2D scene).
  const expFocusToday = data.dailyStats[dateStr()]?.focusMin ?? 0;
  const exp = expeditionStatus(data.expedition, expFocusToday, new Date());
  const expRunning = !!data.expedition.endAt;
  const expTip = exp.away
    ? "🧭 Pet đang thám hiểm…"
    : exp.usedToday
      ? `🧭 Pet đã đi đủ ${exp.limit} chuyến hôm nay rồi`
      : exp.ready
        ? `🧭 Sẵn sàng! Chuyến ${exp.tripsToday + 1}/${exp.limit} — bấm cho pet lên đường`
        : `🧭 Chuyến ${exp.tripsToday + 1}/${exp.limit}: cần ${exp.needMinutes} phút tập trung nữa (hiện có ${exp.haveMinutes})`;
  const startExpeditionNow = () => {
    update((d) => {
      const ft = d.dailyStats[dateStr()]?.focusMin ?? 0;
      const next = startExpedition(d.expedition, ft, new Date());
      if (next === d.expedition) return d;
      ting();
      toast.success("🧭 Pet lên đường thám hiểm! 30 phút nữa sẽ trở về.");
      // The pet writes its own departure into the journal.
      return logPetEvent(
        { ...d, expedition: next },
        "expedition",
        `🧭 ${petTitle(pet)} lên đường thám hiểm — hẹn trở lại sau 30 phút!`,
      );
    });
  };
  const pet = data.petState;
  const petForm = petEmoji(pet);
  const mood = moodOf(pet);
  const pomodoroMinutes = data.settings.pomodoroMinutes;
  const breakMinutes = data.settings.breakMinutes;
  const autoBreak = data.settings.autoBreak;
  const presetOptions = [...POMODORO_PRESETS, ...data.settings.customPresets];
  const [customMin, setCustomMin] = useState("");
  const applyCustomPreset = () => {
    const m = Math.round(Number(customMin));
    if (!Number.isFinite(m) || m < 1 || m > 180) {
      toast.error("Nhập số phút từ 1 đến 180 nhé!");
      return;
    }
    update((d) => ({
      ...d,
      settings: {
        ...d.settings,
        pomodoroMinutes: m,
        customPresets:
          POMODORO_PRESETS.includes(m as (typeof POMODORO_PRESETS)[number]) ||
          d.settings.customPresets.includes(m)
            ? d.settings.customPresets
            : [...d.settings.customPresets, m].slice(0, 4),
      },
    }));
    setCustomMin("");
    toast.success(`Đã lưu phiên học ${m} phút 🍅`);
  };
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

  // Cards elsewhere (e.g. the timetable slot card) can ask for a Pomodoro here.
  useEffect(() => {
    return onPomodoroRequest(({ minutes, label }) => {
      setEndAt((cur) => {
        if (cur) {
          toast("⏳ Đang có phiên tập trung rồi — hoàn thành đi đã!");
          return cur;
        }
        setWarmup(false);
        setLeft(minutes * 60);
        sessionMinRef.current = minutes;
        setZen(true);
        say(`Học "${label}" ${minutes} phút thôi! 📚`);
        toast(`🍅 Bắt đầu ${minutes}p cho "${label}"`);
        return Date.now() + minutes * 60_000;
      });
    });
  }, []);

  // Pomodoro with the pet (wall-clock based). Restored from localStorage so a
  // session or auto-break survives switching tabs (this widget unmounts there).
  const [restored] = useState(loadSession);
  const [endAt, setEndAt] = useState<number | null>(restored.endAt);
  // Planned length of the running session — kept across reloads so a preset
  // change mid-session can't falsify the logged minutes.
  const sessionMinRef = useRef<number | null>(restored.endAt ? restored.minutes : null);
  const [left, setLeft] = useState(() =>
    restored.endAt
      ? Math.max(0, Math.ceil((restored.endAt - Date.now()) / 1000))
      : pomodoroMinutes * 60,
  );
  const [petLogOpen, setPetLogOpen] = useState(false);
  const [bossActive, setBossActive] = useState(false);
  const [zen, setZen] = useState(false);
  const [warmup, setWarmup] = useState(restored.warmup); // 5-minute anti-procrastination session
  const warmupRef = useRef(false);
  warmupRef.current = warmup;
  const [breakEndAt, setBreakEndAt] = useState<number | null>(restored.breakEndAt);
  const [breakLeft, setBreakLeft] = useState(() =>
    restored.breakEndAt
      ? Math.max(0, Math.ceil((restored.breakEndAt - Date.now()) / 1000))
      : breakMinutes * 60,
  );
  const [journalOpen, setJournalOpen] = useState(false);
  useEffect(() => {
    if (!endAt) setLeft(pomodoroMinutes * 60);
  }, [endAt, pomodoroMinutes]);
  useEffect(() => {
    if (!breakEndAt) setBreakLeft(breakMinutes * 60);
  }, [breakEndAt, breakMinutes]);
  // Keep the session/break alive across tab switches: this widget unmounts on
  // inactive tabs, so the wall-clock deadlines are saved to localStorage.
  useEffect(() => {
    saveSession(endAt, breakEndAt, warmup, sessionMinRef.current, strikesRef.current);
  }, [endAt, breakEndAt, warmup]);
  useEffect(() => {
    setFocus(endAt ? left : null);
  }, [endAt, left, setFocus]);
  useEffect(() => () => setFocus(null), [setFocus]);
  const bossRef = useRef(false);
  bossRef.current = bossActive;
  const [hit, setHit] = useState(false);
  const [strikes, setStrikes] = useState(0); // "phá đò" escapes in this session
  const strikesRef = useRef(0);
  const endAtRef = useRef(endAt);
  endAtRef.current = endAt;
  const breakEndAtRef = useRef(breakEndAt);
  breakEndAtRef.current = breakEndAt;
  const hp = bossHp(left, pomodoroMinutes * 60);
  const today = dateStr();
  const tasksToday = data.dailyStats[today]?.tasks ?? 0;
  const bossTaskHp = dailyBossHpLeft(data.dailyBoss, today, tasksToday);
  // The HP bar shows the worst of both: the running session AND damage already dealt by tasks.
  const shownHp = Math.min(hp, bossTaskHp);
  // Fresh session (a new endAt) starts with a clean break-in counter; a
  // reloaded session keeps the strikes it already collected (restored below).
  useEffect(() => {
    if (endAt && endAt !== restored.endAt) {
      strikesRef.current = 0;
      setStrikes(0);
    }
  }, [endAt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reload keeps the session — and its break-in count.
  const strikesRestored = useRef(false);
  useEffect(() => {
    if (strikesRestored.current) return;
    strikesRestored.current = true;
    if (restored.endAt && restored.strikes > 0) {
      strikesRef.current = restored.strikes;
      setStrikes(restored.strikes);
    }
  }, []);
  // Phá đò: catch tab escapes while a Pomodoro is running.
  useEffect(() => {
    const onHide = () => {
      if (!document.hidden || !endAtRef.current) return;
      strikesRef.current += 1;
      setStrikes(strikesRef.current);
      update((d) => recordInterruption(d, null)); // feed the distraction chart
      fireFlashbang("breakin");
      if (strikesRef.current >= 3)
        toast.error("🚨 Phá đò 3 lần — phiên này sẽ không được tính thưởng!");
      else toast(`🚨 Phá đò lần ${strikesRef.current}/3 — quay lại tập trung đi!`);
      say(strikesRef.current >= 3 ? "Ngồi yên đi mà… 😤" : "Ê, đang học mà! 👀");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);
  useEffect(() => {
    if (!endAt) return;
    const iv = setInterval(() => {
      const r = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setLeft(r);
      if (r <= 0) {
        clearInterval(iv);
        setEndAt(null);
        setLeft(pomodoroMinutes * 60);
        setWarmup(false);
        const wasWarmup = warmupRef.current;
        const plannedMin = wasWarmup
          ? 5
          : (sessionMinRef.current ?? restored.minutes ?? pomodoroMinutes);
        sessionMinRef.current = null;
        const boss = bossRef.current && !wasWarmup;
        if (strikesRef.current >= 3) {
          toast.error("🚨 Phá đò 3 lần — phiên này không được tính, thử lại nhé!");
          say("Lần này tập trung thật nhé… 😤");
        } else {
          const res = finishPomodoro(
            boss,
            plannedMin,
            wasWarmup ? "warmup" : "pomodoro",
            strikesRef.current,
          );
          celebrate();
          fireFlashbang("done");
          if (wasWarmup) {
            toast.success("🚀 Xong 5 phút — bạn đã vào việc rồi đó!");
            say("Mình biết bạn làm được mà! 🚀");
          } else if (boss) {
            celebrate();
            ting(true);
            if (res.bossDue) {
              toast.success(
                `⚔️ Đã hạ gục Quái Vật Xao Nhãng! +${BOSS_REWARD.catCoins} 😺 +${BOSS_REWARD.lizardGems} 🦎`,
              );
            } else {
              toast("⚔️ Boss hôm nay đã gục nhờ nhiệm vụ rồi — phiên này nhận thưởng thường 🍅");
            }
            if (autoBreak && breakMinutes > 0) setBreakEndAt(Date.now() + breakMinutes * 60_000);
          } else {
            toast.success(`🍅 Xong phiên học cùng thú cưng! +${POMODORO_REWARD} 😺`);
            if (autoBreak && breakMinutes > 0) setBreakEndAt(Date.now() + breakMinutes * 60_000);
          }
          say("Giỏi quá! Mình tự hào về bạn! 🎉");
        }
      }
    }, 500);
    return () => clearInterval(iv);
  }, [endAt, finishPomodoro, pomodoroMinutes, autoBreak, breakMinutes]);

  // Auto-break countdown after a finished Pomodoro.
  useEffect(() => {
    if (!breakEndAt) return;
    const iv = setInterval(() => {
      const r = Math.max(0, Math.ceil((breakEndAt - Date.now()) / 1000));
      setBreakLeft(r);
      if (r <= 0) {
        clearInterval(iv);
        setBreakEndAt(null);
        ting();
        toast("☕ Hết giờ nghỉ — quay lại thôi!");
        say("Nghỉ xong rồi, làm tiếp nhé! 💪");
      }
    }, 500);
    return () => clearInterval(iv);
  }, [breakEndAt]);

  // Timed tasks (e.g. "Học bài 25p") finished by the clock in the store ask for
  // the same auto-break the pet Pomodoro gets — skip when already busy.
  useEffect(() => {
    const onStartBreak = () => {
      if (endAtRef.current || breakEndAtRef.current) return;
      setBreakEndAt(Date.now() + breakMinutes * 60_000);
      say(`☕ Xong việc rồi, nghỉ ${breakMinutes} phút nè!`);
    };
    window.addEventListener("pp-auto-break", onStartBreak);
    return () => window.removeEventListener("pp-auto-break", onStartBreak);
  }, [breakMinutes]);

  // Feed the Tab Title HUD with the live Pomodoro state.
  useEffect(() => {
    publishHud({
      running: !!endAt,
      remaining: breakEndAt ? breakLeft : left,
      boss: bossActive,
      onBreak: !!breakEndAt,
      strikes,
    });
  }, [endAt, left, breakEndAt, breakLeft, bossActive, strikes]);

  const s = data.streak;
  const todayDone = s.today.date === dateStr() ? s.today.done : 0;
  const mult = streakMultiplier(s.count);
  const anim =
    mood === "excited"
      ? "animate-pet-dance"
      : mood === "sulky"
        ? "animate-pet-sulk"
        : mood === "hungry"
          ? "animate-pet-droop"
          : "animate-pet-idle";

  return (
    <section className="glass glass-glow p-5" data-pet-interactions>
      <JournalModal open={journalOpen} onClose={() => setJournalOpen(false)} />
      <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
        <div className="mx-auto w-fit">
          <Button
            type="button"
            variant="ghost"
            onClick={() => say(randomLine(pet))}
            className="relative mx-auto grid size-32 shrink-0 place-items-center rounded-full bg-pet-halo p-0"
            aria-label="Chạm vào thú cưng"
          >
            {bubble && (
              <span className="animate-pop absolute -top-10 left-1/2 z-10 w-48 -translate-x-1/2 rounded-2xl bg-popover px-3 py-2 text-xs font-medium text-popover-foreground shadow-lg">
                {bubble}
              </span>
            )}
            <span className={`relative block text-7xl leading-none ${anim}`}>
              {pet.accessories.back && (
                <span className={`absolute ${ACCESSORY_UI.back[pet.species]}`} aria-hidden>
                  {ACCESSORIES[pet.accessories.back].emoji}
                </span>
              )}
              <span className="relative">{petForm}</span>
              {(["head", "face"] as const).map((slot) =>
                pet.accessories[slot] ? (
                  <span key={slot} className={`absolute ${ACCESSORY_UI[slot][pet.species]}`}>
                    {ACCESSORIES[pet.accessories[slot]!].emoji}
                  </span>
                ) : null,
              )}
            </span>
            <span className="absolute -bottom-1.5 -right-1.5 flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-lg shadow-sm backdrop-blur-md">
              <span className="text-[10px] font-semibold leading-none text-foreground/85">
                {MOOD_META[mood].label}
              </span>
              {MOOD_META[mood].face}
            </span>
          </Button>
          <div
            className="mt-2 overflow-hidden rounded-xl border bg-gradient-to-b from-secondary/70 to-accent/70"
            aria-label="Góc học của thú cưng"
            title="Góc học — bấm một món để cất vào kho (kệ sách có bí mật nhỏ 👀)"
          >
            {expRunning ? (
              <ExpeditionScene
                petEmoji={petForm}
                endAt={data.expedition.endAt!}
                batterySaver={data.settings.batterySaver}
                wings={data.petState.accessories.back === "wings"}
              />
            ) : (
              <StudyRoom3D
                decor={pet.decorActive}
                petEmoji={petForm}
                petEvolving={tierOf(pet.petLevel || 1) === 1}
                batterySaver={data.settings.batterySaver}
                onShelfClick={() => setJournalOpen(true)}
                onStow={(id) =>
                  update((d) => {
                    const r = toggleDecor(d.petState, id);
                    if (r && !r.placed && !r.pet.decorActive.includes(id)) {
                      toast("🏠 Đã bày đủ tất cả các món!");
                    }
                    return r ? { ...d, petState: r.pet } : d;
                  })
                }
              />
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold">
              {TIER_BADGE[tierOf(pet.petLevel)]} {petTitle(pet)}
            </h2>
            <span className="rounded-full bg-xp px-2 py-0.5 text-xs font-bold text-primary-foreground">
              Lv {pet.petLevel}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
              {MOOD_META[mood].label}
            </span>
            <PetName
              pet={pet}
              onRename={(v) =>
                update((d) => {
                  const { petName: _p, ...petRest } = d.petState;
                  return {
                    ...d,
                    petState: { ...petRest, ...(v ? { petName: v } : {}) },
                  };
                })
              }
            />
            {data.expedition.endAt && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                🧭 {SPECIES[pet.species].name} đang thám hiểm…
              </span>
            )}
          </div>
          <Bar icon="🍖" label="Độ no" value={pet.hunger} tone="hunger" />
          <Bar icon="💖" label="Hạnh phúc" value={pet.happiness} tone="happy" />
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>🧬 Tiến hóa</span>
              <span>
                {pet.petXp}/{petXpForLevel(pet.petLevel)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-xp transition-all duration-700"
                style={{
                  width: `${Math.min(100, (pet.petXp / petXpForLevel(pet.petLevel)) * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {breakEndAt ? (
              <span className="font-display text-2xl tabular-nums text-hunger">
                ☕ {fmt(breakLeft)}
              </span>
            ) : (
              <span className="font-display text-2xl tabular-nums">{fmt(left)}</span>
            )}
            {endAt && (
              <Button
                size="sm"
                variant="ghost"
                aria-label="Vào chế độ tập trung toàn màn hình"
                title="Ẩn mọi thứ, chỉ còn đồng hồ và thú cưng"
                onClick={() => setZen(true)}
              >
                🧘 Zen
              </Button>
            )}
            {endAt ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (bossActive) {
                    bossCancel();
                    setHit(true);
                    setTimeout(() => setHit(false), 600);
                    toast.error("👹 Boss phản đòn! Thú cưng mất 8 hạnh phúc");
                    say("Huhu, bị Boss đánh rồi 😢");
                  }
                  setEndAt(null);
                  setLeft(pomodoroMinutes * 60);
                  setWarmup(false);
                }}
              >
                ⏹ Hủy
              </Button>
            ) : breakEndAt ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setBreakEndAt(null);
                  toast("⏭ Đã bỏ qua giờ nghỉ");
                }}
              >
                ⏭ Bỏ qua nghỉ
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    sessionMinRef.current = pomodoroMinutes;
                    setEndAt(Date.now() + left * 1000);
                    say(`Cùng tập trung ${pomodoroMinutes} phút nhé! 📚`);
                  }}
                >{`🍅 Tập trung ${pomodoroMinutes}p`}</Button>
                <Button
                  size="sm"
                  variant="secondary"
                  title="Chỉ cam kết 5 phút — thường là đủ để bắt đầu"
                  onClick={() => {
                    setWarmup(true);
                    sessionMinRef.current = 5;
                    setEndAt(Date.now() + 5 * 60 * 1000);
                    say("Chỉ 5 phút thôi! Vào việc nào 🚀");
                  }}
                >
                  🚀 5p thôi
                </Button>
              </>
            )}
            <Select
              value={String(pomodoroMinutes)}
              onValueChange={(value) =>
                update((d) => ({
                  ...d,
                  settings: { ...d.settings, pomodoroMinutes: Number(value) },
                }))
              }
              disabled={!!endAt || !!breakEndAt}
            >
              <SelectTrigger className="h-8 w-[110px]">
                <SelectValue placeholder="Thời lượng" />
              </SelectTrigger>
              <SelectContent>
                {[
                  ...presetOptions,
                  ...(presetOptions.includes(pomodoroMinutes) ? [] : [pomodoroMinutes]),
                ]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} phút
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={180}
              className="h-8 w-20"
              placeholder="Tuỳ ý"
              aria-label="Phút tuỳ chỉnh"
              value={customMin}
              disabled={!!endAt || !!breakEndAt}
              onChange={(e) => setCustomMin(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyCustomPreset()}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              disabled={!!endAt || !!breakEndAt}
              onClick={applyCustomPreset}
            >
              Lưu
            </Button>
            <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                className="accent-[var(--destructive)]"
                checked={bossActive}
                disabled={!!endAt || !!breakEndAt}
                onChange={(e) => setBossActive(e.target.checked)}
              />
              ⚔️ Thách đấu Boss
              <span className="sr-only">
                (Nhiệm vụ hoàn thành hôm nay cũng gây sát thương Boss: 5 nhiệm vụ = hạ Boss)
              </span>
            </label>
            <div className="exp-compass group relative ml-auto">
              <Button
                size="sm"
                variant={exp.ready ? "secondary" : "ghost"}
                className="h-8 px-2 text-base"
                disabled={!exp.ready || !!endAt || !!breakEndAt}
                aria-label={expTip}
                title={expTip}
                onClick={startExpeditionNow}
              >
                🧭
              </Button>
              <span
                className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 hidden w-max max-w-56 rounded-lg bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-md group-hover:block group-focus-within:block"
                role="tooltip"
              >
                {expTip}
              </span>
            </div>
            {breakEndAt && <BreathWidget compact />}
          </div>
          <AmbientControl />
          {bossActive && (
            <div className={`boss-panel rounded-xl p-3 ${hit ? "animate-boss-hit" : ""}`}>
              <div className="mb-1.5 flex items-center justify-between font-mono text-xs uppercase tracking-wider">
                <span>
                  <span className={`inline-block text-2xl ${endAt ? "animate-pet-idle" : ""}`}>
                    {shownHp > 0 ? "👹" : "💀"}
                  </span>{" "}
                  Quái Vật Xao Nhãng
                </span>
                <span>
                  HP {shownHp}/{BOSS_MAX_HP}
                </span>
              </div>
              <div className="boss-hp-track h-4 overflow-hidden">
                <div
                  className="boss-hp-fill h-full transition-all duration-500"
                  style={{ width: `${shownHp}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Thắng: x2 thưởng ({BOSS_REWARD.catCoins} 😺 + {BOSS_REWARD.lizardGems} 🦎). Bỏ cuộc:
                Boss phản đòn −8 💖.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                🗡 Nhiệm vụ hôm nay cũng bắn Boss:{" "}
                {Math.min(BOSS_MAX_HP, tasksToday * DAILY_BOSS_TASK_DAMAGE)}/{BOSS_MAX_HP} HP
                {bossTaskHp === 0
                  ? " — Boss đã gục! 💀"
                  : ` (còn cần ${Math.ceil(bossTaskHp / DAILY_BOSS_TASK_DAMAGE)} nhiệm vụ)`}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/50 p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setPetLogOpen((v) => !v)}
          >
            <span>📖 Nhật ký của {petTitle(pet)}</span>
            <span>{petLogOpen ? "▾" : "▸"}</span>
          </button>
          {petLogOpen && (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-left">
              {data.petLog.length === 0 && (
                <li className="text-xs text-muted-foreground">
                  Chưa có gì — pet sẽ tự ghi lại khi lên cấp, hạ boss, đi thám hiểm, được cho ăn…
                </li>
              )}
              {data.petLog.map((e) => (
                <li key={e.id} className="flex items-start gap-1.5 text-xs">
                  <span aria-hidden>{petLogEmoji(e.kind)}</span>
                  <span className="min-w-0 flex-1">{e.text}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(e.at).toLocaleDateString("vi-VN", { month: "short", day: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-secondary p-4 text-center">
          <div className="text-3xl">🔥</div>
          <div className="font-display text-3xl font-bold">{s.count}</div>
          <div className="text-xs text-muted-foreground">ngày streak</div>
          <div className="mt-2 rounded-full bg-xp px-2 py-0.5 text-xs font-bold text-primary-foreground">
            x{mult.toFixed(1)}
            {mult === 2 ? " MAX" : ""}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Hôm nay {Math.min(todayDone, STREAK_GOAL)}/{STREAK_GOAL} · 🧊 {data.inventory.freezes}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1 h-7 text-xs"
            title="Ngày mệt/bận: bấm vào đây là streak không bị mất (kể cả hôm sau)"
            onClick={() =>
              update((d) => {
                if (d.streak.lastQualifiedDate === dateStr()) {
                  toast(
                    "Hôm nay đã đủ " + STREAK_GOAL + " nhiệm vụ — streak vẫn giữ, khỏi cần nghỉ 😎",
                  );
                  return d;
                }
                const ns = toggleRestDay(d.streak, dateStr());
                if (
                  ns &&
                  ns.restDates.includes(dateStr()) !==
                    (d.streak.restDates ?? []).includes(dateStr())
                ) {
                  toast(
                    ns.restDates.includes(dateStr())
                      ? "🌙 Đã đánh dấu hôm nay là ngày nghỉ"
                      : "☀️ Đã bỏ đánh dấu ngày nghỉ",
                  );
                }
                return ns ? { ...d, streak: ns } : d;
              })
            }
          >
            {(data.streak.restDates ?? []).includes(dateStr())
              ? "🌙 Bỏ nghỉ hôm nay"
              : "🌙 Hôm nay nghỉ"}
          </Button>
        </div>
      </div>
      <FocusMode
        open={zen}
        left={left}
        running={!!endAt}
        pet={pet}
        bossActive={bossActive}
        bossHpPct={shownHp}
        strikes={strikes}
        onBreak={!!breakEndAt}
        breakLeft={breakLeft}
        onClose={() => setZen(false)}
      />
    </section>
  );
}

function PetName({ pet, onRename }: { pet: PetState; onRename: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing)
    return (
      <span className="inline-flex items-center gap-1">
        <Input
          value={draft}
          autoFocus
          maxLength={20}
          className="h-7 w-32 text-xs"
          aria-label="Tên thú cưng"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(draft.trim());
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-1.5"
          onClick={() => {
            onRename(draft.trim());
            setEditing(false);
          }}
        >
          ✓
        </Button>
      </span>
    );
  return (
    <button
      type="button"
      title="Đặt tên cho thú cưng"
      className="rounded-full bg-secondary px-2 py-0.5 text-xs transition hover:bg-secondary/70"
      onClick={() => {
        setDraft(pet.petName ?? "");
        setEditing(true);
      }}
    >
      {pet.petName ? `“${pet.petName}”` : "+ Đặt tên"}
    </button>
  );
}
