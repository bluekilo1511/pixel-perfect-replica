import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { toast } from "sonner";
import { PetWidget } from "./PetWidget";
import { DailyQuestsCard, RaidBossCard } from "./QuestRaid";
import { addExam, dateStr, KIND_META, makeTask, removeExam, removeTemplate, saveTaskAsTemplate, syncTodaySlots, taskFromTemplate, WATER_GOAL, type Task, type TaskKind } from "@/lib/tracker/model";
import { daysUntil, examLabel, upcomingExams } from "@/lib/tracker/exams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function WaterCard() {
  const { data, drinkWater } = useTracker();
  const cups = data.game.water.cups;
  return (
    <section className="glass p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">💧 Uống nước</h2>
        <span className="text-sm text-muted-foreground">{cups}/{WATER_GOAL} ly</span>
      </div>
      <div className="my-4 grid grid-cols-8 gap-1.5">
        {Array.from({ length: WATER_GOAL }, (_, i) => (
          <div key={i} className={`h-10 rounded-lg border border-border transition-colors ${i < cups ? "bg-primary" : "bg-muted"}`} />
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

  const exam = task.examId ? data.exams.find((e) => e.id === task.examId) : undefined;
  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 transition ${running ? "bg-secondary glass-glow" : "bg-muted"} ${locked ? "opacity-60" : ""}`}>{exam && (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">📝 {exam.name} · {examLabel(daysUntil(exam.date, dateStr()))}</span>
    )}
      <span className="text-xl">{KIND_META[task.kind].emoji}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-medium ${locked ? "line-through" : ""}`}>{task.title}</p>
        <p className="text-xs text-muted-foreground">
          {task.timeRange && <span className="mr-1.5 rounded-full bg-time-badge px-2 py-0.5 font-semibold text-primary-foreground">🕒 {task.timeRange}</span>}
          {task.pinned ? "📌 Ghim hằng ngày · " : ""}
          {task.fromSlotId ? "🗓️ Từ thời khóa biểu · " : ""}
          {task.minutes > 0 ? `${task.minutes} phút` : "Không hẹn giờ"}
        </p>
      </div>
      {task.minutes > 0 && !locked && (
        <span className="font-display text-lg tabular-nums">{fmt(secs)}</span>
      )}
      <Button size="sm" variant={task.pinned ? "secondary" : "ghost"} aria-label={task.pinned ? "Bỏ ghim" : "Ghim"} title={task.pinned ? "Bỏ ghim" : "Ghim – tự lặp lại mỗi ngày"}
        className={task.pinned ? "" : "opacity-50 hover:opacity-100"}
        onClick={() => update((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === task.id ? { ...t, pinned: !t.pinned } : t)) }))}>📌</Button>
      {locked ? (
        <span className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-primary-foreground">✓ Đã hoàn thành</span>
      ) : (
        <div className="flex gap-2">
          {task.minutes > 0 && (
            running
              ? <Button size="sm" variant="secondary" onClick={pauseTimer}>⏸ Dừng</Button>
              : <Button size="sm" onClick={() => startTimer(task.id)}>▶ Bắt đầu</Button>
          )}
           {task.minutes === 0 && <Button size="sm" data-ocean onClick={() => finish(task.id)}>✓ Xong</Button>}
          {!task.pinned && !running && (
            <Button size="sm" variant="ghost" aria-label="Xóa" onClick={() => update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== task.id) }))}>✕</Button>
          )}
        </div>
      )}
    </li>
  );
}

function ExamCard() {
  const { data, update } = useTracker();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const today = dateStr();
  const upcoming = upcomingExams(data.exams, today);
  const add = () => {
    if (!name.trim() || !date) return;
    update((d) => addExam(d, name, date));
    setName("");
    setDate("");
  };
  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">📝 Kỳ thi sắp tới</h2>
        <span className="text-sm text-muted-foreground">{upcoming.length}</span>
      </div>
      {upcoming.length ? (
        <ul className="mb-3 space-y-2">
          {upcoming.map((e) => (
            <li key={e.id} className={`flex items-center gap-2 rounded-xl border border-border p-3 ${e.daysLeft <= 3 ? "bg-destructive/10" : "bg-muted"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.name}</p>
                <p className="text-xs text-muted-foreground">{e.date} · {examLabel(e.daysLeft)}</p>
              </div>
              <Button size="sm" variant="ghost" aria-label={`Xóa ${e.name}`} onClick={() => update((d) => removeExam(d, e.id))}>✕</Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-muted-foreground">Chưa có kỳ thi nào. Thêm để thấy đếm ngược nhé!</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Input className="min-w-[140px] flex-1" placeholder="Tên kỳ thi…" value={name} onChange={(e) => setName(e.target.value)} />
        <Input type="date" className="w-40" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Ngày thi" />
        <Button onClick={add}>+ Thêm</Button>
      </div>
    </section>
  );
}

function TemplatesCard() {
  const { data, update } = useTracker();
  if (!data.templates.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">⭐ Mẫu có sẵn:</span>
      {data.templates.map((tpl) => (
        <span key={tpl.id} className="flex items-center gap-1 rounded-full border border-border bg-muted py-1 pl-3 pr-1 text-sm">
          <span className="max-w-[160px] truncate">{KIND_META[tpl.kind].emoji} {tpl.title}{tpl.minutes > 0 ? ` · ${tpl.minutes}p` : ""}</span>
          <Button size="sm" variant="ghost" aria-label={`Thêm "${tpl.title}"`} title="Thêm nhiệm vụ từ mẫu này" className="h-6 px-2" onClick={() => {
            update((d) => taskFromTemplate(d, tpl.id, dateStr())?.data ?? d);
            toast.success(`Đã thêm "${tpl.title}" ✅`);
          }}>+</Button>
          <Button size="sm" variant="ghost" aria-label={`Xóa mẫu ${tpl.title}`} title="Xóa mẫu này" className="h-6 px-1 opacity-60 hover:opacity-100" onClick={() => update((d) => removeTemplate(d, tpl.id))}>✕</Button>
        </span>
      ))}
    </div>
  );
}

function AddTask() {
  const { data, update } = useTracker();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<TaskKind>("pomodoro");
  const [minutes, setMinutes] = useState(25);
  const [examId, setExamId] = useState<string>("");
  const add = () => {
    const name = title.trim() || KIND_META[kind].label;
    update((d) => ({ ...d, tasks: [...d.tasks, makeTask(name, kind, minutes, dateStr(), examId ? { examId } : {})] }));
    setTitle("");
  };
  return (
    <div className="flex flex-wrap gap-2">
      <Input className="min-w-[180px] flex-1" placeholder="Tên nhiệm vụ…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <select className="h-9 rounded-md border border-input bg-popover px-2 text-sm" value={kind}
        onChange={(e) => { const k = e.target.value as TaskKind; setKind(k); setMinutes(KIND_META[k].minutes || minutes); }}>
        {(Object.keys(KIND_META) as TaskKind[]).filter((k) => k !== "water").map((k) => <option key={k} value={k}>{KIND_META[k].emoji} {KIND_META[k].label}</option>)}
      </select>
      <Input type="number" min={0} className="w-20" value={minutes} onChange={(e) => setMinutes(Math.max(0, +e.target.value))} aria-label="Số phút" />
      {data.exams.length > 0 && (
        <select className="h-9 rounded-md border border-input bg-popover px-2 text-sm" value={examId} onChange={(e) => setExamId(e.target.value)} aria-label="Gắn kỳ thi">
          <option value="">Không gắn thi</option>
          {data.exams.map((e) => <option key={e.id} value={e.id}>📝 {e.name}</option>)}
        </select>
      )}
      <Button onClick={add}>+ Thêm</Button>
      <Button variant="ghost" aria-label="Lưu làm mẫu" title="Lưu cấu hình này làm mẫu để thêm nhanh lần sau" onClick={() => {
        const name = title.trim() || KIND_META[kind].label;
        update((d) => saveTaskAsTemplate(d, { title: name, kind, minutes }));
        toast.success(`Đã lưu mẫu "${name}" ⭐`);
      }}>⭐</Button>
    </div>
  );
}

export function TodayPanel() {
  const { data, update } = useTracker();
  const today = dateStr();
  const tasks = data.tasks.filter((t) => t.date === today).sort((a, b) => Number(a.completed) - Number(b.completed) || Number(!!b.pinned) - Number(!!a.pinned));
  const done = tasks.filter((t) => t.completed).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <WaterCard />
      <div className="space-y-5">
      <PetWidget />
      <section className="glass p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">✅ Nhiệm vụ cần làm hôm nay</h2>
          <span className="text-sm text-muted-foreground">{done}/{tasks.length}</span>
        </div>
        <Button variant="outline" className="mb-3 w-full" onClick={() => {
          if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission().catch(() => {});
          const r = syncTodaySlots(data);
          if (!r.added) { toast("Lịch hôm nay đã có đủ trong danh sách 👍"); return; }
          update((d) => syncTodaySlots(d).data);
          toast.success(`Đã nạp ${r.added} tiết học hôm nay 🗓️`, { description: "Sẽ nhắc bạn trước mỗi tiết 5 phút 🔔" });
        }}>⚡ Đồng bộ nhanh lịch hôm nay</Button>
        <AddTask />
        <TemplatesCard />
        <ul className="mt-4 space-y-2">
          {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
          {!tasks.length && <p className="py-6 text-center text-sm text-muted-foreground">Chưa có nhiệm vụ nào.</p>}
        </ul>
      </section>
      <ExamCard />
      <DailyQuestsCard />
      <RaidBossCard />
      </div>
    </div>
  );
}
