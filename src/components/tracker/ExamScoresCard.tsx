import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { dateStr } from "@/lib/tracker/model";
import {
  addExamScore,
  needsFocusSubject,
  removeExamScore,
  subjectScores,
} from "@/lib/tracker/exams";

const todayIso = () => dateStr();

/** Per-subject test scores with a mini bar chart and a "needs focus" trend line. */
export function ExamScoresCard() {
  const { data, update } = useTracker();
  const [subject, setSubject] = useState("");
  const [score, setScore] = useState("");
  const [max, setMax] = useState("10");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());

  const knownSubjects = Array.from(
    new Set([...data.subjects, ...data.examScores.map((s) => s.subject)]),
  );

  const add = () => {
    const subjectTrim = subject.trim();
    const scoreNum = Number(score);
    const maxNum = Number(max);
    if (!subjectTrim || !score || !Number.isFinite(scoreNum)) {
      toast.error("Nhập môn và điểm trước nhé 📊");
      return;
    }
    const next = addExamScore(data.examScores, {
      subject: subjectTrim,
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
    toast.success(`Đã thêm điểm ${subjectTrim} 📊`);
  };

  const groups = Array.from(new Set(data.examScores.map((s) => s.subject)));

  return (
    <section className="glass p-5" aria-label="Bảng điểm kiểm tra">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📊 Bảng điểm kiểm tra</h2>
        <span className="text-sm text-muted-foreground">{data.examScores.length}</span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Nhập điểm từng bài kiểm tra theo môn — web vẽ biểu đồ và cảnh báo môn nào cần ưu tiên ôn.
      </p>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_5rem_5rem_1fr_auto_auto]">
        <div>
          <Label htmlFor="es-subject" className="sr-only">Môn</Label>
          <Input
            id="es-subject"
            list="es-subjects"
            placeholder="Môn (vd: Hóa)"
            value={subject}
            maxLength={24}
            onChange={(e) => setSubject(e.target.value)}
          />
          <datalist id="es-subjects">
            {knownSubjects.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
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
      {groups.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Chưa có điểm nào. Thêm bài đầu tiên để thấy xu hướng từng môn nhé!
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => {
            const scores = subjectScores(data.examScores, g);
            const warn = needsFocusSubject(data.examScores, g);
            return (
              <li key={g} className="rounded-xl border border-border bg-muted p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    📚 {g}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {scores.length} bài · gần nhất {scores[scores.length - 1]!.score}/
                      {scores[scores.length - 1]!.max}
                    </span>
                  </p>
                  {warn && (
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                      ⚠️ {warn}
                    </span>
                  )}
                </div>
                <div className="flex h-16 items-end gap-1.5">
                  {scores.map((s) => (
                    <div
                      key={s.id}
                      className="group relative flex-1"
                      title={`${s.date}${s.title ? ` · ${s.title}` : ""}: ${s.score}/${s.max}`}
                    >
                      <div
                        className={`w-full rounded-t transition-all ${
                          s.score / s.max < 0.8 ? "bg-destructive/60" : "bg-primary/70"
                        }`}
                        style={{ height: `${Math.max(8, Math.round((s.score / s.max) * 100))}%` }}
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {scores.map((s) => `${s.score}`).join(" → ")}
                  {scores[0]!.date ? ` · từ ${scores[0]!.date}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {scores.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Xoá điểm ${s.score} ngày ${s.date}`}
                      title={`Xoá ${s.score}/${s.max} · ${s.date}${s.title ? ` · ${s.title}` : ""}`}
                      className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground transition hover:text-destructive"
                      onClick={() => update((d) => ({ ...d, examScores: removeExamScore(d.examScores, s.id) }))}
                    >
                      {s.score} ✕
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
