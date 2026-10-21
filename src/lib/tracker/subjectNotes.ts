// Pure per-subject study notes with weak/strong topic marks. No browser APIs, so it is testable.
import type { AppData } from "./model";

export type TopicMark = "redo" | "weak" | "good";

export const TOPIC_MARK_META: Record<TopicMark, { emoji: string; label: string }> = {
  redo: { emoji: "🔁", label: "Cần học lại" },
  weak: { emoji: "🔻", label: "Yếu" },
  good: { emoji: "🟢", label: "Tốt" },
};

export const SUBJECT_NOTE_MAX = 300;
export const TOPICS_MAX = 12;
export const TOPIC_NAME_MAX = 40;
export const SUBJECT_NOTES_KEYS_MAX = 16;

export interface TopicMarkEntry {
  name: string;
  mark: TopicMark;
}

export interface SubjectNote {
  note?: string;
  topics?: TopicMarkEntry[];
}

export type SubjectNoteMap = Record<string, SubjectNote>;

const isMark = (v: unknown): v is TopicMark => v === "redo" || v === "weak" || v === "good";

const cleanKey = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 24) : "");

/** Accepts any old/new JSON; keeps at most SUBJECT_NOTES_KEYS_MAX subjects with valid content. */
export function normalizeSubjectNotes(raw: unknown): SubjectNoteMap {
  if (!raw || typeof raw !== "object") return {};
  const out: SubjectNoteMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const subject = cleanKey(key);
    if (!subject || !value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    const note = typeof v.note === "string" ? v.note.trim().slice(0, SUBJECT_NOTE_MAX) : "";
    const topics = Array.isArray(v.topics)
      ? v.topics
          .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
          .filter((t) => typeof t.name === "string" && (t.name as string).trim() && isMark(t.mark))
          .map((t) => ({
            name: (t.name as string).trim().slice(0, TOPIC_NAME_MAX),
            mark: t.mark as TopicMark,
          }))
          .filter(
            (t, i, arr) =>
              arr.findIndex((x) => x.name.toLowerCase() === t.name.toLowerCase()) === i,
          )
          .slice(0, TOPICS_MAX)
      : [];
    if (!note && topics.length === 0) continue;
    out[subject] = { ...(note ? { note } : {}), ...(topics.length ? { topics } : {}) };
    if (Object.keys(out).length >= SUBJECT_NOTES_KEYS_MAX) break;
  }
  return out;
}

const pruneEmpty = (notes: SubjectNoteMap): SubjectNoteMap => {
  const out: SubjectNoteMap = {};
  for (const [k, v] of Object.entries(notes)) {
    const hasNote = !!v.note && v.note.length > 0;
    const hasTopics = !!v.topics && v.topics.length > 0;
    if (hasNote || hasTopics)
      out[k] = { ...(hasNote ? { note: v.note } : {}), ...(hasTopics ? { topics: v.topics } : {}) };
  }
  return out;
};

/** Saves the free-text note of a subject. Empty text clears it. Null when the subject key is bad. */
export function setSubjectNote(data: AppData, subject: string, text: string): AppData | null {
  const key = cleanKey(subject);
  if (!key) return null;
  const note = text.trim().slice(0, SUBJECT_NOTE_MAX);
  const prev = data.subjectNotes[key] ?? {};
  const next: SubjectNoteMap = {
    ...data.subjectNotes,
    [key]: { ...prev, ...(note ? { note } : {}) },
  };
  if (!note) delete next[key]?.note;
  return { ...data, subjectNotes: pruneEmpty(next) };
}

/** Sets (or clears with null) the mark of one topic of a subject, creating the topic when new. */
export function setTopicMark(
  data: AppData,
  subject: string,
  topic: string,
  mark: TopicMark | null,
): AppData | null {
  const key = cleanKey(subject);
  const name = topic.trim().slice(0, TOPIC_NAME_MAX);
  if (!key || !name) return null;
  const prev = data.subjectNotes[key] ?? {};
  let topics: TopicMarkEntry[] = [...(prev.topics ?? [])];
  if (mark === null) {
    topics = topics.filter((t) => t.name.toLowerCase() !== name.toLowerCase());
  } else {
    const existing = topics.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      topics = topics.map((t) => (t === existing ? { ...t, mark } : t));
    } else {
      if (topics.length >= TOPICS_MAX) return null;
      topics = [...topics, { name, mark }];
    }
  }
  const next: SubjectNoteMap = {
    ...data.subjectNotes,
    [key]: { ...prev, ...(topics.length ? { topics } : {}) },
  };
  if (topics.length === 0) delete next[key]?.topics;
  return { ...data, subjectNotes: pruneEmpty(next) };
}

/** Removes a whole subject note (used when the subject itself is removed). */
export function removeSubjectNote(data: AppData, subject: string): AppData {
  if (!data.subjectNotes[subject]) return data;
  const next = { ...data.subjectNotes };
  delete next[subject];
  return { ...data, subjectNotes: next };
}

/** All weak / needs-redo topics across subjects, for focusing revision. */
export function weakTopics(data: AppData): { subject: string; topic: string; mark: TopicMark }[] {
  const out: { subject: string; topic: string; mark: TopicMark }[] = [];
  for (const [subject, note] of Object.entries(data.subjectNotes)) {
    for (const t of note.topics ?? []) {
      if (t.mark === "weak" || t.mark === "redo")
        out.push({ subject, topic: t.name, mark: t.mark });
    }
  }
  return out;
}
