import confetti from "canvas-confetti";

let ctx: AudioContext | null = null;
let enabled = true;
/** Master switch for effect sounds (user setting, persisted in AppSettings.fxSound). */
export function setFxEnabled(v: boolean) {
  enabled = v;
}
export function ting(big = false) {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    const notes = big ? [784, 988, 1175, 1568] : [1318, 1760];
    notes.forEach((f, i) => {
      const t = ctx!.currentTime + i * 0.09;
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {
    /* audio unavailable */
  }
}

export function celebrate() {
  ting();
  confetti({ particleCount: 90, spread: 80, origin: { y: 0.3 }, gravity: 1.1 });
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
