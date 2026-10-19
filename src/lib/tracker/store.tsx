import type React from "react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  addMaterial, addWaterCup, applyAchievements, applyPrize, claimAchievementReward, completePomodoroSession, completeTask, dateStr, defaultData, ensureDailyPins, migrate, pushDueSlots,
  WHEEL_PRIZES, upcomingSlots, type AppData,
} from "./model";
import { decayPet } from "./gamify";
import { ACHIEVEMENT_REWARD, ACHIEVEMENTS, MATERIALS, petTitle, resolveExpedition, rollDrop, TIER_BADGE, tierOf, type AchievementId, type MaterialId } from "./extras";
import { bossCounterAttack, defeatBoss } from "./boss";
import { bumpPet, POMODORO_REWARD } from "./gamify";
import { celebrate, levelUpFx, ting } from "./effects";
import { CAPSULE_INTERVAL_MS, lastSnapshotAt, saveSnapshot } from "./timeCapsule";
import { createFile, createWriter, downloadData, openFile } from "./storage";

export type SaveStatus = "none" | "saving" | "saved" | "dirty" | "error";

interface Timer { taskId: string; endAt: number; remaining: number }

interface Store {
  data: AppData;
  ready: boolean;
  fileName: string | null;
  status: SaveStatus;
  lastSaved: Date | null;
  timer: Timer | null;
  levelUp: number | null;
  update: (fn: (d: AppData) => AppData) => void;
  open: () => Promise<void>;
  create: () => Promise<void>;
  startOffline: () => void;
  download: () => void;
  startTimer: (id: string) => void;
  pauseTimer: () => void;
  finish: (id: string) => void;
  drinkWater: () => void;
  spin: () => string | null;
  dismissLevelUp: () => void;
  restore: (raw: unknown) => void;
  finishPomodoro: (boss: boolean, minutes: number) => void;
  bossCancel: () => void;
  claimAchievement: (id: AchievementId) => boolean;
}

function announceAchievements(fresh: AchievementId[]) {
  fresh.forEach((id) => {
    const a = ACHIEVEMENTS[id];
    toast(`🏆 Đã mở khóa chòm sao ${a.emoji} ${a.name}`, { description: a.desc, className: "glass-toast", duration: 6000 });
  });
  if (fresh.length) levelUpFx();
}
function announceDrop(drop: MaterialId | null) {
  if (drop) toast(`🎁 Rơi nguyên liệu: ${MATERIALS[drop].emoji} ${MATERIALS[drop].name}`, { className: "glass-toast" });
}

// Keep one context instance across hot reloads so provider and consumers always match.
const g = globalThis as { __trackerCtx?: React.Context<Store | null> };
const Ctx = (g.__trackerCtx ??= createContext<Store | null>(null));
export const useTracker = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTracker outside provider");
  return c;
};

export function TrackerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [ready, setReady] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("none");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [timer, setTimer] = useState<Timer | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const writer = useRef<ReturnType<typeof createWriter> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const firstSave = useRef(true);
  const reminded = useRef(new Set<string>());

  // Auto-save after every change.
  useEffect(() => {
    if (!ready) return;
    if (firstSave.current) { firstSave.current = false; }
    if (!writer.current) { setStatus("dirty"); return; }
    setStatus("saving");
    writer.current(data).then(
      () => { setStatus("saved"); setLastSaved(new Date()); },
      () => setStatus("error"),
    );
  }, [data, ready]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  const onLevels = (n: number, level: number) => {
    if (n > 0) { setLevelUp(level); levelUpFx(); }
  };

  const boot = (raw: unknown, name: string | null, handle: unknown) => {
    writer.current = handle ? createWriter(handle) : null;
    setFileName(name);
    setData(pushDueSlots(ensureDailyPins(migrate(raw))).data);
    setReady(true);
  };

  const open = async () => {
    try {
      const r = await openFile();
      if (!r) return;
      let raw: unknown = null;
      try { raw = r.text.trim() ? JSON.parse(r.text) : null; } catch { toast.error("File không phải JSON hợp lệ, tạo dữ liệu mới."); }
      boot(raw, r.name, r.handle);
      toast.success(`Đã mở "${r.name}"`);
    } catch (e: any) { if (e?.name !== "AbortError") toast.error("Không mở được file"); }
  };
  const create = async () => {
    try {
      const h = await createFile();
      if (!h) { boot(null, null, null); return; }
      boot(null, h.name, h);
    } catch (e: any) { if (e?.name !== "AbortError") toast.error("Không tạo được file"); }
  };
  const startOffline = () => boot(null, null, null);
  const download = () => { downloadData(dataRef.current, fileName ?? undefined); setStatus("saved"); setLastSaved(new Date()); };

  const finish = useCallback((id: string) => {
    const r = completeTask(dataRef.current, id);
    if (!r.rewarded) return; // anti-spam
    setData(r.data);
    void saveSnapshot(r.data);
    setTimer((t) => (t?.taskId === id ? null : t));
    celebrate();
    toast.success("Hoàn thành! +XP, +1 😺, +1 🎡");
    onLevels(r.levelsGained, r.data.game.level);
    announceDrop(r.drop);
    announceAchievements(r.fresh);
    if (r.petEvolved) {
      levelUpFx();
      toast.success(`${TIER_BADGE[tierOf(r.data.petState.petLevel)]} Thú cưng tiến hóa thành ${petTitle(r.data.petState)}!`, { className: "glass-toast", duration: 6000 });
    } else if (r.petLevels > 0) toast(`🐾 Thú cưng lên cấp ${r.data.petState.petLevel}!`);
  }, []);

  // Timer tick based on wall clock → reaches 00:00 reliably even if tab was throttled.
  useEffect(() => {
    if (!timer) return;
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
      if (remaining <= 0) { clearInterval(iv); finish(timer.taskId); return; }
      setTimer((t) => (t ? { ...t, remaining } : t));
    }, 250);
    return () => clearInterval(iv);
  }, [timer?.taskId, timer?.endAt, finish]);

  const pauseTimer = () => {
    if (!timer) return;
    const remaining = Math.max(1, Math.ceil((timer.endAt - Date.now()) / 1000));
    setData((d) => ({ ...d, tasks: d.tasks.map((t) => (t.id === timer.taskId ? { ...t, remainingSeconds: remaining } : t)) }));
    setTimer(null);
  };

  const startTimer = (id: string) => {
    const task = dataRef.current.tasks.find((t) => t.id === id);
    if (!task || task.completed || task.rewardClaimed || task.minutes <= 0) return;
    if (timer) pauseTimer();
    const secs = task.remainingSeconds > 0 ? task.remainingSeconds : task.minutes * 60;
    setTimer({ taskId: id, endAt: Date.now() + secs * 1000, remaining: secs });
  };

  // Day rollover + timetable trigger every 20s.
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      const d0 = ensureDailyPins(dataRef.current, dateStr());
      const { data: dp, pushed } = pushDueSlots(d0);
      const pet = decayPet(dp.petState);
      let d1 = pet === dp.petState ? dp : { ...dp, petState: pet };
      if (d0.streak !== dataRef.current.streak && d0.streak.lastQualifiedDate !== dataRef.current.streak.lastQualifiedDate) {
        toast("🧊 Bình đóng băng đã cứu chuỗi streak của bạn!");
      }
      // Smart Reminder: 5 minutes before each class.
      const now = new Date();
      upcomingSlots(d1, now).forEach((s) => {
        const key = `${dateStr(now)}:${s.id}`;
        if (reminded.current.has(key)) return;
        reminded.current.add(key);
        ting();
        toast(`🔔 5 phút nữa: ${s.title}`, { description: `${s.start} - ${s.end}` });
        try {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`🔔 5 phút nữa: ${s.title}`, { body: `${s.start} - ${s.end}` });
          }
        } catch { /* ignore */ }
      });
      const expedition = resolveExpedition(d1.expedition, now);
      if (expedition) {
        let next = { ...d1, expedition: expedition.expedition };
        expedition.drops.forEach((drop) => { next = addMaterial(next, drop); });
        d1 = next;
        ting();
        toast.success(`🧭 ${petTitle(d1.petState)} đã trở về từ chuyến thám hiểm!`);
        expedition.drops.forEach(announceDrop);
      }
      const ach = applyAchievements(d1, {});
      announceAchievements(ach.fresh);
      if (ach.data !== dataRef.current) setData(ach.data);
      pushed.forEach((s) => { toast(`⏰ Đến giờ: ${s.title}`, { description: "Đã thêm vào việc hôm nay" }); });
      if (pushed.length) ting();
    };
    check();
    const iv = setInterval(check, 20000);
    return () => clearInterval(iv);
  }, [ready]);

  // Time Capsule: silent snapshot every 12h.
  useEffect(() => {
    if (!ready) return;
    const tick = async () => {
      if (Date.now() - (await lastSnapshotAt()) >= CAPSULE_INTERVAL_MS) void saveSnapshot(dataRef.current);
    };
    void tick();
    const iv = setInterval(tick, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [ready]);

  const restore = (raw: unknown) => {
    setData(ensureDailyPins(migrate(raw)));
    setReady(true);
  };

  const finishPomodoro = (boss: boolean, minutes: number) => {
    const cur = dataRef.current;
    const game = boss ? defeatBoss(cur.game) : { ...cur.game, catCoins: cur.game.catCoins + POMODORO_REWARD };
    const r = completePomodoroSession({ ...cur, game, petState: bumpPet(cur.petState, 0, 10) }, minutes);
    setData(r.data);
    announceAchievements(r.fresh);
  };
  const bossCancel = () => setData((d) => ({ ...d, petState: bossCounterAttack(d.petState) }));
  const claimAchievement = (id: AchievementId) => {
    const next = claimAchievementReward(dataRef.current, id);
    if (!next) return false;
    setData(next);
    ting();
    toast.success(`🏆 Đã nhận thưởng +${ACHIEVEMENT_REWARD} 🦎`);
    return true;
  };

  const drinkWater = () => {
    const r = addWaterCup(dataRef.current);
    if (r.data === dataRef.current) return;
    setData(r.data);
    if (r.goalReached) { celebrate(); toast.success("Đủ 8 ly nước hôm nay! 🎉"); }
    announceAchievements(r.fresh);
    onLevels(r.levelsGained, r.data.game.level);
  };

  const spin = () => {
    const d = dataRef.current;
    if (d.game.spinTickets <= 0) return null;
    const prize = WHEEL_PRIZES[Math.floor(Math.random() * WHEEL_PRIZES.length)] ?? WHEEL_PRIZES[0]!;
    setData((cur) => ({ ...cur, game: { ...cur.game, spinTickets: cur.game.spinTickets - 1 } }));
    // apply prize after the wheel animation
    setTimeout(() => {
      const cur = dataRef.current;
      const r = applyPrize(cur.game, prize);
      const game = { ...r.game, spinHistory: [{ at: new Date().toISOString(), prize }, ...cur.game.spinHistory].slice(0, 20) };
      const drop = rollDrop();
      setData(addMaterial({ ...cur, game }, drop));
      announceDrop(drop);
      ting();
      toast.success(`🎡 Bạn nhận được ${prize}`);
      onLevels(r.levelsGained, game.level);
    }, 2600);
    return prize;
  };

  return (
    <Ctx.Provider value={{
      data, ready, fileName, status, lastSaved, timer, levelUp, update, open, create, startOffline, download,
      startTimer, pauseTimer, finish, drinkWater, spin, dismissLevelUp: () => setLevelUp(null), restore, finishPomodoro, bossCancel, claimAchievement,
    }}>
      {children}
    </Ctx.Provider>
  );
}
