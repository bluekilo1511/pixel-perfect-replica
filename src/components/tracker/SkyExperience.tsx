import { createContext, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useTracker } from "@/lib/tracker/store";

const FocusContext = createContext<(remaining: number | null) => void>(() => {});
export const useFocusSky = () => useContext(FocusContext);

function shatterIce() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "ice-shatter-canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  document.body.appendChild(canvas);
  const color = getComputedStyle(document.documentElement).getPropertyValue("--ice-shard").trim();
  const shards = Array.from({ length: 48 }, () => ({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, size: 12 + Math.random() * 35, dx: (Math.random() - .5) * 180, dy: 100 + Math.random() * 180, angle: Math.random() * Math.PI }));
  const start = performance.now();
  const frame = (now: number) => {
    const p = Math.min(1, (now - start) / 850);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 1 - p;
    shards.forEach((s) => {
      ctx.save(); ctx.translate(s.x + s.dx * p, s.y + s.dy * p * p); ctx.rotate(s.angle + p * 2);
      ctx.beginPath(); ctx.moveTo(0, -s.size); ctx.lineTo(s.size * .6, s.size * .4); ctx.lineTo(-s.size * .5, s.size * .7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    });
    if (p < 1) requestAnimationFrame(frame); else canvas.remove();
  };
  requestAnimationFrame(frame);
}

export function SkyExperience({ children }: { children: ReactNode }) {
  const { data, timer } = useTracker();
  const [petRemaining, setPetRemaining] = useState<number | null>(null);
  const [wave, setWave] = useState(false);
  const waveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const frozen = data.streak.freezeActive === true;
  const previousFreeze = useRef(frozen);
  useEffect(() => {
    if (previousFreeze.current && !frozen) shatterIce();
    previousFreeze.current = frozen;
  }, [frozen]);
  useEffect(() => () => clearTimeout(waveTimeout.current), []);
  const task = data.tasks.find((t) => t.id === timer?.taskId);
  const taskRemaining = task?.kind === "pomodoro" && timer ? timer.remaining : null;
  const values = [petRemaining, taskRemaining].filter((v): v is number => v !== null);
  const remaining = values.length ? Math.min(...values) : null;
  const ripple = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button, input[type=checkbox]");
    if (!button || button.hasAttribute("disabled") || (!button.hasAttribute("data-ocean") && !button.closest("[data-pet-interactions]"))) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const widget = button.closest<HTMLElement>(".glass") ?? button.parentElement;
    if (!widget) return;
    const bounds = widget.getBoundingClientRect();
    const ring = document.createElement("span");
    const overlay = document.createElement("span");
    overlay.className = "ocean-ripple-overlay";
    ring.className = "ocean-ripple";
    ring.style.left = `${event.detail ? event.clientX - bounds.left : bounds.width / 2}px`;
    ring.style.top = `${event.detail ? event.clientY - bounds.top : bounds.height / 2}px`;
    ring.style.setProperty("--ripple-size", `${Math.hypot(bounds.width, bounds.height) * 2}px`);
    overlay.appendChild(ring);
    widget.appendChild(overlay);
    ring.addEventListener("animationend", () => overlay.remove(), { once: true });
    setWave(true); clearTimeout(waveTimeout.current);
    waveTimeout.current = setTimeout(() => setWave(false), 900);
  };
  return <FocusContext.Provider value={setPetRemaining}>
    <div className={`sky-experience ${remaining !== null ? "sky-focusing" : ""} ${remaining !== null && remaining <= 300 ? "sky-final" : ""} ${frozen ? "sky-frozen" : ""} ${wave ? "sky-wave" : ""}`} onClickCapture={ripple}>
      {children}
    </div>
  </FocusContext.Provider>;
}