/** Tiny pub/sub buses shared between the Pomodoro engine, the tab-title HUD
 * and the "The Origin" easter egg overlay — all client-side, nothing persisted. */

export interface PomodoroHudState {
  running: boolean;
  remaining: number; // seconds left in the current focus or break
  boss: boolean;
  onBreak: boolean;
  strikes: number; // "phá đò" escapes recorded in the current session
}

const HUD_DEFAULT: PomodoroHudState = {
  running: false,
  remaining: 0,
  boss: false,
  onBreak: false,
  strikes: 0,
};

let hud: PomodoroHudState = HUD_DEFAULT;
const hudListeners = new Set<(s: PomodoroHudState) => void>();

export function publishHud(next: PomodoroHudState) {
  hud = next;
  hudListeners.forEach((fn) => fn(hud));
}

export function subscribeHud(fn: (s: PomodoroHudState) => void): () => void {
  hudListeners.add(fn);
  fn(hud);
  return () => {
    hudListeners.delete(fn);
  };
}

export function getHud(): PomodoroHudState {
  return hud;
}

// --- The Origin easter egg -------------------------------------------------
let originOpen = false;
const originListeners = new Set<(open: boolean) => void>();

export function setOriginOpen(open: boolean) {
  originOpen = open;
  originListeners.forEach((fn) => fn(open));
}

export function isOriginOpen(): boolean {
  return originOpen;
}

export function subscribeOrigin(fn: (open: boolean) => void): () => void {
  originListeners.add(fn);
  fn(originOpen);
  return () => {
    originListeners.delete(fn);
  };
}
