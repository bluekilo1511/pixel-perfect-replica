import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { DAY_LABELS, dateStr } from "@/lib/tracker/model";
import { shiftDate } from "@/lib/tracker/gamify";
import {
  addExtraSchedule,
  extraToTask,
  removeExtraSchedule,
  upcomingExtraSchedule,
} from "@/lib/tracker/tkb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputVN } from "./DateInputVN";

const viDate = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  return `${DAY_LABELS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Quick one-off reminders ("Họp nhóm 20h") with their own list and auto-push. */
export function ExtraScheduleCard() {
  const { data, update } = useTracker();
  const items = upcomingExtraSchedule(data, new Date());
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(shiftDate(dateStr(), 1));
  const [time, setTime] = useState("");
  const [minutes, setMinutes] = useState(0);

  const add = () => {
    const next = addExtraSchedule(data, { date, title, time: time || null, minutes });
    if (!next) {
      toast.error("Chưa thêm được — kiểm tra tiêu đề, ngày và giờ nhé");
      return;
    }
    update(() => next);
    setTitle("");
    setTime("");
    toast.success("Đã lưu nhắc việc 📌");
  };

  const pushOne = (id: string) => {
    const next = extraToTask(data, id, new Date());
    if (!next) {
      toast("Mục này đã có trong việc cần làm rồi 👍");
      return;
    }
    update(() => next);
    toast.success("Đã thêm vào việc cần làm ✅");
  };

  return (
    <section className="glass p-5">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">📌 Nhắc việc sắp tới</h2>
        <p className="text-sm text-muted-foreground">
          Lịch ngoài thời khóa biểu: nhóm học, nộp bài, hẹn… Mục đến hôm nay sẽ tự nhảy vào danh
          sách việc cần làm.
        </p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Input
          placeholder="Việc gì? (VD: Họp nhóm)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="col-span-2"
          aria-label="Tên nhắc việc"
        />
        <DateInputVN value={date} onChange={(iso) => setDate(iso)} ariaLabel="Ngày" />
        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Giờ (tùy chọn)"
        />
        <Input
          type="number"
          min={0}
          max={600}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(0, +e.target.value || 0))}
          aria-label="Số phút (0 = không hẹn giờ)"
          placeholder="Phút (0 = không hẹn giờ)"
        />
        <Button className="col-span-2 sm:col-span-3" onClick={add} disabled={!title.trim()}>
          + Thêm nhắc việc
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
          Chưa có nhắc việc nào trong 7 ngày tới.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((x) => (
            <li
              key={x.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{x.title}</p>
                <p className="font-display text-xs tabular-nums text-muted-foreground">
                  {viDate(x.date)}
                  {x.time && ` · ${x.time}`}
                  {x.minutes > 0 && ` · ${x.minutes}p`}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => pushOne(x.id)}
                title="Thêm vào việc cần làm"
              >
                → Việc
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update((d) => removeExtraSchedule(d, x.id))}
                title="Xóa"
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
