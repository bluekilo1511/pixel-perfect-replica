import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateStr, addSubject, SUBJECTS_MAX } from "@/lib/tracker/model";
import {
  addExamScore,
  needsFocusSubject,
  removeExamScore,
  subjectScores,
  type ExamScore,
} from "@/lib/tracker/exams";

const todayIso = () => dateStr();
const pct = (s: ExamScore) => s.score / s.max;

/** Per-subject test scores, picked from your subject list, with bars, trend and a focus warning. */
export function ExamScoresCard() {
  const { data, update } = useTracker();
  const chips = Array.from(new Set([...data.subjects, ...data.examScores.map((s) => s.subject)]));
  const [sel, setSel] = useState("");
  const active = chips.find((c) => c === sel) ?? chips[0] ?? "";
  const [score, setScore] = useState("");
  const [max, setMax] = useState("10");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [newSubject, setNewSubject] = useState("");

  const scores = active ? subjectScores(data.examScores, active) : [];
  const warn = active ? needsFocusSubject(data.examScores, active) : null;
  const avg = scores.length ? scores.reduce((a, s) => a + pct(s), 0) / scores.length : 0;
  const last = scores[scores.length - 1];
  const prev = scores[scores.length - 2];
  const trend =
    last && prev
      ? pct(last) > pct(prev) + 0.05
        ? { icon: "▲", text: "tiến bộ", cls: "text-primary" }
        : pct(last) < pct(prev) - 0.05
          ? { icon: "▼", text: "đi xuống", cls: "text-destructive" }
          : { icon: "◆", text: "ổn định", cls: "text-muted-foreground" }
      : null;

  const addSubjectChip = () => {
    const name = newSubject.trim().slice(0, 24);
    if (!name) return;
    const dup = chips.find((c) => c.toLowerCase() === name.toLowerCase());
    if (dup) {
      setSel(dup);
    } else if (data.subjects.length >= SUBJECTS_MAX) {
      toast.error(`Danh sách môn đã đầy (tối đa ${SUBJECTS_MAX}) 📚`);
      return;
    } else {
      update((d) => addSubject(d, name) ?? d);
    }
    setSel(name);
    setNewSubject("");
  };

  const add = () => {
    if (!active) {
      toast.error("Chọn hoặc thêm môn trước nhé 📚");
      return;
    }
    const scoreNum = Number(score);
    if (!score || !Number.isFinite(scoreNum)) {
      toast.error("Nhập điểm trước nhé 📊");
      return;
    }
    const maxNum = Number(max);
    const next = addExamScore(data.examScores, {
      subject: active,
      score: scoreNum,
      max: Number.isFinite(maxNum) && maxNum > 0 ? maxNum : 10,
      title,
      date: date || todayIso(),
    });
    if (!next) {
      toast.error("Điểm không hợp lệ (phải nằm trong thang điểm) hoặc danh sách đã đầy 📊");
      return;
    }
    update((d) => ({ ...d, examScores: next }));
    setScore("");
    setTitle("");
    toast.success(`Đã thêm điểm ${active} 📊`);
  };

  const chipCls = (c: string) =>
    [
      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
      c === active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
    ].join(" ");

  return (
    <section className="glass p-5" aria-label="Bảng điểm kiểm tra">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📊 Bảng điểm kiểm tra</h2>
        <span className="text-sm text-muted-foreground">{data.examScores.length}</span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Điểm lấy theo danh sách môn của bạn (tab Hôm nay → 📚 Môn học) — web vẽ biểu đồ và cảnh báo
        môn nào cần ưu tiên ôn.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {chips.map((c) => {
          const list = subjectScores(data.examScores, c);
          const a = list.length ? list.reduce((x, s) => x + pct(s), 0) / list.length : null;
          return (
            <button key={c} type="button" onClick={() => setSel(c)} className={chipCls(c)}>
              {c}
              {a !== null && <span className="ml-1 tabular-nums opacity-75">{Math.round(a * 100)}%</span>}
            </button>
          );
        })}
        <span className="flex items-center gap-1">
          <Input
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSubjectChip()}
            placeholder="+ môn mới"
            maxLength={24}
            className="h-7 w-28 rounded-full text-xs"
            aria-label="Thêm môn mới"
          />
          <Button size="sm" variant="ghost" className="h-7 rounded-full px-2" onClick={addSubjectChip}>
            +
          </Button>
        </span>
      </div>

      {active && (
        <div className="mb-4 grid items-center gap-2 sm:grid-cols-[5rem_5rem_1fr_auto_auto]">
          <Input
            type="number"
            step="0.25"
            min={0}
            placeholder="Điểm"
            aria-label="Điểm"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            aria-label="Thang điểm"
            title="Thang điểm (mặc định 10)"
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
          <Input
            placeholder="Ghi chú (vd: giữa kỳ)"
            value={title}
            maxLength={40}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Input
            type="date"
            className="w-36"
            aria-label="Ngày kiểm tra"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Button onClick={add}>+ Thêm</Button>
        </div>
      )}

      {!active ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Chưa có môn nào. Thêm môn ở phần 📚 Môn học (tab Hôm nay) hoặc gõ vào ô "+ môn mới" phía
          trên nhé!
        </p>
      ) : scores.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
          📚 {active}: chưa có điểm nào. Nhập bài đầu tiên ở trên để xem xu hướng nhé!
        </p>
      ) : (
        <div className="rounded-xl border border-border bg-muted p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-semibold">📚 {active}</h3>
              <span className="text-xs text-muted-foreground">
                {scores.length} bài · TB {Math.round(avg * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              {trend && (
                <span className={`text-xs font-semibold ${trend.cls}`}>
                  {trend.icon} {trend.text}
                </span>
              )}
              {warn && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                  ⚠️ {warn}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-end gap-2">
            {scores.map((s) => (
              <div
                key={s.id}
                className="group flex min-w-10 flex-1 flex-col items-center gap-1"
                title={`${s.date}${s.title ? ` · ${s.title}` : ""}: ${s.score}/${s.max}`}
              >
                <span className="text-[10px] font-semibold tabular-nums">{s.score}</span>
                <div className="flex h-20 w-full items-end overflow-hidden rounded-md bg-card/70">
                  <div
                    className={`w-full rounded-t-sm bg-gradient-to-t transition-all group-hover:brightness-110 ${
                      pct(s) < 0.8 ? "from-destructive/50 to-destructive" : "from-primary/50 to-primary"
                    }`}
                    style={{ height: `${Math.max(6, Math.round(pct(s) * 100))}%` }}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Xoá điểm ${s.score} ngày ${s.date}`}
                  title={`Xoá ${s.score}/${s.max} · ${s.date}`}
                  className="text-[10px] text-muted-foreground transition hover:text-destructive"
                  onClick={() =>
                    update((d) => ({ ...d, examScores: removeExamScore(d.examScores, s.id) }))
                  }
                >
                  {s.date.slice(5)} ✕
                </button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {scores.map((s) => `${s.score}/${s.max}`).join(" → ")}
          </p>
        </div>
      )}
    </section>
  );
}
