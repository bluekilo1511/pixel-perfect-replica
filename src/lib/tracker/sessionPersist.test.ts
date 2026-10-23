import { afterEach, describe, expect, it } from "vitest";
import { loadSession, saveSession } from "./sessionPersist";

afterEach(() => localStorage.clear());

describe("sessionPersist", () => {
  it("round-trips a running session", () => {
    saveSession(Date.now() + 60_000, null, false, 1000);
    const s = loadSession();
    expect(s.endAt).toBeGreaterThan(Date.now());
    expect(s.breakEndAt).toBeNull();
    expect(s.warmup).toBe(false);
  });

  it("keeps an expired endAt (completion must still fire) but drops a stale break", () => {
    saveSession(Date.now() - 5000, Date.now() - 5000, true, 1000);
    const s = loadSession();
    expect(s.endAt).toBeLessThan(Date.now());
    expect(s.breakEndAt).toBeNull();
    expect(s.warmup).toBe(true);
  });

  it("drops state saved too long ago", () => {
    saveSession(Date.now() + 60_000, null, false, Date.now() - 13 * 60 * 60 * 1000);
    expect(loadSession().endAt).toBeNull();
  });

  it("clears when both timers are gone and survives garbage", () => {
    saveSession(Date.now() + 60_000, Date.now() + 30_000, false, 1000);
    saveSession(null, null, false, 1000);
    expect(localStorage.getItem("pp:pomodoro-session")).toBeNull();
    localStorage.setItem("pp:pomodoro-session", "{oops");
    expect(loadSession().endAt).toBeNull();
  });
});
