import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { addSubject, removeSubject, SUBJECTS_MAX } from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Manages the user's study subjects used to tag Pomodoro sessions. */
export function SubjectsCard() {
  const { data, update } = useTracker();
  const [name, setName] = useState("");
  const add = () => {
    const n = name.trim();
    if (!n) return;
    const r = addSubject(data, n);
    if (!r) {
      toast.error(
        data.subjects.length >= SUBJECTS_MAX
          ? `Tối đa ${SUBJECTS_MAX} môn thôi nhé`
          : "Môn này đã có rồi",
      );
      return;
    }
    update(() => r);
    setName("");
  };
  return (
    <section className="glass p-5" aria-label="Môn học">
      <h2 className="mb-2 text-sm font-semibold">📚 Môn học</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Gắn môn cho nhiệm vụ Pomodoro để xem biểu đồ ôn bài theo môn.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {data.subjects.map((s) => (
          <span
            key={s}
            className="group flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs"
          >
            {s}
            <button
              type="button"
              aria-label={`Xoá môn ${s}`}
              className="text-muted-foreground transition hover:text-destructive"
              onClick={() => update((d) => removeSubject(d, s))}
            >
              ×
            </button>
          </span>
        ))}
        {data.subjects.length === 0 && (
          <span className="text-xs text-muted-foreground">Chưa có môn nào — thêm bên dưới.</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          className="h-8"
          placeholder="Tên môn, vd: Toán"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="Tên môn mới"
        />
        <Button size="sm" variant="outline" className="h-8" onClick={add}>
          + Thêm
        </Button>
      </div>
    </section>
  );
}
