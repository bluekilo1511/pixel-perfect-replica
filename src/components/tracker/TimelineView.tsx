import { useEffect, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { dateStr, makeTask, PRIORITY_META } from "@/lib/tracker/model";
import { slotSubject } from "@/lib/tracker/tkb";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  onSelectTask: (id: string) => void;
  selectedTaskId: string | null;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 to 23:00

export function TimelineView({ onSelectTask, selectedTaskId }: Props) {
  const { data, update, finish } = useTracker();
  const today = dateStr();
  const now = new Date();
  const dayIndex = now.getDay(); // 0 = CN, 1 = T2, ...

  const [currentMinutes, setCurrentMinutes] = useState(now.getHours() * 60 + now.getMinutes());

  useEffect(() => {
    const timer = setInterval(() => {
      const n = new Date();
      setCurrentMinutes(n.getHours() * 60 + n.getMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // 1. School slots today
  const schoolDay = data.timetable.days[dayIndex];
  const schoolSlots = (schoolDay?.slots ?? []).filter((s) => slotSubject(s));

  // 2. Personal schedule slots today
  const personalDay = data.personalSchedule?.days?.[dayIndex];
  const personalSlots = (personalDay?.slots ?? []).filter((s) => (s.subject || s.notes)?.trim());

  // 3. Today's tasks
  const todayTasks = data.tasks.filter((t) => t.date === today);

  const handleCreateAtHour = (hour: number) => {
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    const title = window.prompt(`Thêm nhiệm vụ lúc ${timeStr}:`);
    if (!title || !title.trim()) return;

    update((d) => ({
      ...d,
      tasks: [
        ...d.tasks,
        makeTask(title.trim(), "custom", 30, today, {
          timeRange: `${timeStr} - ${String(hour).padStart(2, "0")}:30`,
          remindAt: timeStr,
        }),
      ],
    }));
    toast.success(`Đã xếp lịch lúc ${timeStr}`);
  };

  return (
    <div className="space-y-4">
      {/* Intro Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/60 p-3.5 backdrop-blur-sm">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5">
            <span>⏳ Timeline 24h & Khung giờ học (Time-blocking)</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Theo dõi dòng chảy thời gian thực từ 06:00 đến 23:00, kết hợp thời khóa biểu trường,
            lịch cá nhân và nhiệm vụ đã xếp giờ.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-semibold text-primary">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            Hiện tại: {String(Math.floor(currentMinutes / 60)).padStart(2, "0")}:
            {String(currentMinutes % 60).padStart(2, "0")}
          </span>
        </div>
      </div>

      {/* Hourly Timeline Container */}
      <div className="relative rounded-2xl border border-border/80 bg-card/40 p-4 backdrop-blur-sm">
        {/* Hourly Rows */}
        <div className="space-y-4 divide-y divide-border/40">
          {HOURS.map((hour) => {
            const hourLabel = `${String(hour).padStart(2, "0")}:00`;
            const isCurrentHour = Math.floor(currentMinutes / 60) === hour;

            // Find matching school slots whose time starts with this hour
            const matchingSchool = schoolSlots.filter((s) => {
              if (!s.time) return false;
              const h = parseInt(s.time.split(":")[0] ?? "", 10);
              return h === hour;
            });

            // Find matching personal slots
            const matchingPersonal = personalSlots.filter((s) => {
              if (!s.time) return false;
              const h = parseInt(s.time.split(":")[0] ?? "", 10);
              return h === hour;
            });

            // Find matching tasks
            const matchingTasks = todayTasks.filter((t) => {
              const checkTime = t.remindAt ?? t.timeRange?.slice(0, 5);
              if (!checkTime) return false;
              const h = parseInt(checkTime.split(":")[0] ?? "", 10);
              return h === hour;
            });

            return (
              <div
                key={hour}
                className={`group flex items-start gap-4 pt-3 transition ${
                  isCurrentHour ? "bg-primary/5 rounded-xl px-2.5 py-2 -mx-2" : ""
                }`}
              >
                {/* Time Column */}
                <div className="w-14 shrink-0 text-right">
                  <span
                    className={`font-mono text-xs font-semibold ${
                      isCurrentHour ? "text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {hourLabel}
                  </span>
                </div>

                {/* Content Column */}
                <div className="flex-1 min-h-[44px] space-y-1.5">
                  {/* School slots */}
                  {matchingSchool.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary font-medium"
                    >
                      <span>🏫 Tiết {s.period}:</span>
                      <span className="font-bold">{slotSubject(s)}</span>
                      {s.room && <span className="opacity-75">· Phòng {s.room}</span>}
                      {s.time && <span className="ml-auto opacity-75">{s.time}</span>}
                    </div>
                  ))}

                  {/* Personal slots */}
                  {matchingPersonal.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-500 font-medium"
                    >
                      <span>📅 Lịch:</span>
                      <span className="font-bold">{s.subject || s.notes}</span>
                      {s.time && <span className="ml-auto opacity-75">{s.time}</span>}
                    </div>
                  ))}

                  {/* Tasks */}
                  {matchingTasks.map((t) => {
                    const isSelected = selectedTaskId === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask(t.id)}
                        className={`flex items-center gap-2 rounded-lg border p-2 text-xs transition cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/15 font-semibold"
                            : "border-border/60 bg-background/80 hover:bg-background"
                        } ${t.completed ? "opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (!t.completed) finish(t.id);
                          }}
                          className="h-3.5 w-3.5 rounded border-border text-primary cursor-pointer"
                        />
                        <span className={`flex-1 truncate ${t.completed ? "line-through" : ""}`}>
                          {t.title}
                        </span>
                        {t.priority && (
                          <span className={`font-bold ${PRIORITY_META[t.priority].flagColor}`}>
                            {PRIORITY_META[t.priority].short}
                          </span>
                        )}
                        {t.timeRange && (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {t.timeRange}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Empty Slot prompt button */}
                  {matchingSchool.length === 0 &&
                    matchingPersonal.length === 0 &&
                    matchingTasks.length === 0 && (
                      <button
                        type="button"
                        onClick={() => handleCreateAtHour(hour)}
                        className="w-full text-left text-[11px] text-muted-foreground/50 hover:text-primary py-1 transition flex items-center gap-1"
                      >
                        <span className="opacity-0 group-hover:opacity-100 transition">
                          + Xếp lịch lúc {hourLabel}
                        </span>
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
