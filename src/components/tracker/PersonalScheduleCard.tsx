import { Fragment, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { KIND_META, uid, type Slot, type TaskKind } from "@/lib/tracker/model";
import { buildIcs } from "@/lib/tracker/ics";
import { toast } from "sonner";
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

type Editing = { dayIndex: number; slot: Slot; isNew: boolean } | null;

const cleanSlot = (s: Slot): Slot => {
  if (s.teacher && s.teacher.trim()) return { ...s, teacher: s.teacher.trim() };
  const out: Partial<Slot> = { ...s };
  delete out.teacher;
  return out as Slot;
};

const withTracked = (s: Slot, tracked: boolean): Slot => {
  if (tracked) {
    const out: Partial<Slot> = { ...s };
    delete out.tracked;
    return out as Slot;
  }
  return { ...s, tracked: false };
};

const newSlot = (kind: TaskKind = "pomodoro"): Slot => ({
  id: uid("slot"),
  start: "19:00",
  end: "19:25",
  title: KIND_META[kind].label,
  kind,
  minutes: KIND_META[kind].minutes,
});

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Lịch riêng ngoài giờ học: gia sư, tự học tối, thể thao, hẹn… Đến giờ tự tạo task. */
export function PersonalScheduleCard() {
  const { data, update } = useTracker();
  const [editing, setEditing] = useState<Editing>(null);
  const todayIdx = new Date().getDay();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const exportIcs = () => {
    const ics = buildIcs(data.personal, data.extraSchedule);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lich-rihan.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success("📥 Đã tải lich-rihan.ics — import vào Google Calendar để nhận thông báo!");
  };

  const save = (e: NonNullable<Editing>) => {
    update((d) => ({
      ...d,
      personal: {
        ...d.personal,
        days: d.personal.days.map((day) => {
          if (day.dayIndex !== e.dayIndex) return day;
          const exists = day.slots.some((s) => s.id === e.slot.id);
          const slots = exists
            ? day.slots.map((s) => (s.id === e.slot.id ? e.slot : s))
            : [...day.slots, e.slot];
          return { ...day, slots: slots.sort((a, b) => a.start.localeCompare(b.start)) };
        }),
      },
    }));
    setEditing(null);
  };

  const remove = (e: NonNullable<Editing>) => {
    update((d) => ({
      ...d,
      personal: {
        ...d.personal,
        days: d.personal.days.map((day) =>
          day.dayIndex === e.dayIndex
            ? { ...day, slots: day.slots.filter((s) => s.id !== e.slot.id) }
            : day,
        ),
      },
    }));
    setEditing(null);
  };

  const cellBase =
    "relative rounded-lg border p-1.5 text-left text-xs transition min-h-[48px] w-full";

  const cellClass = (dayIndex: number, s: Slot) =>
    [
      cellBase,
      s.tracked === false ? "border-dashed border-border/70 bg-muted/60" : "border-border bg-card",
      "hover:border-primary",
      dayIndex === todayIdx && toMin(s.start) <= nowMin && nowMin < toMin(s.end)
        ? "ring-2 ring-primary border-primary"
        : "",
      "overflow-hidden",
    ].join(" ");

  return (
    <section className="glass p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">📅 Lịch riêng (ngoài giờ học)</h2>
          <p className="text-sm text-muted-foreground">
            Lịch cá nhân của bạn: gia sư, tự học buổi tối, thể thao, hẹn… Đến giờ sẽ tự nhảy vào
            danh sách việc cần làm. Mục có 👁 chỉ hiển thị.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportIcs} aria-label="Xuất lịch ra file .ics">
          📥 Xuất .ics
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {data.personal.days.map((day) => (
          <div
            key={day.dayIndex}
            className={`flex min-h-[180px] flex-col rounded-xl border p-2.5 ${day.dayIndex === todayIdx ? "border-primary bg-secondary glass-glow" : "border-border bg-muted"}`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h3 className={`text-sm font-semibold ${day.dayIndex === 0 ? "text-accent" : ""}`}>
                {day.label}
              </h3>
              {day.dayIndex === todayIdx && (
                <span className="text-[10px] font-semibold uppercase text-primary">Hôm nay</span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {day.slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    setEditing({ dayIndex: day.dayIndex, slot: { ...s }, isNew: false })
                  }
                  className={cellClass(day.dayIndex, s)}
                >
                  <div className="font-display tabular-nums text-[10px] text-muted-foreground">
                    {s.start}–{s.end}
                    {s.tracked === false && <span className="ml-1">👁</span>}
                  </div>
                  <div className="mt-0.5 truncate font-medium leading-tight">
                    {KIND_META[s.kind].emoji} {s.title}
                  </div>
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full border border-dashed border-border"
              onClick={() => setEditing({ dayIndex: day.dayIndex, slot: newSlot(), isNew: true })}
            >
              + Thêm
            </Button>
          </div>
        ))}
      </div>

      {editing && (
        <SlotDialog
          editing={editing}
          onClose={() => setEditing(null)}
          onSave={save}
          onDelete={remove}
          dayLabel={data.personal.days[editing.dayIndex]?.label ?? ""}
        />
      )}
    </section>
  );
}

function SlotDialog({
  editing,
  onClose,
  onSave,
  onDelete,
  dayLabel,
}: {
  editing: NonNullable<Editing>;
  dayLabel: string;
  onClose: () => void;
  onSave: (e: NonNullable<Editing>) => void;
  onDelete: (e: NonNullable<Editing>) => void;
}) {
  const [slot, setSlot] = useState(editing.slot);
  const [tracked, setTracked] = useState(editing.slot.tracked !== false);
  const set = (p: Partial<Slot>) => setSlot((s) => ({ ...s, ...p }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle>
            {editing.isNew ? "Thêm lịch riêng" : "Sửa lịch riêng"} · {dayLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Gán nhanh</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(KIND_META) as TaskKind[]).map((k) => (
                <Button
                  key={k}
                  type="button"
                  size="sm"
                  variant={slot.kind === k ? "default" : "secondary"}
                  onClick={() =>
                    set({
                      kind: k,
                      title: k === "custom" ? slot.title : KIND_META[k].label,
                      minutes: KIND_META[k].minutes,
                    })
                  }
                >
                  {KIND_META[k].emoji} {KIND_META[k].label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ps-t">Tiêu đề</Label>
            <Input
              id="ps-t"
              className="mt-1"
              value={slot.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="ps-s">Bắt đầu</Label>
              <Input
                id="ps-s"
                type="time"
                className="mt-1"
                value={slot.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ps-e">Kết thúc</Label>
              <Input
                id="ps-e"
                type="time"
                className="mt-1"
                value={slot.end}
                onChange={(e) => set({ end: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ps-m">Hẹn giờ (phút)</Label>
              <Input
                id="ps-m"
                type="number"
                min={0}
                className="mt-1"
                value={slot.minutes}
                onChange={(e) => set({ minutes: Math.max(0, +e.target.value) })}
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={tracked}
              onChange={(e) => setTracked(e.target.checked)}
            />
            <span>
              <span className="font-medium">⏰ Tự vào việc cần làm</span>
              <span className="block text-xs text-muted-foreground">
                Đến giờ sẽ tự tạo mục trong danh sách hôm nay. Tắt nếu chỉ cần nhìn lên lịch (👁 chỉ
                xem).
              </span>
            </span>
          </label>
        </div>
        <DialogFooter className="gap-2">
          {!editing.isNew && (
            <Button variant="destructive" onClick={() => onDelete(editing)}>
              🗑 Xóa
            </Button>
          )}
          <Button
            disabled={!slot.title.trim() || !slot.start}
            onClick={() => onSave({ ...editing, slot: withTracked(cleanSlot(slot), tracked) })}
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
