import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import {
  addNote,
  dateStr,
  notesDoneCount,
  removeNote,
  renameNote,
  toggleNote,
} from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Routine to-dos without a timer — "Dậy sớm", "Đọc 10 trang". The check resets each morning; no XP, no streak. */
export function NotesCard() {
  const { data, update } = useTracker();
  const today = dateStr();
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const done = notesDoneCount(data.notes, today);

  const add = () => {
    if (!title.trim() || data.notes.length >= 20) {
      toast.error("Không thêm được: tên trống hoặc đã đạt tối đa 20 việc.");
      return;
    }
    update((d) => addNote(d, title));
    setTitle("");
  };

  const saveRename = () => {
    if (!editingId) return;
    update((d) => renameNote(d, editingId, draft));
    setEditingId(null);
  };

  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">🗒️ Việc cần làm</h2>
        <span className="text-sm text-muted-foreground">
          {done}/{data.notes.length} hôm nay
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Việc thường ngày, không hẹn giờ — tick mỗi sáng, lại trắng vào hôm sau.
      </p>
      {data.notes.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {data.notes.map((n) => {
            const checked = n.lastDoneDate === today;
            return (
              <li
                key={n.id}
                className={`flex items-center gap-2 rounded-xl border border-border p-2.5 text-sm ${checked ? "bg-secondary/60" : "bg-muted"}`}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--primary)]"
                  checked={checked}
                  aria-label={checked ? `Bỏ tick ${n.title}` : `Hoàn thành ${n.title}`}
                  onChange={() => update((d) => toggleNote(d, n.id))}
                />
                {editingId === n.id ? (
                  <>
                    <Input
                      className="h-7 flex-1"
                      value={draft}
                      autoFocus
                      maxLength={120}
                      aria-label="Tên việc"
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={saveRename}>
                      💾
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`min-w-0 flex-1 truncate text-left ${checked ? "line-through opacity-70" : ""}`}
                      title="Bấm để đổi tên"
                      onClick={() => {
                        setEditingId(n.id);
                        setDraft(n.title);
                      }}
                    >
                      {n.title}
                    </button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Xóa ${n.title}`}
                      className="h-7 px-1.5 opacity-50 hover:opacity-100"
                      onClick={() => update((d) => removeNote(d, n.id))}
                    >
                      ✕
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!data.notes.length && (
        <p className="mb-3 text-sm text-muted-foreground">
          Chưa có việc nào. Thêm để tick mỗi ngày!
        </p>
      )}
      <div className="flex gap-2">
        <Input
          className="min-w-[140px] flex-1"
          placeholder="VD: Dậy sớm 6h…"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add}>+ Thêm</Button>
      </div>
    </section>
  );
}
