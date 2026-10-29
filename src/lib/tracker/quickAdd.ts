// Pure rules for the Ctrl+K quick-add. No browser APIs here, so it is testable.

export interface QuickAddParsed {
  title: string;
  minutes: number | null; // duration typed in the text, e.g. "25p"
}

const DURATION_RE = /(\d{1,3})\s*(?:p|phut|phút)(?=\s|$)/i;

// Accepted duration spellings: "25p", "25 phut", "25 phút" (case-insensitive),
// always at a word boundary so "Toán25p" and "Học 25p" both match while an
// unrelated "p" inside a word never triggers a split. Values are clamped to
// 0..600 minutes to keep a stray "9999p" from producing a nonsense timer.

/**
 * "Học Toán 25p" -> { title: "Học Toán", minutes: 25 }. Without a duration,
 * minutes stays null.
 *
 * Subjects are never parsed from the text (the old "#Tiếng Anh" tag syntax is
 * gone: it broke multi-word names like "Tiếng Anh" into just "Tiếng"). They
 * attach automatically by title match against the subject list, or through the
 * explicit timetable-slot and exam subject bindings. Keep this function pure:
 * no browser APIs, so it stays cheap to unit-test.
 */
export function parseQuickAdd(text: string): QuickAddParsed {
  const raw = text.trim();
  const m = raw.match(DURATION_RE);
  const minutes = m ? Math.max(0, Math.min(600, Math.round(Number(m[1])))) : null;
  const title = (m ? raw.slice(0, m.index) + raw.slice((m.index ?? 0) + m[0].length) : raw)
    .replace(/\s+/g, " ")
    .trim();
  return { title: title || "Nhiệm vụ", minutes };
}
