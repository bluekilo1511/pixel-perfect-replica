/** Tiny event bus so any card can ask the pet widget to start a Pomodoro. */

export interface PomodoroRequest {
  minutes: number;
  label: string;
}

const EVENT = "pp:start-pomodoro";

export function requestPomodoro(req: PomodoroRequest) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PomodoroRequest>(EVENT, { detail: req }));
}

/** Subscribes to start requests; returns an unsubscribe function. */
export function onPomodoroRequest(cb: (req: PomodoroRequest) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => cb((e as CustomEvent<PomodoroRequest>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
