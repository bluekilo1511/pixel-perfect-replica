import { useMemo, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { DAY_LABELS } from "@/lib/tracker/model";
import {
  DEFAULT_TKB,
  applyTimetableImport,
  parseTimetableText,
  type ParsedTkb,
} from "@/lib/tracker/tkb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const PLACEHOLDER = `Thứ 2
Buổi sáng
TNHN (DC) - Ngăn
TNHN (CD) - Ngăn
T.Anh - Ngọc
Buổi chiều
C.Nghệ - Hiểu
Thứ 5: KHTN (Sinh) - Tuyết, T.Anh - Ngọc, M.Thuật - Duyên`;

export function TimetableQuickImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { update } = useTracker();
  const [text, setText] = useState("");
  const [morningStart, setMorningStart] = useState(DEFAULT_TKB.morningStart);
  const [afternoonStart, setAfternoonStart] = useState(DEFAULT_TKB.afternoonStart);
  const [slotMinutes, setSlotMinutes] = useState(DEFAULT_TKB.slotMinutes);
  const [mode, setMode] = useState<"replace" | "merge">("replace");

  const parsed: ParsedTkb = useMemo(
    () =>
      text.trim()
        ? parseTimetableText(text, { morningStart, afternoonStart, slotMinutes })
        : { touched: [], warnings: [], count: 0 },
    [text, morningStart, afternoonStart, slotMinutes],
  );

  const apply = () => {
    const defaults = { morningStart, afternoonStart, slotMinutes };
    update((d) => applyTimetableImport(d, parsed, mode, defaults));
    toast.success(`Đã nhập ${parsed.count} tiết học 🗓️`, {
      description: parsed.touched.map((t) => DAY_LABELS[t.dayIndex]).join(", "),
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>⚡ Nhập nhanh thời khóa biểu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="tkb-text">Dán lịch vào đây</Label>
            <textarea
              id="tkb-text"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="mt-1 w-full rounded-lg border border-border bg-card p-3 font-mono text-xs outline-none focus:border-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mỗi dòng một môn, dạng "Toán - Bình" (tên môn - giáo viên). Hàng "Thứ 2…Thứ 7", "Chủ
              nhật" để đổi ngày; "Buổi sáng/Buổi chiều" để đổi buổi. Có thể ghi thời gian cụ thể:
              "19:00-20:30 Ôn Toán".
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="tkb-ms">Tiết 1 sáng</Label>
              <Input
                id="tkb-ms"
                type="time"
                className="mt-1"
                value={morningStart}
                onChange={(e) => setMorningStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tkb-as">Tiết 1 chiều</Label>
              <Input
                id="tkb-as"
                type="time"
                className="mt-1"
                value={afternoonStart}
                onChange={(e) => setAfternoonStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tkb-len">Phút/tiết</Label>
              <Input
                id="tkb-len"
                type="number"
                min={15}
                max={120}
                className="mt-1"
                value={slotMinutes}
                onChange={(e) => setSlotMinutes(Math.min(120, Math.max(15, +e.target.value || 45)))}
              />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Cách nhập</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "replace" ? "default" : "secondary"}
                onClick={() => setMode("replace")}
              >
                Thay ngày được nhập
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "merge" ? "default" : "secondary"}
                onClick={() => setMode("merge")}
              >
                Thêm vào lịch cũ
              </Button>
            </div>
          </div>
          {parsed.count > 0 && (
            <div className="rounded-lg border border-border bg-card p-3 text-xs">
              <p className="mb-1 font-medium">
                Xem trước: {parsed.count} tiết ·{" "}
                {parsed.touched
                  .map(
                    (t) => `${DAY_LABELS[t.dayIndex]} (${t.morning} sáng + ${t.afternoon} chiều)`,
                  )
                  .join(", ")}
              </p>
              {parsed.warnings.map((w) => (
                <p key={w} className="text-amber-500">
                  ⚠ {w}
                </p>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Đóng
          </Button>
          <Button disabled={!parsed.count} onClick={apply}>
            Nhập {parsed.count || ""} tiết
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
