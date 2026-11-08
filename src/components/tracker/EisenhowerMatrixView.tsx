import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import {
  dateStr,
  deduceEisenhower,
  EISENHOWER_META,
  makeTask,
  PRIORITY_META,
  type EisenhowerQuadrant,
} from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  onSelectTask: (id: string) => void;
  selectedTaskId: string | null;
}

const QUADRANTS: EisenhowerQuadrant[] = ["do_first", "schedule", "delegate", "dont_do"];

export function EisenhowerMatrixView({ onSelectTask, selectedTaskId }: Props) {
  const { data, update, finish } = useTracker();
  const today = dateStr();
  const todayTasks = data.tasks.filter((t) => t.date === today);

  const [inputQ, setInputQ] = useState<Record<EisenhowerQuadrant, string>>({
    do_first: "",
    schedule: "",
    delegate: "",
    dont_do: "",
  });

  const handleQuickAddQ = (q: EisenhowerQuadrant) => {
    const text = inputQ[q].trim();
    if (!text) return;
    const prio = q === "do_first" ? "p1" : q === "schedule" ? "p2" : q === "delegate" ? "p3" : "p4";
    update((d) => ({
      ...d,
      tasks: [
        ...d.tasks,
        makeTask(text, "custom", 0, today, {
          priority: prio,
          eisenhower: q,
        }),
      ],
    }));
    toast.success(`Đã thêm vào ${EISENHOWER_META[q].badge}`);
    setInputQ((prev) => ({ ...prev, [q]: "" }));
  };

  return (
    <div className="space-y-4">
      {/* Intro banner */}
      <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-1.5">
              <span>🧭 Ma trận Eisenhower (Ưu tiên nhiệm vụ)</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Phân loại nhiệm vụ hôm nay theo tính chất <strong>Khẩn cấp</strong> và{" "}
              <strong>Quan trọng</strong> để tập trung năng lượng đúng chỗ.
            </p>
          </div>
          <span className="text-xs font-semibold text-primary">
            {todayTasks.filter((t) => !t.completed).length} việc đang chờ
          </span>
        </div>
      </div>

      {/* 2x2 Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {QUADRANTS.map((q) => {
          const meta = EISENHOWER_META[q];
          const tasks = todayTasks.filter((t) => deduceEisenhower(t, data.exams) === q);
          const pending = tasks.filter((t) => !t.completed);
          const done = tasks.filter((t) => t.completed);

          return (
            <div
              key={q}
              className={`flex flex-col rounded-2xl border p-4 shadow-sm backdrop-blur-sm transition ${meta.colorClass} ${meta.borderClass}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{meta.badge}</span>
                    <span className="text-xs font-semibold">{meta.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{meta.sub}</p>
                </div>
                <span className="rounded-full bg-background/80 px-2 py-0.5 text-xs font-bold text-foreground">
                  {pending.length}
                </span>
              </div>

              {/* Task list */}
              <div className="flex-1 space-y-1.5 py-3 min-h-[140px]">
                {tasks.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Chưa có việc trong ô này.
                  </p>
                ) : (
                  tasks.map((t) => {
                    const isSelected = selectedTaskId === t.id;
                    const subCount = t.subtasks?.length ?? 0;
                    const subDone = t.subtasks?.filter((s) => s.completed).length ?? 0;

                    return (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask(t.id)}
                        className={`group flex items-center gap-2.5 rounded-xl border p-2.5 text-xs transition cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border/60 bg-background/80 hover:border-border hover:bg-background"
                        } ${t.completed ? "opacity-50" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={t.completed}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (!t.completed) finish(t.id);
                          }}
                          className="h-4 w-4 rounded border-border text-primary cursor-pointer"
                        />

                        <div className="min-w-0 flex-1">
                          <p
                            className={`font-medium truncate ${t.completed ? "line-through" : ""}`}
                          >
                            {t.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                            {t.priority && (
                              <span className={`font-bold ${PRIORITY_META[t.priority].flagColor}`}>
                                {PRIORITY_META[t.priority].short}
                              </span>
                            )}
                            {t.subject && <span>📚 {t.subject}</span>}
                            {t.minutes > 0 && <span>⏱️ {t.minutes}p</span>}
                            {subCount > 0 && (
                              <span className="rounded bg-muted px-1 text-muted-foreground">
                                ✓ {subDone}/{subCount}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] opacity-0 group-hover:opacity-100 text-muted-foreground transition">
                          ✎
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Add into Quadrant */}
              <div className="flex gap-1.5 pt-2 border-t border-border/40">
                <Input
                  value={inputQ[q]}
                  onChange={(e) => setInputQ({ ...inputQ, [q]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleQuickAddQ(q);
                    }
                  }}
                  placeholder={`+ Thêm việc vào ${meta.badge}…`}
                  className="h-8 text-xs bg-background/90"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => handleQuickAddQ(q)}
                >
                  Thêm
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
