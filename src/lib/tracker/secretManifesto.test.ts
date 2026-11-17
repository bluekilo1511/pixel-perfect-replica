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
});
