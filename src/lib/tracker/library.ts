// Thư viện học tập: cây Thư mục (năm học) → Môn → Học kỳ → Bộ thẻ.
// Pure logic, no browser APIs, so everything is testable. The tree is tiny
// metadata (names + ids only) — the cards themselves live one record per deck
// in IndexedDB (see studyStore.ts).

export const NAME_MAX = 40;
export const FOLDERS_MAX = 20;
export const SUBJECTS_PER_FOLDER_MAX = 30;
export const TERMS_PER_SUBJECT_MAX = 30;
export const DECKS_PER_CONTAINER_MAX = 40;

export interface DeckNode {
  id: string;
  name: string;
  createdAt: string;
}
export interface TermNode {
  id: string;
  name: string;
  decks: DeckNode[];
}
export interface SubjectNode {
  id: string;
  name: string;
  terms: TermNode[];
  decks: DeckNode[]; // decks that hang directly off the subject (no term)
}
export interface FolderNode {
  id: string;
  name: string;
  subjects: SubjectNode[];
}
export interface Library {
  folders: FolderNode[];
}

export const newLibId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const defaultLibrary = (): Library => ({ folders: [] });

export const cleanName = (n: string) => n.trim().slice(0, NAME_MAX);

export interface DeckPath {
  folder: FolderNode;
  subject: SubjectNode;
  term: TermNode | null;
  deck: DeckNode;
}

/** Locate a deck and its full path in the tree, or null. */
export function findDeck(library: Library, deckId: string): DeckPath | null {
  for (const folder of library.folders) {
    for (const subject of folder.subjects) {
      for (const term of subject.terms) {
        const deck = term.decks.find((d) => d.id === deckId);
        if (deck) return { folder, subject, term, deck };
      }
      const deck = subject.decks.find((d) => d.id === deckId);
      if (deck) return { folder, subject, term: null, deck };
    }
  }
  return null;
}

/** Human label for a deck: "Thư mục / Môn (· Học kỳ) / Bộ". Chips can use just the subject name. */
export function deckLabel(library: Library, deckId: string): string {
  const p = findDeck(library, deckId);
  if (!p) return deckId;
  const mid = p.term ? ` · ${p.term.name}` : "";
  return `${p.subject.name}${mid} / ${p.deck.name}`;
}

/** Subject display name for a deck (cards' `subject` chip uses this). */
export function deckSubjectName(library: Library, deckId: string): string {
  const p = findDeck(library, deckId);
  return p ? p.subject.name : "";
}

const findFolder = (library: Library, folderId: string) =>
  library.folders.find((f) => f.id === folderId);
const findSubject = (folder: FolderNode | undefined, subjectId: string) =>
  folder?.subjects.find((s) => s.id === subjectId);
const findTerm = (subject: SubjectNode | undefined, termId: string) =>
  subject?.terms.find((t) => t.id === termId);

const deckNode = (name: string): DeckNode => ({
  id: newLibId("deck"),
  name: cleanName(name) || "Bộ thẻ",
  createdAt: new Date().toISOString(),
});

/** Add a folder. Returns the new tree or null when the name is empty/cap hit. */
export function addFolder(library: Library, name: string): Library | null {
  const clean = cleanName(name);
  if (!clean || library.folders.length >= FOLDERS_MAX) return null;
  return { folders: [...library.folders, { id: newLibId("fold"), name: clean, subjects: [] }] };
}

export function addSubject(library: Library, folderId: string, name: string): Library | null {
  const folder = findFolder(library, folderId);
  const clean = cleanName(name);
  if (!folder || !clean || folder.subjects.length >= SUBJECTS_PER_FOLDER_MAX) return null;
  return {
    folders: library.folders.map((f) =>
      f.id === folderId
        ? {
            ...f,
            subjects: [...f.subjects, { id: newLibId("sub"), name: clean, terms: [], decks: [] }],
          }
        : f,
    ),
  };
}

export function addTerm(
  library: Library,
  folderId: string,
  subjectId: string,
  name: string,
): Library | null {
  const folder = findFolder(library, folderId);
  const subject = findSubject(folder, subjectId);
  const clean = cleanName(name);
  if (!subject || !clean || subject.terms.length >= TERMS_PER_SUBJECT_MAX) return null;
  return {
    folders: library.folders.map((f) =>
      f.id !== folderId
        ? f
        : {
            ...f,
            subjects: f.subjects.map((s) =>
              s.id === subjectId
                ? { ...s, terms: [...s.terms, { id: newLibId("term"), name: clean, decks: [] }] }
                : s,
            ),
          },
    ),
  };
}

/** Add a deck under a term, or directly under the subject when termId is null. */
export function addDeck(
  library: Library,
  folderId: string,
  subjectId: string,
  termId: string | null,
  name: string,
): { library: Library; deckId: string } | null {
  const folder = findFolder(library, folderId);
  const subject = findSubject(folder, subjectId);
  if (!subject) return null;
  const term = termId ? findTerm(subject, termId) : null;
  if (termId && !term) return null;
  const container: DeckNode[] = term ? term.decks : subject.decks;
  if (container.length >= DECKS_PER_CONTAINER_MAX) return null;
  const node = deckNode(name);
  const graft = (decks: DeckNode[]) => [...decks, node];
  return {
    library: {
      folders: library.folders.map((f) =>
        f.id !== folderId
          ? f
          : {
              ...f,
              subjects: f.subjects.map((s) => {
                if (s.id !== subjectId) return s;
                if (!term) return { ...s, decks: graft(s.decks) };
                return {
                  ...s,
                  terms: s.terms.map((t) =>
                    t.id === termId ? { ...t, decks: graft(t.decks) } : t,
                  ),
                };
              }),
            },
      ),
    },
    deckId: node.id,
  };
}

/** Rename any node in place. */
export function renameNode(
  library: Library,
  kind: "folder" | "subject" | "term" | "deck",
  id: string,
  name: string,
): Library | null {
  const clean = cleanName(name);
  if (!clean) return null;
  const walk = (decks: DeckNode[]): DeckNode[] | null => {
    if (!decks.some((d) => d.id === id)) return null;
    return decks.map((d) => (d.id === id ? { ...d, name: clean } : d));
  };
  for (let fi = 0; fi < library.folders.length; fi++) {
    const f = library.folders[fi]!;
    if (kind === "folder" && f.id === id)
      return {
        folders: library.folders.map((x) => (x.id === id ? { ...x, name: clean } : x)),
      };
    for (let si = 0; si < f.subjects.length; si++) {
      const s = f.subjects[si]!;
      if (kind === "subject" && s.id === id)
        return {
          folders: library.folders.map((x) =>
            x.id === f.id
              ? { ...x, subjects: x.subjects.map((y) => (y.id === id ? { ...y, name: clean } : y)) }
              : x,
          ),
        };
      for (let ti = 0; ti < s.terms.length; ti++) {
        const t = s.terms[ti]!;
        if (kind === "term" && t.id === id)
          return {
            folders: library.folders.map((x) =>
              x.id === f.id
                ? {
                    ...x,
                    subjects: x.subjects.map((y) =>
                      y.id === s.id
                        ? {
                            ...y,
                            terms: y.terms.map((z) => (z.id === id ? { ...z, name: clean } : z)),
                          }
                        : y,
                    ),
                  }
                : x,
            ),
          };
        const decks = walk(t.decks);
        if (decks)
          return {
            folders: library.folders.map((x) =>
              x.id === f.id
                ? {
                    ...x,
                    subjects: x.subjects.map((y) =>
                      y.id === s.id
                        ? {
                            ...y,
                            terms: y.terms.map((z) => (z.id === t.id ? { ...z, decks } : z)),
                          }
                        : y,
                    ),
                  }
                : x,
            ),
          };
      }
      const decks = walk(s.decks);
      if (decks)
        return {
          folders: library.folders.map((x) =>
            x.id === f.id
              ? { ...x, subjects: x.subjects.map((y) => (y.id === s.id ? { ...y, decks } : y)) }
              : x,
          ),
        };
    }
  }
  return null;
}

/** Remove a node (deck / term / subject / folder) by id; cascades children. */
export function removeNode(
  library: Library,
  id: string,
): { library: Library; deckIds: string[] } | null {
  const collectDecks = (node: {
    decks?: DeckNode[];
    terms?: TermNode[];
    subjects?: SubjectNode[];
  }) => {
    const ids: string[] = [];
    for (const d of node.decks ?? []) ids.push(d.id);
    for (const t of node.terms ?? []) for (const d of t.decks) ids.push(d.id);
    for (const s of node.subjects ?? []) {
      for (const d of s.decks) ids.push(d.id);
      for (const t of s.terms) for (const d of t.decks) ids.push(d.id);
    }
    return ids;
  };
  const strip = <T extends { id: string }>(list: T[], target: string): T[] =>
    list.filter((x) => x.id !== target);

  for (const f of library.folders) {
    if (f.id === id)
      return { library: { folders: strip(library.folders, id) }, deckIds: collectDecks(f) };
    for (const s of f.subjects) {
      if (s.id === id)
        return {
          library: {
            folders: library.folders.map((x) =>
              x.id === f.id ? { ...x, subjects: strip(x.subjects, id) } : x,
            ),
          },
          deckIds: collectDecks(s),
        };
      for (const t of s.terms) {
        if (t.id === id)
          return {
            library: {
              folders: library.folders.map((x) =>
                x.id === f.id
                  ? {
                      ...x,
                      subjects: x.subjects.map((y) =>
                        y.id === s.id ? { ...y, terms: strip(y.terms, id) } : y,
                      ),
                    }
                  : x,
              ),
            },
            deckIds: t.decks.map((d) => d.id),
          };
      }
      if (s.decks.some((d) => d.id === id))
        return {
          library: {
            folders: library.folders.map((x) =>
              x.id === f.id
                ? {
                    ...x,
                    subjects: x.subjects.map((y) =>
                      y.id === s.id ? { ...y, decks: strip(y.decks, id) } : y,
                    ),
                  }
                : x,
            ),
          },
          deckIds: [id],
        };
      for (const t of s.terms) {
        if (t.decks.some((d) => d.id === id))
          return {
            library: {
              folders: library.folders.map((x) =>
                x.id === f.id
                  ? {
                      ...x,
                      subjects: x.subjects.map((y) =>
                        y.id === s.id
                          ? {
                              ...y,
                              terms: y.terms.map((z) =>
                                z.id === t.id ? { ...z, decks: strip(z.decks, id) } : z,
                              ),
                            }
                          : y,
                      ),
                    }
                  : x,
              ),
            },
            deckIds: [id],
          };
      }
    }
  }
  return null;
}

/** Count decks in the whole tree. */
export function countDecks(library: Library): number {
  let n = 0;
  for (const f of library.folders)
    for (const s of f.subjects) {
      n += s.decks.length;
      for (const t of s.terms) n += t.decks.length;
    }
  return n;
}

/** Normalizes unknown storage data into a valid Library. */
export function normalizeLibrary(raw: unknown): Library {
  const lib = defaultLibrary();
  if (!raw || typeof raw !== "object") return lib;
  const folders = (raw as { folders?: unknown }).folders;
  if (!Array.isArray(folders)) return lib;
  for (const rf of folders.slice(0, FOLDERS_MAX)) {
    if (!rf || typeof rf !== "object") continue;
    const fo = rf as Record<string, unknown>;
    const folder: FolderNode = {
      id: typeof fo.id === "string" && fo.id ? fo.id : newLibId("fold"),
      name: typeof fo.name === "string" ? fo.name.slice(0, NAME_MAX) : "Thư mục",
      subjects: [],
    };
    for (const rs of Array.isArray(fo.subjects)
      ? fo.subjects.slice(0, SUBJECTS_PER_FOLDER_MAX)
      : []) {
      if (!rs || typeof rs !== "object") continue;
      const so = rs as Record<string, unknown>;
      const subject: SubjectNode = {
        id: typeof so.id === "string" && so.id ? so.id : newLibId("sub"),
        name: typeof so.name === "string" ? so.name.slice(0, NAME_MAX) : "Môn",
        terms: [],
        decks: [],
      };
      for (const rt of Array.isArray(so.terms) ? so.terms.slice(0, TERMS_PER_SUBJECT_MAX) : []) {
        if (!rt || typeof rt !== "object") continue;
        const to = rt as Record<string, unknown>;
        const term: TermNode = { id: to.id as string, name: to.name as string, decks: [] };
        term.id = typeof to.id === "string" && to.id ? to.id : newLibId("term");
        term.name = typeof to.name === "string" ? to.name.slice(0, NAME_MAX) : "Học kỳ";
        for (const rd of Array.isArray(to.decks)
          ? to.decks.slice(0, DECKS_PER_CONTAINER_MAX)
          : []) {
          if (!rd || typeof rd !== "object") continue;
          const dn = rd as Record<string, unknown>;
          term.decks.push({
            id: typeof dn.id === "string" && dn.id ? dn.id : newLibId("deck"),
            name: typeof dn.name === "string" ? dn.name.slice(0, NAME_MAX) : "Bộ thẻ",
            createdAt: typeof dn.createdAt === "string" ? dn.createdAt : new Date().toISOString(),
          });
        }
        subject.terms.push(term);
      }
      for (const rd of Array.isArray(so.decks) ? so.decks.slice(0, DECKS_PER_CONTAINER_MAX) : []) {
        if (!rd || typeof rd !== "object") continue;
        const dn = rd as Record<string, unknown>;
        subject.decks.push({
          id: typeof dn.id === "string" && dn.id ? dn.id : newLibId("deck"),
          name: typeof dn.name === "string" ? dn.name.slice(0, NAME_MAX) : "Bộ thẻ",
          createdAt: typeof dn.createdAt === "string" ? dn.createdAt : new Date().toISOString(),
        });
      }
      folder.subjects.push(subject);
    }
    lib.folders.push(folder);
  }
  return lib;
}
