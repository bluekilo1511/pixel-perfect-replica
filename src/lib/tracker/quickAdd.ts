// Pure rules for the Ctrl+K quick-add. No browser APIs here, so it is testable.

export interface QuickAddParsed {
  title: string;
  minutes: number | null; // duration typed in the text, e.g. "25p"
}

const DURATION_RE = /(\d{1,3})\s*(?:p|phut|phút)(?=\s|$)/i;

/** "Học Toán 25p" -> { title: "Học Toán", minutes: 25 }. Without a duration, minutes stays null. */
export function parseQuickAdd(text: string): QuickAddParsed {
  const raw = text.trim();
  const m = raw.match(DURATION_RE);
  const minutes = m ? Math.max(0, Math.min(600, Math.round(Number(m[1])))) : null;
  const title = (m ? raw.slice(0, m.index) + raw.slice((m.index ?? 0) + m[0].length) : raw)
    .replace(/\s+/g, " ")
    .trim();
  return { title: title || "Nhiệm vụ", minutes };
}
