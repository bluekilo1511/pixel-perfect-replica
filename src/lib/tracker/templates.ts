import type { TaskKind } from "./model";

// Pure rules for reusable task templates. No browser APIs here, so it is testable.

export interface TaskTemplate {
  id: string;
  title: string;
  kind: TaskKind;
  minutes: number;
  emoji?: string; // custom icon; falls back to the kind emoji when absent
}

export const defaultTemplates = (): TaskTemplate[] => [];

let tplSeq = 0;
export const newTemplateId = () => `tpl_${Date.now().toString(36)}_${(tplSeq++).toString(36)}`;

export const TEMPLATE_EMOJI_MAX = 8;

/** Keeps a short printable icon (emoji, letter, kaomoji fragment) or nothing. */
export function normalizeTemplateEmoji(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = [...raw]
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp > 0x1f && cp !== 0x7f;
    })
    .join("")
    .trim();
  return trimmed ? [...trimmed].slice(0, TEMPLATE_EMOJI_MAX).join("") : undefined;
}

/** Accepts old/new JSON and keeps only well-formed templates. */
export function normalizeTemplates(raw: unknown): TaskTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => !!t && typeof t === "object")
    .map((t) => {
      const r = t as {
        id?: unknown;
        title?: unknown;
        kind?: unknown;
        minutes?: unknown;
        emoji?: unknown;
      };
      const minutes = Math.max(0, Math.round(Number(r.minutes) || 0));
      const kind: TaskKind =
        r.kind === "pomodoro" || r.kind === "exercise" || r.kind === "water" ? r.kind : "custom";
      const emoji = normalizeTemplateEmoji(r.emoji);
      return {
        id: typeof r.id === "string" && r.id ? r.id : newTemplateId(),
        title: String(r.title ?? "Nhiệm vụ"),
        kind,
        minutes,
        ...(emoji ? { emoji } : {}),
      };
    })
    .filter((t) => t.title.trim() !== "");
}
