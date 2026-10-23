import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  addMaterial,
  addWaterCup,
  applyAchievements,
  claimAchievementReward,
  completePomodoroSession,
  completeTask,
  dateStr,
  defaultData,
  claimDailySalary,
  ensureDailyPins,
  migrate,
  pushDueSlots,
  recordSpin,
  beginSpin,
  canSpin,
  JACKPOT_PRIZE,
  JACKPOT_TICKETS,
  upcomingSlots,
  type AppData,
  type SpinMode,
} from "./model";
import { applyAdminBoost, type AdminBoostKind } from "./model";
import { decayPet } from "./gamify";
import {
  ACHIEVEMENT_REWARD,
  ACHIEVEMENTS,
  MATERIALS,
  petEmoji,
  petTitle,
  resolveExpedition,
  rollDrop,
  TIER_BADGE,
  tierOf,
  weatherEffect,
  weatherFromData,
  type AchievementId,
  type MaterialId,
} from "./extras";
import {
  claimQuest as claimQuestRule,
  claimRaid as claimRaidRule,
  markWaterNudged,
  shouldNudgeWater,
} from "./model";
import { pushDueExtras } from "./tkb";
import { bossCounterAttack, defeatBoss } from "./boss";
import { bumpPet, POMODORO_REWARD } from "./gamify";
import { celebrate, evolutionFx, levelUpFx, setFxEnabled, setChime, ting } from "./effects";
import { CAPSULE_INTERVAL_MS, lastSnapshotAt, saveSnapshot } from "./timeCapsule";
import { createFile, createWriter, downloadData, openFile, type Handle } from "./storage";

/** True only when the user cancelled the file picker. */
const isAbort = (e: unknown): boolean =>
  e instanceof Error
    ? e.name === "AbortError"
    : e !== null && typeof e === "object" && (e as { name?: unknown }).name === "AbortError";

export type SaveStatus = "none" | "saving" | "saved" | "dirty" | "error";

interface Timer {
  taskId: string;
  endAt: number;
  remaining: number;
}

interface Store {
  data: AppData;
  ready: boolean;
  fileName: string | null;
  status: SaveStatus;
  lastSaved: Date | null;
  timer: Timer | null;
  levelUp: number | null;
  evolution: { from: string; to: string; title: string } | null;
  update: (fn: (d: AppData) => AppData) => void;
  open: () => Promise<void>;
  create: () => Promise<void>;
  startOffline: () => void;
  startAdmin: () => void;
  adminBoost: (kind: AdminBoostKind, amount: number) => void;
  download: () => void;
  startTimer: (id: string) => void;
  pauseTimer: () => void;
  finish: (id: string) => void;
  drinkWater: () => void;
  spin: (mode?: SpinMode) => string | null;
  dismissLevelUp: () => void;
  dismissEvolution: () => void;
  restore: (raw: unknown) => void;
  finishPomodoro: (boss: boolean, minutes: number, kind?: "pomodoro" | "warmup") => void;
  bossCancel: () => void;
  claimAchievement: (id: AchievementId) => boolean;
  dismissBackupReminder: () => void;
  claimQuest: (id: string) => boolean;
  claimRaid: () => boolean;
}

function announceAchievements(fresh: AchievementId[]) {
  fresh.forEach((id) => {
    const a = ACHIEVEMENTS[id];
    toast(`🏆 Đã mở khóa chòm sao ${a.emoji} ${a.name}`, {
      description: a.desc,
      className: "glass-toast",
      duration: 6000,
    });
  });
  if (fresh.length) levelUpFx();
}
function announceDrop(drop: MaterialId | null) {
  if (drop)
    toast(`🎁 Rơi nguyên liệu: ${MATERIALS[drop].emoji} ${MATERIALS[drop].name}`, {
      className: "glass-toast",
    });
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
  const [evolution, setEvolution] = useState<{ from: string; to: string; title: string } | null>(
    null,
  );
  const writer = useRef<ReturnType<typeof createWriter> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const firstSave = useRef(true);
  const reminded = useRef(new Set<string>());

  // Auto-save after every change.
  useEffect(() => {
    if (!ready) return;
    if (firstSave.current) {
      firstSave.current = false;
    }
    if (!writer.current) {
      setStatus("dirty");
      return;
    }
    setStatus("saving");
    writer.current(data).then(
      () => {
        setStatus("saved");
        setLastSaved(new Date());
      },
      () => setStatus("error"),
    );
  }, [data, ready]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  // Keep the effect-sound switch in sync with the saved setting.
  useEffect(() => {
    setFxEnabled(data.settings.fxSound);
    setChime(data.settings.chime);
  }, [data.settings.fxSound, data.settings.chime]);

  const onLevels = (n: number, level: number) => {
    if (n > 0) {
      setLevelUp(level);
      levelUpFx();
    }
  };

  const boot = (raw: unknown, name: string | null, handle: Handle | null) => {
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
      try {
        raw = r.text.trim() ? JSON.parse(r.text) : null;
      } catch {
        toast.error("File không phải JSON hợp lệ, tạo dữ liệu mới.");
      }
      boot(raw, r.name, r.handle);
      toast.success(`Đã mở "${r.name}"`);
    } catch (e: unknown) {
      if (!isAbort(e)) toast.error("Không mở được file");
    }
  };
  const create = async () => {
    try {
      const h = await createFile();
      if (!h) {
        boot(null, null, null);
        return;
      }
      boot(null, h.name, h);
    } catch (e: unknown) {
      if (!isAbort(e)) toast.error("Không tạo được file");
    }
  };
  const startOffline = () => boot(null, null, null);
  const startAdmin = () => {
    boot(null, null, null);
    setData((d) => ({ ...d, settings: { ...d.settings, admin: true } }));
  };
  const adminBoost = (kind: AdminBoostKind, amount: number) =>
    setData((d) => applyAdminBoost(d, kind, amount));
  const download = () => {
    if (dataRef.current.settings.admin) {
      toast.error("Chế độ test (Admin) đang bật — tắt trong Cài đặt để tải backup.");
      return;
    }
    const now = new Date();
    setData((d) => ({ ...d, backup: { ...d.backup, lastBackupAt: now.toISOString() } }));
    downloadData(dataRef.current, fileName ?? undefined);
    setStatus("saved");
    setLastSaved(now);
  };
  const dismissBackupReminder = () =>
    setData((d) => ({ ...d, backup: { ...d.backup, lastReminderAt: new Date().toISOString() } }));

  const claimQuest = (id: string) => {
    const r = claimQuestRule(dataRef.current, id);
    if (!r.ok) return false;
    setData(r.data);
    ting();
    toast.success("🎯 Hoàn thành nhiệm vụ ngày! Đã nhận thưởng.");
    return true;
  };
  const claimRaid = () => {
    const r = claimRaidRule(dataRef.current);
    if (!r.ok) return false;
    setData(r.data);
    celebrate();
    toast.success("⚔️ Hạ Boss tuần! +10 😺 +3 🦎");
    return true;
  };

  const finish = useCallback((id: string) => {
    const prev = dataRef.current;
    const xpMult = weatherEffect(weatherFromData(prev)).xpMult;
    const prevFormEmoji = petEmoji(dataRef.current.petState);
    const r = completeTask(dataRef.current, id, new Date(), Math.random, xpMult);
    if (!r.rewarded) return; // anti-spam
    setData(r.data);
    void saveSnapshot(r.data);
    setTimer((t) => (t?.taskId === id ? null : t));
    celebrate();
    toast.success("Hoàn thành! +XP, +1 😺, +1 🎡", {
      action: {
        label: "Hoàn tác",
        onClick: () => {
          setData(prev);
          void saveSnapshot(prev);
        },
      },
    });
    onLevels(r.levelsGained, r.data.game.level);
    announceDrop(r.drop);
    announceAchievements(r.fresh);
    if (r.petEvolved) {
      levelUpFx();
      evolutionFx();
      setEvolution({
        from: prevFormEmoji,
        to: petEmoji(r.data.petState),
        title: petTitle(r.data.petState),
      });
      toast.success(
        `${TIER_BADGE[tierOf(r.data.petState.petLevel)]} Thú cưng tiến hóa thành ${petTitle(r.data.petState)}!`,
        { className: "glass-toast", duration: 6000 },
      );
    } else if (r.petLevels > 0) toast(`🐾 Thú cưng lên cấp ${r.data.petState.petLevel}!`);
  }, []);

  // Timer tick based on wall clock → reaches 00:00 reliably even if tab was throttled.
  useEffect(() => {
    if (!timer) return;
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(iv);
        finish(timer.taskId);
        return;
      }
      setTimer((t) => (t ? { ...t, remaining } : t));
    }, 250);
    return () => clearInterval(iv);
    // The interval only reads taskId/endAt/finish; the per-tick `remaining` state
    // update must not restart the interval, so `timer` is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer?.taskId, timer?.endAt, finish]);

  const pauseTimer = () => {
    if (!timer) return;
    const remaining = Math.max(1, Math.ceil((timer.endAt - Date.now()) / 1000));
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) =>
        t.id === timer.taskId ? { ...t, remainingSeconds: remaining } : t,
      ),
    }));
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
      const sal = claimDailySalary(d0, dateStr());
      if (sal.coins > 0) {
        ting();
        toast.success(`💰 Lương ngày mới: +${sal.coins} 😺 (Lv ${sal.data.game.level})`);
      }
      const { data: dp, pushed } = pushDueSlots(sal.data); // chain salary result so lastSalaryDate persists
      const pet = decayPet(
        dp.petState,
        new Date(),
        weatherEffect(weatherFromData(dp)).petDecayMult,
      );
      let d1 = pet === dp.petState ? dp : { ...dp, petState: pet };
      if (
        d0.streak !== dataRef.current.streak &&
        d0.streak.lastQualifiedDate !== dataRef.current.streak.lastQualifiedDate
      ) {
        toast("🧊 Bình đóng băng đã cứu chuỗi streak của bạn!");
      }
      // One-off reminders due today land in the task list once each.
      const now = new Date();
      const ex = pushDueExtras(d1, now);
      if (ex.data !== d1) d1 = ex.data;
      if (ex.pushed.length) {
        toast("📌 Nhắc việc hôm nay", {
          description: ex.pushed.map((x) => x.title).join(", "),
        });
      }
      // Smart Reminder: 5 minutes before each class.
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
        } catch {
          /* ignore */
        }
      });
      const expedition = resolveExpedition(d1.expedition, now);
      if (expedition) {
        let next = { ...d1, expedition: expedition.expedition };
        expedition.drops.forEach((drop) => {
          next = addMaterial(next, drop);
        });
        d1 = next;
        ting();
        toast.success(`🧭 ${petTitle(d1.petState)} đã trở về từ chuyến thám hiểm!`);
        expedition.drops.forEach(announceDrop);
      }
      const ach = applyAchievements(d1, {});
      announceAchievements(ach.fresh);
      if (ach.data !== dataRef.current) setData(ach.data);
      pushed.forEach((s) => {
        toast(`⏰ Đến giờ: ${s.title}`, { description: "Đã thêm vào việc hôm nay" });
      });
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
      if (Date.now() - (await lastSnapshotAt()) >= CAPSULE_INTERVAL_MS)
        void saveSnapshot(dataRef.current);
    };
    void tick();
    const iv = setInterval(tick, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [ready]);

  const restore = (raw: unknown) => {
    setData(ensureDailyPins(migrate(raw)));
    setReady(true);
  };

  const finishPomodoro = (boss: boolean, minutes: number, kind?: "pomodoro" | "warmup") => {
    const cur = dataRef.current;
    const game = boss
      ? defeatBoss(cur.game)
      : { ...cur.game, catCoins: cur.game.catCoins + POMODORO_REWARD };
    const r = completePomodoroSession(
      { ...cur, game, petState: bumpPet(cur.petState, 0, 10) },
      minutes,
      undefined,
      kind,
    );
    if (shouldNudgeWater(r.data)) {
      setData(markWaterNudged(r.data));
      toast("💧 Uống một ly nước nhé!", {
        description: "Hai phiên tập trung liên tiếp rồi đó 🍅🍅",
      });
    } else setData(r.data);
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
    if (r.goalReached) {
      celebrate();
      toast.success("Đủ 8 ly nước hôm nay! 🎉");
    }
    announceAchievements(r.fresh);
    onLevels(r.levelsGained, r.data.game.level);
  };

  const spin = (mode: SpinMode = "normal") => {
    const d = dataRef.current;
    if (!canSpin(d.game, mode)) return null;
    const begun = beginSpin(d.game, mode);
    setData({ ...d, game: begun.game });
    const { prize, jackpot } = begun;
    // apply prize after the wheel animation
    setTimeout(() => {
      const cur = dataRef.current;
      const r = recordSpin(cur.game, prize, jackpot, mode);
      const drop = rollDrop();
      setData(addMaterial({ ...cur, game: r.game }, drop));
      announceDrop(drop);
      ting();
      toast.success(
        jackpot ? `🎰 JACKPOT! +${JACKPOT_TICKETS} lượt quay!` : `🎡 Bạn nhận được ${prize}`,
      );
      onLevels(r.levelsGained, r.game.level);
    }, 2600);
    return prize;
  };

  return (
    <Ctx.Provider
      value={{
        data,
        ready,
        fileName,
        status,
        lastSaved,
        timer,
        levelUp,
        evolution,
        update,
        open,
        create,
        startOffline,
        startAdmin,
        adminBoost,
        download,
        startTimer,
        pauseTimer,
        finish,
        drinkWater,
        spin,
        dismissLevelUp: () => setLevelUp(null),
        dismissEvolution: () => setEvolution(null),
        restore,
        finishPomodoro,
        bossCancel,
        claimAchievement,
        dismissBackupReminder,
        claimQuest,
        claimRaid,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
