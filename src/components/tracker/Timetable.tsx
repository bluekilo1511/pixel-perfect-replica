import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { KIND_META, uid, type Slot, type TaskKind } from "@/lib/tracker/model";
import { TimetableQuickImport } from "./TimetableQuickImport";
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

/** Drops an empty teacher label and trims a filled one before saving. */
const cleanSlot = (s: Slot): Slot => {
  if (s.teacher && s.teacher.trim()) return { ...s, teacher: s.teacher.trim() };
  const out: Partial<Slot> = { ...s };
  delete out.teacher;
  return out as Slot;
};

const newSlot = (kind: TaskKind = "pomodoro"): Slot => ({
  id: uid("slot"),
  start: "08:00",
  end: "08:25",
  title: KIND_META[kind].label,
  kind,
  minutes: KIND_META[kind].minutes,
});

export function Timetable() {
  const { data, update } = useTracker();
  const [editing, setEditing] = useState<Editing>(null);
  const [importing, setImporting] = useState(false);
  const todayIdx = new Date().getDay();

  const save = (e: NonNullable<Editing>, applyAllWeek: boolean) => {
    update((d) => ({
      ...d,
      timetable: {
        ...d.timetable,
        days: d.timetable.days.map((day) => {
          const target = applyAllWeek ? true : day.dayIndex === e.dayIndex;
          if (!target) return day;
          const slot = day.dayIndex === e.dayIndex ? e.slot : { ...e.slot, id: uid("slot") };
          const exists = day.slots.some((s) => s.id === slot.id);
          const slots = exists
            ? day.slots.map((s) => (s.id === slot.id ? slot : s))
            : [...day.slots, slot];
          return { ...day, slots: slots.sort((a, b) => a.start.localeCompare(b.start)) };
        }),
      },
    }));
    setEditing(null);
  };

  const remove = (e: NonNullable<Editing>) => {
    update((d) => ({
      ...d,
      timetable: {
        ...d.timetable,
        days: d.timetable.days.map((day) =>
          day.dayIndex === e.dayIndex
            ? { ...day, slots: day.slots.filter((s) => s.id !== e.slot.id) }
            : day,
        ),
      },
    }));
    setEditing(null);
  };

  return (
    <section className="glass p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">🗓️ Thời khóa biểu tuần</h2>
          <p className="text-sm text-muted-foreground">
            Bắt đầu từ Chủ Nhật — lên kế hoạch cho cả tuần mới. Bấm vào khung giờ để sửa.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
          ⚡ Nhập nhanh
        </Button>
      </div>
      <TimetableQuickImport open={importing} onClose={() => setImporting(false)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {data.timetable.days.map((day) => (
          <div
            key={day.dayIndex}
            className={`flex min-h-[220px] flex-col rounded-xl border p-2.5 ${day.dayIndex === todayIdx ? "border-primary bg-secondary glass-glow" : "border-border bg-muted"}`}
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
                  className="rounded-lg border border-border bg-card p-2 text-left text-xs transition hover:border-primary"
                >
                  <div className="font-display tabular-nums text-muted-foreground">
                    {s.start}–{s.end}
                  </div>
                  <div className="mt-0.5 font-medium leading-snug">
                    {KIND_META[s.kind].emoji} {s.title}
                  </div>
                  {s.teacher && <div className="text-muted-foreground">👩‍🏫 {s.teacher}</div>}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full border border-dashed border-border"
              onClick={() => setEditing({ dayIndex: day.dayIndex, slot: newSlot(), isNew: true })}
            >
              + Khung giờ
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
          dayLabel={data.timetable.days[editing.dayIndex]?.label ?? ""}
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
  onSave: (e: NonNullable<Editing>, all: boolean) => void;
  onDelete: (e: NonNullable<Editing>) => void;
}) {
  const [slot, setSlot] = useState(editing.slot);
  const [allWeek, setAllWeek] = useState(false);
  const set = (p: Partial<Slot>) => setSlot((s) => ({ ...s, ...p }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass">
        <DialogHeader>
          <DialogTitle>
            {editing.isNew ? "Thêm khung giờ" : "Sửa khung giờ"} · {dayLabel}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Gán nhanh nhiệm vụ</Label>
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
            <Label htmlFor="st">Tiêu đề</Label>
            <Input
              id="st"
              className="mt-1"
              value={slot.title}
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="sv">Giáo viên (tùy chọn)</Label>
            <Input
              id="sv"
              className="mt-1"
              value={slot.teacher ?? ""}
              onChange={(e) => set({ teacher: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="ss">Bắt đầu</Label>
              <Input
                id="ss"
                type="time"
                className="mt-1"
                value={slot.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="se">Kết thúc</Label>
              <Input
                id="se"
                type="time"
                className="mt-1"
                value={slot.end}
                onChange={(e) => set({ end: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sm">Hẹn giờ (phút)</Label>
              <Input
                id="sm"
                type="number"
                min={0}
                className="mt-1"
                value={slot.minutes}
                onChange={(e) => set({ minutes: Math.max(0, +e.target.value) })}
              />
            </div>
          </div>
          {editing.isNew && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allWeek}
                onChange={(e) => setAllWeek(e.target.checked)}
              />
              Áp dụng cho cả tuần (CN → T7)
            </label>
          )}
        </div>
        <DialogFooter className="gap-2">
          {!editing.isNew && (
            <Button variant="destructive" onClick={() => onDelete(editing)}>
              🗑 Xóa
            </Button>
          )}
          <Button
            disabled={!slot.title.trim() || !slot.start}
            onClick={() => onSave({ ...editing, slot: cleanSlot(slot) }, allWeek)}
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
