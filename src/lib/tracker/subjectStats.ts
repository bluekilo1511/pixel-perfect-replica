// Pure per-subject focus statistics (no browser APIs, so it is testable).
import type { AppData } from "./model";
import { UNTAGGED_LABEL } from "./model";

export interface SubjectStat {
  label: string;
  minutes: number;
}

const datePart = (iso: string) => iso.slice(0, 10);

/** Focus minutes per subject, from the session log. Sessions without a tag fall into "Chưa gán". */
export function subjectMinutes(data: AppData, fromDate: string | null = null): SubjectStat[] {
  const totals = new Map<string, number>();
  for (const s of data.sessionLog) {
    if (s.kind !== "pomodoro") continue;
    if (fromDate && datePart(s.at) < fromDate) continue;
    const label = s.subject ?? UNTAGGED_LABEL;
    totals.set(label, (totals.get(label) ?? 0) + s.minutes);
  }
  return [...totals.entries()]
    .map(([label, minutes]) => ({ label, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label, "vi"));
}

export interface SubjectChartRow extends SubjectStat {
  pct: number; // share of the biggest subject, 0..100 (for bar width)
}

export const SUBJECT_COLORS = [
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#3b82f6",
  "#ef4444",
  "#14b8a6",
  "#ec4899",
  "#a3a3a3",
];

/** Rows for the per-subject bar chart. range "week" = since this week's Monday, "all" = everything. */
export function subjectChartRows(
  data: AppData,
  range: "week" | "all",
  mondayOf: (d: Date) => string,
  now = new Date(),
): SubjectChartRow[] {
  const from = range === "week" ? mondayOf(now) : null;
  const rows = subjectMinutes(data, from);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  return rows.map((r) => ({ ...r, pct: Math.round((r.minutes / max) * 100) }));
}
