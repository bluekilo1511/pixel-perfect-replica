import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { listSnapshots, type Snapshot } from "@/lib/tracker/timeCapsule";
import { Button } from "@/components/ui/button";

export function TimeCapsuleButton() {
  const { restore } = useTracker();
  const [snaps, setSnaps] = useState<Snapshot[] | null>(null);
  const openList = async () => {
    try {
      setSnaps(await listSnapshots());
    } catch {
      toast.error("Trình duyệt không hỗ trợ Time Capsule");
    }
  };
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground"
        onClick={() => (snaps ? setSnaps(null) : openList())}
      >
        🕰️ Khôi phục từ Time Capsule
      </Button>
      {snaps && (
        <div className="glass absolute right-0 top-full z-30 mt-2 w-72 space-y-1 p-3">
          <p className="mb-1 text-xs font-semibold">Bản sao lưu trong trình duyệt</p>
          {snaps.length === 0 && (
            <p className="text-xs text-muted-foreground">Chưa có bản sao lưu nào.</p>
          )}
          {snaps.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-secondary"
              onClick={() => {
                if (!confirm("Khôi phục bản này? Dữ liệu hiện tại sẽ bị thay thế.")) return;
                restore(s.data);
                setSnaps(null);
                toast.success("Đã khôi phục dữ liệu từ Time Capsule");
              }}
            >
              {new Date(s.at).toLocaleString("vi-VN")} · Lv {s.data.game?.level ?? 1} ·{" "}
              {s.data.tasks?.length ?? 0} task
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
