// Pure pet journal: the pet writes down its own story — level-ups, evolutions,
// bosses defeated, expeditions, snacks. No browser APIs, so it is testable.
import { petEmoji, petTitle, tierOf } from "./extras";
import type { AppData } from "./model";

export const PET_LOG_MAX = 60;
export const PET_LOG_TEXT_MAX = 120;

export type PetLogKind =
  "level" | "evolution" | "boss" | "raid" | "expedition" | "feed" | "hatch" | "review";

const KINDS: readonly PetLogKind[] = [
  "level",
  "evolution",
  "boss",
  "raid",
  "expedition",
  "feed",
  "hatch",
  "review",
];

export interface PetLogEntry {
  id: string;
  kind: PetLogKind;
  text: string;
  at: string; // ISO timestamp
}

const newId = () => `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/** Emoji shown next to each entry kind in the journal list. */
export const petLogEmoji = (kind: PetLogKind): string =>
  ({
    level: "⬆️",
    evolution: "✨",
    boss: "⚔️",
    raid: "🐲",
    expedition: "🧭",
    feed: "🍖",
    hatch: "🎉",
    review: "📋",
  })[kind];

/** Accepts old/new JSON and keeps at most PET_LOG_MAX entries, newest first. */
export function normalizePetLog(raw: unknown): PetLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => {
      const text = typeof e.text === "string" ? e.text.trim().slice(0, PET_LOG_TEXT_MAX) : "";
      const kind = KINDS.includes(e.kind as PetLogKind) ? (e.kind as PetLogKind) : "level";
      return {
        id: typeof e.id === "string" && e.id ? e.id : newId(),
        kind,
        text,
        at: typeof e.at === "string" ? e.at : new Date().toISOString(),
      };
    })
    .filter((e) => e.text.length > 0)
    .slice(0, PET_LOG_MAX);
}

/** Appends one entry (newest first), capped at PET_LOG_MAX. Empty text is ignored. */
export function appendPetLog(
  log: PetLogEntry[],
  kind: PetLogKind,
  text: string,
  now = new Date(),
): PetLogEntry[] {
  const clean = text.trim().slice(0, PET_LOG_TEXT_MAX);
  if (!clean) return log;
  return [{ id: newId(), kind, text: clean, at: now.toISOString() }, ...log].slice(0, PET_LOG_MAX);
}

/** Appends an event to the app data's pet journal (pure). */
export function logPetEvent(d: AppData, kind: PetLogKind, text: string, now = new Date()): AppData {
  return { ...d, petLog: appendPetLog(d.petLog, kind, text, now) };
}

/**
 * Level-ups and evolutions are derived from the petState diff so every XP
 * source (tasks, treats, potions, the market…) lands in the journal without
 * each feature having to remember to log. A species change (new pet, or the
 * first load of saved data) never logs — only a genuine level-up does.
 */
export function withPetLog(prev: AppData, next: AppData): AppData {
  const lvl0 = prev.petState?.petLevel || 1;
  const lvl1 = next.petState?.petLevel || 1;
  if (lvl1 <= lvl0 || prev.petState.species !== next.petState.species) return next;
  const t0 = tierOf(lvl0);
  const t1 = tierOf(lvl1);
  const pet = next.petState;
  const entry: [PetLogKind, string] =
    t1 > t0
      ? ["evolution", `${petEmoji(pet)} ${petTitle(pet)} đã tiến hóa — dạng mới thật oai!`]
      : ["level", `${petTitle(pet)} đã lên cấp ${lvl1} 💫`];
  return { ...next, petLog: appendPetLog(next.petLog, entry[0], entry[1]) };
}

// ---- 🐾 Weekly review: the pet grades the week so far in its journal ----

/** Local YYYY-MM-DD for a Date (same rule as model.dateStr, kept local to avoid a cycle). */
const isoOf = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const addDaysIso = (iso: string, n: number): string => {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const d = new Date(Date.UTC(y, m - 1, day));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Monday of the week containing `date` (weeks start Monday, like the raid). */
export const weekMonday = (date: string): string => {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay(); // 0 = Sunday
  return addDaysIso(date, dow === 0 ? -6 : 1 - dow);
};

/**
 * The pet looks back over Monday..yesterday of the current week and writes one
 * honest line into its journal. Returns null before there is anything to grade
 * (e.g. a Monday morning) so nothing is logged twice for an empty week.
 */
export function petWeeklyReview(data: AppData, now = new Date()): PetLogEntry | null {
  const today = isoOf(now);
  const monday = weekMonday(today);
  const yesterday = addDaysIso(today, -1);
  if (monday > yesterday) return null; // the week just started

  let tasks = 0;
  let focusMin = 0;
  let emptyDays = 0;
  let days = 0;
  for (let d = monday; d <= yesterday; d = addDaysIso(d, 1)) {
    const s = data.dailyStats[d];
    days += 1;
    if (!s || (s.tasks === 0 && s.focusMin === 0)) {
      emptyDays += 1;
      continue;
    }
    tasks += s.tasks;
    focusMin += s.focusMin;
  }
  if (days === 0) return null;

  const pet = data.petState;
  let text: string;
  if (tasks >= 20 || focusMin >= 420) {
    text = `Tuần này ${tasks} nhiệm vụ / ${focusMin}p tập trung — ${petEmoji(pet)} chấm 10/10, chủ nhân là cỗ máy học tập!`;
  } else if (emptyDays >= 5) {
    text = `Bỏ ${emptyDays} ngày trống trơn… ${petEmoji(pet)} nằm chờ chủ nhân cả tuần 😤 tuần sau chăm hơn nha!`;
  } else if (tasks >= 8 || focusMin >= 120) {
    text = `Tuần này ${tasks} nhiệm vụ / ${focusMin}p. Không tệ, ${petEmoji(pet)} chấm 7.5 — giỏi lắm!`;
  } else {
    text = `Tuần này ${tasks} nhiệm vụ / ${focusMin}p tập trung. ${petEmoji(pet)} tin tuần sau sẽ bùng nổ hơn! 🐾`;
  }
  return { id: newId(), kind: "review", text, at: now.toISOString() };
}

/** Prepends the weekly review entry (if any) to the pet journal. Pure. */
export function withWeeklyReview(data: AppData, now = new Date()): AppData {
  const entry = petWeeklyReview(data, now);
  if (!entry) return data;
  return { ...data, petLog: [entry, ...data.petLog].slice(0, PET_LOG_MAX) };
}
