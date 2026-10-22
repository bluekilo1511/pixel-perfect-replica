// Quick timetable import (school-style grid), evening prep for tomorrow's
// subjects, and one-off reminders outside the weekly grid. Pure logic only.
import {
  EXTRA_SCHEDULE_MAX,
  EXTRA_TITLE_MAX,
  dateStr,
  makeTask,
  uid,
  type AppData,
  type ExtraScheduleItem,
  type Slot,
  type Task,
} from "./model";
import { shiftDate } from "./gamify";

export interface TkbDefaults {
  morningStart: string; // "HH:MM" — first morning period
  afternoonStart: string; // "HH:MM" — first afternoon period
  slotMinutes: number;
}

export const DEFAULT_TKB: TkbDefaults = {
  morningStart: "07:30",
  afternoonStart: "13:00",
  slotMinutes: 45,
};

export interface TkbEntry {
  dayIndex: number;
  slots: Slot[];
  morning: number;
  afternoon: number;
}

export interface ParsedTkb {
  touched: TkbEntry[];
  warnings: string[];
  count: number;
}

const parseHM = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const toHM = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const normHM = (v: string) => toHM(parseHM(v));

const splitEntries = (line: string) =>
  line
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Parses a pasted school timetable. Accepted per line:
 *  - day header: "Thứ 2", "Thứ 2 sáng:", "Chủ nhật", "CN"
 *  - session header: "Buổi sáng", "Buổi chiều" (applies to following entries)
 *  - entries separated by , or ; — "TNHN (DC) - Ngăn" → subject + teacher,
 *    optional explicit time prefix "19:00" or "19:00-20:30".
 */
export function parseTimetableText(text: string, defaults: TkbDefaults = DEFAULT_TKB): ParsedTkb {
  const warnings: string[] = [];
  const counters = new Map<string, number>(); // `${day}:${session}` → next period index
  const byDay = new Map<number, TkbEntry>();
  let day: number | null = null;
  let session: "morning" | "afternoon" = "morning";
  const slotLen = Math.max(1, Math.floor(defaults.slotMinutes));

  const autoTime = (d: number, sess: "morning" | "afternoon") => {
    const key = `${d}:${sess}`;
    const idx = counters.get(key) ?? 0;
    counters.set(key, idx + 1);
    const base =
      sess === "morning" ? parseHM(defaults.morningStart) : parseHM(defaults.afternoonStart);
    const start = base + idx * slotLen;
    return { start: toHM(start), end: toHM(start + slotLen) };
  };

  const addEntry = (raw: string, d: number, sess: "morning" | "afternoon") => {
    let entry = raw.trim().replace(/^[-•*]\s*/, "");
    if (!entry) return;
    let start: string | null = null;
    let end: string | null = null;
    const tm = entry.match(/^(\d{1,2}:\d{2})(?:\s*[-–]\s*(\d{1,2}:\d{2}))?\s+/);
    if (tm && tm[1]) {
      start = normHM(tm[1]);
      end = tm[2] ? normHM(tm[2]) : null;
      entry = entry.slice(tm[0].length);
    }
    const parts = entry.split(/\s+[-–]\s+/);
    const teacher = parts.length > 1 ? parts[parts.length - 1]!.trim() : undefined;
    const title = (parts.length > 1 ? parts.slice(0, -1).join(" - ") : entry).trim();
    if (!title) return;
    const t = start ? { start, end: end ?? toHM(parseHM(start) + slotLen) } : autoTime(d, sess);
    const slot: Slot = {
      id: uid("slot"),
      start: t.start,
      end: t.end,
      title,
      kind: "pomodoro",
      minutes: slotLen,
      session: sess,
      ...(teacher ? { teacher } : {}),
    };
    const entryBox = byDay.get(d) ?? { dayIndex: d, slots: [], morning: 0, afternoon: 0 };
    entryBox.slots.push(slot);
    if (sess === "morning") entryBox.morning += 1;
    else entryBox.afternoon += 1;
    byDay.set(d, entryBox);
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Session-only line: "Buổi sáng" / "Chiều"
    const sessOnly = line.match(/^(buổi\s+)?(sáng|chiều)\s*$/i);
    if (sessOnly) {
      session = sessOnly[2] === "sáng" ? "morning" : "afternoon";
      continue;
    }

    // Day header, optionally with entries on the same line
    const dm = line.match(/^(chủ nhật|cn|thứ\s*([2-7]))\s*[:：]?\s*(.*)$/i);
    if (dm) {
      day = !dm[2] ? 0 : Number(dm[2]) - 1; // Thứ 2..7 → 1..6 (CN = 0)
      session = "morning";
      let rest = dm[3] ?? "";
      const sm = rest.match(/^(buổi\s+)?(sáng|chiều)\s*(?::|：|$)\s*(.*)$/i);
      if (sm && sm[2]) {
        session = sm[2] === "sáng" ? "morning" : "afternoon";
        rest = sm[3] ?? "";
      }
      const d = day;
      splitEntries(rest).forEach((e) => addEntry(e, d, session));
      continue;
    }

    // "Sáng: a, b" mid-file
    const sm2 = line.match(/^(buổi\s+)?(sáng|chiều)\s*[:：]\s*(.*)$/i);
    if (sm2 && sm2[2] && day !== null) {
      session = sm2[2] === "sáng" ? "morning" : "afternoon";
      const d = day;
      splitEntries(sm2[3] ?? "").forEach((e) => addEntry(e, d, session));
      continue;
    }

    if (day === null) {
      warnings.push(`Dòng "${line.slice(0, 40)}" bị bỏ qua vì chưa biết thuộc thứ nào.`);
      continue;
    }
    const d = day;
    splitEntries(line).forEach((e) => addEntry(e, d, session));
  }

  const touched = [...byDay.values()].sort((a, b) => a.dayIndex - b.dayIndex);
  return {
    touched,
    warnings: warnings.slice(0, 5),
    count: touched.reduce((n, t) => n + t.slots.length, 0),
  };
}

/** Merges parsed days into the timetable, also saving the period defaults. */
export function applyTimetableImport(
  data: AppData,
  parsed: ParsedTkb,
  mode: "replace" | "merge",
  defaults: TkbDefaults,
): AppData {
  const map = new Map(parsed.touched.map((t) => [t.dayIndex, t]));
  return {
    ...data,
    timetable: {
      ...data.timetable,
      morningStart: defaults.morningStart,
      afternoonStart: defaults.afternoonStart,
      slotMinutes: defaults.slotMinutes,
      days: data.timetable.days.map((day) => {
        const p = map.get(day.dayIndex);
        if (!p) return day;
        const slots = mode === "replace" ? p.slots : [...day.slots, ...p.slots];
        return {
          ...day,
          slots: [...slots].sort((a, b) => a.start.localeCompare(b.start)),
        };
      }),
    },
  };
}

// ---- Evening prep: study tonight for tomorrow's classes ----

export interface PrepPick {
  slot: Slot;
  minutes: number;
}

/** Tomorrow's weekday slots, sorted by start time. */
export function tomorrowSlots(data: AppData, now = new Date()): Slot[] {
  const day = data.timetable.days[(now.getDay() + 1) % 7];
  return day ? [...day.slots].sort((a, b) => a.start.localeCompare(b.start)) : [];
}

/**
 * Creates "Ôn: {subject}" tasks dated today for the picked slots, once per
 * slot per day. Tags the subject when its name already exists in data.subjects.
 */
export function addPrepTasks(
  data: AppData,
  now = new Date(),
  picks: PrepPick[] = [],
): { data: AppData; added: number } {
  const today = dateStr(now);
  const tomorrow = shiftDate(today, 1);
  const newTasks: Task[] = [];
  const subjectLower = data.subjects.map((s) => s.toLowerCase());
  picks.forEach(({ slot, minutes }) => {
    const dupe = data.tasks.some(
      (t) =>
        t.date === today &&
        t.prepSlotId === slot.id &&
        t.prepForDate === tomorrow &&
        t.title.startsWith("Ôn:"),
    );
    if (dupe) return;
    const mins = Math.min(240, Math.max(5, Math.round(minutes)));
    const idx = subjectLower.indexOf(slot.title.toLowerCase());
    newTasks.push(
      makeTask(`Ôn: ${slot.title} (mai ${slot.start})`, "pomodoro", mins, today, {
        prepSlotId: slot.id,
        prepForDate: tomorrow,
        ...(idx >= 0 ? { subject: data.subjects[idx] } : {}),
      }),
    );
  });
  if (!newTasks.length) return { data, added: 0 };
  return { data: { ...data, tasks: [...data.tasks, ...newTasks] }, added: newTasks.length };
}

// ---- One-off reminders outside the weekly grid ----

const EXTRA_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXTRA_HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Adds a one-off reminder. Returns null on a bad date/title/time or a full list. */
export function addExtraSchedule(
  data: AppData,
  input: { date: string; title: string; time?: string | null; minutes?: number },
): AppData | null {
  const title = input.title.trim().slice(0, EXTRA_TITLE_MAX);
  if (!title || !EXTRA_DATE_RE.test(input.date)) return null;
  let time: string | null = null;
  if (input.time) {
    const t = input.time.trim();
    if (!EXTRA_HM_RE.test(t)) return null;
    time = t.padStart(5, "0");
  }
  if (data.extraSchedule.length >= EXTRA_SCHEDULE_MAX) return null;
  const item: ExtraScheduleItem = {
    id: uid("extra"),
    date: input.date,
    title,
    time,
    minutes: Math.min(600, Math.max(0, Math.round(input.minutes ?? 0))),
    createdAt: new Date().toISOString(),
  };
  return { ...data, extraSchedule: [...data.extraSchedule, item] };
}

export function removeExtraSchedule(data: AppData, id: string): AppData {
  return { ...data, extraSchedule: data.extraSchedule.filter((x) => x.id !== id) };
}

/** Reminders within the next `days` days, soonest first. */
export function upcomingExtraSchedule(
  data: AppData,
  now = new Date(),
  days = 7,
): ExtraScheduleItem[] {
  const today = dateStr(now);
  const end = shiftDate(today, days);
  return data.extraSchedule
    .filter((x) => x.date >= today && x.date <= end)
    .sort((a, b) =>
      `${a.date} ${a.time ?? "99:99"}`.localeCompare(`${b.date} ${b.time ?? "99:99"}`),
    );
}

/** Turns one reminder into a task on its own date; each item only once. */
export function extraToTask(data: AppData, itemId: string, now = new Date()): AppData | null {
  const item = data.extraSchedule.find((x) => x.id === itemId);
  if (!item || data.extraLog.includes(`${item.date}:${item.id}`)) return null;
  const task = makeTask(
    item.title,
    item.minutes > 0 ? "pomodoro" : "custom",
    item.minutes,
    item.date,
    { extraScheduleId: item.id, ...(item.time ? { timeRange: item.time } : {}) },
  );
  return {
    ...data,
    tasks: [...data.tasks, task],
    extraLog: [...data.extraLog.filter((k) => k >= dateStr(now)), `${item.date}:${item.id}`],
  };
}

/** Pushes today's due reminders (time reached) into today's tasks, once each. */
export function pushDueExtras(
  data: AppData,
  now = new Date(),
): { data: AppData; pushed: ExtraScheduleItem[] } {
  const today = dateStr(now);
  const nowHM = toHM(now.getHours() * 60 + now.getMinutes());
  const due = data.extraSchedule.filter(
    (x) =>
      x.date === today &&
      !data.extraLog.includes(`${today}:${x.id}`) &&
      (!x.time || x.time <= nowHM),
  );
  if (!due.length) return { data, pushed: [] };
  const tasks = due.map((x) =>
    makeTask(x.title, x.minutes > 0 ? "pomodoro" : "custom", x.minutes, today, {
      extraScheduleId: x.id,
      ...(x.time ? { timeRange: x.time } : {}),
    }),
  );
  return {
    data: {
      ...data,
      tasks: [...data.tasks, ...tasks],
      extraLog: [...data.extraLog.filter((k) => k >= today), ...due.map((x) => `${today}:${x.id}`)],
    },
    pushed: due,
  };
}
