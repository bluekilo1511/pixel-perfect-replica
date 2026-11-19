import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SubjectComboManagerModal } from "./SubjectComboManagerModal";
import { Input } from "@/components/ui/input";
import {
  addSubject,
  dateStr,
  deleteSubjectCompletely,
  mergeSubjects,
  SUBJECTS_MAX,
} from "@/lib/tracker/model";
import {
  clearSubjectCombo,
  comboGrade,
  comboMembers,
  detectCap2Merges,
  detectSubDiscipline,
  matchCap2Config,
  mergeAllCap2,
} from "@/lib/tracker/combos";
import {
  absorbGradeExtra,
  addGradeEntry,
  addGradeExtra,
  convertExamScores,
  GRADE_TYPE_META,
  gradeAdvice,
  gradeTarget,
  gradeBand,
  gradeWhatIf,
  guessSemester,
  removeGradeEntry,
  removeGradeExtra,
  semesterEntries,
  setGradeTarget,
  subjectGrade,
  type GradeType,
  type Semester,
} from "@/lib/tracker/grades";

const TYPE_BUTTONS: { type: GradeType; label: string }[] = [
  { type: "tx", label: "+ TX" },
  { type: "gk", label: "+ Giữa kỳ" },
  { type: "ck", label: "+ Cuối kỳ" },
];

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
  const [extraLabel, setExtraLabel] = useState("");
  const [extraScore, setExtraScore] = useState("");
  const [simGk, setSimGk] = useState("");
  const [simCk, setSimCk] = useState("");
  const [comboManagerOpen, setComboManagerOpen] = useState(false);

  const entries = active ? semesterEntries(data.gradeBook, active, semester) : [];
  const tx = entries.filter((e) => e.type === "tx");
  const gk = entries.filter((e) => e.type === "gk");
  const ck = entries.filter((e) => e.type === "ck");
  const extras = active
    ? data.gradeExtras.filter((e) => e.subject === active && e.semester === semester)
    : [];
  const directGrade = active ? subjectGrade(data.gradeBook, active, semester) : null;
  const comboMembersList = active ? comboMembers(data, active) : undefined;
  const comboAvg = comboMembersList ? comboGrade(data.gradeBook, comboMembersList, semester) : null;
  const grade = directGrade !== null ? directGrade : comboAvg;
  const targetNum = active ? gradeTarget(data.gradeTargets, active) : 8;
  const advice = active ? gradeAdvice(data.gradeBook, active, semester, targetNum) : null;
  const legacyCount = data.examScores.length;
  const whatIf = active
    ? gradeWhatIf(data.gradeBook, active, semester, {
        gk: simGk.trim() === "" ? undefined : Number(simGk),
        ck: simCk.trim() === "" ? undefined : Number(simCk),
      })
    : null;

  const cap2Config = matchCap2Config(active);
  const cap2Merges = detectCap2Merges(data, chips);

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

  const columnBox = (e: (typeof entries)[number], idx: number) => {
    const subDiscipline = cap2Config ? detectSubDiscipline(cap2Config, e.title) : null;
    return (
      <div
        key={e.id}
        className={`${colCls} group relative min-w-16`}
        title={`${e.title || GRADE_TYPE_META[e.type].short}${e.date ? ` · ${e.date}` : ""}: ${e.score}/${e.max}`}
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
          <span>
            {GRADE_TYPE_META[e.type].short}
            {e.type === "tx" ? idx + 1 : ""}
          </span>
          {subDiscipline && (
            <span className="rounded bg-primary/15 px-1 py-0.2 text-[9px] font-semibold text-primary">
              {subDiscipline.badge}
            </span>
          )}
          {e.title && !subDiscipline && (
            <span className="truncate max-w-[50px]">· {e.title}</span>
          )}
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
  };

  const adviceLine = (() => {
    if (!active) return null;
    if (advice) {
      if (advice.done)
        return `Mục tiêu ${active} ${targetNum}: cột ${GRADE_TYPE_META[advice.column].short} chỉ cần bất kỳ điểm nào — mục tiêu đã chắc ✅`;
      if (advice.impossible)
        return `Mục tiêu ${active} ${targetNum}: ngay cả khi ${GRADE_TYPE_META[advice.column].short} đạt 10 cũng không đủ 😥 — cân nhắc mục tiêu thấp hơn`;
      return `Mục tiêu ${active} ${targetNum}: ${GRADE_TYPE_META[advice.column].short} cần ≥ ${advice.need} để môn đạt mục tiêu 🎯`;
    }
    if (grade !== null) return `Tất cả cột đã có điểm — điểm môn hiện tại là ${grade}.`;
    return null;
  })();

  const DUPLICATE_PAIRS: [string, string][] = [
    ["N.Văn", "Ngữ Văn"],
    ["N.văn", "Ngữ Văn"],
    ["Văn", "Ngữ Văn"],
    ["Sử", "Lịch sử"],
    ["Địa", "Địa lý"],
    ["GDCD", "Giáo dục công dân"],
  ];
  const detectedDups = DUPLICATE_PAIRS.filter(
    ([shortName, fullName]) =>
      chips.some((c) => c.toLowerCase() === shortName.toLowerCase()) &&
      chips.some((c) => c.toLowerCase() === fullName.toLowerCase()) &&
      shortName.toLowerCase() !== fullName.toLowerCase(),
  );

  return (
    <section className="glass p-5" aria-label="Sổ điểm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">🧮 Sổ điểm</h2>
        <div className="flex items-center gap-1" role="group" aria-label="Học kỳ">
          <Button
            size="sm"
            variant="outline"
            className="mr-1 h-8 text-xs"
            onClick={() => setComboManagerOpen(true)}
          >
            🧩 Môn tổ hợp
          </Button>
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
        Cột điểm như sổ của giáo viên: Thường xuyên (TX) · Giữa kỳ (GK) · Cuối kỳ (CK).
        Điểm môn = trung bình các cột, làm tròn 0.1. Điểm dư ghi bên phải, chỉ nhét vào cột khi
        chắc.
      </p>

      {cap2Merges.length > 0 && (
        <div className="mb-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3 text-xs text-sky-900 dark:text-sky-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <p className="font-semibold flex items-center gap-1.5 text-sm">
                <span>🏫</span> Cấu trúc môn Cấp 2 (THCS — Thông tư 22)
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Phát hiện phân môn lẻ:{" "}
                {cap2Merges.map((m) => (
                  <span key={m.targetSubject} className="font-semibold text-foreground">
                    [{m.orphanSubjects.join(", ")} → {m.targetSubject}]{" "}
                  </span>
                ))}
                . Ở Cấp 2, <strong>KHTN</strong> và <strong>LS&ĐL</strong> là môn tích hợp có 4 cột TX cho các phân môn gộp chung trong 1 môn duy nhất.
              </p>
            </div>
            <Button
              size="sm"
              className="h-8 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
              onClick={() => {
                update((d) => mergeAllCap2(d, chips));
                const firstTarget = cap2Merges[0]?.targetSubject;
                if (firstTarget) setSel(firstTarget);
                toast.success("Đã gộp toàn bộ điểm vào 4 cột môn tích hợp Cấp 2 và dọn dẹp các môn con! 🎉");
              }}
            >
              ⚡ Gộp chuẩn Cấp 2 & dọn môn lẻ
            </Button>
          </div>
        </div>
      )}

      {detectedDups.map(([shortName, fullName]) => {
        const actualShort =
          chips.find((c) => c.toLowerCase() === shortName.toLowerCase()) || shortName;
        const actualFull =
          chips.find((c) => c.toLowerCase() === fullName.toLowerCase()) || fullName;
        return (
          <div
            key={`${actualShort}-${actualFull}`}
            className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200"
          >
            <div className="flex items-center gap-2">
              <span>💡</span>
              <span>
                Phát hiện 2 tên của cùng một môn: <strong>{actualShort}</strong> và{" "}
                <strong>{actualFull}</strong>.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/50 bg-background hover:bg-amber-500/20"
              onClick={() => {
                update((d) => mergeSubjects(d, actualShort, actualFull));
                setSel(actualFull);
                toast.success(`Đã gộp "${actualShort}" vào "${actualFull}" 📚`);
              }}
            >
              Gộp {actualShort} vào {actualFull}
            </Button>
          </div>
        );
      })}

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
          const isCap2 = matchCap2Config(c) !== null;
          const members = comboMembers(data, c);
          const directG = subjectGrade(data.gradeBook, c, semester);
          const g =
            directG !== null
              ? directG
              : members
                ? comboGrade(data.gradeBook, members, semester)
                : null;
          return (
            <button key={c} type="button" onClick={() => setSel(c)} className={chipCls(c)}>
              {isCap2 ? (
                <span title="Môn tích hợp Cấp 2">🧬</span>
              ) : members ? (
                <span title="Môn tổ hợp">🧩</span>
              ) : null}
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

      {cap2Config ? (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🧬</span>
              <div>
                <p className="text-sm font-semibold">
                  Môn tích hợp Cấp 2: {active}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Thông tư 22: Môn có 4 cột ĐĐG Thường xuyên (gộp {cap2Config.subDisciplines.map((s) => s.name).join(", ")}), 1 Giữa kỳ và 1 Cuối kỳ.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
              {tx.length}/4 cột TX · {gk.length}/1 GK · {ck.length}/1 CK
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground font-medium">Phân môn đã có điểm:</span>
            {cap2Config.subDisciplines.map((sub) => {
              const count = tx.filter((e) => detectSubDiscipline(cap2Config, e.title)?.short === sub.short).length;
              return (
                <span
                  key={sub.short}
                  className={`rounded-md px-2 py-0.5 text-xs flex items-center gap-1 border transition ${
                    count > 0
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-medium"
                      : "border-border bg-card text-muted-foreground opacity-80"
                  }`}
                >
                  {sub.badge}: {count > 0 ? `${count} cột` : "chưa có"}
                </span>
              );
            })}
          </div>
        </div>
      ) : (() => {
        const members = active ? comboMembers(data, active) : undefined;
        if (!members) return null;
        const avg = comboGrade(data.gradeBook, members, semester);
        const hasDirectMarks = tx.length + gk.length + ck.length > 0;
        return (
          <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                🧩 {active} đang được gán phân môn: {members.join(", ")}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs font-medium"
                onClick={() => {
                  update((d) => clearSubjectCombo(d, active));
                  toast.success(`Đã gỡ tổ hợp. ${active} nay được tính là 1 môn độc lập!`);
                }}
              >
                Gỡ tổ hợp (Tính là 1 môn riêng)
              </Button>
            </div>
            {hasDirectMarks ? (
              <p className="text-xs text-primary font-medium">
                ✓ Đang tính theo điểm kiểm tra riêng của môn {active}.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>
                  Điểm trung bình các phân môn:{" "}
                  <strong className="text-foreground tabular-nums">
                    {avg !== null ? avg : "—"}
                  </strong>
                </span>
                <span>· Hoặc nhập điểm TX/GK/CK bên dưới để tính trực tiếp cho {active}.</span>
              </div>
            )}
          </div>
        );
      })()}

      {!active ? (
        <div className="space-y-3 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            Chưa có môn nào. Thêm môn ở phần 📚 Môn học (tab Hôm nay) hoặc gõ vào ô "+ môn mới" phía
            trên nhé!
          </p>
          <Button size="sm" variant="outline" onClick={() => setComboManagerOpen(true)}>
            🧩 Cài đặt môn tích hợp Cấp 2 / môn tổ hợp
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-stretch gap-2">
            {tx.map((e, i) => columnBox(e, i))}
            {gk.map((e) => columnBox(e, 0))}
            {ck.map((e) => columnBox(e, 0))}
            {adding === null ? (
              cap2Config ? (
                <div className="flex flex-col gap-1 rounded-xl border border-border/50 bg-muted/40 p-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
                    Thêm cột ({active}):
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {cap2Config.subDisciplines.map((sub) => (
                      <Button
                        key={sub.short}
                        size="sm"
                        variant="outline"
                        className="h-6 justify-start px-2 text-[11px] font-medium border-border/60 hover:border-primary/50"
                        onClick={() => {
                          setAdding("tx");
                          setTitle(sub.name);
                        }}
                      >
                        + TX {sub.short}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-1 pt-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 flex-1 px-1 text-xs"
                      onClick={() => setAdding("gk")}
                    >
                      + Giữa kỳ
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 flex-1 px-1 text-xs"
                      onClick={() => setAdding("ck")}
                    >
                      + Cuối kỳ
                    </Button>
                  </div>
                </div>
              ) : (
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
              )
            ) : (
              <div className="rounded-xl border border-primary/50 bg-card p-3 shadow-md w-64 space-y-2">
                <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    + Cột mới: {GRADE_TYPE_META[adding].label}
                  </p>
                  <span className="text-[11px] text-muted-foreground">Thang 10</span>
                </div>
                <div>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.25"
                      min={0}
                      max={10}
                      placeholder="Nhập điểm (0 - 10)"
                      aria-label="Điểm số"
                      value={score}
                      onChange={(e) => setScore(e.target.value)}
                      className="h-8 text-sm pr-12 font-medium"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && add(adding)}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none font-medium">
                      / 10
                    </span>
                  </div>
                </div>
                <Input
                  placeholder="Ghi chú (tuỳ chọn, vd: KT 15p, Miệng)"
                  value={title}
                  maxLength={30}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-7 text-xs"
                  onKeyDown={(e) => e.key === "Enter" && add(adding)}
                />

                {cap2Config && adding === "tx" && (
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    <p className="text-[11px] text-muted-foreground font-medium">Gắn phân môn:</p>
                    <div className="flex flex-wrap gap-1">
                      {cap2Config.subDisciplines.map((sub) => (
                        <button
                          key={sub.short}
                          type="button"
                          className={`rounded-full px-2 py-0.5 text-xs border transition ${
                            title.includes(sub.short) || title.includes(sub.name)
                              ? "border-primary bg-primary text-primary-foreground font-semibold"
                              : "border-border bg-muted/60 text-foreground hover:bg-muted"
                          }`}
                          onClick={() => {
                            setTitle(sub.name);
                          }}
                        >
                          {sub.badge}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-1.5 pt-1">
                  <Button
                    size="sm"
                    className="h-7 flex-1 text-xs font-semibold"
                    onClick={() => add(adding)}
                  >
                    Lưu điểm
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setAdding(null);
                      setScore("");
                      setTitle("");
                    }}
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
            <div className="ml-auto flex items-center gap-2">
              {active && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Bạn có chắc muốn xoá môn "${active}" và toàn bộ điểm số của môn này không?`,
                      )
                    ) {
                      update((d) => deleteSubjectCompletely(d, active));
                      setSel("");
                      toast.success(`Đã xoá môn ${active} khỏi sổ điểm 🗑️`);
                    }
                  }}
                  title={`Xoá môn ${active} và toàn bộ điểm`}
                >
                  🗑️ Xoá môn
                </Button>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Mục tiêu {active && <span className="text-foreground/80">{active}</span>}
                <Input
                  type="number"
                  step="0.5"
                  min={1}
                  max={10}
                  value={active ? String(gradeTarget(data.gradeTargets, active)) : ""}
                  onChange={(e) =>
                    active &&
                    update((d) => ({
                      ...d,
                      gradeTargets: setGradeTarget(d.gradeTargets, active, Number(e.target.value)),
                    }))
                  }
                  aria-label={`Điểm mục tiêu ${active}`}
                  className="h-7 w-14 text-xs tabular-nums"
                />
              </span>
            </div>
            {adviceLine && <p className="w-full text-sm text-foreground/90">{adviceLine}</p>}
          </div>

          <div className="mb-4 rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-sm font-semibold">
              🔮 Nếu mà…{" "}
              <span className="text-xs font-normal text-muted-foreground">
                — nhập điểm GK/CK dự kiến để xem môn này sẽ rơi vào khoảng nào
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1">
                GK dự kiến
                <Input
                  type="number"
                  step="0.25"
                  min={0}
                  max={10}
                  value={simGk}
                  placeholder="—"
                  aria-label="Điểm giữa kỳ giả định"
                  className="h-7 w-16 text-xs tabular-nums"
                  onChange={(e) => setSimGk(e.target.value)}
                />
              </label>
              <label className="flex items-center gap-1">
                CK dự kiến
                <Input
                  type="number"
                  step="0.25"
                  min={0}
                  max={10}
                  value={simCk}
                  placeholder="—"
                  aria-label="Điểm cuối kỳ giả định"
                  className="h-7 w-16 text-xs tabular-nums"
                  onChange={(e) => setSimCk(e.target.value)}
                />
              </label>
              {active && whatIf && (
                <span className="text-sm">
                  {whatIf.projected !== null ? (
                    <>
                      → <span className="font-display text-base">{whatIf.projected}</span>
                      {whatIf.projected >= targetNum
                        ? " 🎯 đạt mục tiêu"
                        : ` (còn ${Math.round((targetNum - whatIf.projected) * 10) / 10} nữa tới mục tiêu ${targetNum})`}
                    </>
                  ) : (
                    <>
                      {whatIf.missing.includes("tx")
                        ? "Cần ít nhất 1 cột TX và 1 CK để dự đoán."
                        : "Nhập CK dự kiến để dự đoán."}
                    </>
                  )}
                </span>
              )}
            </div>
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
      <SubjectComboManagerModal open={comboManagerOpen} onOpenChange={setComboManagerOpen} />
    </section>
  );
}
