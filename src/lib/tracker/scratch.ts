/** Quick "mảnh giấy" notes you jot mid-focus without leaving the timer.
 * The ScratchNote type, caps and normalizeScratch live in model.ts — this module
 * only adds the user-facing mutations. */
import { dateStr, makeTask, SCRATCH_MAX, SCRATCH_LEN_MAX, type AppData } from "./model";

/** Appends a note; returns the same data object untouched when the text is empty. */
export function addScratch(data: AppData, text: string, now = new Date()): AppData {
  const clean = typeof text === "string" ? text.trim().slice(0, SCRATCH_LEN_MAX) : "";
  if (!clean) return data;
  const note = {
    id: `s_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    text: clean,
    at: now.toISOString(),
    date: dateStr(now),
  };
  return { ...data, scratch: [...data.scratch, note].slice(-SCRATCH_MAX) };
}

export function removeScratch(data: AppData, id: string): AppData {
  return { ...data, scratch: data.scratch.filter((n) => n.id !== id) };
}

export function clearScratch(data: AppData): AppData {
  return data.scratch.length ? { ...data, scratch: [] } : data;
}

/** Turns a note into a no-timer task for `today` and drops the note. Null when the id is unknown. */
export function promoteScratch(data: AppData, id: string, today = dateStr()): AppData | null {
  const note = data.scratch.find((n) => n.id === id);
  if (!note) return null;
  const task = makeTask(note.text, "custom", 0, today, { emoji: "📝" });
  return {
    ...data,
    tasks: [...data.tasks, task],
    scratch: data.scratch.filter((n) => n.id !== id),
  };
}
