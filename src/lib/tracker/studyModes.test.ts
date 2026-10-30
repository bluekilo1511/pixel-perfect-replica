import { describe, expect, it } from "vitest";
import { STUDY_MODES, gamifyHidden, modeMeta, normalizeStudyMode } from "./studyModes";
import { defaultData, migrate } from "./model";

describe("study modes", () => {
  it("defaults to normal and survives migration from old files", () => {
    expect(defaultData().settings.studyMode).toBe("normal");
    expect(migrate({ app: "local-task-tracker-pro", version: 3 }).settings.studyMode).toBe(
      "normal",
    );
    expect(migrate({ settings: { studyMode: "exam" } }).settings.studyMode).toBe("exam");
    expect(migrate({ settings: { studyMode: "nonsense" } }).settings.studyMode).toBe("normal");
    expect(migrate({ settings: { studyMode: 42 } }).settings.studyMode).toBe("normal");
  });

  it("hides gamified cards in exam and rest modes only", () => {
    for (const m of STUDY_MODES) {
      expect(gamifyHidden(normalizeStudyMode(m.key))).toBe(m.key !== "normal");
    }
  });

  it("falls back to the normal meta for unknown keys", () => {
    expect(modeMeta("exam").emoji).toBe("🎯");
    expect(modeMeta("weird" as never).key).toBe("normal");
  });
});
