import { useEffect, useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Maximize2,
  Minimize2,
  Play,
  Pause,
  CheckCircle2,
  X,
  Plus,
  Minus,
  FileText,
  Sparkles,
  Flame,
} from "lucide-react";
import { useTracker } from "@/lib/tracker/store";
import { KIND_META } from "@/lib/tracker/model";
import { ACCESSORIES, ACCESSORY_UI, moodOf, SPECIES } from "@/lib/tracker/gamify";
import { PetAura } from "./PetAura";
import { accessoryClass, petEmoji } from "@/lib/tracker/extras";
import { timerPetState } from "@/lib/tracker/timerPet";
import { addScratch, promoteScratch, removeScratch } from "@/lib/tracker/scratch";
import { dateStr } from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";
import { AmbientControl } from "./AmbientControl";
import { SecretManifestoModal } from "./SecretManifestoModal";
import { PetHoldRing } from "./PetHoldRing";
import { usePetHoldTrigger } from "@/lib/tracker/usePetHoldTrigger";

/** Fired by the ⛶ button on a running task row (and nothing else — keep it user-initiated). */
export const TIMER_FS_EVENT = "tt-timer-fullscreen";
export const requestTimerFullscreen = () => window.dispatchEvent(new CustomEvent(TIMER_FS_EVENT));

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const STARS = Array.from({ length: 32 }, (_, i) => ({
  left: (i * 31 + 7) % 100,
  top: (i * 47 + 13) % 100,
  size: 1 + ((i * 5) % 3),
  delay: ((i * 11) % 40) / 10,
  dur: 2.5 + ((i * 9) % 30) / 10,
}));

/** Fullscreen pinned countdown: immersive ambient experience, elegant radial ring, pet companion & distraction-free controls. */
export function TimerFullscreen() {
  const { data, timer, pauseTimer, startTimer, update, finish } = useTracker();
  const [open, setOpen] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [manifestoOpen, setManifestoOpen] = useState(false);
  const { isHolding, holdProgress, handlers: petHoldHandlers } = usePetHoldTrigger({
    onHoldComplete: () => {
      setManifestoOpen(true);
    },
    onClick: () => {
      toast(petR.say, { icon: petR.face });
    },
    holdDurationMs: 3000,
  });
  const [note, setNote] = useState("");
  const [isFs, setIsFs] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Open only on the explicit ⛶ press
  useEffect(() => {
    const onOpen = () => setOpen((o) => !o);
    window.addEventListener(TIMER_FS_EVENT, onOpen);
    return () => window.removeEventListener(TIMER_FS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open && timer) setPinnedId(timer.taskId);
  }, [open, timer?.taskId]);

  const activeId = timer?.taskId ?? pinnedId;
  const task = activeId ? (data.tasks.find((t) => t.id === activeId) ?? null) : null;

  // No pinned task left (finished, deleted) -> close
  useEffect(() => {
    if (open && (!task || task.completed)) setOpen(false);
  }, [open, task]);

  // Esc always shrinks back
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  if (!open || !task || task.completed) return null;

  const running = !!timer && timer.taskId === task.id;
  const left = running ? timer.remaining : Math.max(0, task.remainingSeconds || task.minutes * 60);
  const total = Math.max(1, task.minutes * 60);
  const pct = Math.min(1, Math.max(0, 1 - left / total));

  // Circular ring geometry
  const size = 360;
  const stroke = 12;
  const R = (size - stroke * 2) / 2;
  const C = 2 * Math.PI * R;

  const pet = data.petState;
  const petR = timerPetState(pct, running);
  const calm = data.settings.batterySaver === true;
  const meta = KIND_META[task.kind];

  const toggleFs = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      /* ignore policy rejection */
    }
  };

  const addNote = () => {
    if (!note.trim()) return;
    update((d) => addScratch(d, note));
    setNote("");
    toast.success("Đã ghi lại suy nghĩ ✨");
  };

  const adjustMinutes = (delta: number) => {
    const newRemaining = Math.max(60, left + delta * 60);
    update((d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === task.id
          ? {
              ...t,
              remainingSeconds: newRemaining,
              minutes: Math.max(1, Math.round(newRemaining / 60)),
            }
          : t,
      ),
    }));
    toast(`Đã ${delta > 0 ? "thêm" : "bớt"} ${Math.abs(delta)} phút`);
  };

  const handleFinishEarly = () => {
    try {
      void confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.7 },
        colors: ["#38bdf8", "#818cf8", "#c084fc", "#f472b6"],
      });
    } catch {
      /* ignore */
    }
    finish(task.id, true);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#050914] text-white select-none"
      role="dialog"
      aria-label="Đồng hồ tập trung toàn màn hình"
    >
      {/* Background radial atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(56,92,204,0.18)_0%,rgba(15,23,42,0.85)_60%,#030712_100%)]"
      />

      {/* Gentle ambient colored aura behind the main ring */}
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px] transition-all duration-1000 ${
          running
            ? left <= 300
              ? "h-[450px] w-[450px] bg-amber-500/20"
              : "h-[500px] w-[500px] bg-indigo-500/20"
            : "h-[350px] w-[350px] bg-slate-500/10"
        }`}
      />

      {/* Drifting subtle stars */}
      {!calm && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-cyan-200/50 focus-star"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay}s`,
                animationDuration: `${s.dur}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ================= TOP HEADER BAR ================= */}
      <header className="relative z-20 flex w-full items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <div
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide backdrop-blur-md transition-colors ${
              running
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                running ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
              }`}
            />
            {running ? "Đang tập trung" : "Tạm dừng"}
          </div>

          {/* Subject / kind chip */}
          <div className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-md sm:flex">
            <span>{task.emoji ?? meta.emoji}</span>
            <span>{task.subject ? task.subject : meta.label}</span>
          </div>
        </div>

        {/* Right utility buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <AmbientControl />

          <button
            type="button"
            onClick={() => setPadOpen((v) => !v)}
            aria-label="Ghi chú nhanh"
            className={`relative flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium backdrop-blur-md transition-colors ${
              padOpen
                ? "border-primary/50 bg-primary/20 text-white"
                : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Ghi chú</span>
            {data.scratch.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/80 px-1.5 py-0.2 text-[10px] text-primary-foreground font-bold">
                {data.scratch.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleFs}
            aria-label={isFs ? "Thoát toàn màn hình" : "Toàn màn hình"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
          >
            {isFs ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Thu nhỏ"
            className="group flex h-9 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-destructive/20 hover:border-destructive/40 hover:text-destructive"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline font-mono opacity-60 group-hover:opacity-100">
              Esc
            </span>
          </button>
        </div>
      </header>

      {/* ================= CENTER HERO ================= */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-2">
        <div className="flex max-w-2xl flex-col items-center text-center">
          {/* Task Title */}
          <div className="mb-4 flex flex-col items-center gap-1.5">
            <h1 className="max-w-[85vw] truncate text-2xl font-bold tracking-tight text-white/95 sm:text-3xl drop-shadow-md">
              <span className="mr-2 text-2xl sm:text-3xl">{task.emoji ?? meta.emoji}</span>
              {task.title}
            </h1>
            <p className="text-xs uppercase tracking-[0.25em] text-white/50 font-semibold">
              {meta.label} · Kế hoạch {task.minutes} phút
            </p>
          </div>

          {/* Radial Countdown Hero */}
          <div className="relative my-2 flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="max-h-[50vh] max-w-[80vw]"
              aria-hidden
            >
              <defs>
                <linearGradient id="timerRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="50%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#c084fc" />
                </linearGradient>
                <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Track */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={R}
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth={stroke}
              />

              {/* Outer Dashed Orbit Track */}
              {!calm && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={R + 18}
                  fill="none"
                  stroke="rgba(129, 140, 248, 0.25)"
                  strokeWidth="1.5"
                  strokeDasharray="4 12"
                  className="focus-ring-spin origin-center"
                />
              )}

              {/* Active Progress Arc */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={R}
                fill="none"
                stroke="url(#timerRingGradient)"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                filter="url(#ringGlow)"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="focus-ring-arc"
              />
            </svg>

            {/* Centered Large Digits & Info */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-display text-7xl sm:text-8xl md:text-9xl font-black tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)] tabular-nums">
                {fmt(left)}
              </span>
              <div className="mt-1 flex items-center gap-2 text-xs font-medium text-white/60">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/80">
                  {Math.round(pct * 100)}%
                </span>
                <span>còn {Math.ceil(left / 60)} phút</span>
              </div>

              {/* Quick minute adjustments */}
              <div className="mt-3 flex items-center gap-1.5 opacity-60 transition-opacity hover:opacity-100">
                <button
                  type="button"
                  onClick={() => adjustMinutes(-1)}
                  title="Giảm 1 phút"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="text-[11px] text-white/40">chỉnh giờ</span>
                <button
                  type="button"
                  onClick={() => adjustMinutes(5)}
                  title="Thêm 5 phút"
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Companion Pedestal */}
          <div
            {...petHoldHandlers}
            className="mt-4 flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 backdrop-blur-md shadow-lg transition-transform hover:scale-[1.02] cursor-pointer relative select-none touch-none"
            title="Chạm để trò chuyện • Giữ 3 giây để mở Thư Bí Mật 📜"
          >
            <div className="absolute -left-1.5 -top-1.5 pointer-events-none">
              <PetHoldRing isHolding={isHolding} progress={holdProgress} size={56} />
            </div>
            <span
              className={`relative block text-4xl leading-none ${
                petR.anim === "dance" ? "animate-pet-dance" : "animate-pet-idle"
              }`}
            >
              {pet.accessories.back === "wings" ? (
                <PetAura pet={pet} />
              ) : pet.accessories.back ? (
                <span className={`absolute ${ACCESSORY_UI.back[pet.species]}`} aria-hidden>
                  {ACCESSORIES[pet.accessories.back].emoji}
                </span>
              ) : null}
              <span className="relative">{petEmoji(pet)}</span>
              {(["head", "face"] as const).map((slot) =>
                pet.accessories[slot] ? (
                  <span key={slot} className={`absolute ${accessoryClass(slot, pet)}`}>
                    {ACCESSORIES[pet.accessories[slot]!].emoji}
                  </span>
                ) : null,
              )}
            </span>
            <div className="text-left text-xs">
              <div className="flex items-center gap-1.5 font-medium text-white/90">
                <span>{SPECIES[pet.species].name}</span>
                <span className="rounded bg-white/10 px-1 py-0.2 text-[10px] text-white/60">
                  Lv.{pet.petLevel}
                </span>
              </div>
              <p className="text-white/60 mt-0.5">
                {petR.face} {petR.say}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* ================= BOTTOM ACTION BAR ================= */}
      <footer className="relative z-20 flex w-full items-center justify-center gap-3 p-6 sm:pb-8">
        <Button
          size="lg"
          onClick={() => {
            if (running) pauseTimer();
            else startTimer(task.id);
          }}
          className={`h-13 rounded-full px-8 text-base font-semibold shadow-xl transition-all duration-300 ${
            running
              ? "border border-white/20 bg-white/10 text-white hover:bg-white/20"
              : "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500 shadow-indigo-500/25"
          }`}
        >
          {running ? (
            <>
              <Pause className="mr-2 h-5 w-5" /> Tạm dừng
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5 fill-current" /> Tiếp tục tập trung
            </>
          )}
        </Button>

        <Button
          size="lg"
          variant="outline"
          onClick={handleFinishEarly}
          className="h-13 rounded-full border-white/15 bg-white/5 px-6 text-white/90 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
          title="Đánh dấu hoàn thành sớm và nhận thưởng"
        >
          <CheckCircle2 className="mr-2 h-5 w-5 text-emerald-400" />
          Hoàn thành sớm
        </Button>
      </footer>

      {/* ================= SLIDE-OUT SCRATCHPAD DRAWER ================= */}
      {padOpen && (
        <aside
          className="fixed bottom-6 right-6 top-20 z-40 flex w-80 max-w-[calc(100vw-3rem)] flex-col rounded-3xl border border-white/15 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-right-8 duration-200"
          role="region"
          aria-label="Sổ tay tập trung"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">Ghi chú nhanh</h2>
            </div>
            <button
              type="button"
              onClick={() => setPadOpen(false)}
              className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="my-2 text-xs text-white/50">
            Ghi vội suy nghĩ hay việc phát sinh, đừng để đứt đoạn tập trung.
          </p>

          <div className="my-2 flex gap-2">
            <input
              type="text"
              placeholder="Ý tưởng hoặc việc cần làm…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              className="h-9 min-w-0 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-xs text-white placeholder-white/30 focus:border-cyan-400 focus:outline-none"
            />
            <Button size="sm" onClick={addNote} className="h-9 rounded-xl px-3 text-xs">
              Thêm
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {data.scratch.length === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center text-center text-xs text-white/40">
                <span>Chưa có ghi chú nào</span>
              </div>
            ) : (
              data.scratch.map((s) => (
                <div
                  key={s.id}
                  className="group flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-2.5 text-xs text-white/90"
                >
                  <span className="min-w-0 flex-1 truncate pr-2" title={s.text}>
                    {s.text}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        update((d) => promoteScratch(d, s.id, dateStr()) ?? d);
                        toast.success("Đã chuyển thành nhiệm vụ hôm nay 📝");
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] text-cyan-400 hover:bg-cyan-500/20"
                      title="Chuyển thành việc hôm nay"
                    >
                      → Việc
                    </button>
                    <button
                      type="button"
                      onClick={() => update((d) => removeScratch(d, s.id))}
                      className="rounded p-1 text-white/40 hover:bg-destructive/20 hover:text-destructive"
                      title="Xoá"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      )}

      <SecretManifestoModal
        open={manifestoOpen}
        onClose={() => setManifestoOpen(false)}
        petName={pet.petName || SPECIES[pet.species].name}
      />
    </div>
  );
}
