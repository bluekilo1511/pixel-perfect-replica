import { useEffect, useRef, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { dateStr, KIND_META, makeTask, PRIORITY_META, type TaskKind } from "@/lib/tracker/model";
import { parseQuickAdd } from "@/lib/tracker/quickAdd";
import { matchSubject } from "@/lib/tracker/tkb";
import { shiftDate } from "@/lib/tracker/gamify";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const KINDS: TaskKind[] = ["pomodoro", "exercise", "custom"];

/** Ctrl/Cmd+K opens a quick-add with natural-language parsing from anywhere on the page. */
export function QuickAdd() {
  const { update } = useTracker();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<TaskKind>("pomodoro");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  const add = () => {
    const parsed = parseQuickAdd(text);
    const targetDate = parsed.dateOffsetDays
      ? shiftDate(dateStr(), parsed.dateOffsetDays)
      : dateStr();

    update((d) => {
      const subject = matchSubject(d, parsed.title);
      return {
        ...d,
        tasks: [
          ...d.tasks,
          makeTask(parsed.title, kind, parsed.minutes ?? KIND_META[kind].minutes, targetDate, {
            ...(subject ? { subject } : {}),
            ...(parsed.priority ? { priority: parsed.priority } : {}),
            ...(parsed.timeRange ? { timeRange: parsed.timeRange } : {}),
          }),
        ],
      };
    });

    const prioLabel = parsed.priority ? ` [${PRIORITY_META[parsed.priority].short}]` : "";
    toast.success(`Đã thêm "${parsed.title}"${prioLabel} ${KIND_META[kind].emoji}`);
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <span>⚡ Thêm nhanh nhiệm vụ</span>
          </DialogTitle>
        </DialogHeader>
        <Input
          ref={inputRef}
          placeholder="vd: Học Toán 25p !1 mai 20h"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={kind === k ? "secondary" : "outline"}
                onClick={() => setKind(k)}
              >
                {KIND_META[k].emoji} {KIND_META[k].label}
              </Button>
            ))}
          </div>
          <Button size="sm" onClick={add}>
            Thêm
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Cú pháp thông minh:</strong> <code className="rounded bg-muted px-1">25p</code>{" "}
          (thời lượng) · <code className="rounded bg-muted px-1">!1 / p1</code> (ưu tiên) ·{" "}
          <code className="rounded bg-muted px-1">20h30</code> (giờ) ·{" "}
          <code className="rounded bg-muted px-1">mai</code> (ngày mai).
        </p>
      </DialogContent>
    </Dialog>
  );
}
