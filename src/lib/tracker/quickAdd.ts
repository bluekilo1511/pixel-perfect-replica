// Pure rules for the Ctrl+K quick-add. No browser APIs here, so it is testable.

export interface QuickAddParsed {
  title: string;
  minutes: number | null; // duration typed in the text, e.g. "25p"
  subject: string | null; // subject tag typed with #, e.g. "Học #Toán 25p"
}

const DURATION_RE = /(\d{1,3})\s*(?:p|phut|phút)(?=\s|$)/i;
const SUBJECT_TAG_RE = /#([^\s#]{1,24})(?=\s|$)/;

/** "Học Toán 25p" -> { title: "Học Toán", minutes: 25 }. Without a duration, minutes stays null. */
export function parseQuickAdd(text: string): QuickAddParsed {
  const raw = text.trim();
  const tag = raw.match(SUBJECT_TAG_RE);
  const withoutTag = (tag ? raw.replace(tag[0], " ") : raw).replace(/\s+/g, " ").trim();
  const m = withoutTag.match(DURATION_RE);
  const minutes = m ? Math.max(0, Math.min(600, Math.round(Number(m[1])))) : null;
  const title = (
    m ? withoutTag.slice(0, m.index) + withoutTag.slice((m.index ?? 0) + m[0].length) : withoutTag
  )
    .replace(/(^|\s)#(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: title || "Nhiệm vụ", minutes, subject: tag?.[1] ?? null };
}
