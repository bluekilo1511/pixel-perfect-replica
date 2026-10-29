/**
 * Persisted Pomodoro/break state.
 *
 * The pet widget only mounts on the "Today" tab, so its timer state used to
 * vanish when the user switched tabs — killing a running session and the
 * auto-break after a finished Pomodoro. Saving the wall-clock deadlines to
 * localStorage lets the widget restore (and finish) them when it remounts.
 */

export interface PersistedSession {
  endAt: number | null; // wall-clock finish of the running Pomodoro (may be past — completion still fires)
  breakEndAt: number | null; // wall-clock finish of the auto-break
  warmup: boolean; // the session is a 5-minute warmup
  minutes: number | null; // planned length of THIS session (survives preset changes)
  strikes: number; // break-in count for this session (survives tab switches)
  savedAt: number;
}

const KEY = "pp:pomodoro-session";
/** Ignore state saved longer ago than this — an ancient session is garbage, not context. */
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const empty = (): PersistedSession => ({
  endAt: null,
  breakEndAt: null,
  warmup: false,
  minutes: null,
  strikes: 0,
  savedAt: 0,
});

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function loadSession(now = Date.now()): PersistedSession {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as Partial<PersistedSession>;
    const savedAt = num(p.savedAt) ?? 0;
    if (now - savedAt > MAX_AGE_MS) return empty();
    const endAt = num(p.endAt);
    const breakEndAt = num(p.breakEndAt);
    return {
      // An expired endAt is kept on purpose: the widget's tick fires the
      // (late) completion — rewards, chime, auto-break — right after remount.
      endAt,
      breakEndAt: breakEndAt !== null && breakEndAt > now ? breakEndAt : null,
      warmup: p.warmup === true,
      minutes: num(p.minutes),
      strikes: Math.max(0, Math.floor(num(p.strikes) ?? 0)),
      savedAt,
    };
  } catch {
    return empty();
  }
}

export function saveSession(
  endAt: number | null,
  breakEndAt: number | null,
  warmup: boolean,
  minutes: number | null = null,
  strikes = 0,
  now = Date.now(),
): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (endAt === null && breakEndAt === null) {
      localStorage.removeItem(KEY);
      return;
    }
    const s: PersistedSession = { endAt, breakEndAt, warmup, minutes, strikes, savedAt: now };
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable — the session just won't survive remounts */
  }
}
