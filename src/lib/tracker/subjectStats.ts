// Pure per-subject focus statistics (no browser APIs, so it is testable).
import type { AppData } from "./model";
import { UNTAGGED_LABEL } from "./model";
import {
  getCap2ParentConfig,
  matchCap2Config,
} from "./combos";

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

export interface SubBreakdownItem {
  label: string;
  minutes: number;
  pctOfCombo: number; // 0..100
}

export interface EnrichedSubjectChartRow {
  label: string;
  minutes: number;
  pct: number; // relative to max in this view
  isCombo?: boolean | undefined;
  comboKey?: "KHTN" | "LSDL" | "custom" | undefined;
  isSubdiscipline?: boolean | undefined;
  parentCombo?: string | undefined;
  subBreakdown?: SubBreakdownItem[] | undefined;
}

export type SubjectChartMode = "all" | "combos" | "standalone";

/** Calculates enriched subject rows supporting both individual subjects and combo aggregation.
 * In mode "all": returns both combo totals (sum of their subdisciplines) and individual subjects.
 * In mode "combos": rolls up subdisciplines into their respective combos.
 * In mode "standalone": returns individual subjects as recorded. */
export function enrichedSubjectChartRows(
  data: AppData,
  range: "week" | "all",
  mondayOf: (d: Date) => string,
  mode: SubjectChartMode = "all",
  now = new Date(),
): EnrichedSubjectChartRow[] {
  const from = range === "week" ? mondayOf(now) : null;
  const rawList = subjectMinutes(data, from);
  if (rawList.length === 0) return [];

  const rawMap = new Map<string, number>();
  for (const r of rawList) rawMap.set(r.label, r.minutes);

  // 1. Calculate Cấp 2 KHTN breakdown and total
  let khtnTotal = 0;
  const khtnBreakdown: { label: string; minutes: number }[] = [];
  // 2. Calculate Cấp 2 LS&ĐL breakdown and total
  let lsdlTotal = 0;
  const lsdlBreakdown: { label: string; minutes: number }[] = [];

  // 3. Custom combos from data.subjectCombos
  const customCombos = data.subjectCombos ?? {};
  const customComboTotals = new Map<string, { total: number; breakdown: { label: string; minutes: number }[] }>();
  for (const [cName, members] of Object.entries(customCombos)) {
    let cTot = rawMap.get(cName) ?? 0;
    const cBreakdown: { label: string; minutes: number }[] = [];
    if (cTot > 0) cBreakdown.push({ label: `${cName} (chung)`, minutes: cTot });
    for (const m of members) {
      const min = rawMap.get(m) ?? 0;
      if (min > 0) {
        cTot += min;
        cBreakdown.push({ label: m, minutes: min });
      }
    }
    if (cTot > 0) {
      customComboTotals.set(cName, { total: cTot, breakdown: cBreakdown });
    }
  }

  // Scan all subjects in rawMap
  for (const [label, minutes] of rawMap.entries()) {
    if (label === UNTAGGED_LABEL) continue;

    const cap2Config = matchCap2Config(label);
    const cap2Parent = getCap2ParentConfig(label);

    if (cap2Config?.key === "KHTN") {
      khtnTotal += minutes;
      khtnBreakdown.push({ label: `${label} (chung)`, minutes });
    } else if (cap2Parent?.config.key === "KHTN") {
      khtnTotal += minutes;
      khtnBreakdown.push({ label, minutes });
    } else if (cap2Config?.key === "LSDL") {
      lsdlTotal += minutes;
      lsdlBreakdown.push({ label: `${label} (chung)`, minutes });
    } else if (cap2Parent?.config.key === "LSDL") {
      lsdlTotal += minutes;
      lsdlBreakdown.push({ label, minutes });
    }
  }

  const formatBreakdown = (items: { label: string; minutes: number }[], total: number): SubBreakdownItem[] => {
    return items
      .sort((a, b) => b.minutes - a.minutes)
      .map((item) => ({
        label: item.label,
        minutes: item.minutes,
        pctOfCombo: total > 0 ? Math.round((item.minutes / total) * 100) : 0,
      }));
  };

  const results: EnrichedSubjectChartRow[] = [];

  if (mode === "standalone") {
    // Return individual subjects as logged
    for (const r of rawList) {
      const cap2Parent = getCap2ParentConfig(r.label);
      results.push({
        label: r.label,
        minutes: r.minutes,
        pct: 0,
        isSubdiscipline: !!cap2Parent,
        parentCombo: cap2Parent?.config.name,
      });
    }
  } else if (mode === "combos") {
    // Roll up subdisciplines into combos
    if (khtnTotal > 0) {
      results.push({
        label: "KHTN",
        minutes: khtnTotal,
        pct: 0,
        isCombo: true,
        comboKey: "KHTN",
        subBreakdown: formatBreakdown(khtnBreakdown, khtnTotal),
      });
    }
    if (lsdlTotal > 0) {
      results.push({
        label: "LS&ĐL",
        minutes: lsdlTotal,
        pct: 0,
        isCombo: true,
        comboKey: "LSDL",
        subBreakdown: formatBreakdown(lsdlBreakdown, lsdlTotal),
      });
    }
    for (const [cName, cData] of customComboTotals.entries()) {
      results.push({
        label: cName,
        minutes: cData.total,
        pct: 0,
        isCombo: true,
        comboKey: "custom",
        subBreakdown: formatBreakdown(cData.breakdown, cData.total),
      });
    }
    // Add other standalone subjects not belonging to any combo
    for (const r of rawList) {
      const isKhtnPart = matchCap2Config(r.label)?.key === "KHTN" || getCap2ParentConfig(r.label)?.config.key === "KHTN";
      const isLsdlPart = matchCap2Config(r.label)?.key === "LSDL" || getCap2ParentConfig(r.label)?.config.key === "LSDL";
      const isCustomPart = Object.entries(customCombos).some(
        ([cName, ms]) => cName === r.label || ms.includes(r.label),
      );
      if (!isKhtnPart && !isLsdlPart && !isCustomPart) {
        results.push({
          label: r.label,
          minutes: r.minutes,
          pct: 0,
        });
      }
    }
  } else {
    // mode === "all": Include combos (with subBreakdown) AND individual subdisciplines AND standalone
    if (khtnTotal > 0) {
      results.push({
        label: "KHTN",
        minutes: khtnTotal,
        pct: 0,
        isCombo: true,
        comboKey: "KHTN",
        subBreakdown: formatBreakdown(khtnBreakdown, khtnTotal),
      });
    }
    if (lsdlTotal > 0) {
      results.push({
        label: "LS&ĐL",
        minutes: lsdlTotal,
        pct: 0,
        isCombo: true,
        comboKey: "LSDL",
        subBreakdown: formatBreakdown(lsdlBreakdown, lsdlTotal),
      });
    }
    for (const [cName, cData] of customComboTotals.entries()) {
      results.push({
        label: cName,
        minutes: cData.total,
        pct: 0,
        isCombo: true,
        comboKey: "custom",
        subBreakdown: formatBreakdown(cData.breakdown, cData.total),
      });
    }

    // Now include individual subjects from rawList
    for (const r of rawList) {
      // If it is the exact combo name itself and already counted above, skip to avoid double listing
      if (
        (matchCap2Config(r.label)?.key === "KHTN" && khtnTotal > 0) ||
        (matchCap2Config(r.label)?.key === "LSDL" && lsdlTotal > 0) ||
        (customComboTotals.has(r.label))
      ) {
        continue;
      }

      const cap2Parent = getCap2ParentConfig(r.label);
      results.push({
        label: r.label,
        minutes: r.minutes,
        pct: 0,
        isSubdiscipline: !!cap2Parent,
        parentCombo: cap2Parent?.config.name,
      });
    }
  }

  // Sort by minutes descending
  results.sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label, "vi"));

  // Calculate percentage relative to maximum minutes
  const max = Math.max(1, ...results.map((r) => r.minutes));
  for (const r of results) {
    r.pct = Math.round((r.minutes / max) * 100);
  }

  return results;
}

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
