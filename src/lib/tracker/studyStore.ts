// IndexedDB-backed study storage: one record per deck ("one file") instead of
// one giant JSON blob. The library tree lives in its own record; each deck's
// cards live in the `decks` store; a small card index powers due-counts without
// loading every card. Mindmaps get one record each too.
// The IDB factory is injectable so tests can use fake-indexeddb.
import type { Flashcard } from "./flashcards";
import type { Mindmap } from "./mindmap";
import {
  defaultLibrary,
  findDeck,
  normalizeLibrary,
  type FolderNode,
  type Library,
  type SubjectNode,
} from "./library";

const DB_NAME = "pixel-perfect-study";
const DB_VERSION = 1;
const TREE_KEY = "library";
const S_TREE = "tree";
const S_DECKS = "decks";
const S_INDEX = "cardIndex";
const S_MAPS = "maps";

let factory: IDBFactory | null = null;
/** Test hook: inject a fake-indexeddb factory. Null restores the browser default. */
export function setStudyDbFactory(f: IDBFactory | null) {
  factory = f;
}

const idb = (): IDBFactory | null => {
  if (factory) return factory;
  try {
    return typeof indexedDB !== "undefined" ? indexedDB : null;
  } catch {
    return null;
  }
};

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error("IndexedDB request failed"));
  });

/** Delete every index entry of one deck via cursor (event-driven, not awaited per step). */
const deleteIndexForDeck = (byDeck: IDBIndex, deckId: string): Promise<void> =>
  new Promise((res, rej) => {
    const cursorReq = byDeck.openCursor(IDBKeyRange.only(deckId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) {
        res();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    cursorReq.onerror = () => rej(cursorReq.error ?? new Error("Index cursor failed"));
  });

const txDone = (tx: IDBTransaction): Promise<void> =>
  new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onabort = () => rej(tx.error ?? new Error("IndexedDB transaction aborted"));
    tx.onerror = () => rej(tx.error ?? new Error("IndexedDB transaction error"));
  });

function openDb(): Promise<IDBDatabase> {
  const f = idb();
  if (!f) return Promise.reject(new Error("IndexedDB unavailable"));
  return new Promise((res, rej) => {
    const open = f.open(DB_NAME, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(S_TREE)) db.createObjectStore(S_TREE);
      if (!db.objectStoreNames.contains(S_DECKS)) db.createObjectStore(S_DECKS);
      if (!db.objectStoreNames.contains(S_INDEX)) {
        const idx = db.createObjectStore(S_INDEX, { keyPath: "cardId" });
        idx.createIndex("byDeck", "deckId", { unique: false });
      }
      if (!db.objectStoreNames.contains(S_MAPS)) db.createObjectStore(S_MAPS);
    };
    open.onsuccess = () => res(open.result);
    open.onerror = () => rej(open.error ?? new Error("IndexedDB open failed"));
  });
}

// ---- Library tree ----

export async function loadLibrary(): Promise<Library | null> {
  const db = await openDb();
  try {
    const v = await req(db.transaction(S_TREE).objectStore(S_TREE).get(TREE_KEY) as IDBRequest);
    return v ? normalizeLibrary(v) : null;
  } finally {
    db.close();
  }
}

export async function saveLibrary(library: Library): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(S_TREE, "readwrite");
    tx.objectStore(S_TREE).put(library, TREE_KEY);
    await txDone(tx);
  } finally {
    db.close();
  }
}

// ---- Deck cards ----

export async function loadDeckCards(deckId: string): Promise<Flashcard[]> {
  const db = await openDb();
  try {
    const v = await req(db.transaction(S_DECKS).objectStore(S_DECKS).get(deckId) as IDBRequest);
    return Array.isArray(v) ? (v as Flashcard[]) : [];
  } finally {
    db.close();
  }
}

/** Write one deck's cards and refresh the card index for due-counts. */
export async function saveDeck(deckId: string, cards: Flashcard[]): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([S_DECKS, S_INDEX], "readwrite");
    const decks = tx.objectStore(S_DECKS);
    const index = tx.objectStore(S_INDEX);
    decks.put(cards, deckId);
    await deleteIndexForDeck(index.index("byDeck"), deckId);
    for (const c of cards) index.put({ cardId: c.id, deckId, due: c.due });
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteDeckCards(deckId: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction([S_DECKS, S_INDEX], "readwrite");
    tx.objectStore(S_DECKS).delete(deckId);
    await deleteIndexForDeck(tx.objectStore(S_INDEX).index("byDeck"), deckId);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** All cards across every deck (games build pools from these). */
export async function loadAllCards(): Promise<Flashcard[]> {
  const db = await openDb();
  try {
    const all = await req(
      db.transaction(S_DECKS).objectStore(S_DECKS).getAll() as IDBRequest<unknown[]>,
    );
    const out: Flashcard[] = [];
    for (const deck of all) if (Array.isArray(deck)) out.push(...(deck as Flashcard[]));
    return out;
  } finally {
    db.close();
  }
}

// ---- Mindmaps ----

export async function loadMaps(): Promise<Mindmap[]> {
  const db = await openDb();
  try {
    const all = await req(db.transaction(S_MAPS).objectStore(S_MAPS).getAll() as IDBRequest);
    return Array.isArray(all) ? (all as Mindmap[]) : [];
  } finally {
    db.close();
  }
}

export async function saveMap(map: Mindmap): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(S_MAPS, "readwrite");
    tx.objectStore(S_MAPS).put(map, map.id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteMap(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(S_MAPS, "readwrite");
    tx.objectStore(S_MAPS).delete(id);
    await txDone(tx);
  } finally {
    db.close();
  }
}

// ---- Stats / due counts (reads the light card index, not the cards) ----

export interface StudyCounts {
  cards: number;
  due: number;
  decks: number;
  maps: number;
}

export async function dueCountAll(today: string): Promise<number> {
  const db = await openDb();
  try {
    const all = await req(
      db.transaction(S_INDEX).objectStore(S_INDEX).getAll() as IDBRequest<
        Array<{ cardId: string; deckId: string; due: string }>
      >,
    );
    return all.filter((e) => e && e.due <= today).length;
  } finally {
    db.close();
  }
}

export async function studyStats(today: string): Promise<StudyCounts> {
  const db = await openDb();
  try {
    const [index, deckIds, maps] = await Promise.all([
      req(
        db.transaction(S_INDEX).objectStore(S_INDEX).getAll() as IDBRequest<
          Array<{ cardId: string; deckId: string; due: string }>
        >,
      ),
      req(db.transaction(S_DECKS).objectStore(S_DECKS).getAllKeys() as IDBRequest<IDBValidKey[]>),
      req(db.transaction(S_MAPS).objectStore(S_MAPS).getAllKeys() as IDBRequest<IDBValidKey[]>),
    ]);
    return {
      cards: index.length,
      due: index.filter((e) => e && e.due <= today).length,
      decks: deckIds.length,
      maps: maps.length,
    };
  } finally {
    db.close();
  }
}

// ---- Legacy migration ----

const ROOT_FOLDER = "📁 Thư viện của tôi";
const DEFAULT_DECK = "Bộ ôn tập";

/**
 * Merge legacy AppData flashcards/mindmaps into the IndexedDB library.
 * Merge-by-id, so restoring an old backup never duplicates cards. Creates the
 * tree (root folder → subject → one deck per subject label) on first run and
 * appends anything new afterwards. Returns how many items were merged.
 */
export async function mergeLegacy(cards: Flashcard[], maps: Mindmap[]): Promise<number> {
  let merged = 0;
  const lib = (await loadLibrary()) ?? defaultLibrary();
  const existing = await loadAllCards();
  const knownCards = new Set(existing.map((c) => c.id));

  // Subject → deckId cache for this merge run.
  const deckBySubject = new Map<string, string>();
  const subjectDeck = async (label: string): Promise<string> => {
    const clean = label.trim() || "Chung";
    const cached = deckBySubject.get(clean);
    if (cached) return cached;
    // Already in the tree? Find a subject with this name (first match wins).
    for (const f of lib.folders) {
      for (const s of f.subjects) {
        const deck = s.decks.find((d) => d.name === DEFAULT_DECK) ?? null;
        if (s.name === clean && deck) {
          deckBySubject.set(clean, deck.id);
          return deck.id;
        }
        const termDeck = s.terms
          .map((t) => t.decks.find((d) => d.name === DEFAULT_DECK))
          .find((d) => !!d);
        if (s.name === clean && termDeck) {
          deckBySubject.set(clean, termDeck!.id);
          return termDeck!.id;
        }
      }
    }
    // Create root folder + subject + deck as needed (mirrors library.ts helpers inline
    // to avoid async/pure tangles in one pass).
    let root: FolderNode | undefined = lib.folders.find((f) => f.name === ROOT_FOLDER);
    if (!root) {
      root = { id: `fold_${Date.now().toString(36)}_root`, name: ROOT_FOLDER, subjects: [] };
      lib.folders.push(root);
    }
    let subject: SubjectNode | undefined = root.subjects.find((s) => s.name === clean);
    if (!subject) {
      subject = {
        id: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: clean,
        terms: [],
        decks: [],
      };
      root.subjects.push(subject);
    }
    const deck = {
      id: `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: DEFAULT_DECK,
      createdAt: new Date().toISOString(),
    };
    subject.decks.push(deck);
    deckBySubject.set(clean, deck.id);
    return deck.id;
  };

  const byDeck = new Map<string, Flashcard[]>();
  const grab = async (c: Flashcard) => {
    if (knownCards.has(c.id)) return;
    knownCards.add(c.id);
    const deckId = c.deckId ?? (await subjectDeck(c.subject));
    const list = byDeck.get(deckId) ?? [];
    list.push({ ...c, deckId });
    byDeck.set(deckId, list);
    merged += 1;
  };

  const pending: Flashcard[] = [];
  for (const c of cards) if (!knownCards.has(c.id)) pending.push(c);
  for (const c of pending) await grab(c);

  if (byDeck.size) {
    await saveLibrary(lib);
    for (const [deckId, list] of byDeck) {
      const prior = await loadDeckCards(deckId);
      await saveDeck(deckId, [...prior, ...list]);
    }
  } else if (!lib.folders.length && cards.length === 0 && maps.length === 0) {
    // First run with nothing to migrate: still seed the tree so the UI has a root.
    await saveLibrary(lib);
  }

  for (const m of maps) {
    const all = await loadMaps();
    if (!all.some((x) => x.id === m.id)) {
      await saveMap(m);
      merged += 1;
    }
  }
  return merged;
}

/** Deck meta derived from the tree (for browsers that show counts). */
export interface DeckRef {
  deckId: string;
  path: string;
}

export function deckRefs(library: Library): DeckRef[] {
  const out: DeckRef[] = [];
  for (const f of library.folders)
    for (const s of f.subjects) {
      for (const d of s.decks)
        out.push({ deckId: d.id, path: `${f.name} / ${s.name} / ${d.name}` });
      for (const t of s.terms)
        for (const d of t.decks)
          out.push({ deckId: d.id, path: `${f.name} / ${s.name} / ${t.name} / ${d.name}` });
    }
  return out;
}

export { findDeck };
