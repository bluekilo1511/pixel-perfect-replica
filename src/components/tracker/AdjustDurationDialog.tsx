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
import { Clock, Pencil } from "lucide-react";
import type { Task } from "@/lib/tracker/model";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onConfirm: (newMinutes: number) => void;
}

export function AdjustDurationDialog({ open, onOpenChange, task, onConfirm }: Props) {
  const [minutes, setMinutes] = useState<number>(task?.minutes ?? 15);

  useEffect(() => {
    if (open && task) {
      setMinutes(task.minutes || 15);
    }
  }, [open, task]);

  if (!task) return null;

  const planned = task.plannedMinutes ?? task.minutes;

  const handleConfirm = () => {
    const valid = Math.max(1, Math.min(600, Math.round(Number(minutes) || 1)));
    onConfirm(valid);
    onOpenChange(false);
  };

  const chips = [5, 10, 15, 20, 25, 30, 40, 45, 60];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/80 bg-background/95 backdrop-blur-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Pencil className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base sm:text-lg font-bold">
              Chỉnh sửa thời gian học thực tế
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground text-left">
            Thay đổi số phút thực tế đã tập trung cho nhiệm vụ này. Thống kê ngày và biểu đồ môn học sẽ được tự động đồng bộ lại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-foreground truncate">{task.title}</span>
              <Badge variant="outline" className="font-mono text-xs">
                Kế hoạch: {planned}p
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Thời gian đang ghi nhận hiện tại: <strong className="text-primary font-mono">{task.minutes} phút</strong>
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-task-minutes" className="block text-xs font-semibold text-foreground">
              Số phút thực tế mới:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-task-minutes"
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

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Gợi ý mốc phút:</span>
            <div className="flex flex-wrap gap-1.5">
              {chips.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setMinutes(val)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-mono font-medium transition cursor-pointer border ${
                    minutes === val
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border/70 bg-secondary/50 text-secondary-foreground hover:bg-secondary"
                  }`}
                >
                  {val}p
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
            className="font-medium text-xs"
          >
            Lưu {minutes} phút
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
