import confetti from "canvas-confetti";
import type { ChimeKind } from "./model";

let ctx: AudioContext | null = null;
let enabled = true;
let chime: ChimeKind = "soft";

/** Master switch for effect sounds (user setting, persisted in AppSettings.fxSound). */
export function setFxEnabled(v: boolean) {
  enabled = v;
}

/** Chime style for ting(): soft = little bells, bowl = Tibetan bowl, retro = 8-bit, birds = chirps. */
export function setChime(kind: ChimeKind) {
  chime = kind;
}

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  c: AudioContext,
  freq: number,
  at: number,
  dur: number,
  type: OscillatorType,
  vol = 0.2,
) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function playSoft(c: AudioContext, big: boolean) {
  const notes = big ? [784, 988, 1175, 1568] : [1318, 1760];
  notes.forEach((f, i) => tone(c, f, c.currentTime + i * 0.09, 0.5, "sine"));
}

function playBowl(c: AudioContext, big: boolean) {
  // Tibetan bowl: low fundamental + shimmering partial, long decay
  const base = big ? 160 : 220;
  const partials: [number, number][] = [
    [base, 0.35],
    [base * 2.76, 0.12],
    [base * 5.4, 0.05],
  ];
  partials.forEach(([f, v]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = c.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 2.4 : 1.6));
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + (big ? 2.5 : 1.7));
  });
}

function playRetro(c: AudioContext, big: boolean) {
  // 8-bit fanfare: square-wave arpeggio
  const notes = big ? [523, 659, 784, 1046, 784, 1046] : [659, 784, 988, 1318];
  notes.forEach((f, i) => tone(c, f, c.currentTime + i * 0.11, 0.14, "square", 0.12));
}

function playBirds(c: AudioContext, big: boolean) {
  // Little chirps: quick upward frequency sweeps
  const chirps = big ? 6 : 3;
  for (let i = 0; i < chirps; i++) {
    const t = c.currentTime + 0.12 + i * (0.16 + Math.random() * 0.08);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(2600 + Math.random() * 700, t);
    o.frequency.exponentialRampToValueAtTime(3600 + Math.random() * 900, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.15);
  }
}

/** The Pomodoro/reward chime, in the user's chosen style. */
export function ting(big = false) {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  try {
    if (chime === "bowl") playBowl(c, big);
    else if (chime === "retro") playRetro(c, big);
    else if (chime === "birds") playBirds(c, big);
    else playSoft(c, big);
  } catch {
    /* audio unavailable */
  }
}

export function celebrate() {
  ting();
  confetti({ particleCount: 90, spread: 80, origin: { y: 0.3 }, gravity: 1.1 });
}

const GOLD = ["#FFD700", "#FFB300", "#FFE066", "#FF8A00"];

/** Wheel prize burst — a cheerful pop for normal prizes, a golden storm for the jackpot. */
export function wheelWinFx(jackpot = false) {
  if (!jackpot) {
    celebrate();
    return;
  }
  ting(true);
  const end = Date.now() + 2200;
  (function frame() {
    confetti({
      particleCount: 7,
      angle: 60,
      spread: 70,
      origin: { x: 0 },
      colors: GOLD,
      gravity: 1.1,
      scalar: 1.2,
    });
    confetti({
      particleCount: 7,
      angle: 120,
      spread: 70,
      origin: { x: 1 },
      colors: GOLD,
      gravity: 1.1,
      scalar: 1.2,
    });
    confetti({
      particleCount: 30,
      spread: 100,
      origin: { y: 0.4 },
      colors: GOLD,
      gravity: 1.1,
      scalar: 1.2,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Dramatic ascending arpeggio + boom for pet evolution. */
export function evolutionFx() {
  if (!enabled) return;
  const c = audio();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    [261.6, 329.6, 392, 523.3, 659.3].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + i * 0.13);
      g.gain.linearRampToValueAtTime(0.16, t0 + i * 0.13 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.13 + 0.5);
      o.connect(g).connect(c.destination);
      o.start(t0 + i * 0.13);
      o.stop(t0 + i * 0.13 + 0.55);
    });
    // boom
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(40, t0 + 0.9);
    g.gain.setValueAtTime(0.22, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + 1.15);
  } catch {
    /* audio unavailable */
  }
}

export function levelUpFx() {
  ting(true);
  const end = Date.now() + 1500;
  (function frame() {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 } });
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
