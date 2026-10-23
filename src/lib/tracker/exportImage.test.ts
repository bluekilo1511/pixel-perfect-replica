import { describe, expect, it, vi } from "vitest";
import { canvasToPng, downloadUrl, inIframe } from "./exportImage";

describe("exportImage", () => {
  it("is not framed in the jsdom test environment", () => {
    expect(inIframe()).toBe(false);
  });

  it("reports framed when window access is blocked", () => {
    const desc = Object.getOwnPropertyDescriptor(window, "self");
    try {
      Object.defineProperty(window, "self", {
        get() {
          throw new Error("cross-origin");
        },
        configurable: true,
      });
      expect(inIframe()).toBe(true);
    } finally {
      if (desc) Object.defineProperty(window, "self", desc);
    }
  });

  it("downloadUrl appends, clicks and removes the anchor", () => {
    const clicks: HTMLAnchorElement[] = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      clicks.push(this);
    };
    try {
      downloadUrl("blob:test", "photo.png");
      expect(clicks).toHaveLength(1);
      const a = clicks[0]!;
      expect(a.href).toContain("blob:test");
      expect(a.download).toBe("photo.png");
      expect(document.body.contains(a)).toBe(false);
    } finally {
      HTMLAnchorElement.prototype.click = orig;
    }
  });

  it("canvasToPng resolves null when the canvas has no backing store", async () => {
    const fake = {
      toBlob: (cb: (b: Blob | null) => void) => cb(null),
    } as unknown as HTMLCanvasElement;
    await expect(canvasToPng(fake)).resolves.toBeNull();
  });
});
