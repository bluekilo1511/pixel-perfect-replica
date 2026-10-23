import { toast } from "sonner";

/**
 * Image export helpers.
 *
 * When the app runs inside an iframe (e.g. the editor's live preview), Chrome
 * silently blocks automatic `<a download>` clicks from cross-origin frames.
 * The export still works there — it just needs to hand the image to the user
 * another way (in-app dialog / manual save).
 */

/** True when the app is framed — automatic downloads are blocked there. */
export function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin access denied → definitely framed
  }
}

/** Append + click an anchor. jsdom-safe; browsers ignore it in blocked frames. */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Canvas → PNG blob, promisified. */
export function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Shared failure toast so both export buttons report the real cause. */
export function exportFailedToast(err: unknown): void {
  console.error("Xuất ảnh thất bại:", err);
  const msg = err instanceof Error ? ` — ${err.message}` : "";
  toast.error(`Không xuất được ảnh${msg}`);
}
