import { describe, expect, it } from "vitest";
import { timerPetState } from "./timerPet";

describe("timerPetState", () => {
  it("idles politely when the timer is paused", () => {
    const s = timerPetState(0.5, false);
    expect(s.anim).toBe("idle");
    expect(s.face).toBe("🫡");
  });

  it("is sleepy at the very start", () => {
    expect(timerPetState(0, true).face).toBe("😴");
    expect(timerPetState(0.14, true).anim).toBe("idle");
  });

  it("watches the clock through the middle stretch", () => {
    expect(timerPetState(0.2, true).face).toBe("👀");
    expect(timerPetState(0.54, true).anim).toBe("watch");
  });

  it("starts cheering past the halfway grind", () => {
    expect(timerPetState(0.6, true).face).toBe("💪");
    expect(timerPetState(0.84, true).anim).toBe("cheer");
  });

  it("celebrates near the finish", () => {
    expect(timerPetState(0.9, true).face).toBe("🎉");
    expect(timerPetState(1, true).anim).toBe("dance");
  });
});
