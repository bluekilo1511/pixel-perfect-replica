import { useEffect } from "react";
import { useTracker } from "@/lib/tracker/store";

const TAB_ORDER = ["today", "stats", "week", "shop", "chronicle", "settings"];

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  return (
    t.tagName === "INPUT" ||
    t.tagName === "BUTTON" ||
    t.tagName === "TEXTAREA" ||
    t.tagName === "SELECT" ||
    t.isContentEditable === true
  );
}

/**
 * Global shortcuts: Space = pause/resume Pomodoro, N = new task,
 * 1–6 = jump between tabs. Ignored while typing in a field.
 */
export function KeyboardShortcuts() {
  const { timer, pauseTimer, startTimer, data } = useTracker();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      if (e.key === " ") {
        e.preventDefault();
        if (timer) {
          pauseTimer();
        } else {
          const resume = data.tasks.find((t) => !t.completed && t.remainingSeconds > 0);
          const next =
            resume ?? data.tasks.find((t) => !t.completed && t.minutes > 0 && !t.rewardClaimed);
          if (next) startTimer(next.id);
        }
      } else if (e.key === "n" || e.key === "N") {
        const input = document.querySelector<HTMLInputElement>("input[data-task-input]");
        if (input) {
          e.preventDefault();
          input.scrollIntoView({ block: "center", behavior: "smooth" });
          input.focus();
        }
      } else if (/^[1-6]$/.test(e.key)) {
        const value = TAB_ORDER[Number(e.key) - 1];
        if (value) window.dispatchEvent(new CustomEvent("ppr:goto-tab", { detail: value }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timer, pauseTimer, startTimer, data.tasks]);
  return null;
}
