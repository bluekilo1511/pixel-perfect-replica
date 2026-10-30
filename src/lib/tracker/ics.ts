// Google-Calendar-friendly .ics export for the personal schedule: weekly
// recurring slots + one-off dated reminders. Pure string building, no deps.
import type { ExtraScheduleItem, Slot, Timetable } from "./model";

const ICS_BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]; // JS dayIndex order

const pad = (n: number) => String(n).padStart(2, "0");

const toIcsDate = (d: Date, hh = 0, mm = 0) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hh)}${pad(mm)}00`;

/** Escapes text per RFC 5545 (commas, semicolons, backslashes, newlines). */
export const escapeIcsText = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const hmToParts = (hm: string): [number, number] | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return [h, min];
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Next calendar date (>= today) whose weekday matches dayIndex. */
export function nextDateFor(dayIndex: number, now = new Date()): Date | null {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) return null;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i < 8; i++) {
    if (d.getDay() === dayIndex) return d;
    d.setDate(d.getDate() + 1);
  }
  return null;
}

function slotEvent(slot: Slot, dayIndex: number, now: Date): string[] {
  const time = hmToParts(slot.start);
  if (!time) return [];
  const start = nextDateFor(dayIndex, now);
  if (!start) return [];
  const [h, m] = time;
  const [eh, em] = hmToParts(slot.end) ?? [Math.min(23, h + 1), m];
  const summary = slot.teacher ? `${slot.title} (${slot.teacher})` : slot.title;
  return [
    "BEGIN:VEVENT",
    `UID:${slot.id || `slot-${dayIndex}-${slot.start}`}@tpp-ics`,
    `DTSTAMP:${toIcsDate(now, 12, 0)}`,
    `DTSTART:${toIcsDate(start, h, m)}`,
    `DTEND:${toIcsDate(start, eh, em)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${ICS_BYDAY[dayIndex]}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    "END:VEVENT",
  ];
}

function extraEvent(x: ExtraScheduleItem, now: Date): string[] {
  if (!isDate(x.date) || !x.title.trim()) return [];
  const [y, mo, dd] = x.date.split("-").map(Number);
  const base = new Date(y!, mo! - 1, dd!);
  const time = x.time ? hmToParts(x.time) : null;
  const lines = [
    "BEGIN:VEVENT",
    `UID:${x.id || `extra-${x.date}`}@tpp-ics`,
    `DTSTAMP:${toIcsDate(now, 12, 0)}`,
  ];
  if (time) {
    const [h, m] = time;
    const endMin = h * 60 + m + Math.max(0, x.minutes || 0);
    const eh = Math.min(23, Math.floor(endMin / 60) % 24);
    const em = endMin % 60;
    lines.push(`DTSTART:${toIcsDate(base, h, m)}`, `DTEND:${toIcsDate(base, eh, em)}`);
  } else {
    // All-day event: DTSTART is a plain date, DTEND is exclusive.
    lines.push(`DTSTART;VALUE=DATE:${x.date.replace(/-/g, "")}`);
    const nxt = new Date(base);
    nxt.setDate(nxt.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(nxt).slice(0, 8)}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(x.title.trim())}`, "END:VEVENT");
  return lines;
}

/** Builds a complete .ics calendar string from the personal timetable + reminders. */
export function buildIcs(
  personal: Timetable,
  extras: ExtraScheduleItem[],
  now = new Date(),
): string {
  const body: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Task Tracker Pro//Personal Schedule//VI",
    "CALSCALE:GREGORIAN",
  ];
  for (const day of personal?.days ?? []) {
    for (const slot of day?.slots ?? []) {
      if (slot.tracked === false) continue; // display-only slots stay out of the calendar
      body.push(...slotEvent(slot, day.dayIndex, now));
    }
  }
  for (const x of Array.isArray(extras) ? extras : []) body.push(...extraEvent(x, now));
  body.push("END:VCALENDAR");
  return body.map((l) => l + "\r\n").join("");
}
