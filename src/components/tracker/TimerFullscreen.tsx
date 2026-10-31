import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { KIND_META } from "@/lib/tracker/model";
import { ACCESSORIES, ACCESSORY_UI, moodOf, SPECIES } from "@/lib/tracker/gamify";
import { petEmoji } from "@/lib/tracker/extras";
import { timerPetState } from "@/lib/tracker/timerPet";
import { addScratch, promoteScratch, removeScratch } from "@/lib/tracker/scratch";
import { dateStr } from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";
import { AmbientControl } from "./AmbientControl";

/** Fired by the ⛶ button on a running task row (and nothing else — keep it user-initiated). */
export const TIMER_FS_EVENT = "tt-timer-fullscreen";
export const requestTimerFullscreen = () => window.dispatchEvent(new CustomEvent(TIMER_FS_EVENT));

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const STARS = Array.from({ length: 26 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  top: (i * 53 + 7) % 100,
  size: 1 + ((i * 7) % 3),
  delay: ((i * 13) % 40) / 10,
  dur: 2.4 + ((i * 11) % 30) / 10,
}));

/** Fullscreen pinned countdown: big progress ring, the pet and ambient sound — everything else hidden. */
export function TimerFullscreen() {
  const { data, timer, pauseTimer, startTimer, update } = useTracker();
  const [open, setOpen] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [note, setNote] = useState("");
  const addNote = () => {
    if (!note.trim()) return;
    update((d) => addScratch(d, note));
    setNote("");
  };
  const [isFs, setIsFs] = useState(false);
  // Pausing clears the store timer, so remember which task was pinned to keep the overlay up.
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  // Open only on the explicit ⛶ press; a fresh timer never pops this over the user.
  useEffect(() => {
    const onOpen = () => setOpen((o) => !o);
    window.addEventListener(TIMER_FS_EVENT, onOpen);
    return () => window.removeEventListener(TIMER_FS_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (open && timer) setPinnedId(timer.taskId);
  }, [open, timer?.taskId]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeId = timer?.taskId ?? pinnedId;
  const task = activeId ? (data.tasks.find((t) => t.id === activeId) ?? null) : null;
  // No pinned task left (finished, deleted) → close.
  useEffect(() => {
    if (open && (!task || task.completed)) setOpen(false);
  }, [open, task]);

  // Esc always shrinks back.
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
  const R = 128;
  const C = 2 * Math.PI * R;
  const pet = data.petState;
  const petR = timerPetState(pct, running);
  const mood = moodOf(pet);
  const calm = data.settings.batterySaver === true;
  const meta = KIND_META[task.kind];

  const toggleFs = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void document.documentElement.requestFullscreen();
    } catch {
      /* some browsers/fullscreen policies reject — the overlay still works */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#070d1f]"
      role="dialog"
      aria-label="Đồng hồ toàn màn hình"
    >
      {/* Opaque deep-navy backdrop: hides the whole app behind the overlay. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(37,64,143,0.45)_0%,transparent_70%)]"
      />
      {/* Drifting stars — skipped in battery saver / reduced motion. */}
      {!calm && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-primary/60 focus-star"
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
      <div className="relative grid h-full place-items-center p-6">
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-black/35 px-8 py-8 text-center shadow-2xl backdrop-blur-md sm:px-12">
          <span className="max-w-[80vw] truncate text-lg font-semibold">
            <span className="mr-2">{task.emoji ?? meta.emoji}</span>
            {task.title}
          </span>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {meta.label} · còn {Math.ceil(left / 60)} phút
          </span>

          {/* Big progress ring */}
          <div className="relative grid place-items-center">
            <svg
              width={300}
              height={300}
              viewBox="0 0 300 300"
              className={calm ? "" : "focus-ring-spin"}
              aria-hidden
            >
              <defs>
                <linearGradient id="timerRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="hsl(var(--secondary))" />
                </linearGradient>
              </defs>
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="10"
              />
              {!calm && (
                <circle
                  cx="150"
                  cy="150"
                  r={R + 14}
                  fill="none"
                  stroke="hsl(var(--primary)/0.35)"
                  strokeWidth="2"
                  strokeDasharray="6 14"
                />
              )}
            </svg>
            {/* The live arc sits above the static svg so its dash-offset can animate smoothly. */}
            <svg
              width={300}
              height={300}
              viewBox="0 0 300 300"
              className="absolute inset-0 -rotate-90"
              aria-hidden
            >
              <circle
                cx="150"
                cy="150"
                r={R}
                fill="none"
                stroke="url(#timerRingGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - pct)}
                className="focus-ring-arc"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <p className="font-display text-7xl tabular-nums sm:text-8xl">{fmt(left)}</p>
              <p className="text-xs text-muted-foreground">{Math.round(pct * 100)}% hoàn thành</p>
            </div>
          </div>

          <span
            className={`relative block text-5xl leading-none ${
              petR.anim === "dance" ? "animate-pet-dance" : "animate-pet-idle"
            }`}
          >
            {pet.accessories.back && (
              <span className={`absolute ${ACCESSORY_UI.back[pet.species]}`} aria-hidden>
                {ACCESSORIES[pet.accessories.back].emoji}
              </span>
            )}
            <span className="relative">{petEmoji(pet)}</span>
            {(["head", "face"] as const).map((slot) =>
              pet.accessories[slot] ? (
                <span key={slot} className={`absolute ${ACCESSORY_UI[slot][pet.species]}`}>
                  {ACCESSORIES[pet.accessories[slot]!].emoji}
                </span>
              ) : null,
            )}
          </span>
          <span className="text-sm text-muted-foreground">
            {petR.face} {SPECIES[pet.species].name} {petR.say}
          </span>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="sm"
              variant={running ? "secondary" : undefined}
              onClick={() => {
                if (running) pauseTimer();
                else startTimer(task.id);
              }}
            >
              {running ? "⏸ Tạm dừng" : "▶ Tiếp tục"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              aria-pressed={padOpen}
              title="Ghi nhanh suy nghĩ mà không rời khỏi phiên"
              onClick={() => setPadOpen((v) => !v)}
            >
              📝 Ghi chú
            </Button>
            <AmbientControl />
            <Button size="sm" variant="outline" onClick={toggleFs} aria-pressed={isFs}>
              {isFs ? "🗗 Thoát toàn màn hình" : "⛶ Toàn màn hình"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Thu nhỏ (Esc)
            </Button>
          </div>

          {padOpen && (
            <div className="w-full max-w-[380px] rounded-xl border border-white/15 bg-white/5 p-3 text-left">
              <div className="flex gap-2">
                <input
                  className="h-8 min-w-0 flex-1 rounded-md border border-white/20 bg-black/40 px-2 text-sm"
                  placeholder="Ghi nhanh, đừng mất tập trung…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNote()}
                  aria-label="Ghi chú nhanh trong phiên"
                />
                <Button size="sm" variant="outline" onClick={addNote}>
                  Thêm
                </Button>
              </div>
              {data.scratch.length > 0 && (
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-sm">
                  {data.scratch.map((n) => (
                    <li key={n.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate" title={n.text}>
                        {n.text}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-primary hover:underline"
                        title="Thêm thành nhiệm vụ hôm nay"
                        onClick={() => {
                          update((d) => promoteScratch(d, n.id, dateStr()) ?? d);
                          toast.success("Đã thêm vào nhiệm vụ hôm nay 📝");
                        }}
                      >
                        → Việc
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                        aria-label="Xoá ghi chú"
                        onClick={() => update((d) => removeScratch(d, n.id))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
