import { describe, expect, it, beforeEach } from "vitest";
import {
  defaultSecretManifesto,
  loadSecretManifesto,
  saveSecretManifesto,
  type SecretManifesto,
} from "./secretManifesto";

describe("secretManifesto", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default manifesto when nothing is saved", () => {
    const data = loadSecretManifesto();
    expect(data.title).toBe("Lý do tôi bắt đầu");
    expect(data.content).toContain("Gửi tôi của những ngày đang nỗ lực");
    expect(data.lineSpacing).toBe("relaxed");
  });

  it("persists updates and loads them correctly", () => {
    const initial = defaultSecretManifesto();
    const updated: SecretManifesto = {
      ...initial,
      title: "Lời hứa với gia đình",
      content: "Tôi làm việc chăm chỉ vì tương lai của ba mẹ và bản thân.",
      lineSpacing: "loose",
      paperTheme: "cosmic",
    };
    saveSecretManifesto(updated);

    const loaded = loadSecretManifesto();
    expect(loaded.title).toBe("Lời hứa với gia đình");
    expect(loaded.content).toBe("Tôi làm việc chăm chỉ vì tương lai của ba mẹ và bản thân.");
    expect(loaded.lineSpacing).toBe("loose");
    expect(loaded.paperTheme).toBe("cosmic");
  });

  it("normalizes decomposed NFD Vietnamese characters to composed NFC", () => {
    const initial = defaultSecretManifesto();
    // 'tất cả những điều này' decomposed into NFD
    const decomposedContent = "ta\u0302\u0301t ca\u0309 nhu\u031B\u0303ng đie\u0302\u0300u na\u0300y";
    const updated: SecretManifesto = {
      ...initial,
      content: decomposedContent,
    };
    saveSecretManifesto(updated);

    const loaded = loadSecretManifesto();
    expect(loaded.content).toBe("tất cả những điều này");
  });
});
