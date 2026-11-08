import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import {
  addSubtask,
  deduceEisenhower,
  editTask,
  EISENHOWER_META,
  PRIORITY_META,
  removeSubtask,
  setTaskEisenhower,
  setTaskNotes,
  setTaskPriority,
  toggleSubtask,
  type EisenhowerQuadrant,
  type PriorityLevel,
} from "@/lib/tracker/model";
import { pinTaskAsWeekGoal } from "@/lib/tracker/goals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestTimerFullscreen } from "./TimerFullscreen";

interface Props {
  taskId: string;
  onClose: () => void;
}

const PRIORITIES: PriorityLevel[] = ["p1", "p2", "p3", "p4"];
const QUADRANTS: EisenhowerQuadrant[] = ["do_first", "schedule", "delegate", "dont_do"];

export function TaskDetailInspector({ taskId, onClose }: Props) {
  const { data, update, activeTaskId, startTimer, pauseTimer, finish } = useTracker();
  const task = data.tasks.find((t) => t.id === taskId);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [notesInput, setNotesInput] = useState(task?.notes ?? "");

  if (!task) {
    return (
      <aside className="flex h-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <p>Nhiệm vụ không tồn tại hoặc đã bị xóa.</p>
        <Button variant="ghost" size="sm" onClick={onClose} className="mt-3">
          Đóng
        </Button>
      </aside>
    );
  }

  const isRunning = activeTaskId === task.id;
  const locked = task.completed;
  const quadrant = deduceEisenhower(task, data.exams);
  const subtasks = task.subtasks ?? [];
  const completedSubs = subtasks.filter((s) => s.completed).length;
  const subPercent = subtasks.length > 0 ? Math.round((completedSubs / subtasks.length) * 100) : 0;

  const handleAddSubtask = () => {
    const text = subtaskInput.trim();
    if (!text) return;
    update((d) => addSubtask(d, task.id, text));
    setSubtaskInput("");
  };

  const handleSaveNotes = () => {
    update((d) => setTaskNotes(d, task.id, notesInput));
    toast.success("Đã lưu ghi chú nhiệm vụ");
  };

  const handleDelete = () => {
    update((d) => ({
      ...d,
      tasks: d.tasks.filter((t) => t.id !== task.id),
    }));
    toast.success("Đã xóa nhiệm vụ");
    onClose();
  };

  return (
    <aside className="flex h-full flex-col border-l border-border bg-card/60 p-4 backdrop-blur-md">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Chi tiết nhiệm vụ
          </span>
          {task.priority && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${PRIORITY_META[task.priority].badgeClass}`}
            >
              {PRIORITY_META[task.priority].short}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label="Đóng chi tiết"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          ✕
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-3 pr-1">
        {/* Title & Status */}
        <div className="space-y-1.5">
          <Input
            value={task.title}
            disabled={locked}
            onChange={(e) => {
              const val = e.target.value;
              update((d) => editTask(d, task.id, { title: val }) ?? d);
            }}
            className="text-base font-semibold"
            placeholder="Tên nhiệm vụ…"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{task.date}</span>
            {task.subject && (
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                📚 {task.subject}
              </span>
            )}
            {task.timeRange && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-foreground">
                🕒 {task.timeRange}
              </span>
            )}
          </div>
        </div>

        {/* Priority Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Mức độ ưu tiên</label>
          <div className="grid grid-cols-4 gap-1">
            {PRIORITIES.map((p) => {
              const active = task.priority === p;
              const meta = PRIORITY_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => update((d) => setTaskPriority(d, task.id, active ? undefined : p))}
                  className={`flex flex-col items-center rounded-lg border py-1.5 text-xs transition ${
                    active
                      ? `${meta.badgeClass} ring-1 ring-primary/40`
                      : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <span className="font-bold">{meta.short}</span>
                  <span className="text-[10px] opacity-75">
                    {p === "p1" ? "Khẩn" : p === "p2" ? "Cao" : p === "p3" ? "Vừa" : "Thấp"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Eisenhower Quadrant Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Ma trận Eisenhower</label>
          <div className="grid grid-cols-2 gap-1.5">
            {QUADRANTS.map((q) => {
              const active = quadrant === q;
              const meta = EISENHOWER_META[q];
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => update((d) => setTaskEisenhower(d, task.id, q))}
                  className={`flex flex-col rounded-lg border p-2 text-left text-xs transition ${
                    active
                      ? `${meta.colorClass} ${meta.borderClass} font-semibold ring-1 ring-primary/30`
                      : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <span className="font-bold">{meta.badge}</span>
                  <span className="text-[10px] opacity-80">{meta.sub}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subtasks Checklist */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between text-xs font-medium">
            <span>Việc con (Subtasks)</span>
            <span className="text-muted-foreground">
              {completedSubs}/{subtasks.length} ({subPercent}%)
            </span>
          </div>

          {/* Progress bar */}
          {subtasks.length > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${subPercent}%` }}
              />
            </div>
          )}

          {/* Subtasks list */}
          <div className="space-y-1">
            {subtasks.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted/40 text-xs"
              >
                <input
                  type="checkbox"
                  checked={s.completed}
                  onChange={() => update((d) => toggleSubtask(d, task.id, s.id))}
                  className="h-3.5 w-3.5 rounded border-border text-primary"
                />
                <span className={`flex-1 truncate ${s.completed ? "line-through opacity-50" : ""}`}>
                  {s.title}
                </span>
                <button
                  type="button"
                  onClick={() => update((d) => removeSubtask(d, task.id, s.id))}
                  className="text-muted-foreground hover:text-destructive text-xs px-1"
                  aria-label="Xoá việc con"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add subtask input */}
          <div className="flex gap-1.5 pt-1">
            <Input
              size={1}
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddSubtask();
                }
              }}
              placeholder="+ Thêm việc con… (Enter)"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAddSubtask}
              className="h-8 px-2.5 text-xs"
            >
              Thêm
            </Button>
          </div>
        </div>

        {/* Notes Textarea */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Ghi chú chi tiết</label>
            {notesInput !== (task.notes ?? "") && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={handleSaveNotes}
              >
                Lưu
              </Button>
            )}
          </div>
          <textarea
            rows={3}
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            onBlur={handleSaveNotes}
            placeholder="Nội dung cần lưu ý, dàn ý bài viết, link tài liệu…"
            className="w-full rounded-lg border border-input bg-background/80 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Timer Controls */}
        {task.minutes > 0 && !locked && (
          <div className="rounded-xl border border-border/80 bg-secondary/20 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Đồng hồ tập trung</span>
              <span className="font-mono text-sm font-bold">
                {Math.floor(task.remainingSeconds / 60)}:
                {String(task.remainingSeconds % 60).padStart(2, "0")}
              </span>
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <>
                  <Button size="sm" variant="secondary" className="flex-1" onClick={pauseTimer}>
                    ⏸ Tạm dừng
                  </Button>
                  <Button size="sm" variant="outline" onClick={requestTimerFullscreen}>
                    ⛶ Toàn màn hình
                  </Button>
                </>
              ) : (
                <Button size="sm" className="flex-1" onClick={() => startTimer(task.id)}>
                  ▶ Bắt đầu học ({task.minutes}p)
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={task.pinned ? "secondary" : "ghost"}
            className="h-8 px-2 text-xs"
            onClick={() =>
              update((d) => ({
                ...d,
                tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, pinned: !t.pinned } : t)),
              }))
            }
          >
            📌 {task.pinned ? "Đã ghim" : "Ghim"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={() => {
              const res = pinTaskAsWeekGoal(data, task.id);
              if (!res) {
                toast.error("Mục tiêu tuần đã đầy hoặc đã có 🎯");
                return;
              }
              update(() => res);
              toast.success("Đã ghim làm mục tiêu tuần 🎯");
            }}
          >
            🎯 Mục tiêu tuần
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {!locked && (
            <Button
              size="sm"
              variant="default"
              className="h-8 px-2.5 text-xs"
              onClick={() => finish(task.id)}
            >
              ✓ Xong
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            🗑️
          </Button>
        </div>
      </div>
    </aside>
  );
}
