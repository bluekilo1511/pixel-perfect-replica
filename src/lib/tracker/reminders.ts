// Pure reminder rules (no browser APIs, so it is testable).
import type { Task } from "./model";

export interface DueReminder {
  taskId: string;
  key: string; // "taskId@YYYY-MM-DD" — fired once per task per day
  hhmm: string;
  title: string;
}

/** Reminders whose time has arrived: same day, not done, and not fired before. */
export function dueReminders(
  tasks: Task[],
  today: string,
  nowMinutes: number,
  fired: ReadonlySet<string>,
): DueReminder[] {
  const due: DueReminder[] = [];
  for (const t of tasks) {
    if (t.completed || t.date !== today) continue;
    const hhmm = typeof t.remindAt === "string" ? t.remindAt : "";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)) continue;
    const [h, m] = hhmm.split(":").map(Number) as [number, number];
    if (h * 60 + (m ?? 0) > nowMinutes) continue;
    const key = `${t.id}@${today}`;
    if (fired.has(key)) continue;
    due.push({ taskId: t.id, key, hhmm, title: t.title });
  }
  return due.sort((a, b) => a.hhmm.localeCompare(b.hhmm));
}

/** Keeps only the keys still relevant — fired keys from older days are pruned. */
export function pruneFiredKeys(keys: string[], today: string): string[] {
  return keys.filter((k) => k.endsWith(`@${today}`));
}
