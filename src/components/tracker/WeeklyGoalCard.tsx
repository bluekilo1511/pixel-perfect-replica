import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { claimWeeklyGoal, setWeeklyGoal, weeklyGoalProgress } from "@/lib/tracker/weeklyGoal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Weekly focus-target card: progress bar, editable target, one gift per completed week. */
export function WeeklyGoalCard() {
  const { data, update } = useTracker();
  const p = weeklyGoalProgress(data);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(p.target));
  if (p.target === 0 && !editing) return null;

  const save = () => {
    const n = Math.max(0, Math.round(Number(draft) || 0));
    update((d) => setWeeklyGoal(d, n));
    setEditing(false);
    toast.success(n === 0 ? "Đã ẩn mục tiêu tuần" : `Mục tiêu tuần: ${n} phút 🎯`);
  };

  return (
    <section className="glass p-5" aria-label="Mục tiêu tập trung tuần">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">🎯 Mục tiêu tuần</h2>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => {
            setDraft(String(p.target));
            setEditing(!editing);
          }}
        >
          {editing ? "Đóng" : "Đổi mục tiêu"}
        </Button>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            className="h-8 w-24"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Số phút mục tiêu"
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <span className="text-xs text-muted-foreground">phút tập trung / tuần (0 = tắt)</span>
          <Button size="sm" className="h-8" onClick={save}>
            Lưu
          </Button>
        </div>
      ) : (
        <>
          <p className="mb-1 text-xs text-muted-foreground">
            {p.done}/{p.target} phút tập trung tuần này
            {p.celebrated && " · 🎁 đã nhận quà"}
          </p>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={p.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
              style={{ width: `${p.pct}%` }}
            />
          </div>
          {p.complete && !p.celebrated && (
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => {
                const r = claimWeeklyGoal(data);
                if (!r) return;
                update(() => r.data);
                toast.success(
                  `Hoàn thành mục tiêu tuần! +5 🪙 và quà nguyên liệu ${r.reward.material ?? ""}`,
                );
              }}
            >
              🎁 Nhận quà tuần này
            </Button>
          )}
        </>
      )}
    </section>
  );
}
