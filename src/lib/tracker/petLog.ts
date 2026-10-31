// Pure pet journal: the pet writes down its own story — level-ups, evolutions,
// bosses defeated, expeditions, snacks. No browser APIs, so it is testable.
import { petEmoji, petTitle, tierOf } from "./extras";
import type { AppData } from "./model";

export const PET_LOG_MAX = 60;
export const PET_LOG_TEXT_MAX = 120;

export type PetLogKind = "level" | "evolution" | "boss" | "raid" | "expedition" | "feed" | "hatch";

const KINDS: readonly PetLogKind[] = [
  "level",
  "evolution",
  "boss",
  "raid",
  "expedition",
  "feed",
  "hatch",
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
