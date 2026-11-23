import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Sparkles } from "lucide-react";
import type { Task } from "@/lib/tracker/model";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  timerElapsedSeconds?: number | undefined;
  onConfirm: (actualMinutes: number) => void;
}

export function CompleteTaskDialog({
  open,
  onOpenChange,
  task,
  timerElapsedSeconds,
  onConfirm,
}: Props) {
  const plannedMinutes = task?.plannedMinutes ?? task?.minutes ?? 25;
  const timerElapsedMinutes =
    timerElapsedSeconds !== undefined && timerElapsedSeconds > 0
      ? Math.max(1, Math.round(timerElapsedSeconds / 60))
      : undefined;

  const [minutes, setMinutes] = useState<number>(15);

  useEffect(() => {
    if (open && task) {
      if (timerElapsedMinutes !== undefined && timerElapsedMinutes > 0) {
        setMinutes(timerElapsedMinutes);
      } else if (task.remainingSeconds && task.remainingSeconds < task.minutes * 60) {
        const elapsed = Math.max(1, Math.round((task.minutes * 60 - task.remainingSeconds) / 60));
        setMinutes(elapsed);
      } else {
        // Default to 15 if planned was > 15, or planned minutes
        setMinutes(plannedMinutes > 15 ? 15 : plannedMinutes);
      }
    }
  }, [open, task, timerElapsedMinutes, plannedMinutes]);

  if (!task) return null;

  const handleConfirm = () => {
    const validMinutes = Math.max(1, Math.min(600, Math.round(Number(minutes) || 1)));
    onConfirm(validMinutes);
    onOpenChange(false);
  };

  const chips = [
    ...(timerElapsedMinutes ? [{ label: `⏱️ Đồng hồ (${timerElapsedMinutes}p)`, value: timerElapsedMinutes }] : []),
    { label: "10p", value: 10 },
    { label: "15p", value: 15 },
    { label: "20p", value: 20 },
    { label: "25p", value: 25 },
    { label: "30p", value: 30 },
    ...(plannedMinutes !== 15 && plannedMinutes !== 25 && plannedMinutes !== 30
      ? [{ label: `Kế hoạch (${plannedMinutes}p)`, value: plannedMinutes }]
      : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/80 bg-background/95 backdrop-blur-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 dark:bg-emerald-400/20 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold">Hoàn thành nhiệm vụ</DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground text-left">
            Ghi nhận thời gian tập trung thực tế để cập nhật biểu đồ môn học, kỷ lục và kinh nghiệm chuẩn xác.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Task Info Banner */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-foreground truncate">{task.title}</span>
              <Badge variant="secondary" className="font-mono text-xs shrink-0">
                Mục tiêu: {plannedMinutes}p
              </Badge>
            </div>
            {task.subject && (
              <span className="inline-block text-xs text-muted-foreground">
                Môn: <strong className="text-foreground">{task.subject}</strong>
              </span>
            )}
          </div>

          {/* Actual Minutes Input */}
          <div className="space-y-2">
            <label htmlFor="actual-minutes" className="block text-xs font-semibold text-foreground">
              Số phút thực tế bạn đã học:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="actual-minutes"
                  type="number"
                  min={1}
                  max={600}
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleConfirm();
                    }
                  }}
                  className="pl-9 font-mono text-base font-bold"
                  autoFocus
                />
              </div>
              <span className="text-sm font-medium text-muted-foreground">phút</span>
            </div>
          </div>

          {/* Quick Choice Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Chọn nhanh:</span>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMinutes(c.value)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer border ${
                    minutes === c.value
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border/70 bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Xác nhận hoàn thành ({minutes}p)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
