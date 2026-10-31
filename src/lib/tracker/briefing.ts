// 🌅 Bản tin buổi sáng — one pure helper that gathers everything worth knowing
// today: school periods, the nearest exam, due flashcards, unfinished quests
// and open tasks. No browser APIs, so it is fully testable.
import { dueCards } from "./flashcards";
import { examLabel, upcomingExams } from "./exams";
import { dailyQuests, questProgress } from "./quests";
import { dateStr, type AppData } from "./model";

export interface BriefingItem {
  emoji: string;
  text: string;
}

/** Items for the morning briefing card; null when there is nothing to say. */
export function morningBriefing(data: AppData, now = new Date()): BriefingItem[] | null {
  const today = dateStr(now);
  const items: BriefingItem[] = [];

  // School timetable: today's periods, unique subject names, at most 6 listed.
  const slots = (data.timetable.days[now.getDay()]?.slots ?? []).filter((s) => s.title.trim());
  if (slots.length) {
    const names = [...new Set(slots.map((s) => s.title.trim()))].slice(0, 6).join(", ");
    items.push({
      emoji: "🏫",
      text: `Hôm nay ${slots.length} tiết: ${names}${slots.length > 6 ? "…" : ""}`,
    });
  }

  // Nearest upcoming exam.
  const exam = upcomingExams(data.exams, today)[0];
  if (exam) {
    items.push({ emoji: "📅", text: `Thi ${exam.name} — ${examLabel(exam.daysLeft)}` });
  }

  // Flashcards due for review today.
  const due = dueCards(data.flashcards, today).length;
  if (due > 0) items.push({ emoji: "🃏", text: `${due} flashcard đến hạn ôn` });

  // Daily quests not finished yet.
  const quests = dailyQuests(today);
  const stats = data.dailyStats[today];
  const remaining = quests.filter((q) => questProgress(stats, q) < q.target).length;
  if (quests.length && remaining > 0) {
    items.push({ emoji: "🎯", text: `Nhiệm vụ hôm nay còn dở ${remaining}/${quests.length}` });
  }

  // Open tasks left from before.
  const open = data.tasks.filter((t) => !t.completed).length;
  if (open > 0) items.push({ emoji: "📝", text: `${open} nhiệm vụ chưa xong` });

  return items.length ? items : null;
}
