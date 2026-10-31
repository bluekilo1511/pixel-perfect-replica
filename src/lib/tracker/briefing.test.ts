import { describe, expect, it } from "vitest";
import { morningBriefing } from "./briefing";
import { addExam, defaultData, type Task } from "./model";
import type { Flashcard } from "./flashcards";

const morning = new Date("2026-11-02T08:00:00"); // a Monday, 8am
const monday = "2026-11-02";

const fc = (id: string, due: string): Flashcard => ({
  id,
  subject: "Toán",
  question: "1+1?",
  answer: "2",
  ease: 2.5,
  interval: 0,
  reps: 0,
  lapses: 0,
  due,
  createdAt: monday,
});

const task = (id: string, completed: boolean): Task => ({
  id,
  title: `Việc ${id}`,
  kind: "pomodoro",
  minutes: 25,
  remainingSeconds: 0,
  date: monday,
  completed,
  completedAt: null,
  rewardClaimed: false,
  createdAt: monday,
});

describe("morningBriefing", () => {
  it("returns null on a fresh, empty app once every quest is done", () => {
    const d = defaultData();
    d.dailyStats[monday] = { tasks: 9, focusMin: 999, water: 9, treats: 1, pomodoros: 9 };
    expect(morningBriefing(d, morning)).toBeNull();
  });

  it("lists today's timetable periods", () => {
    const d = defaultData();
    d.timetable.days[1]!.slots = [
      { id: "a", start: "07:00", end: "07:45", title: "Toán", kind: "pomodoro", minutes: 45 },
      { id: "b", start: "08:00", end: "08:45", title: "Ngữ văn", kind: "pomodoro", minutes: 45 },
    ];
    const items = morningBriefing(d, morning)!;
    expect(items[0]).toEqual({ emoji: "🏫", text: "Hôm nay 2 tiết: Toán, Ngữ văn" });
  });

  it("reports the nearest exam with a friendly label", () => {
    const d = addExam(defaultData(), "Toán", "2026-11-05", { buoi: "Sáng" });
    const items = morningBriefing(d, morning)!;
    expect(items[0]).toEqual({ emoji: "📅", text: "Thi Toán — còn 3 ngày" });
  });

  it("counts due flashcards, unfinished quests and open tasks", () => {
    const d = defaultData();
    d.flashcards = [fc("f1", monday)];
    d.tasks = [task("t1", false), task("t2", true)];
    const items = morningBriefing(d, morning)!;
    const flat = items.map((i) => `${i.emoji} ${i.text}`).join(" | ");
    expect(flat).toContain("🃏 1 flashcard");
    expect(flat).toContain("🎯 Nhiệm vụ hôm nay còn dở 3/3");
    expect(flat).toContain("📝 1 nhiệm vụ chưa xong");
  });

  it("stays quiet about quests once they are done", () => {
    const d = defaultData();
    d.dailyStats[monday] = { tasks: 9, focusMin: 999, water: 9, treats: 1, pomodoros: 9 };
    d.tasks = [task("t1", false)];
    const items = morningBriefing(d, morning)!;
    expect(items.some((i) => i.emoji === "🎯")).toBe(false);
  });
});
