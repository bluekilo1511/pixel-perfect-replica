import { useEffect, useRef, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dateStr } from "@/lib/tracker/model";
import { dueReminders, pruneFiredKeys } from "@/lib/tracker/reminders";

const STORE_KEY = "ttp-reminders-fired";

const loadFired = (): Set<string> => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
};

const saveFired = (keys: string[]) => {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(keys));
  } catch {
    /* storage full or blocked — reminders still work for this session */
  }
};

/** Fires each task's ⏰ reminder once per day: a toast, plus a browser notification when allowed. */
export function TaskReminders() {
  const { data } = useTracker();
  const firedRef = useRef<Set<string> | null>(null);
  const [perm, setPerm] = useState<string>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );

  useEffect(() => {
    if (firedRef.current === null) {
      const today = dateStr();
      firedRef.current = new Set(pruneFiredKeys([...loadFired()], today));
    }
    const check = () => {
      const fired = firedRef.current;
      if (!fired) return;
      const now = new Date();
      const today = dateStr(now);
      const due = dueReminders(data.tasks, today, now.getHours() * 60 + now.getMinutes(), fired);
      if (!due.length) return;
      for (const r of due) {
        fired.add(r.key);
        toast.info(`⏰ ${r.title}`, {
          description: `Đã tới giờ nhắc ${r.hhmm} — bắt tay vào làm nhé!`,
          duration: 10_000,
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification("Task Tracker Pro", {
              body: `${r.title} — đã tới giờ nhắc ${r.hhmm}`,
            });
          } catch {
            /* some browsers reject notifications outside a user gesture */
          }
        }
      }
      saveFired(pruneFiredKeys([...fired], today));
    };
    check();
    const iv = setInterval(check, 15_000);
    return () => clearInterval(iv);
  }, [data.tasks]);

  if (typeof Notification === "undefined" || Notification.permission !== "default") return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-7 text-xs"
      title="Cho phép web hiện thông báo khi tới giờ nhắc"
      onClick={() => {
        void Notification.requestPermission().then(setPerm);
      }}
    >
      🔔 Bật thông báo trình duyệt
    </Button>
  );
}
