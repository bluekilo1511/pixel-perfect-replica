import { describe, expect, it } from "vitest";
import { newFlashcard, type Flashcard } from "./flashcards";
import {
  addChildNode,
  buildMindPuzzle,
  deleteMindNode,
  MIND_CANVAS_H,
  MIND_CANVAS_W,
  moveMindNode,
  newMindmap,
  normalizeMindmaps,
  updateMindNode,
  type Mindmap,
} from "./mindmap";
import { blankMatches, buildBlankRound, normalizeStudyHistory } from "./study";

const rng = () => 0.42; // deterministic enough for layout/sort tests

const card = (i: number): Flashcard =>
  newFlashcard(`Môn ${i % 2}`, `Câu hỏi số ${i}?`, `Đáp án của thẻ ${i}`, "2026-01-01");

describe("mind maps", () => {
  it("creates a map with a single root node", () => {
    const m = newMindmap("Toán rời rạc");
    expect(m.title).toBe("Toán rời rạc");
    expect(m.nodes).toHaveLength(1);
    expect(m.nodes[0]!.parentId).toBeNull();
  });

  it("spawns children around the parent: sides alternate, rows drop", () => {
    let m = newMindmap("T");
    const root = m.nodes[0]!.id;
    for (let i = 0; i < 4; i++) m = addChildNode(m, root)!;
    expect(m.nodes).toHaveLength(5);
    const kids = m.nodes.filter((n) => n.parentId === root);
    const rights = kids.filter((n) => n.x > m.nodes[0]!.x);
    const lefts = kids.filter((n) => n.x < m.nodes[0]!.x);
    expect(rights).toHaveLength(2);
    expect(lefts).toHaveLength(2);
    expect(new Set(kids.map((k) => k.y)).size).toBe(2); // two rows of two
  });

  it("refuses children past the node cap or on a missing parent", () => {
    const m = newMindmap("T");
    expect(addChildNode(m, "không-tồn-tại")).toBeNull();
    const big: Mindmap = {
      ...m,
      nodes: Array.from({ length: 80 }, (_, i) => ({ ...m.nodes[0]!, id: `n${i}` })),
    };
    expect(addChildNode(big, big.nodes[0]!.id)).toBeNull();
  });

  it("edits text/color/shape with clamping", () => {
    let m = newMindmap("T");
    const root = m.nodes[0]!.id;
    m = updateMindNode(m, root, {
      text: "  ".padEnd(70, "a") + " ",
      color: "#f472b6",
      shape: "diamond",
    });
    expect(m.nodes[0]!.text.length).toBeLessThanOrEqual(60);
    expect(m.nodes[0]!.color).toBe("#f472b6");
    expect(m.nodes[0]!.shape).toBe("diamond");
    m = updateMindNode(m, root, { text: "   " });
    expect(m.nodes[0]!.text.length).toBeGreaterThan(0); // never blanked out
  });

  it("moves nodes within the canvas bounds", () => {
    let m = newMindmap("T");
    const root = m.nodes[0]!.id;
    m = moveMindNode(m, root, -500, MIND_CANVAS_H + 999);
    expect(m.nodes[0]!.x).toBeGreaterThanOrEqual(40);
    expect(m.nodes[0]!.y).toBeLessThanOrEqual(MIND_CANVAS_H - 30);
  });

  it("deletes a node and its whole subtree", () => {
    let m = newMindmap("T");
    const root = m.nodes[0]!.id;
    m = addChildNode(m, root, "con 1")!;
    m = addChildNode(m, m.nodes[1]!.id, "cháu 1")!;
    m = addChildNode(m, root, "con 2")!;
    m = deleteMindNode(m, m.nodes[1]!.id);
    expect(m.nodes.map((n) => n.text)).toEqual(["T", "con 2"]);
  });

  it("normalizes junk: keeps valid nodes, drops orphans, fixes bad values", () => {
    const good = newMindmap("Giữ");
    const raw = [
      {
        id: "mm_x",
        title: "  Tự vẽ  ",
        nodes: [
          ...good.nodes,
          { id: "orphan", parentId: "ghost", x: 10, y: 10, text: "mồ côi" },
          { id: "bad", parentId: null, x: 10, y: 10 }, // no text
        ],
        shape: "triangle",
        color: "#fff",
      },
      "junk",
      null,
    ];
    const maps = normalizeMindmaps(raw);
    expect(maps).toHaveLength(1);
    expect(maps[0]!.title).toBe("Tự vẽ");
    expect(maps[0]!.nodes.some((n) => n.id === "orphan")).toBe(false);
    expect(maps[0]!.nodes.every((n) => n.shape !== ("triangle" as never))).toBe(true);
  });
});

describe("mind puzzle (lược đồ khuyết)", () => {
  it("needs at least 4 cards", () => {
    expect(buildMindPuzzle([card(0), card(1), card(2)], rng)).toBeNull();
  });

  it("builds a 3-level tree and punches 2-4 holes with matching candidates", () => {
    const pool = Array.from({ length: 6 }, (_, i) => card(i));
    const p = buildMindPuzzle(pool, rng)!;
    expect(p).not.toBeNull();
    expect(p.nodes.filter((n) => n.level === 0)).toHaveLength(1);
    expect(p.nodes.filter((n) => n.level === 1)).toHaveLength(5);
    expect(p.nodes.filter((n) => n.level === 2)).toHaveLength(5);
    expect(p.holes.length).toBeGreaterThanOrEqual(2);
    expect(p.holes.length).toBeLessThanOrEqual(4);
    const holeNodes = p.nodes.filter((n) => p.holes.includes(n.id));
    for (const h of holeNodes) {
      expect(h.text).toBeNull();
      expect(h.holeOf).toBeTruthy();
      expect(p.candidates.some((c) => c.text === h.holeOf)).toBe(true);
    }
    // Every candidate is unique and at least one decoy exists.
    const texts = p.candidates.map((c) => c.text);
    expect(new Set(texts).size).toBe(texts.length);
    expect(texts.length).toBeGreaterThan(p.holes.length);
    // Non-hole nodes keep their text.
    expect(p.nodes.filter((n) => !p.holes.includes(n.id)).every((n) => n.text !== null)).toBe(true);
  });

  it("sometimes punches a question hole when there are 4+ questions", () => {
    const pool = Array.from({ length: 6 }, (_, i) => card(i));
    const seen = new Set<number>();
    for (let s = 0; s < 40; s++) {
      let seed = s + 1;
      const r = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      const p = buildMindPuzzle(pool, r)!;
      seen.add(p.nodes.filter((n) => p.holes.includes(n.id) && n.level === 1).length);
    }
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1)).toBe(true);
  });
});

describe("fill-in-the-blank game", () => {
  it("matches blanks loosely: case, spaces and punctuation", () => {
    expect(blankMatches("Tán xạ Rayleigh", "tán xạ   rayleigh")).toBe(true);
    expect(blankMatches("Hà Nội, Việt Nam", "hà nội việt nam")).toBe(true);
    expect(blankMatches("Hà Nội", "Hải Phòng")).toBe(false);
    expect(blankMatches("abc", "  ")).toBe(false);
  });

  it("builds rounds with 1-2 blanks inside the answer", () => {
    const short = newFlashcard("Môn", "Hỏi?", "một hai ba", "2026-01-01");
    const long = newFlashcard("Môn", "Hỏi nữa?", "năm sáu bảy tám chín mười", "2026-01-01");
    const oneWord = newFlashcard("Môn", "Hỏi luôn?", "duy-nhất", "2026-01-01");
    const qs = buildBlankRound([short, long, oneWord], 10);
    expect(qs).toHaveLength(2); // one-word answers are not playable
    for (const q of qs) {
      expect(q.blanks.length).toBeGreaterThanOrEqual(1);
      expect(q.blanks.length).toBeLessThanOrEqual(2);
      expect(q.parts.join(" ")).toBe(q.parts.join(" "));
      for (const b of q.blanks) expect(q.parts[b.index]).toBe(b.answer);
      const idxs = q.blanks.map((b) => b.index);
      expect(new Set(idxs).size).toBe(idxs.length);
    }
    const longQ = qs.find((q) => q.parts.length === 6)!;
    expect(longQ.blanks).toHaveLength(2);
  });

  it("history normalization accepts the new game kinds", () => {
    const base = { date: "2026-01-01", subject: "Toán", correct: 1, total: 2, seconds: 30 };
    const out = normalizeStudyHistory([
      { ...base, game: "blank" },
      { ...base, game: "flashcards" },
      { ...base, game: "mindpuzzle" },
      { ...base, game: "nonsense" },
    ]);
    expect(out.map((r) => r.game)).toEqual(["blank", "flashcards", "mindpuzzle"]);
  });
});
