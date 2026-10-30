/** "Sức khỏe dữ liệu": a read-only report of how big/heavy the save file is plus
 * a conservative one-click cleanup. Pure functions, no browser APIs. */
import { dateStr, pruneTasks, type AppData } from "./model";

export interface DataHealth {
  bytes: number; // serialized size of the whole AppData (UTF-16 chars ≈ bytes for ASCII-heavy JSON)
  tasks: number; // stored tasks (all dates)
  oldTasks: number; // tasks older than 14 days that are still stored
  sessionLog: number;
  dailyStatsDays: number;
  flashcards: number;
  gradeEntries: number;
  scratch: number;
  lastBackupAt: string | null;
  warnings: string[];
}

const OLD_DAYS = 14;
const SESSION_CAP = 400;
const STATS_CAP_DAYS = 180;

export function dataHealth(data: AppData, today = dateStr()): DataHealth {
  const cutoff = new Date(`${today}T23:59:59`);
  cutoff.setDate(cutoff.getDate() - OLD_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const oldTasks = data.tasks.filter((t) => t.date < cutoffStr).length;
  const sessionLog = data.sessionLog.length;
  const dailyStatsDays = Object.keys(data.dailyStats).length;
  const warnings: string[] = [];
  if (oldTasks > 0)
    warnings.push(`${oldTasks} nhiệm vụ quá 14 ngày vẫn còn trong file — dọn dẹp sẽ gọt bớt.`);
  if (sessionLog > SESSION_CAP)
    warnings.push(`${sessionLog} mục nhật ký phiên — phần cũ sẽ được cắt khi dọn dẹp.`);
  if (dailyStatsDays > STATS_CAP_DAYS)
    warnings.push(`${dailyStatsDays} ngày thống kê — phần cũ sẽ được cắt khi dọn dẹp.`);
  const lastBackupAt = data.backup.lastBackupAt;
  if (!lastBackupAt) warnings.push("Chưa sao lưu lần nào — nên tải file JSON để giữ an toàn.");
  else {
    const days = (Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000;
    if (days > 7) warnings.push(`Đã ${Math.floor(days)} ngày chưa sao lưu.`);
  }
  return {
    bytes: JSON.stringify(data).length,
    tasks: data.tasks.length,
    oldTasks,
    sessionLog,
    dailyStatsDays,
    flashcards: data.flashcards.length,
    gradeEntries: data.gradeBook.length,
    scratch: data.scratch.length,
    lastBackupAt,
    warnings,
  };
}

export interface CleanupResult {
  data: AppData;
  removedTasks: number;
  removedSessions: number;
  removedStatsDays: number;
}

export function removedTotal(r: CleanupResult): number {
  return r.removedTasks + r.removedSessions + r.removedStatsDays;
}

/** Trims what only exists to keep history: stale tasks, old session entries, old stat days.
 * Never touches grades, flashcards, scratch notes, inventory or anything user-authored. */
export function cleanupData(data: AppData, today = dateStr()): CleanupResult {
  const pruned = pruneTasks(data, today);
  const removedTasks = pruned.tasks.length - data.tasks.length;

  const sessionLog = data.sessionLog.slice(-SESSION_CAP);
  const removedSessions = data.sessionLog.length - sessionLog.length;

  const keepDates = Object.keys(data.dailyStats).sort().slice(-STATS_CAP_DAYS);
  const removedStatsDays = Object.keys(data.dailyStats).length - keepDates.length;
  const dailyStats: AppData["dailyStats"] = {};
  keepDates.forEach((d) => {
    const s = data.dailyStats[d];
    if (s) dailyStats[d] = s;
  });

  return {
    data: { ...pruned, sessionLog, dailyStats },
    removedTasks,
    removedSessions,
    removedStatsDays,
  };
}
