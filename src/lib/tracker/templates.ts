import type { TaskKind } from "./model";

// Pure rules for reusable task templates. No browser APIs here, so it is testable.

export interface TaskTemplate {
  id: string;
  title: string;
  kind: TaskKind;
  minutes: number;
}

export const defaultTemplates = (): TaskTemplate[] => [];

let tplSeq = 0;
export const newTemplateId = () => `tpl_${Date.now().toString(36)}_${(tplSeq++).toString(36)}`;

/** Accepts old/new JSON and keeps only well-formed templates. */
export function normalizeTemplates(raw: unknown): TaskTemplate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => !!t && typeof t === "object")
    .map((t) => {
      const r = t as { id?: unknown; title?: unknown; kind?: unknown; minutes?: unknown };
      const minutes = Math.max(0, Math.round(Number(r.minutes) || 0));
      const kind: TaskKind =
        r.kind === "pomodoro" || r.kind === "exercise" || r.kind === "water" ? r.kind : "custom";
      return {
        id: typeof r.id === "string" && r.id ? r.id : newTemplateId(),
        title: String(r.title ?? "Nhiệm vụ"),
        kind,
        minutes,
      };
    })
    .filter((t) => t.title.trim() !== "");
}
