// Local file storage via the File System Access API, with download fallback. No localStorage.
import type { AppData } from "./model";

/** Minimal shape of a File System Access API file handle as used here. */
export interface Handle {
  getFile(): Promise<File>;
  createWritable(opts?: { mode?: string }): Promise<{
    write(data: string): Promise<void>;
    close(): Promise<void>;
  }>;
  queryPermission?(opts?: { mode?: string }): Promise<string>;
  requestPermission?(opts?: { mode?: string }): Promise<string>;
  readonly name: string;
}

/** Window with the File System Access pickers, present only in Chromium browsers. */
type PickerWindow = Window & {
  showOpenFilePicker?: (opts?: unknown) => Promise<Handle[]>;
  showSaveFilePicker?: (opts?: unknown) => Promise<Handle>;
};
export const FILE_NAME = "task-tracker-data.json";
const pickerTypes = [
  {
    description: "Dữ liệu Task Tracker",
    accept: { "application/json": [".json"], "text/plain": [".txt"] },
  },
];

export const supportsFSA = () => typeof window !== "undefined" && "showOpenFilePicker" in window;

export async function openFile(): Promise<{
  handle: Handle | null;
  text: string;
  name: string;
} | null> {
  if (supportsFSA()) {
    const picks = await (window as PickerWindow).showOpenFilePicker!({ types: pickerTypes });
    const handle = picks[0]!;
    const file = await handle.getFile();
    return { handle, text: await file.text(), name: file.name };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.txt";
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { handle: null, text: await f.text(), name: f.name } : null);
    };
    input.click();
  });
}

export async function createFile(): Promise<Handle | null> {
  if (!supportsFSA()) return null;
  return (window as PickerWindow).showSaveFilePicker!({
    suggestedName: FILE_NAME,
    types: pickerTypes,
  });
}

/** Serialised writer: never runs two writes at once, always writes the latest data. */
export function createWriter(handle: Handle) {
  let writing = false;
  let pending: AppData | null = null;
  return async function write(data: AppData): Promise<void> {
    pending = data;
    if (writing) return;
    writing = true;
    try {
      while (pending) {
        const next = pending;
        pending = null;
        const opts = { mode: "readwrite" };
        if (handle.queryPermission && (await handle.queryPermission(opts)) !== "granted") {
          if ((await handle.requestPermission!(opts)) !== "granted") throw new Error("denied");
        }
        const w = await handle.createWritable();
        await w.write(JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2));
        await w.close();
      }
    } finally {
      writing = false;
    }
  };
}

export function downloadData(data: AppData, name = FILE_NAME) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
