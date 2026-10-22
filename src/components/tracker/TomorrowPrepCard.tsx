import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { dateStr } from "@/lib/tracker/model";
import { addPrepTasks, tomorrowSlots, type PrepPick } from "@/lib/tracker/tkb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Tonight's study plan for tomorrow's timetable subjects. */
export function TomorrowPrepCard() {
  const { data, update } = useTracker();
  const slots = tomorrowSlots(data, new Date());
  const [minutes, setMinutes] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const tomorrowLabel = data.timetable.days[(new Date().getDay() + 1) % 7]?.label ?? "mai";
  const picks: PrepPick[] = slots
    .filter((s) => !skipped[s.id])
    .map((s) => ({ slot: s, minutes: minutes[s.id] ?? data.settings.pomodoroMinutes }));

  const apply = () => {
    const added = addPrepTasks(data, new Date(), picks).added;
    if (!added) {
      toast("Môn mai đã có trong kế hoạch tối nay rồi 👍");
      return;
    }
    update((d) => addPrepTasks(d, new Date(), picks).data);
    toast.success(`Đã thêm ${added} việc ôn cho tối nay 🌙`, {
      description: "Hoàn thành để tính vào streak như thường.",
    });
  };

  return (
    <section className="glass p-5">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">🌙 Học trước cho {tomorrowLabel.toLowerCase()}</h2>
        <p className="text-sm text-muted-foreground">
          Các môn của ngày mai trong thời khóa biểu — chọn phút ôn từng môn rồi nạp vào việc tối
          nay.
        </p>
      </div>
      {slots.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Chưa có tiết nào cho {tomorrowLabel.toLowerCase()}. Nhập TKB nhanh ở tab Thời khóa biểu ⚡
          nhé.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {slots.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={!skipped[s.id]}
                  onChange={(e) => setSkipped((m) => ({ ...m, [s.id]: e.target.checked }))}
                  aria-label={`Ôn ${s.title}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    📚 {s.title}
                    {s.teacher && <span className="text-muted-foreground"> · {s.teacher}</span>}
                  </p>
                  <p className="font-display text-xs tabular-nums text-muted-foreground">
                    {s.start}–{s.end}
                  </p>
                </div>
                <Input
                  type="number"
                  min={5}
                  max={240}
                  className="w-20"
                  value={minutes[s.id] ?? data.settings.pomodoroMinutes}
                  onChange={(e) =>
                    setMinutes((m) => ({
                      ...m,
                      [s.id]: Math.min(240, Math.max(5, +e.target.value || 25)),
                    }))
                  }
                  aria-label={`Phút ôn ${s.title}`}
                />
              </li>
            ))}
          </ul>
          <Button className="mt-3 w-full" disabled={!picks.length} onClick={apply}>
            ⚡ Nạp {picks.length} việc ôn vào tối nay
          </Button>
        </>
      )}
    </section>
  );
}
