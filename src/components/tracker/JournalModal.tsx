import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import {
  deleteJournal,
  journalForDate,
  upsertJournal,
  JOURNAL_TEXT_MAX,
} from "@/lib/tracker/journal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Hidden personal diary: opens by clicking the little bookshelf on the study-room wall. */
export function JournalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, update } = useTracker();
  const today = dateStr();
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [loadedDate, setLoadedDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loadedDate === date) return;
    const entry = journalForDate(data, date);
    setTitle(entry?.title ?? "");
    setText(entry?.text ?? "");
    setLoadedDate(date);
  }, [open, date, loadedDate, data]);

  if (!open) return null;

  const save = () => {
    if (!text.trim()) {
      toast.error("Sổ tay cần vài chữ đã chứ ✍️");
      return;
    }
    update((d) => upsertJournal(d, { date, ...(title.trim() ? { title } : {}), text }) ?? d);
    toast.success("Đã ghi vào sổ tay 📖");
  };

  const remove = () => {
    update((d) => deleteJournal(d, date));
    setTitle("");
    setText("");
    toast("Đã xoá trang này");
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="glass glass-glow animate-pop max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Sổ tay cá nhân"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">📖 Sổ tay của riêng mình</h2>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Đóng sổ tay">
            ✕
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Ghi chuyện riêng, cảm nhận trong ngày hay điều nào đó muốn tự nhắc bản thân — chỉ mình bạn
          đọc được thôi.
        </p>
        <div className="mb-2 flex flex-wrap gap-2">
          <Input
            type="date"
            className="h-9 w-40"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Ngày của trang sổ"
          />
          <Input
            className="h-9 min-w-[140px] flex-1"
            placeholder="Tiêu đề (không bắt buộc)"
            value={title}
            maxLength={60}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Tiêu đề trang sổ"
          />
        </div>
        <textarea
          className="min-h-40 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          placeholder="Hôm nay thế nào? Có chuyện gì muốn kể bản thân không?"
          value={text}
          maxLength={JOURNAL_TEXT_MAX}
          onChange={(e) => setText(e.target.value)}
          aria-label="Nội dung sổ tay"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{data.journal.length} trang đã ghi</span>
          <div className="flex gap-2">
            {journalForDate(data, date) && (
              <Button size="sm" variant="ghost" onClick={remove}>
                🗑 Xoá trang
              </Button>
            )}
            <Button size="sm" onClick={save}>
              💾 Lưu
            </Button>
          </div>
        </div>
        {data.journal.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Các trang gần đây</p>
            <ul className="space-y-1">
              {data.journal.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="w-full truncate rounded-md px-2 py-1 text-left text-xs hover:bg-secondary"
                    onClick={() => setDate(e.date)}
                  >
                    🗓 {e.date}
                    {e.title ? ` · ${e.title}` : ""} — {e.text.slice(0, 40)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
