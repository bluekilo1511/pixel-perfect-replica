import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { nextSlotToday, runningSlotToday, type Slot } from "@/lib/tracker/model";
import { requestPomodoro } from "@/lib/tracker/pomodoroBus";
import { useTracker } from "@/lib/tracker/store";
import { Button } from "@/components/ui/button";

/** Card showing the next (or currently running) timetable slot with a one-click Pomodoro. */
export function NextSlotCard() {
  const { data } = useTracker();
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const now = new Date();
  const running = runningSlotToday(data, now);
  const next = running ?? nextSlotToday(data, now);
  if (!next) {
    return (
      <div className="glass p-4 text-sm opacity-70">
        🗓️ Hôm nay hết slot thời khóa biểu rồi — nghỉ ngơi nhé!
      </div>
    );
  }
  return <SlotView slot={next} running={!!running} />;
}

function SlotView({ slot, running }: { slot: Slot; running: boolean }) {
  const minutes = slot.minutes || 25;
  return (
    <div className="glass flex items-center gap-3 p-4">
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide opacity-60">
          {running ? "▶️ Đang đến giờ học" : "⏰ Slot tiếp theo"}
        </div>
        <div className="truncate font-semibold">
          {slot.title} <span className="opacity-60">· {slot.start}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => requestPomodoro({ minutes, label: slot.title })}
      >
        <Play className="mr-1 size-3.5" /> Học ngay {minutes}p
      </Button>
    </div>
  );
}
