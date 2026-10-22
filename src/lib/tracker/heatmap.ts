// Pure heatmap rules (no browser APIs, so it is testable).

export const HEAT_WEEKS = 20;

/** Focus minutes → 0..4 intensity (GitHub-style). */
export function focusLevel(focusMin: number): 0 | 1 | 2 | 3 | 4 {
  if (focusMin <= 0) return 0;
  if (focusMin < 15) return 1;
  if (focusMin < 45) return 2;
  if (focusMin < 90) return 3;
  return 4;
}

export interface HeatCell {
  date: string; // YYYY-MM-DD
  level: 0 | 1 | 2 | 3 | 4;
  focusMin: number;
  tasks: number;
  future: boolean; // after today — rendered empty
}

export interface HeatWeek {
  start: string; // YYYY-MM-DD of the week's Sunday
  cells: HeatCell[]; // always 7, Sunday first
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (iso0: string, n: number) => {
  const [y, m, d] = iso0.split("-").map(Number) as [number, number, number];
  return iso(new Date(y, (m ?? 1) - 1, (d ?? 1) + n));
};

/** Last `weeks` weeks (Sunday → Saturday), ending with the week containing `today`. Future days inside the current week are flagged. */
export function heatmapWeeks(
  dailyStats: Record<string, { focusMin?: number; tasks?: number }>,
  today: string,
  weeks = HEAT_WEEKS,
): HeatWeek[] {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const dayIdx = new Date(y, (m ?? 1) - 1, d ?? 1).getDay(); // 0 = Sunday
  const lastStart = addDays(today, -dayIdx);
  const start0 = addDays(lastStart, -(weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, w) => {
    const start = addDays(start0, w * 7);
    return {
      start,
      cells: Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i);
        const future = date > today;
        const s = dailyStats[date];
        const focusMin = future ? 0 : (s?.focusMin ?? 0);
        return {
          date,
          level: future ? (0 as const) : focusLevel(focusMin),
          focusMin,
          tasks: future ? 0 : (s?.tasks ?? 0),
          future,
        };
      }),
    };
  });
}

/** Days with any focus minutes inside the rendered range. */
export function activeDaysOf(weeks: HeatWeek[]): number {
  return weeks.reduce((a, w) => a + w.cells.filter((c) => !c.future && c.focusMin > 0).length, 0);
}
