import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { PetWidget } from "./PetWidget";
import { SpecialDaysCard } from "./SpecialDaysCard";
import { NextSlotCard } from "./NextSlotCard";
import { TomorrowPrepCard } from "./TomorrowPrepCard";
import { ExtraScheduleCard } from "./ExtraScheduleCard";
import { NotesCard } from "./NotesCard";
import { WeeklyGoalCard } from "./WeeklyGoalCard";
import { SubjectsCard } from "./SubjectsCard";
import { DailyQuestsCard, RaidBossCard } from "./QuestRaid";
import {
  addExam,
  dateStr,
  editTask,
  setTaskSubject,
  KIND_META,
  SUBJECTS_MAX,
  makeTask,
  removeExam,
  removeTemplate,
  updateTemplate,
  saveTaskAsTemplate,
  setTaskMood,
  syncTodaySlots,
  taskFromTemplate,
  updateExam,
  WATER_GOAL,
  type Task,
  type TaskKind,
} from "@/lib/tracker/model";
import {
  daysUntil,
  examLabel,
  formatDateVN,
  upcomingExams,
  type ExamEvent,
} from "@/lib/tracker/exams";
import {
  addExamPrepTasks,
  EXAM_PREP_PER_DAY,
  EXAM_PREP_WINDOW,
  nextPrepSuggestion,
  slotSubject,
} from "@/lib/tracker/tkb";
import { shiftDate } from "@/lib/tracker/gamify";
import {
  addWeekGoal,
  currentWeekGoals,
  pinTaskAsWeekGoal,
  removeWeekGoal,
  toggleWeekGoalDone,
} from "@/lib/tracker/goals";
import { weeklyGoalProgress } from "@/lib/tracker/weeklyGoal";
import { mondayOf } from "@/lib/tracker/weeklyReport";
import { weakTopics } from "@/lib/tracker/subjectNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputVN } from "./DateInputVN";
import { requestTimerFullscreen } from "./TimerFullscreen";

const fmt = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const MOODS = [
  { v: 1, emoji: "😄", label: "Đã hăng!" },
  { v: 2, emoji: "🙂", label: "Ổn áp" },
  { v: 3, emoji: "😐", label: "Hơi mệt" },
  { v: 4, emoji: "😪", label: "Kiệt sức" },
] as const;

const TODAY_SECTIONS = [
  { key: "today", label: "🎯 Hôm nay" },
  { key: "schedule", label: "📅 Lịch & thi" },
  { key: "goals", label: "📚 Mục tiêu & môn" },
] as const;

type TodaySectionKey = (typeof TODAY_SECTIONS)[number]["key"];

function readTodaySection(): TodaySectionKey {
  try {
    const v = localStorage.getItem("ppr.todaySection");
    if (v === "schedule" || v === "goals") return v;
  } catch {
    /* storage unavailable */
  }
  return "today";
}

function WaterCard() {
  const { data, drinkWater } = useTracker();
  const cups = data.game.water.cups;
  return (
    <section className="glass p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">💧 Uống nước</h2>
        <span className="text-sm text-muted-foreground">
          {cups}/{WATER_GOAL} ly
        </span>
      </div>
      <div className="my-4 grid grid-cols-8 gap-1 sm:gap-1.5">
        {Array.from({ length: WATER_GOAL }, (_, i) => (
          <div
            key={i}
            className={`h-8 rounded-lg border border-border transition-colors sm:h-10 ${i < cups ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <Button className="w-full" onClick={drinkWater} disabled={cups >= WATER_GOAL}>
        {cups >= WATER_GOAL ? "Đã đủ hôm nay 🎉" : "+1 Ly"}
      </Button>
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const { data, timer, startTimer, pauseTimer, finish, update } = useTracker();
  const running = timer?.taskId === task.id;
  const secs = running ? timer.remaining : task.remainingSeconds || task.minutes * 60;
  const locked = task.completed || task.rewardClaimed;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: task.title,
    kind: task.kind,
    minutes: task.minutes,
    date: task.date,
    subject: task.subject ?? "",
    remindAt: task.remindAt ?? "",
  });
  const openEditor = () => {
    setDraft({
      title: task.title,
      kind: task.kind,
      minutes: task.minutes,
      date: task.date,
      subject: task.subject ?? "",
      remindAt: task.remindAt ?? "",
    });
    setEditing(true);
  };
  const saveEdit = () => {
    if (running) pauseTimer();
    update((d) => {
      const edited = editTask(d, task.id, { ...draft, remindAt: draft.remindAt || null }) ?? d;
      return setTaskSubject(edited, task.id, draft.subject || null) ?? edited;
    });
    setEditing(false);
    toast.success("Đã cập nhật nhiệm vụ ✏️");
  };

  const exam = task.examId ? data.exams.find((e) => e.id === task.examId) : undefined;
  if (editing) {
    return (
      <li className="rounded-xl border border-primary/40 bg-muted p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-[160px] flex-1"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            aria-label="Tên nhiệm vụ"
          />
          <select
            className="h-9 rounded-md border border-input bg-popover px-2 text-sm"
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as TaskKind })}
            aria-label="Loại nhiệm vụ"
          >
            {(Object.keys(KIND_META) as TaskKind[])
              .filter((k) => k !== "water")
              .map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].emoji} {KIND_META[k].label}
                </option>
              ))}
          </select>
          <Input
            type="number"
            min={0}
            className="w-20"
            value={draft.minutes}
            onChange={(e) => setDraft({ ...draft, minutes: Math.max(0, +e.target.value) })}
            aria-label="Số phút"
          />
          <DateInputVN
            className="w-36"
            value={draft.date}
            onChange={(iso) => setDraft({ ...draft, date: iso })}
            ariaLabel="Ngày"
          />
          <Input
            type="time"
            className="w-28"
            value={draft.remindAt}
            onChange={(e) => setDraft({ ...draft, remindAt: e.target.value })}
            aria-label="Giờ nhắc"
            title="Giờ nhắc hôm nay (tuỳ chọn)"
          />
          <select
            className="h-9 rounded-md border border-input bg-popover px-2 text-sm"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            aria-label="Môn học"
          >
            <option value="">— môn? —</option>
            {data.subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={saveEdit}>
            💾 Lưu
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Hủy
          </Button>
        </div>
      </li>
    );
  }
  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 transition ${running ? "bg-secondary glass-glow" : "bg-muted"} ${locked ? "opacity-60" : ""}`}
    >
      {exam && (
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          📝 {exam.name} · {formatDateVN(exam.date)} · {examLabel(daysUntil(exam.date, dateStr()))}
        </span>
      )}
      {task.subject && (
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          📚 {task.subject}
        </span>
      )}
      <span className="text-xl">{task.emoji ?? KIND_META[task.kind].emoji}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${locked ? "line-through" : ""}`}>{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {task.timeRange && (
            <span className="mr-1.5 rounded-full bg-time-badge px-2 py-0.5 font-semibold text-primary-foreground">
              🕒 {task.timeRange}
            </span>
          )}
          {task.remindAt && (
            <span className="mr-1.5 rounded-full bg-secondary px-2 py-0.5 font-semibold">
              ⏰ {task.remindAt}
            </span>
          )}
          {task.pinned ? "📌 Ghim hằng ngày · " : ""}
          {task.fromSlotId ? "🗓️ Từ thời khóa biểu · " : ""}
          {task.minutes > 0 ? `${task.minutes} phút` : "Không hẹn giờ"}
        </p>
      </div>
      {task.minutes > 0 && !locked && (
        <span className="font-display text-lg tabular-nums">{fmt(secs)}</span>
      )}
      <Button
        size="sm"
        variant={task.pinned ? "secondary" : "ghost"}
        aria-label={task.pinned ? "Bỏ ghim" : "Ghim"}
        title={task.pinned ? "Bỏ ghim" : "Ghim – tự lặp lại mỗi ngày"}
        className={task.pinned ? "" : "opacity-50 hover:opacity-100"}
        onClick={() =>
          update((d) => ({
            ...d,
            tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, pinned: !t.pinned } : t)),
          }))
        }
      >
        📌
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label="Ghim làm mục tiêu tuần"
        title="Ghim làm mục tiêu cho cả tuần — hiện trong bảng Mục tiêu tuần"
        className="opacity-50 hover:opacity-100"
        onClick={() => {
          const r = pinTaskAsWeekGoal(data, task.id);
          if (!r) {
            toast.error("Mục tiêu tuần đã đầy hoặc nhiệm vụ này đã được ghim rồi 🎯");
            return;
          }
          update(() => r);
          toast.success("Đã ghim làm mục tiêu cả tuần 🎯");
        }}
      >
        🎯
      </Button>
      {locked ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-primary-foreground">
            ✓ Đã hoàn thành
          </span>
          {task.minutes > 0 && (
            <span
              className="flex items-center gap-0.5"
              role="group"
              aria-label="Cảm xúc sau khi hoàn thành"
            >
              {MOODS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  title={m.label}
                  aria-label={m.label}
                  aria-pressed={task.mood === m.v}
                  onClick={() => update((d) => setTaskMood(d, task.id, m.v))}
                  className={`rounded-full px-1 text-base transition ${task.mood === m.v ? "bg-secondary" : "opacity-40 hover:opacity-100"}`}
                >
                  {m.emoji}
                </button>
              ))}
            </span>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Sửa nhiệm vụ"
            title="Sửa tên, thời lượng hoặc ngày"
            onClick={openEditor}
          >
            ✎
          </Button>
          {task.minutes > 0 &&
            (running ? (
              <>
                <Button size="sm" variant="secondary" onClick={pauseTimer} title="Tạm dừng đồng hồ">
                  ⏸ Dừng
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Phóng to toàn màn hình"
                  title="Ghim đồng hồ lên toàn màn hình — vòng tiến độ + pet canh chừng"
                  onClick={requestTimerFullscreen}
                >
                  ⛶
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => startTimer(task.id)}>
                ▶ Bắt đầu
              </Button>
            ))}
          {task.minutes === 0 && (
            <Button size="sm" data-ocean onClick={() => finish(task.id)}>
              ✓ Xong
            </Button>
          )}
          {!task.pinned && !running && (
            <Button
              size="sm"
              variant="ghost"
              aria-label="Xóa"
              onClick={() =>
                update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }))
              }
            >
              ✕
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

type ExamDraft = {
  name: string;
  date: string;
  mon: string;
  buoi: string;
  gioBatDau: string;
  thoiGian: string;
  khoi: string;
};

const emptyExamDraft = (): ExamDraft => ({
  name: "",
  date: "",
  mon: "",
  buoi: "",
  gioBatDau: "",
  thoiGian: "",
  khoi: "",
});

const examDraftOf = (e: ExamEvent): ExamDraft => ({
  name: e.name,
  date: e.date,
  mon: e.mon ?? "",
  buoi: e.buoi ?? "",
  gioBatDau: e.gioBatDau ?? "",
  thoiGian: e.thoiGian ?? "",
  khoi: e.khoi ?? "",
});

function ExamForm({
  draft,
  setDraft,
  subjects,
}: {
  draft: ExamDraft;
  setDraft: (d: ExamDraft) => void;
  subjects: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        className="min-w-[160px] flex-1"
        placeholder="Môn thi / tên kỳ thi… (VD: Ngữ văn Tin)"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        aria-label="Môn thi"
      />
      <DateInputVN
        className="w-36"
        value={draft.date}
        onChange={(iso) => setDraft({ ...draft, date: iso })}
        ariaLabel="Ngày thi (dd/mm/yyyy)"
      />
      <select
        className="h-9 rounded-md border border-input bg-popover px-2 text-sm"
        value={draft.mon}
        onChange={(e) => setDraft({ ...draft, mon: e.target.value })}
        aria-label="Gắn môn học"
        title="Gắn kỳ thi với một môn học (tùy chọn) — việc ôn sẽ mang đúng môn"
      >
        <option value="">— gắn môn? —</option>
        {subjects.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border border-input bg-popover px-2 text-sm"
        value={draft.buoi}
        onChange={(e) => setDraft({ ...draft, buoi: e.target.value })}
        aria-label="Buổi thi"
      >
        <option value="">— buổi? —</option>
        <option value="Sáng">Sáng</option>
        <option value="Chiều">Chiều</option>
      </select>
      <Input
        type="time"
        className="w-28"
        value={draft.gioBatDau}
        onChange={(e) => setDraft({ ...draft, gioBatDau: e.target.value })}
        aria-label="Giờ vào thi"
        title="Giờ vào thi (tuỳ chọn)"
      />
      <Input
        className="w-28"
        placeholder="90 phút"
        value={draft.thoiGian}
        onChange={(e) => setDraft({ ...draft, thoiGian: e.target.value })}
        aria-label="Thời gian làm bài"
        title="Thời gian làm bài (tuỳ chọn)"
      />
      <Input
        className="w-24"
        placeholder="Khối 8, 9"
        value={draft.khoi}
        onChange={(e) => setDraft({ ...draft, khoi: e.target.value })}
        aria-label="Khối"
        title="Khối (tuỳ chọn)"
      />
    </div>
  );
}

function ExamDetail({ e }: { e: ExamEvent }) {
  const bits = [
    e.mon ? `🔗 ${e.mon}` : "",
    e.buoi,
    e.gioBatDau,
    e.thoiGian,
    e.khoi ? `Khối ${e.khoi}` : "",
  ].filter(Boolean) as string[];
  if (!bits.length) return null;
  return <p className="text-xs text-muted-foreground">{bits.join(" · ")}</p>;
}

function ExamCard() {
  const { data, update } = useTracker();
  const [draft, setDraft] = useState<ExamDraft>(emptyExamDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ExamDraft>(emptyExamDraft);
  const today = dateStr();
  const upcoming = upcomingExams(data.exams, today);
  const past = data.exams
    .filter((e) => daysUntil(e.date, today) < 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const add = () => {
    if (!draft.name.trim() || !draft.date) {
      toast.error("Cần tên môn thi và ngày thi (dd/mm/yyyy).");
      return;
    }
    update((d) =>
      addExam(d, draft.name, draft.date, {
        mon: draft.mon,
        buoi: draft.buoi,
        gioBatDau: draft.gioBatDau,
        thoiGian: draft.thoiGian,
        khoi: draft.khoi,
      }),
    );
    setDraft(emptyExamDraft());
  };
  const saveEdit = (id: string) => {
    if (!editDraft.name.trim() || !editDraft.date) {
      toast.error("Cần tên môn thi và ngày thi (dd/mm/yyyy).");
      return;
    }
    update((d) =>
      updateExam(d, id, {
        name: editDraft.name,
        date: editDraft.date,
        mon: editDraft.mon,
        buoi: editDraft.buoi,
        gioBatDau: editDraft.gioBatDau,
        thoiGian: editDraft.thoiGian,
        khoi: editDraft.khoi,
      }),
    );
    setEditingId(null);
    toast.success("Đã sửa kỳ thi ✏️");
  };
  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📝 Kỳ thi sắp tới</h2>
        <span className="text-sm text-muted-foreground">{upcoming.length}</span>
      </div>
      {upcoming.length ? (
        <ul className="mb-3 space-y-2">
          {upcoming.map((e) =>
            editingId === e.id ? (
              <li key={e.id} className="rounded-xl border border-primary/50 bg-muted p-3">
                <ExamForm draft={editDraft} setDraft={setEditDraft} subjects={data.subjects} />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(e.id)}>
                    💾 Lưu
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Hủy
                  </Button>
                </div>
              </li>
            ) : (
              <li
                key={e.id}
                className={`flex flex-wrap items-center gap-2 rounded-xl border border-border p-3 ${e.daysLeft <= 3 ? "bg-destructive/10" : "bg-muted"}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateVN(e.date)} · {examLabel(e.daysLeft)}
                  </p>
                  <ExamDetail e={e} />
                  {e.daysLeft <= EXAM_PREP_WINDOW && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 h-7 text-xs"
                      title="Tạo 2 pomodoro ôn thi hôm nay (chỉ 1 lần/ngày/kỳ thi)"
                      onClick={() => {
                        const r = addExamPrepTasks(data, e, today);
                        if (!r.added) {
                          toast("Đã có kế hoạch ôn cho kỳ thi này hôm nay 👍");
                          return;
                        }
                        update((d) => addExamPrepTasks(d, e, today).data);
                        toast.success(`Đã tạo ${r.added} việc ôn thi hôm nay 🌙`, {
                          description: `Gợi ý: ôn ${EXAM_PREP_PER_DAY} pomodoro/ngày đến ngày thi.`,
                        });
                      }}
                    >
                      💡 Tạo {EXAM_PREP_PER_DAY} việc ôn hôm nay
                    </Button>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Sửa ${e.name}`}
                  onClick={() => {
                    setEditingId(e.id);
                    setEditDraft(examDraftOf(e));
                  }}
                >
                  ✏️
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Xóa ${e.name}`}
                  onClick={() => update((d) => removeExam(d, e.id))}
                >
                  ✕
                </Button>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">
          Chưa có kỳ thi nào. Thêm để thấy đếm ngược nhé!
        </p>
      )}
      {past.length > 0 && (
        <details className="mb-3 rounded-xl border border-border bg-muted/40 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Đã qua / sai ngày ({past.length}) — xóa nếu lỡ nhập nhầm
          </summary>
          <ul className="mt-2 space-y-1">
            {past.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs">
                <span className="min-w-0 flex-1 truncate">
                  {e.name} · {formatDateVN(e.date)} · {e.buoi ? `${e.buoi} ` : ""}
                  {e.gioBatDau ?? ""}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  aria-label={`Xóa ${e.name}`}
                  onClick={() => update((d) => removeExam(d, e.id))}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="space-y-2">
        <ExamForm draft={draft} setDraft={setDraft} subjects={data.subjects} />
        <Button onClick={add}>+ Thêm kỳ thi</Button>
      </div>
    </section>
  );
}

function TemplatesCard() {
  const { data, update } = useTracker();
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", minutes: 0, emoji: "" });
  if (!data.templates.length) return null;
  const startEdit = (id: string) => {
    const tpl = data.templates.find((t) => t.id === id);
    if (!tpl) return;
    setDraft({ title: tpl.title, minutes: tpl.minutes, emoji: tpl.emoji ?? "" });
    setEditId(id);
  };
  const saveEdit = () => {
    if (!editId) return;
    update((d) => updateTemplate(d, editId, { ...draft, emoji: draft.emoji || null }));
    setEditId(null);
    toast.success("Đã lưu mẫu ⭐");
  };
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">⭐ Mẫu có sẵn:</span>
        {data.templates.map((tpl) =>
          editId === tpl.id ? (
            <span
              key={tpl.id}
              className="flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/40 bg-muted p-2 text-sm"
            >
              <Input
                className="h-8 w-16 text-center"
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                aria-label="Biểu tượng của mẫu"
                placeholder="📚"
                maxLength={8}
              />
              <Input
                className="h-8 w-36"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                aria-label="Tên mẫu"
              />
              <Input
                type="number"
                min={0}
                className="h-8 w-20"
                value={draft.minutes}
                onChange={(e) => setDraft({ ...draft, minutes: Math.max(0, +e.target.value) })}
                aria-label="Số phút"
              />
              <Button size="sm" className="h-8" onClick={saveEdit}>
                💾
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditId(null)}>
                Hủy
              </Button>
            </span>
          ) : (
            <span
              key={tpl.id}
              className="flex items-center gap-1 rounded-full border border-border bg-muted py-1 pl-3 pr-1 text-sm"
            >
              <span className="max-w-[160px] truncate">
                {tpl.emoji ?? KIND_META[tpl.kind].emoji} {tpl.title}
                {tpl.minutes > 0 ? ` · ${tpl.minutes}p` : ""}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Thêm "${tpl.title}"`}
                title="Thêm nhiệm vụ từ mẫu này"
                className="h-6 px-2"
                onClick={() => {
                  update((d) => taskFromTemplate(d, tpl.id, dateStr())?.data ?? d);
                  toast.success(`Đã thêm "${tpl.title}" ✅`);
                }}
              >
                +
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Sửa mẫu ${tpl.title}`}
                title="Sửa biểu tượng, tên, số phút của mẫu"
                className="h-6 px-1 opacity-60 hover:opacity-100"
                onClick={() => startEdit(tpl.id)}
              >
                ✎
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Xóa mẫu ${tpl.title}`}
                title="Xóa mẫu này"
                className="h-6 px-1 opacity-60 hover:opacity-100"
                onClick={() => update((d) => removeTemplate(d, tpl.id))}
              >
                ✕
              </Button>
            </span>
          ),
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Mẫu cũng xuất hiện trong mục chọn "loại nhiệm vụ" khi thêm việc — bấm ✎ để đổi biểu tượng,
        tên hoặc số phút.
      </p>
    </div>
  );
}

function PrepSuggestionBar() {
  const { data, update, startTimer } = useTracker();
  const pick = nextPrepSuggestion(data, new Date());
  if (!pick) return null;
  const start = () => {
    const today = dateStr();
    const tomorrow = shiftDate(today, 1);
    const subject = slotSubject(data, pick.slot);
    const t = makeTask(
      `Ôn: ${pick.slot.title} (mai ${pick.slot.start})`,
      "pomodoro",
      pick.minutes,
      today,
      {
        prepSlotId: pick.slot.id,
        prepForDate: tomorrow,
        ...(subject ? { subject } : {}),
      },
    );
    update((d) => ({ ...d, tasks: [...d.tasks, t] }));
    startTimer(t.id);
    toast(`🍅 Bắt đầu ôn ${pick.slot.title} cho mai`);
  };
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <span className="text-lg">💡</span>
      <span className="min-w-0 flex-1 truncate">
        Mai có tiết <b>{pick.slot.title}</b> ({pick.slot.start}) — {pick.minutes} phút ôn ngay?
      </span>
      <Button size="sm" onClick={start}>
        ▶ Ôn luôn
      </Button>
    </div>
  );
}

function AddTask() {
  const { data, update } = useTracker();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("pomodoro");
  const [minutes, setMinutes] = useState(25);
  const [examId, setExamId] = useState<string>("");
  const [remind, setRemind] = useState("");
  // Emoji picked from a saved template; cleared whenever the user switches back to a plain kind.
  const [tplEmoji, setTplEmoji] = useState<string | null>(null);
  // What the select itself shows (a kind or "tpl:<id>") so a template choice doesn't snap back.
  const [sel, setSel] = useState<string>("pomodoro");
  const pickValue = (value: string) => {
    setSel(value);
    if (value.startsWith("tpl:")) {
      const tpl = data.templates.find((t) => t.id === value.slice(4));
      if (!tpl) return;
      setKind(tpl.kind);
      setMinutes(tpl.minutes);
      setTitle(tpl.title);
      setTplEmoji(tpl.emoji ?? null);
      return;
    }
    const k = value as TaskKind;
    setKind(k);
    setMinutes(KIND_META[k].minutes || minutes);
    setTplEmoji(null);
  };
  const add = () => {
    const name = title.trim() || KIND_META[kind].label;
    update((d) => {
      const tagMatch = name.match(/#([^\s#]{1,24})(?=\s|$)/);
      const cleanName =
        (tagMatch ? name.replace(tagMatch[0], " ").replace(/\s+/g, " ").trim() : name) ||
        KIND_META[kind].label;
      let subject: string | null = null;
      let subjects = d.subjects;
      if (tagMatch) {
        const tag = tagMatch[1]!;
        const found = d.subjects.find((x) => x.toLowerCase() === tag.toLowerCase());
        if (found) subject = found;
        else if (d.subjects.length < SUBJECTS_MAX) {
          subject = tag;
          subjects = [...d.subjects, tag];
        }
      } else {
        subject = d.subjects.find((x) => cleanName.toLowerCase().includes(x.toLowerCase())) ?? null;
      }
      return {
        ...d,
        subjects,
        tasks: [
          ...d.tasks,
          makeTask(cleanName, kind, minutes, dateStr(), {
            ...(examId ? { examId } : {}),
            ...(subject ? { subject } : {}),
            ...(remind ? { remindAt: remind } : {}),
            ...(tplEmoji ? { emoji: tplEmoji } : {}),
          }),
        ],
      };
    });
    setTitle("");
    setRemind("");
    setTplEmoji(null);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Input
        className="min-w-[180px] flex-1"
        data-task-input="true"
        placeholder="Tên nhiệm vụ…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()}
      />
      <select
        className="h-9 min-w-[170px] rounded-md border border-input bg-popover px-2 text-sm"
        value={sel}
        onChange={(e) => pickValue(e.target.value)}
        aria-label="Loại nhiệm vụ"
        title="Loại có sẵn hoặc mẫu bạn đã lưu"
      >
        <optgroup label="Loại có sẵn">
          {(Object.keys(KIND_META) as TaskKind[])
            .filter((k) => k !== "water")
            .map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].emoji} {KIND_META[k].label}
              </option>
            ))}
        </optgroup>
        {data.templates.length > 0 && (
          <optgroup label="⭐ Mẫu của bạn">
            {data.templates.map((tpl) => (
              <option key={tpl.id} value={`tpl:${tpl.id}`}>
                {tpl.emoji ?? KIND_META[tpl.kind].emoji} {tpl.title}
                {tpl.minutes > 0 ? ` · ${tpl.minutes}p` : ""}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <Input
        type="number"
        min={0}
        className="w-20"
        value={minutes}
        onChange={(e) => setMinutes(Math.max(0, +e.target.value))}
        aria-label="Số phút"
      />
      {data.exams.length > 0 && (
        <select
          className="h-9 rounded-md border border-input bg-popover px-2 text-sm"
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          aria-label="Gắn kỳ thi"
        >
          <option value="">Không gắn thi</option>
          {data.exams.map((e) => (
            <option key={e.id} value={e.id}>
              📝 {e.name}
            </option>
          ))}
        </select>
      )}
      <Input
        type="time"
        className="w-28"
        value={remind}
        onChange={(e) => setRemind(e.target.value)}
        aria-label="Giờ nhắc (tuỳ chọn)"
        title="Tới giờ này hôm nay web sẽ nhắc (tuỳ chọn)"
      />
      <Button onClick={add}>+ Thêm</Button>
      <Button
        variant="ghost"
        aria-label="Lưu làm mẫu"
        title="Lưu cấu hình này làm mẫu để thêm nhanh lần sau"
        onClick={() => {
          const name = title.trim() || KIND_META[kind].label;
          update((d) => saveTaskAsTemplate(d, { title: name, kind, minutes }));
          toast.success(`Đã lưu mẫu "${name}" ⭐`);
        }}
      >
        ⭐
      </Button>
    </div>
  );
}

function WeekGoalsCard() {
  const { data, update } = useTracker();
  const goals = currentWeekGoals(data);
  const done = goals.filter((g) => g.doneAt).length;
  const [draft, setDraft] = useState("");
  const add = () => {
    const r = addWeekGoal(data, draft);
    if (!r) {
      toast.error("Trùng mục tiêu hoặc đã đủ 6 mục tiêu cho tuần này 🎯");
      return;
    }
    update(() => r);
    setDraft("");
    toast.success("Đã thêm mục tiêu tuần 🎯");
  };
  return (
    <section className="glass p-5" aria-label="Mục tiêu tuần (từ việc cần làm)">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">🎯 Mục tiêu ghim cả tuần</h2>
        <span className="text-xs text-muted-foreground">
          {done}/{goals.length}
        </span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Ghim từ nút 🎯 trên mỗi việc, hoặc thêm trực tiếp ở đây. Đánh dấu khi hoàn thành trong tuần.
      </p>
      {goals.length > 0 && (
        <ul className="mb-2 space-y-1">
          {goals.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5">
              <button
                type="button"
                aria-label={g.doneAt ? "Bỏ đánh dấu" : "Đánh dấu hoàn thành"}
                aria-pressed={!!g.doneAt}
                onClick={() => update((d) => toggleWeekGoalDone(d, g.id))}
                className={`text-sm ${g.doneAt ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                {g.doneAt ? "☑" : "☐"}
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-xs ${g.doneAt ? "line-through opacity-60" : ""}`}
              >
                {g.title}
              </span>
              <button
                type="button"
                aria-label={`Xoá mục tiêu ${g.title}`}
                className="text-muted-foreground transition hover:text-destructive"
                onClick={() => update((d) => removeWeekGoal(d, g.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          className="h-8"
          placeholder="Mục tiêu cả tuần, vd: Hoàn thành 10 đề Toán"
          value={draft}
          maxLength={120}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          aria-label="Mục tiêu tuần mới"
        />
        <Button size="sm" variant="outline" className="h-8" onClick={add}>
          +
        </Button>
      </div>
    </section>
  );
}

function WeekReviewCard() {
  const { data } = useTracker();
  const goals = currentWeekGoals(data);
  const goalsDone = goals.filter((g) => g.doneAt).length;
  const start = mondayOf(new Date());
  const shift = (date: string, n: number) => {
    const [y, m, d] = date.split("-").map(Number) as [number, number, number];
    const dt = new Date(y, m - 1, d + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  };
  const weekDates = new Set(Array.from({ length: 7 }, (_, i) => shift(start, i)));
  const tasksThisWeek = data.tasks.filter((t) => weekDates.has(t.date));
  const tasksDone = tasksThisWeek.filter((t) => t.completed).length;
  const focus = weeklyGoalProgress(data);
  const weak = weakTopics(data);
  const notes = data.subjectNotes;
  return (
    <section className="glass p-5" aria-label="Bảng đánh giá tuần">
      <h2 className="mb-2 text-sm font-semibold">📋 Bảng đánh giá tuần</h2>
      <ul className="space-y-1.5 text-xs">
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">Mục tiêu tuần</span>
          <span className="font-medium">
            {goalsDone}/{goals.length} đạt{" "}
            {goals.length > 0 && goalsDone === goals.length ? "🎉" : ""}
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">Việc cần làm trong tuần</span>
          <span className="font-medium">
            {tasksDone}/{tasksThisWeek.length} hoàn thành
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">Phút tập trung</span>
          <span className="font-medium">
            {focus.done}
            {focus.target > 0 ? `/${focus.target}` : ""} phút
          </span>
        </li>
        <li className="flex justify-between gap-2">
          <span className="text-muted-foreground">Chủ điểm cần ôn</span>
          <span className="font-medium">{weak.length} chủ điểm</span>
        </li>
      </ul>
      {weak.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Nên ưu tiên:{" "}
          {weak
            .slice(0, 3)
            .map((w) => `${w.subject} · ${w.topic}`)
            .join(", ")}
        </p>
      )}
      {Object.keys(notes).length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Đánh dấu chủ điểm yếu/tốt trong card 📚 Môn học để bảng này có dữ liệu.
        </p>
      )}
    </section>
  );
}

export function TodayPanel() {
  const { data, update } = useTracker();
  const today = dateStr();
  const tasks = data.tasks
    .filter((t) => t.date === today)
    .sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) || Number(!!b.pinned) - Number(!!a.pinned),
    );
  const done = tasks.filter((t) => t.completed).length;
  const [section, setSection] = useState<TodaySectionKey>(readTodaySection);
  const pickSection = (key: TodaySectionKey) => {
    setSection(key);
    try {
      localStorage.setItem("ppr.todaySection", key);
    } catch {
      /* storage unavailable */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Hôm nay các nhóm">
        {TODAY_SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={section === s.key}
            onClick={() => pickSection(s.key)}
            className={
              section === s.key
                ? "shrink-0 rounded-full px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow"
                : "shrink-0 rounded-full px-4 py-2 text-sm font-medium bg-secondary/60 text-foreground/75 hover:bg-secondary hover:text-foreground"
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "today" && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5">
            <WaterCard />
            <NotesCard />
          </div>
          <div className="space-y-5">
            <PetWidget />
            <section className="glass p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">✅ Nhiệm vụ cần làm hôm nay</h2>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                    title="Thêm nhanh từ bất kỳ đâu"
                  >
                    ⌨️ Ctrl+K
                  </span>
                  {done}/{tasks.length}
                </span>
              </div>
              <Button
                variant="outline"
                className="mb-3 w-full"
                onClick={() => {
                  if (typeof Notification !== "undefined" && Notification.permission === "default")
                    Notification.requestPermission().catch(() => {});
                  const r = syncTodaySlots(data);
                  if (!r.added) {
                    toast("Lịch hôm nay đã có đủ trong danh sách 👍");
                    return;
                  }
                  update((d) => syncTodaySlots(d).data);
                  toast.success(`Đã nạp ${r.added} mục lịch riêng hôm nay 🗓️`, {
                    description: "Sẽ nhắc bạn trước mỗi mục 5 phút 🔔",
                  });
                }}
              >
                ⚡ Đồng bộ nhanh lịch riêng hôm nay
              </Button>
              <PrepSuggestionBar />
              <AddTask />
              <TemplatesCard />
              {(() => {
                const open = tasks.filter((t) => !t.completed);
                const completed = tasks.filter((t) => t.completed);
                return (
                  <>
                    <ul className="mt-4 space-y-2">
                      {open.map((t) => (
                        <TaskRow key={t.id} task={t} />
                      ))}
                      {!tasks.length && (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Chưa có nhiệm vụ nào.
                        </p>
                      )}
                    </ul>
                    {completed.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                          ✓ Đã hoàn thành ({completed.length})
                        </p>
                        <ul className="space-y-2">
                          {completed.map((t) => (
                            <TaskRow key={t.id} task={t} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </section>
            <DailyQuestsCard />
            <RaidBossCard />
          </div>
        </div>
      )}

      {section === "schedule" && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5">
            <NextSlotCard />
            <TomorrowPrepCard />
            <ExtraScheduleCard />
          </div>
          <div className="space-y-5">
            <ExamCard />
            <SpecialDaysCard />
          </div>
        </div>
      )}

      {section === "goals" && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5">
            <SubjectsCard />
            <WeeklyGoalCard />
          </div>
          <div className="space-y-5">
            <WeekGoalsCard />
            <WeekReviewCard />
          </div>
        </div>
      )}
    </div>
  );
}
