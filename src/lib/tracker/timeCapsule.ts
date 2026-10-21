// Browser-only IndexedDB backup. Call only from effects / event handlers.
import type { AppData } from "./model";

const DB = "task_tracker_time_capsule";
const STORE = "snapshots";
export const MAX_SNAPSHOTS = 5;
export const CAPSULE_INTERVAL_MS = 12 * 60 * 60 * 1000;

export interface Snapshot {
  id?: number;
  at: string;
  data: AppData;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (typeof indexedDB === "undefined") return rej(new Error("no idb"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const db = await openDb();
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).getAll();
    q.onsuccess = () => res((q.result as Snapshot[]).sort((a, b) => b.at.localeCompare(a.at)));
    q.onerror = () => rej(q.error);
  });
}

export async function saveSnapshot(data: AppData): Promise<void> {
  try {
    const db = await openDb();
    const all = await listSnapshots();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      const st = tx.objectStore(STORE);
      st.add({ at: new Date().toISOString(), data: JSON.parse(JSON.stringify(data)) });
      all.slice(MAX_SNAPSHOTS - 1).forEach((s) => s.id != null && st.delete(s.id));
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch {
    /* silent */
  }
}

export async function lastSnapshotAt(): Promise<number> {
  try {
    const s = await listSnapshots();
    return s[0] ? Date.parse(s[0].at) : 0;
  } catch {
    return 0;
  }
}
