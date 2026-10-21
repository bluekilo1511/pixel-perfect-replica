// Pure hidden-journal logic (opened by clicking the wall bookshelf). No browser APIs, so it is testable.
import type { AppData } from "./model";

export const JOURNAL_MAX = 300;
export const JOURNAL_TEXT_MAX = 4000;
export const JOURNAL_TITLE_MAX = 60;

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD the entry belongs to
  title?: string;
  text: string;
  updatedAt: string; // ISO
}

const newId = () => `jr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const isDate = (v: unknown): v is string => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

const cleanText = (v: unknown) => (typeof v === "string" ? v.slice(0, JOURNAL_TEXT_MAX) : "");
const cleanTitle = (v: unknown) => {
  const t = typeof v === "string" ? v.trim().slice(0, JOURNAL_TITLE_MAX) : "";
  return t || undefined;
};

/** Accepts any old/new JSON and keeps at most JOURNAL_MAX entries, newest day first. */
export function normalizeJournal(raw: unknown): JournalEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .filter((e) => isDate(e["date"]) && cleanText(e["text"]).trim().length > 0)
    .map((e) => {
      const title = cleanTitle(e["title"]);
      return {
        id: typeof e["id"] === "string" && e["id"].trim() ? e["id"] : newId(),
        date: e["date"] as string,
        ...(title ? { title } : {}),
        text: cleanText(e["text"]),
        updatedAt: typeof e["updatedAt"] === "string" ? e["updatedAt"] : new Date().toISOString(),
      };
    })
    .filter((e) => {
      // one entry per day: an older duplicate of the same date is dropped
      if (seen.has(e.date)) return false;
      seen.add(e.date);
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, JOURNAL_MAX);
}

export interface JournalUpsert {
  id?: string; // when given, updates that entry
  date: string;
  title?: string;
  text: string;
}

/** Creates or updates the entry for a day. Empty text deletes the entry. Returns null on bad input. */
export function upsertJournal(
  data: AppData,
  input: JournalUpsert,
  now = new Date(),
): AppData | null {
  if (!isDate(input.date)) return null;
  const text = cleanText(input.text);
  const title = cleanTitle(input.title);
  if (!text.trim()) return deleteJournal(data, input.id ?? input.date);
  const entry: JournalEntry = {
    id: input.id ?? newId(),
    date: input.date,
    ...(title ? { title } : {}),
    text,
    updatedAt: now.toISOString(),
  };
  // Update by id, or replace the existing entry of the same day.
  const rest = data.journal.filter((e) => e.id !== entry.id && e.date !== entry.date);
  const journal = [entry, ...rest].slice(0, JOURNAL_MAX);
  return { ...data, journal };
}

/** Removes one entry by id (or by date). */
export function deleteJournal(data: AppData, idOrDate: string): AppData {
  return { ...data, journal: data.journal.filter((e) => e.id !== idOrDate && e.date !== idOrDate) };
}

/** Finds today's entry, if any. */
export function journalForDate(data: AppData, date: string): JournalEntry | undefined {
  return data.journal.find((e) => e.date === date);
}
