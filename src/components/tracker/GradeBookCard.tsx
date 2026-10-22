import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSubject, dateStr, SUBJECTS_MAX } from "@/lib/tracker/model";
import {
  absorbGradeExtra,
  addGradeEntry,
  addGradeExtra,
  convertExamScores,
  GRADE_TYPE_META,
  gradeAdvice,
  gradeBand,
  guessSemester,
  removeGradeEntry,
  removeGradeExtra,
  semesterEntries,
  subjectGrade,
  type GradeType,
  type Semester,
} from "@/lib/tracker/grades";

const TYPE_BUTTONS: { type: GradeType; label: string }[] = [
  { type: "tx", label: "+ TX" },
  { type: "gk", label: "+ Giữa kỳ" },
  { type: "ck", label: "+ Cuối kỳ" },
];

const pct = (s: { score: number; max: number }) => s.score / s.max;

/** Sổ điểm kiểu giáo viên: cột TX / giữa kỳ / cuối kỳ theo từng môn, kỳ 1 – kỳ 2 riêng, cộng "điểm dư" ở bên. */
export function GradeBookCard() {
  const { data, update } = useTracker();
  const chips = Array.from(
    new Set([
      ...data.subjects,
      ...data.gradeBook.map((e) => e.subject),
      ...data.gradeExtras.map((e) => e.subject),
    ]),
  );
  const [sel, setSel] = useState("");
  const active = chips.find((c) => c === sel) ?? chips[0] ?? "";
  const [semester, setSemester] = useState<Semester>(() => guessSemester(dateStr()));
  const [adding, setAdding] = useState<GradeType | null>(null);
  const [score, setScore] = useState("");
  const [max, setMax] = useState("10");
  const [title, setTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [target, setTarget] = useState("8");
  const [extraLabel, setExtraLabel] = useState("");
  const [extraScore, setExtraScore] = useState("");

  const entries = active ? semesterEntries(data.gradeBook, active, semester) : [];
  const tx = entries.filter((e) => e.type === "tx");
  const gk = entries.filter((e) => e.type === "gk");
  const ck = entries.filter((e) => e.type === "ck");
  const extras = active
    ? data.gradeExtras.filter((e) => e.subject === active && e.semester === semester)
    : [];
  const grade = active ? subjectGrade(data.gradeBook, active, semester) : null;
  const targetNum = Number(target);
  const advice = active ? gradeAdvice(data.gradeBook, active, semester, targetNum) : null;
  const legacyCount = data.examScores.length;

  const addSubjectChip = () => {
    const name = newSubject.trim().slice(0, 24);
    if (!name) return;
    const dup = chips.find((c) => c.toLowerCase() === name.toLowerCase());
    if (dup) setSel(dup);
    else if (data.subjects.length >= SUBJECTS_MAX) {
      toast.error(`Danh sách môn đã đầy (tối đa ${SUBJECTS_MAX}) 📚`);
      return;
    } else update((d) => addSubject(d, name) ?? d);
    setSel(name);
    setNewSubject("");
  };

  const add = (type: GradeType) => {
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
    const next = addGradeEntry(data.gradeBook, {
      subject: active,
      semester,
      type,
      score: scoreNum,
      max: Number.isFinite(maxNum) && maxNum > 0 ? maxNum : 10,
      title,
      date: dateStr(),
    });
    if (!next) {
      toast.error("Điểm không hợp lệ (phải nằm trong thang điểm) 📊");
      return;
    }
    update((d) => ({ ...d, gradeBook: next }));
    setScore("");
    setTitle("");
    setAdding(null);
    toast.success(`Đã thêm cột ${GRADE_TYPE_META[type].short} — ${active} kỳ ${semester} 📊`);
  };

  const addExtra = () => {
    if (!active) {
      toast.error("Chọn môn trước nhé 📚");
      return;
    }
    const label = extraLabel.trim();
    if (!label) {
      toast.error("Ghi chú điểm dư trống mà 📝");
      return;
    }
    const scoreNum = extraScore.trim() === "" ? null : Number(extraScore);
    const maxNum = Number(max);
    const next = addGradeExtra(data.gradeExtras, {
      subject: active,
      semester,
      label,
      score: scoreNum,
      max: Number.isFinite(maxNum) && maxNum > 0 ? maxNum : 10,
    });
    if (!next) {
      toast.error("Không thêm được điểm dư (có thể đã đầy) 📝");
      return;
    }
    update((d) => ({ ...d, gradeExtras: next }));
    setExtraLabel("");
    setExtraScore("");
    toast.success("Đã ghi điểm dư — chỉ nhét vào cột khi chắc nhé 📝");
  };

  const absorb = (extraId: string, type: GradeType) => {
    const r = absorbGradeExtra(data.gradeBook, data.gradeExtras, extraId, type);
    if (!r) {
      toast.error("Không ghép được cột 📝");
      return;
    }
    update((d) => ({ ...d, gradeBook: r.entries, gradeExtras: r.extras }));
    toast.success(`Đã nhập điểm dư vào cột ${GRADE_TYPE_META[type].short} ✅`);
  };

  const migrateLegacy = () => {
    update((d) => ({
      ...d,
      gradeBook: [...d.gradeBook, ...convertExamScores(d.examScores)],
      examScores: [],
    }));
    toast.success("Đã chuyển điểm cũ vào sổ — kiểm tra kỳ và loại cột nhé ⬆️");
  };

  const chipCls = (c: string) =>
    [
      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
      c === active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-muted-foreground hover:border-primary hover:text-foreground",
    ].join(" ");

  const colCls = "rounded-xl border border-border bg-card p-2 text-center";

  const columnBox = (e: (typeof entries)[number], idx: number) => (
    <div
      key={e.id}
      className={`${colCls} group relative min-w-16`}
      title={`${e.title || GRADE_TYPE_META[e.type].short}${e.date ? ` · ${e.date}` : ""}: ${e.score}/${e.max}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {GRADE_TYPE_META[e.type].short}
        {e.type === "tx" ? idx + 1 : ""}
        {e.title ? ` · ${e.title}` : ""}
      </p>
      <p className="font-display text-xl tabular-nums">{e.score}</p>
      <p className="text-[10px] text-muted-foreground">/{e.max}</p>
      <button
        type="button"
        aria-label={`Xoá cột ${e.score}/${e.max}`}
        className="absolute right-1 top-1 text-[10px] text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-destructive"
        onClick={() => update((d) => ({ ...d, gradeBook: removeGradeEntry(d.gradeBook, e.id) }))}
      >
        ✕
      </button>
    </div>
  );

  const adviceLine = (() => {
    if (!active) return null;
    if (advice) {
      if (advice.done)
        return `Mục tiêu ${targetNum}: cột ${GRADE_TYPE_META[advice.column].short} chỉ cần bất kỳ điểm nào — mục tiêu đã chắc ✅`;
      if (advice.impossible)
        return `Mục tiêu ${targetNum}: ngay cả khi ${GRADE_TYPE_META[advice.column].short} đạt 10 cũng không đủ 😥 — cân nhắc mục tiêu thấp hơn`;
      return `Mục tiêu ${targetNum}: ${GRADE_TYPE_META[advice.column].short} cần ≥ ${advice.need} để môn đạt mục tiêu 🎯`;
    }
    if (grade !== null) return `Tất cả cột đã có điểm — điểm môn hiện tại là ${grade}.`;
    return null;
  })();

  return (
    <section className="glass p-5" aria-label="Sổ điểm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🧮 Sổ điểm</h2>
        <div className="flex items-center gap-1" role="group" aria-label="Học kỳ">
          {([1, 2] as Semester[]).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={semester === s ? "secondary" : "ghost"}
              onClick={() => setSemester(s)}
            >
              Kỳ {s}
            </Button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Cột điểm như sổ của giáo viên: Thường xuyên (TX, thêm tuỳ ý) · Giữa kỳ (GK) · Cuối kỳ (CK).
        Điểm môn = trung bình các cột, làm tròn 0.1. Điểm dư ghi bên phải, chỉ nhét vào cột khi
        chắc.
      </p>

      {legacyCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm">
            ⬆️ Có {legacyCount} điểm nhập kiểu cũ — chuyển vào sổ để tính theo cột.
          </p>
          <Button size="sm" onClick={migrateLegacy}>
            Chuyển vào sổ
          </Button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {chips.map((c) => {
          const g = subjectGrade(data.gradeBook, c, semester);
          return (
            <button key={c} type="button" onClick={() => setSel(c)} className={chipCls(c)}>
              {c}
              {g !== null && <span className="ml-1 tabular-nums opacity-75">{g}</span>}
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
          <Button
            size="sm"
            variant="ghost"
            className="h-7 rounded-full px-2"
            onClick={addSubjectChip}
          >
            +
          </Button>
        </span>
      </div>

      {!active ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Chưa có môn nào. Thêm môn ở phần 📚 Môn học (tab Hôm nay) hoặc gõ vào ô "+ môn mới" phía
          trên nhé!
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-stretch gap-2">
            {tx.map((e, i) => columnBox(e, i))}
            {gk.map((e) => columnBox(e, 0))}
            {ck.map((e) => columnBox(e, 0))}
            {adding === null ? (
              <div className="flex flex-col justify-center gap-1">
                {TYPE_BUTTONS.map((b) => (
                  <Button
                    key={b.type}
                    size="sm"
                    variant="ghost"
                    className="h-6 justify-start px-2 text-xs"
                    onClick={() => setAdding(b.type)}
                  >
                    {b.label}
                  </Button>
                ))}
              </div>
            ) : (
              <div className={`${colCls} min-w-40 border-primary/40`}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                  Cột mới · {GRADE_TYPE_META[adding].label}
                </p>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.25"
                    min={0}
                    placeholder="Điểm"
                    aria-label="Điểm"
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    className="h-7 w-16 text-xs"
                  />
                  <Input
                    type="number"
                    min={1}
                    aria-label="Thang điểm"
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                    className="h-7 w-12 text-xs"
                  />
                </div>
                <Input
                  placeholder="Ghi chú (tuỳ chọn)"
                  value={title}
                  maxLength={24}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 h-7 text-xs"
                />
                <div className="mt-1 flex gap-1">
                  <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => add(adding)}>
                    Lưu
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setAdding(null)}
                  >
                    Hủy
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted p-3">
            <span className="text-sm font-semibold">
              {grade !== null ? (
                <>
                  Điểm môn kỳ {semester}: <span className="font-display text-lg">{grade}</span> ·{" "}
                  <span className={grade >= 5 ? "text-primary" : "text-destructive"}>
                    {gradeBand(grade)}
                  </span>
                </>
              ) : (
                <>Cần ít nhất 1 cột TX và 1 cột CK để tính điểm môn.</>
              )}
            </span>
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              Mục tiêu
              <Input
                type="number"
                step="0.5"
                min={1}
                max={10}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-label="Điểm mục tiêu"
                className="h-7 w-14 text-xs tabular-nums"
              />
            </span>
            {adviceLine && <p className="w-full text-sm text-foreground/90">{adviceLine}</p>}
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-sm font-semibold">
              📝 Điểm dư{" "}
              <span className="text-xs font-normal text-muted-foreground">
                — thầy/cô cho thêm, chưa chắc thuộc cột nào
              </span>
            </p>
            {extras.length === 0 ? (
              <p className="mb-2 text-xs text-muted-foreground">Chưa có điểm dư nào ở kỳ này.</p>
            ) : (
              <ul className="mb-2 space-y-1">
                {extras.map((x) => (
                  <li
                    key={x.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-2 py-1 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate" title={x.label}>
                      {x.label}
                    </span>
                    {x.score !== null && (
                      <span className="font-display tabular-nums">
                        {x.score}/{x.max}đ
                      </span>
                    )}
                    {x.score !== null && (
                      <span className="flex gap-1">
                        {TYPE_BUTTONS.map((b) => (
                          <Button
                            key={b.type}
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px]"
                            aria-label={`Nhập vào cột ${GRADE_TYPE_META[b.type].short}`}
                            title={`Nhập vào cột ${GRADE_TYPE_META[b.type].label}`}
                            onClick={() => absorb(x.id, b.type)}
                          >
                            {GRADE_TYPE_META[b.type].short}
                          </Button>
                        ))}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label="Xoá điểm dư"
                      className="text-xs text-muted-foreground transition hover:text-destructive"
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          gradeExtras: removeGradeExtra(d.gradeExtras, x.id),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Vì sao có điểm này? (vd: thầy cho làm thêm)"
                value={extraLabel}
                maxLength={60}
                onChange={(e) => setExtraLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExtra()}
                aria-label="Ghi chú điểm dư"
                className="min-w-[180px] flex-1"
              />
              <Input
                type="number"
                step="0.25"
                min={0}
                placeholder="Điểm (tuỳ chọn)"
                value={extraScore}
                onChange={(e) => setExtraScore(e.target.value)}
                aria-label="Điểm dư (tuỳ chọn)"
                className="w-28"
              />
              <Button size="sm" onClick={addExtra}>
                + Ghi
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
