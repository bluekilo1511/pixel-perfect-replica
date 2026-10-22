import { Fragment, useState } from "react";
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

/** Tracked slots omit the flag entirely; display-only ones carry tracked:false. */
const withTracked = (s: Slot, tracked: boolean): Slot => {
  if (tracked) {
    const out: Partial<Slot> = { ...s };
    delete out.tracked;
    return out as Slot;
  }
  return { ...s, tracked: false };
};

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
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
  const today = new Date();
  const nowMin = today.getHours() * 60 + today.getMinutes();

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

  const afternoonMin = toMin(data.timetable.afternoonStart || "13:00");
  const sessionOf = (s: Slot): "morning" | "afternoon" =>
    s.session ?? (toMin(s.start) >= afternoonMin ? "afternoon" : "morning");

  const schoolRows = (["morning", "afternoon"] as const).map((sess) => ({
    sess,
    count: Math.max(
      1,
      ...data.timetable.days.map((d) => d.slots.filter((s) => sessionOf(s) === sess).length),
    ),
  }));

  const isNow = (dayIndex: number, s: Slot) =>
    dayIndex === todayIdx && toMin(s.start) <= nowMin && nowMin < toMin(s.end);

  const openEdit = (dayIndex: number, s: Slot) =>
    setEditing({ dayIndex, slot: { ...s }, isNew: false });

  const cellBase =
    "relative rounded-lg border p-1.5 text-left text-xs transition min-h-[52px] w-full";

  const cellClass = (dayIndex: number, s: Slot) =>
    [
      cellBase,
      s.tracked === false ? "border-dashed border-border/70 bg-muted/60" : "border-border bg-card",
      s.tracked === false ? "hover:border-primary/60" : "hover:border-primary",
      isNow(dayIndex, s) ? "ring-2 ring-primary border-primary" : "",
      "overflow-hidden",
    ].join(" ");

  const cellBody = (s: Slot) => (
    <>
      <div className="font-display tabular-nums text-[10px] text-muted-foreground">
        {s.start}–{s.end}
      </div>
      <div className="mt-0.5 truncate font-medium leading-tight">{s.title}</div>
      {s.teacher && <div className="truncate text-[10px] text-muted-foreground">{s.teacher}</div>}
      {s.tracked === false && (
        <span className="absolute right-1 top-1 text-[9px] text-muted-foreground/70">👁</span>
      )}
    </>
  );

  return (
    <section className="glass p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">🏫 TKB trường</h2>
          <p className="text-sm text-muted-foreground">
            Dạng tờ TKB trường — bấm vào ô để sửa. Môn có 👁 chỉ hiển thị, không tự tạo task. Môn 📚
            Học thật là nguồn cho thẻ “Học trước cho ngày mai”.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setImporting(true)}>
            ⚡ Nhập nhanh
          </Button>
        </div>
      </div>
      <TimetableQuickImport open={importing} onClose={() => setImporting(false)} />

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[760px]">
          <div
            className="grid gap-1 text-xs"
            style={{ gridTemplateColumns: "64px repeat(7, minmax(0, 1fr))" }}
          >
            <div />
            {data.timetable.days.map((day) => (
              <div
                key={day.dayIndex}
                className={`rounded-lg px-1 py-1.5 text-center font-semibold ${day.dayIndex === todayIdx ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                {day.label}
                {day.dayIndex === todayIdx && (
                  <div className="text-[9px] uppercase tracking-wide">hôm nay</div>
                )}
              </div>
            ))}
            {schoolRows.map(({ sess, count }) => (
              <Fragment key={sess}>
                <div
                  className={`col-span-8 mt-2 rounded-md px-2 py-1 text-center text-[11px] font-semibold uppercase tracking-wide ${sess === "morning" ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-400"}`}
                >
                  {sess === "morning" ? "🌞 Buổi sáng" : "🌇 Buổi chiều"}
                </div>
                {Array.from({ length: count }, (_, i) => (
                  <Fragment key={i}>
                    <div className="flex items-center justify-center rounded-lg bg-muted/50 py-1 text-center text-[10px] font-medium text-muted-foreground">
                      Tiết {i + 1}
                    </div>
                    {data.timetable.days.map((day) => {
                      const slots = day.slots.filter((s) => sessionOf(s) === sess);
                      const s = slots[i];
                      if (!s)
                        return (
                          <button
                            key={`${day.dayIndex}:${sess}:${i}`}
                            type="button"
                            onClick={() =>
                              setEditing({
                                dayIndex: day.dayIndex,
                                slot: withTracked(newSlot(), false),
                                isNew: true,
                              })
                            }
                            className="min-h-[52px] rounded-lg border border-dashed border-border/40 text-muted-foreground/30 transition hover:border-primary/50"
                            aria-label={`Thêm tiết ${i + 1} ${day.label}`}
                          >
                            +
                          </button>
                        );
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => openEdit(day.dayIndex, s)}
                          className={cellClass(day.dayIndex, s)}
                        >
                          {cellBody(s)}
                        </button>
                      );
                    })}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
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
  const [tracked, setTracked] = useState(editing.slot.tracked !== false);
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
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={tracked}
              onChange={(e) => setTracked(e.target.checked)}
            />
            <span>
              <span className="font-medium">📚 Học thật</span>
              <span className="block text-xs text-muted-foreground">
                Đến giờ sẽ tự tạo task vào danh sách hôm nay. Tắt đi nếu môn đó chỉ cần nhìn trên
                bảng TKB (👁 chỉ xem).
              </span>
            </span>
          </label>
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
            onClick={() =>
              onSave({ ...editing, slot: withTracked(cleanSlot(slot), tracked) }, allWeek)
            }
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
