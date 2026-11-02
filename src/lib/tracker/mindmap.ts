// Mind maps for the study tab: user-drawn concept maps (nodes, shapes, colors)
// plus the "lược đồ tư duy khuyết" puzzle generator built from flashcards.
// Pure logic — no browser APIs — so everything is testable.

import type { Flashcard } from "./flashcards";

export type MindShape = "rect" | "ellipse" | "diamond";

export const MINDMAPS_MAX = 10;
export const MIND_NODES_MAX = 80;
export const MIND_TEXT_MAX = 60;
export const MINDMAP_TITLE_MAX = 40;
export const MIND_CANVAS_W = 900;
export const MIND_CANVAS_H = 900;

/** Minimum canvas size so a tiny map is still comfortably usable. */
export const MIND_MIN_CANVAS_W = 560;
export const MIND_MIN_CANVAS_H = 360;
/** Breathing room added around the outermost nodes. */
const MIND_PAD = 60;

/**
 * Canvas size that hugs the content: big enough to contain every node plus
 * padding, never bigger. Keeps empty scroll space out of the editor.
 */
export function mindCanvasSize(
  nodes: Pick<MindNode, "id" | "x" | "y">[],
  sizes: Record<string, { w: number; h: number }> = {},
): { w: number; h: number } {
  let x1 = 0;
  let y1 = 0;
  for (const n of nodes) {
    const s = sizes[n.id];
    const w = s?.w ?? 170;
    const h = s?.h ?? 44;
    x1 = Math.max(x1, n.x + w / 2);
    y1 = Math.max(y1, n.y + h / 2);
  }
  return {
    w: Math.round(Math.max(MIND_MIN_CANVAS_W, x1 + MIND_PAD)),
    h: Math.round(Math.max(MIND_MIN_CANVAS_H, y1 + MIND_PAD)),
  };
}
export const MIND_COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
] as const;
export const MIND_DEFAULT_COLOR: string = MIND_COLORS[0];

export interface MindNode {
  id: string;
  text: string;
  parentId: string | null; // null = root of the map
  x: number; // canvas px
  y: number;
  color: string;
  shape: MindShape;
}

export interface Mindmap {
  id: string;
  title: string;
  nodes: MindNode[]; // nodes[0] is the root (parentId null)
  updatedAt: string;
}

export function newMindId(): string {
  return `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const clampX = (x: number) => Math.round(Math.min(MIND_CANVAS_W - 40, Math.max(40, x)));
const clampY = (y: number) => Math.round(Math.min(MIND_CANVAS_H - 30, Math.max(30, y)));

const clampText = (t: string) => t.trim().slice(0, MIND_TEXT_MAX);

export function newMindNode(text: string, parentId: string | null, x: number, y: number): MindNode {
  return {
    id: `mn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    text: clampText(text) || "Ý mới",
    parentId,
    x: clampX(x),
    y: clampY(y),
    color: MIND_DEFAULT_COLOR,
    shape: "rect",
  };
}

/** Create a map with a single root node near the top center of the canvas. */
export function newMindmap(title: string): Mindmap {
  return {
    id: newMindId(),
    title: title.trim().slice(0, MINDMAP_TITLE_MAX) || "Sơ đồ mới",
    nodes: [newMindNode(title || "Chủ đề", null, MIND_CANVAS_W / 2, 70)],
    updatedAt: new Date().toISOString(),
  };
}

export function touchMap(map: Mindmap): Mindmap {
  return { ...map, updatedAt: new Date().toISOString() };
}

/** Spawn a child around the parent: sides alternate, each pair drops a row lower. Pure. */
export function addChildNode(map: Mindmap, parentId: string, text = ""): Mindmap | null {
  const parent = map.nodes.find((n) => n.id === parentId);
  if (!parent || map.nodes.length >= MIND_NODES_MAX) return null;
  const childIndex = map.nodes.filter((n) => n.parentId === parentId).length;
  const side = childIndex % 2 === 0 ? 1 : -1;
  const x = clampX(parent.x + side * 170);
  const y = clampY(parent.y + 110 + Math.floor(childIndex / 2) * 90);
  const node = newMindNode(text, parentId, x, y);
  return touchMap({ ...map, nodes: [...map.nodes, node] });
}

export function updateMindNode(
  map: Mindmap,
  id: string,
  patch: Partial<Pick<MindNode, "text" | "color" | "shape">>,
): Mindmap {
  return touchMap({
    ...map,
    nodes: map.nodes.map((n) =>
      n.id === id
        ? {
            ...n,
            text: patch.text !== undefined ? clampText(patch.text) || n.text : n.text,
            color: patch.color ?? n.color,
            shape: patch.shape ?? n.shape,
          }
        : n,
    ),
  });
}

export function moveMindNode(map: Mindmap, id: string, x: number, y: number): Mindmap {
  return touchMap({
    ...map,
    nodes: map.nodes.map((n) => (n.id === id ? { ...n, x: clampX(x), y: clampY(y) } : n)),
  });
}

/** Delete a node and every descendant under it. Pure. */
export function deleteMindNode(map: Mindmap, id: string): Mindmap {
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of map.nodes) {
      if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
        doomed.add(n.id);
        grew = true;
      }
    }
  }
  return touchMap({ ...map, nodes: map.nodes.filter((n) => !doomed.has(n.id)) });
}

/** Normalize unknown storage data into valid mind maps, capped. */
export function normalizeMindmaps(raw: unknown): Mindmap[] {
  if (!Array.isArray(raw)) return [];
  const out: Mindmap[] = [];
  for (const r of raw.slice(0, MINDMAPS_MAX)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "string" && o.id ? o.id : newMindId();
    const title =
      typeof o.title === "string" ? o.title.trim().slice(0, MINDMAP_TITLE_MAX) : "Sơ đồ mới";
    const nodes: MindNode[] = [];
    const ids = new Set<string>();
    const rawParents = new Map<string, string | null>();
    const arr = Array.isArray(o.nodes) ? o.nodes : [];
    for (const nr of arr.slice(0, MIND_NODES_MAX)) {
      if (!nr || typeof nr !== "object") continue;
      const no = nr as Record<string, unknown>;
      const nid = typeof no.id === "string" && no.id ? no.id : `mn_${ids.size}`;
      if (ids.has(nid)) continue;
      ids.add(nid);
      rawParents.set(nid, typeof no.parentId === "string" && no.parentId ? no.parentId : null);
      const shape: MindShape = no.shape === "ellipse" || no.shape === "diamond" ? no.shape : "rect";
      nodes.push({
        id: nid,
        text: typeof no.text === "string" ? clampText(no.text) : "",
        parentId: null, // resolved below
        x: clampX(Number(no.x) || 0),
        y: clampY(Number(no.y) || 0),
        color:
          typeof no.color === "string" && (MIND_COLORS as readonly string[]).includes(no.color)
            ? no.color
            : MIND_DEFAULT_COLOR,
        shape,
      });
    }
    if (!nodes.length) continue;
    // Strict single-root tree: the first explicit root anchors the map; BFS keeps
    // only its descendants. True orphans are dropped, never turned into roots.
    const root = nodes.find((n) => rawParents.get(n.id) === null);
    if (!root) continue;
    const keptIds = new Set<string>([root.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes) {
        const p = rawParents.get(n.id)!;
        if (p && keptIds.has(p) && !keptIds.has(n.id)) {
          keptIds.add(n.id);
          grew = true;
        }
      }
    }
    for (const n of nodes) n.parentId = rawParents.get(n.id) ?? null;
    const kept = nodes.filter((n) => keptIds.has(n.id));
    if (!kept.length) continue;
    out.push({
      id,
      title: title || "Sơ đồ mới",
      nodes: kept,
      updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    });
  }
  return out;
}

// ---- "Lược đồ tư duy khuyết" puzzle: subject -> questions -> answers ----

export interface MindPuzzleNode {
  id: string;
  level: 0 | 1 | 2; // 0 root, 1 question, 2 answer
  text: string | null; // null = punched hole
  cardId: string | null;
  holeOf: string | null; // original text behind the hole (kept in puzzle, hidden in UI)
}

export interface MindPuzzle {
  nodes: MindPuzzleNode[];
  holes: string[]; // node ids with text punched out
  candidates: Array<{ cardId: string; text: string }>; // shuffled chips to fill holes
}

const PUZZLE_CARDS_MAX = 5;

/** Build a mind-tree from flashcards and punch 2-4 holes. Needs >= 4 cards. Pure. */
export function buildMindPuzzle(
  pool: Flashcard[],
  rng: () => number = Math.random,
): MindPuzzle | null {
  if (pool.length < 4) return null;
  const shuffled = [...pool].sort(() => rng() - 0.5).slice(0, PUZZLE_CARDS_MAX);
  const rootText =
    new Set(shuffled.map((c) => c.subject || "Chung")).size === 1
      ? shuffled[0]!.subject || "Chung"
      : "Tổng hợp";
  const nodes: MindPuzzleNode[] = [
    { id: "mp_root", level: 0, text: rootText, cardId: null, holeOf: null },
  ];
  const leaves: string[] = []; // ids of level-2 answer nodes
  const questions: string[] = []; // ids of level-1 question nodes
  shuffled.forEach((c, i) => {
    const qid = `mp_q${i}`;
    nodes.push({ id: qid, level: 1, text: c.question, cardId: c.id, holeOf: null });
    questions.push(qid);
    const aid = `mp_a${i}`;
    nodes.push({ id: aid, level: 2, text: c.answer, cardId: c.id, holeOf: null });
    leaves.push(aid);
  });
  // Punch 2-4 holes: prefer answers, but take one question too when there are 4+.
  const holeCount = Math.min(4, Math.max(2, Math.floor(shuffled.length / 2)));
  const answerPicks = leaves.sort(() => rng() - 0.5).slice(0, holeCount);
  // Half the time punch a question hole as well (needs 4+ question nodes for variety).
  const withQuestion = questions.length >= 4 && rng() < 0.5;
  const questionPick = withQuestion ? [questions[questions.length - 1]!] : [];
  const holeIds = [...answerPicks.slice(0, holeCount - questionPick.length), ...questionPick];
  const holes = new Set(holeIds);
  const holeTexts = new Set<string>();
  for (const n of nodes) {
    if (holes.has(n.id)) {
      n.holeOf = n.text;
      holeTexts.add(n.text!);
      n.text = null;
    }
  }
  // Candidate chips: the punched texts + decoys from untouched cards' answers.
  const decoyPool = pool.filter((c) => !shuffled.some((s) => s.id === c.id)).map((c) => c.answer);
  const decoys: string[] = [];
  for (const d of decoyPool) {
    if (decoys.length >= holeTexts.size * 2) break;
    if (!holeTexts.has(d) && !decoys.includes(d)) decoys.push(d);
  }
  const candidates = [...holeTexts, ...decoys]
    .sort(() => rng() - 0.5)
    .map((text) => {
      const owner = shuffled.find((c) => c.answer === text);
      return { cardId: owner ? owner.id : "", text };
    });
  return { nodes, holes: [...holes], candidates };
}

/**
 * Endpoints of the connector line between two nodes, trimmed so the line
 * starts at the edge of node A and ends at the edge of node B (not the
 * centers, which would draw through the node text).
 */
export function connectorEnds(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  aShape: MindShape,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  bShape: MindShape,
): { x1: number; y1: number; x2: number; y2: number } {
  const dist = Math.hypot(bx - ax, by - ay);
  if (dist < 1e-6) return { x1: ax, y1: ay, x2: bx, y2: by };
  const dx = (bx - ax) / dist;
  const dy = (by - ay) / dist;
  const reach = (
    cx: number,
    cy: number,
    w: number,
    h: number,
    shape: MindShape,
    sx: number,
    sy: number,
  ): { x: number; y: number } => {
    const hw = Math.max(1, w / 2);
    const hh = Math.max(1, h / 2);
    let t: number;
    if (shape === "ellipse") {
      t = 1 / Math.sqrt((sx / hw) ** 2 + (sy / hh) ** 2);
    } else if (shape === "diamond") {
      t = 1 / (Math.abs(sx) / hw + Math.abs(sy) / hh);
    } else {
      const tx = Math.abs(sx) < 1e-9 ? Infinity : hw / Math.abs(sx);
      const ty = Math.abs(sy) < 1e-9 ? Infinity : hh / Math.abs(sy);
      t = Math.min(tx, ty);
    }
    return { x: cx + sx * t, y: cy + sy * t };
  };
  const p1 = reach(ax, ay, aw, ah, aShape, dx, dy);
  const p2 = reach(bx, by, bw, bh, bShape, -dx, -dy);
  // Guard against heavy overlap: if the trimmed segment points backwards,
  // fall back to the centers instead of drawing through the nodes.
  const forward = (p2.x - p1.x) * dx + (p2.y - p1.y) * dy;
  if (forward < 0) return { x1: ax, y1: ay, x2: bx, y2: by };
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}
