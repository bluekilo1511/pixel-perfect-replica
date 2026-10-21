import { useEffect, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import {
  getHud,
  isOriginOpen,
  subscribeHud,
  subscribeOrigin,
  type PomodoroHudState,
} from "@/lib/tracker/hudBus";

const BASE = "Task Tracker Pro";
const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const baseTitle = (streak: number) => `🔥 ${streak} · ${BASE}`;

const hudTitle = (hud: PomodoroHudState) => {
  const icon = hud.onBreak ? "☕" : hud.boss ? "⚔️" : "🍅";
  const alarm = hud.strikes > 0 ? ` 🚨${hud.strikes}` : "";
  return `${icon} ${fmt(hud.remaining)}${alarm} · ${BASE}`;
};

/** Tab Title HUD: live Pomodoro clock in the tab title + away reminder blink. */
export function TabTitleHud() {
  const { data } = useTracker();
  const [hud, setHud] = useState<PomodoroHudState>(getHud);
  const [origin, setOrigin] = useState(isOriginOpen);
  useEffect(() => subscribeHud(setHud), []);
  useEffect(() => subscribeOrigin(setOrigin), []);

  const streak = data.streak.count;
  const pending = data.tasks.filter((t) => !t.completed).length;

  // State-driven title: focus clock, break clock or streak baseline.
  useEffect(() => {
    if (origin) return; // The Origin overlay owns the tab title while open
    if (hud.running || hud.onBreak) document.title = hudTitle(hud);
    else document.title = baseTitle(streak);
  }, [hud, origin, streak]);

  // Nhắc nhở tab: blink a reminder while the user is away and tasks are waiting.
  useEffect(() => {
    if (origin || hud.running || hud.onBreak || pending === 0) return;
    let blink = false;
    const iv = setInterval(() => {
      if (!document.hidden) {
        document.title = baseTitle(streak);
        return;
      }
      blink = !blink;
      document.title = blink ? `⏰ ${pending} việc cần làm · ${BASE}` : baseTitle(streak);
    }, 2000);
    return () => clearInterval(iv);
  }, [origin, hud.running, hud.onBreak, pending, streak]);

  return null;
}
