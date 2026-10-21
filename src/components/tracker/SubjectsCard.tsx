import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { addSubject, removeSubject, SUBJECTS_MAX } from "@/lib/tracker/model";
import {
  setSubjectNote,
  setTopicMark,
  TOPIC_MARK_META,
  TOPICS_MAX,
  type TopicMark,
} from "@/lib/tracker/subjectNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Manages study subjects: tags for Pomodoro sessions plus per-subject notes and topic marks. */
export function SubjectsCard() {
  const { data, update } = useTracker();
  const [name, setName] = useState("");
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState("");
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
  const mark = (subject: string, topic: string, m: TopicMark | null) => {
    const r = setTopicMark(data, subject, topic, m);
    if (!r) {
      toast.error(`Tối đa ${TOPICS_MAX} chủ điểm cho một môn thôi nhé`);
      return;
    }
    update(() => r);
  };
  return (
    <section className="glass p-5" aria-label="Môn học">
      <h2 className="mb-2 text-sm font-semibold">📚 Môn học</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Bấm vào một môn để ghi chú và đánh dấu chủ điểm cần học lại / yếu / tốt.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {data.subjects.map((s) => {
          const note = data.subjectNotes[s];
          const weakCount = (note?.topics ?? []).filter(
            (t) => t.mark === "weak" || t.mark === "redo",
          ).length;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setOpenSubject(openSubject === s ? null : s);
                setTopicDraft("");
              }}
              aria-expanded={openSubject === s}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition ${
                openSubject === s
                  ? "bg-primary text-primary-foreground"
                  : weakCount > 0
                    ? "bg-destructive/15 text-destructive"
                    : "bg-secondary"
              }`}
            >
              {s}
              {weakCount > 0 && <span title={`${weakCount} chủ điểm cần ôn`}>🔻{weakCount}</span>}
            </button>
          );
        })}
        {data.subjects.length === 0 && (
          <span className="text-xs text-muted-foreground">Chưa có môn nào — thêm bên dưới.</span>
        )}
      </div>
      {openSubject && (
        <div className="mb-3 rounded-xl border border-border bg-muted p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold">✏️ Ghi chú môn {openSubject}</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => {
                update((d) => removeSubject(d, openSubject));
                setOpenSubject(null);
              }}
            >
              Xoá môn
            </Button>
          </div>
          <textarea
            className="mb-2 min-h-16 w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-xs"
            placeholder="Ghi chú cho môn này, vd: cần luyện đề nhiều, hay thi cuối trọng số cao…"
            value={data.subjectNotes[openSubject]?.note ?? ""}
            maxLength={300}
            onChange={(e) => {
              const r = setSubjectNote(data, openSubject, e.target.value);
              if (r) update(() => r);
            }}
            aria-label={`Ghi chú môn ${openSubject}`}
          />
          <p className="mb-1.5 text-xs font-medium">Chủ điểm</p>
          <ul className="mb-2 space-y-1">
            {(data.subjectNotes[openSubject]?.topics ?? []).map((t) => (
              <li
                key={t.name}
                className="flex flex-wrap items-center gap-1.5 rounded-lg bg-background/50 px-2 py-1"
              >
                <span className="min-w-0 flex-1 truncate text-xs">{t.name}</span>
                {(Object.keys(TOPIC_MARK_META) as TopicMark[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    title={TOPIC_MARK_META[m].label}
                    aria-label={`${TOPIC_MARK_META[m].label}: ${t.name}`}
                    aria-pressed={t.mark === m}
                    onClick={() => mark(openSubject, t.name, t.mark === m ? null : m)}
                    className={`rounded-full px-1 text-sm transition ${t.mark === m ? "bg-secondary" : "opacity-40 hover:opacity-100"}`}
                  >
                    {TOPIC_MARK_META[m].emoji}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label={`Xoá chủ điểm ${t.name}`}
                  className="text-muted-foreground transition hover:text-destructive"
                  onClick={() => mark(openSubject, t.name, null)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Input
              className="h-8"
              placeholder="Chủ điểm, vd: Hàm số, Hóa hữu cơ…"
              value={topicDraft}
              maxLength={40}
              onChange={(e) => setTopicDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !topicDraft.trim()) return;
                mark(openSubject, topicDraft, "redo");
                setTopicDraft("");
              }}
              aria-label="Chủ điểm mới"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={() => {
                if (!topicDraft.trim()) return;
                mark(openSubject, topicDraft, "redo");
                setTopicDraft("");
              }}
            >
              + Thêm
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Chủ điểm mới mặc định là 🔁 cần học lại — bấm 🔻 yếu / 🟢 tốt để đổi, bấm lại để bỏ dấu.
          </p>
        </div>
      )}
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
