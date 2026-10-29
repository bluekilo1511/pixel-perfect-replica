import { useEffect, useRef, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { dateStr, KIND_META, makeTask, type TaskKind } from "@/lib/tracker/model";
import { parseQuickAdd } from "@/lib/tracker/quickAdd";
import { matchSubject } from "@/lib/tracker/tkb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const KINDS: TaskKind[] = ["pomodoro", "exercise", "custom"];

/** Ctrl/Cmd+K opens a quick-add from anywhere on the page. */
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
    update((d) => {
      // Subject tags are gone: the subject attaches by longest title match
      // (e.g. "Ôn Tiếng Anh" -> subject "Tiếng Anh"), so multi-word names work.
      const subject = matchSubject(d, parsed.title);
      return {
        ...d,
        tasks: [
          ...d.tasks,
          makeTask(parsed.title, kind, parsed.minutes ?? KIND_META[kind].minutes, dateStr(), {
            ...(subject ? { subject } : {}),
          }),
        ],
      };
    });
    toast.success(`Đã thêm "${parsed.title}" ${KIND_META[kind].emoji}`);
    setText("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>⚡ Thêm nhanh nhiệm vụ</DialogTitle>
        </DialogHeader>
        <Input
          ref={inputRef}
          placeholder="Tên nhiệm vụ… (vd: Học Toán 25p)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
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
        <p className="text-xs text-muted-foreground">
          Enter để thêm · Esc để đóng · Ghi "25p" vào tên để hẹn giờ · Ctrl/Cmd+K để mở lại.
        </p>
      </DialogContent>
    </Dialog>
  );
}
