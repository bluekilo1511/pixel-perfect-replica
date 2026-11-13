import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
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
  autoSpinModes,
  isWeekend,
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
import { claimChallenge as claimChallengeRule, recordInterruption } from "./model";
import { pushDueExtras } from "./tkb";
import { bossCounterAttack, defeatBoss, type DailyBossState } from "./boss";
import { withWeeklyReview } from "@/lib/tracker/petLog";
import { logPetEvent, withPetLog } from "./petLog";
import { bumpPet, POMODORO_REWARD } from "./gamify";
import {
  celebrate,
  evolutionFx,
  levelUpFx,
  setChime,
  setCustomChime,
  setFxEnabled,
  setFxVolume,
  ting,
} from "./effects";
import { loadCustomChime } from "./chimeStore";
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
  finish: (id: string, fromTimer?: boolean) => void;
  drinkWater: () => void;
  spin: (mode?: SpinMode) => string | null;
  dismissLevelUp: () => void;
  dismissEvolution: () => void;
  showEvolution: (evo: { from: string; to: string; title: string }) => void;
  restore: (raw: unknown) => void;
  finishPomodoro: (
    boss: boolean,
    minutes: number,
    kind?: "pomodoro" | "warmup",
    interruptions?: number,
  ) => { bossDue: boolean };
  bossCancel: () => void;
  claimAchievement: (id: AchievementId) => boolean;
  dismissBackupReminder: () => void;
  claimQuest: (id: string) => boolean;
  claimRaid: () => boolean;
  claimChallenge: () => boolean;
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
  const [dataState, setDataState] = useState<AppData>(defaultData);
  /**
   * Every data mutation flows through here, so pet level-ups and evolutions
   * are journalled automatically no matter which feature granted the XP
   * (tasks, treats, potions, the market…).
   */
  const setData = useCallback((action: SetStateAction<AppData>) => {
    setDataState((d) => {
      const next =
        typeof action === "function" ? (action as (prev: AppData) => AppData)(d) : action;
      return withPetLog(d, next);
    });
  }, []);
  const data = dataState;
  const [ready, setReady] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>("none");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [timer, setTimer] = useState<Timer | null>(null);
  const runPauses = useRef(0); // pauses inside the current running session (see finishPomodoro)
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [evolution, setEvolution] = useState<{
    from: string;
    to: string;
    title: string;
  } | null>(null);
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

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [setData]);

  // Keep the effect-sound switch, style and volume in sync with the saved setting.
  useEffect(() => {
    setFxEnabled(data.settings.fxSound);
    setChime(data.settings.chime);
    setFxVolume(data.settings.fxVolume);
  }, [data.settings.fxSound, data.settings.chime, data.settings.fxVolume]);

  // Restore the user's uploaded chime from IndexedDB (audio blobs never live in AppData).
  useEffect(() => {
    if (!data.settings.customChime) {
      setCustomChime(null);
      return;
    }
    let url: string | null = null;
    loadCustomChime()
      .then((rec) => {
        if (rec?.blob && dataRef.current.settings.customChime) {
          url = URL.createObjectURL(rec.blob);
          setCustomChime(url);
        }
      })
      .catch(() => setCustomChime(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [data.settings.customChime]);

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
  const adminBoost = (kind: AdminBoostKind, amount: number) => {
    let prevTier = 1;
    let nextTier = 1;
    let prevEmoji = "";
    let nextEmoji = "";
    let nextTitle = "";
    let nextPetLevel = 1;
    let prevPetLevel = 1;
    setData((prev) => {
      prevTier = tierOf(prev.petState.petLevel || 1);
      prevEmoji = petEmoji(prev.petState);
      prevPetLevel = prev.petState.petLevel || 1;
      const next = applyAdminBoost(prev, kind, amount);
      nextTier = tierOf(next.petState.petLevel || 1);
      nextEmoji = petEmoji(next.petState);
      nextTitle = petTitle(next.petState);
      nextPetLevel = next.petState.petLevel || 1;
      return next;
    });
    if (kind === "petXp") {
      if (nextTier > prevTier) {
        levelUpFx();
        setEvolution({
          from: prevEmoji,
          to: nextEmoji,
          title: nextTitle,
        });
        toast.success(`${TIER_BADGE[nextTier]} Thú cưng tiến hóa thành ${nextTitle}!`);
      } else if (nextPetLevel > prevPetLevel) {
        levelUpFx();
        toast(`🐾 Thú cưng lên cấp ${nextPetLevel}!`);
      }
    }
  };
  const download = () => {
    if (dataRef.current.settings.admin) {
      toast.error("Chế độ test (Admin) đang bật — tắt trong Cài đặt để tải backup.");
      return;
    }
    const now = new Date();
    setData((d) => ({
      ...d,
      backup: { ...d.backup, lastBackupAt: now.toISOString() },
    }));
    downloadData(dataRef.current, fileName ?? undefined);
    setStatus("saved");
    setLastSaved(now);
  };
  const dismissBackupReminder = () =>
    setData((d) => ({
      ...d,
      backup: { ...d.backup, lastReminderAt: new Date().toISOString() },
    }));

  const claimQuest = (id: string) => {
    let ok = false;
    setData((d) => {
      const r = claimQuestRule(d, id);
      if (!r.ok) return d;
      ok = true;
      return r.data;
    });
    if (ok) {
      ting();
      toast.success("🎯 Hoàn thành nhiệm vụ ngày! Đã nhận thưởng.");
    }
    return ok;
  };
  const claimRaid = () => {
    let ok = false;
    let drops: MaterialId[] = [];
    setData((d) => {
      const r = claimRaidRule(d);
      if (!r.ok) return d;
      ok = true;
      drops = r.drops;
      return logPetEvent(r.data, "raid", "🐲 Hạ gục Boss tuần! Phần thưởng lớn đã về tay.");
    });
    if (ok) {
      celebrate();
      toast.success("⚔️ Hạ Boss tuần! +40 😺 +8 🦎", { duration: 6000 });
      drops.forEach(announceDrop);
    }
    return ok;
  };

  const claimChallenge = () => {
    let ok = false;
    setData((d) => {
      const r = claimChallengeRule(d);
      if (!r.ok) return d;
      ok = true;
      return r.data;
    });
    if (ok) {
      ting();
      toast.success("🌟 Thử thách hôm nay hoàn thành! +6 😺 +1 🦎");
    }
    return ok;
  };

  const finish = useCallback(
    (id: string, fromTimer = false) => {
      let rewarded = false;
      let rData: AppData | null = null;
      let levelsGained = 0;
      let newLevel = 1;
      let dropItem: MaterialId | null = null;
      let freshAchievements: AchievementId[] = [];
      let evolved = false;
      let evoData: { from: string; to: string; title: string } | null = null;
      let petLvs = 0;
      let prevTask: AppData["tasks"][number] | null = null;
      let shouldAutoBreak = false;

      setData((prev) => {
        const xpMult = weatherEffect(weatherFromData(prev)).xpMult;
        const prevFormEmoji = petEmoji(prev.petState);
        const r = completeTask(prev, id, new Date(), Math.random, xpMult);
        if (!r.rewarded) return prev; // anti-spam
        rewarded = true;
        rData = r.data;
        levelsGained = r.levelsGained;
        newLevel = r.data.game.level;
        dropItem = r.drop;
        freshAchievements = r.fresh;
        evolved = r.petEvolved;
        if (evolved) {
          evoData = {
            from: prevFormEmoji,
            to: petEmoji(r.data.petState),
            title: petTitle(r.data.petState),
          };
        }
        petLvs = r.petLevels;
        prevTask = prev.tasks.find((t) => t.id === id) ?? null;
        shouldAutoBreak =
          fromTimer && r.data.settings.autoBreak && r.data.settings.breakMinutes > 0;
        void saveSnapshot(r.data);
        return r.data;
      });

      if (!rewarded || !rData) return;
      setTimer((t) => (t?.taskId === id ? null : t));
      celebrate();
      if (shouldAutoBreak) {
        window.dispatchEvent(new CustomEvent("pp-auto-break"));
      }
      const undoTask = prevTask;
      toast.success("Hoàn thành! +XP, +1 😺, +1 🎡", {
        action: {
          label: "Hoàn tác",
          onClick: () => {
            if (!undoTask) return;
            setData((d) => ({
              ...d,
              tasks: d.tasks.some((t) => t.id === id)
                ? d.tasks.map((t) => (t.id === id ? undoTask : t))
                : [...d.tasks, undoTask],
            }));
            toast("↩️ Đã trả lại nhiệm vụ (phần thưởng giữ nguyên)");
          },
        },
      });
      onLevels(levelsGained, newLevel);
      announceDrop(dropItem);
      announceAchievements(freshAchievements);
      if (evolved && evoData && rData) {
        levelUpFx();
        evolutionFx();
        setEvolution(evoData);
        const curPet: AppData["petState"] = (rData as AppData).petState;
        toast.success(
          `${TIER_BADGE[tierOf(curPet.petLevel)]} Thú cưng tiến hóa thành ${petTitle(curPet)}!`,
          { className: "glass-toast", duration: 6000 },
        );
      } else if (petLvs > 0 && rData) {
        toast(`🐾 Thú cưng lên cấp ${(rData as AppData).petState.petLevel}!`);
      }
    },
    [onLevels, setData],
  );

  // Timer tick based on wall clock → reaches 00:00 reliably even if tab was throttled.
  useEffect(() => {
    if (!timer) return;
    const iv = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
      if (remaining <= 0) {
        clearInterval(iv);
        finish(timer.taskId, true);
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
    runPauses.current += 1;
    setData((d) => {
      const logged = recordInterruption(d, timer.taskId);
      return {
        ...logged,
        tasks: logged.tasks.map((t) =>
          t.id === timer.taskId ? { ...t, remainingSeconds: remaining } : t,
        ),
      };
    });
    setTimer(null);
  };

  const startTimer = (id: string) => {
    const task = dataRef.current.tasks.find((t) => t.id === id);
    if (!task || task.completed || task.rewardClaimed || task.minutes <= 0) return;
    if (timer) pauseTimer();
    runPauses.current = 0;
    const secs = task.remainingSeconds > 0 ? task.remainingSeconds : task.minutes * 60;
    setTimer({ taskId: id, endAt: Date.now() + secs * 1000, remaining: secs });
  };

  // Day rollover + timetable trigger every 20s.
  useEffect(() => {
    if (!ready) return;
    const check = () => {
      let salaryNotice: { coins: number; level: number } | null = null;
      let freezeNotice = false;
      let extraNotice: string[] = [];
      let expeditionNotice: { title: string; count: number; drops: MaterialId[] } | null = null;
      let freshAchievements: AchievementId[] = [];
      let dueSlotNotices: string[] = [];

      setData((cur) => {
        const today = dateStr();
        const d0 = ensureDailyPins(cur, today);
        const sal = claimDailySalary(d0, today);
        if (sal.coins > 0) {
          salaryNotice = { coins: sal.coins, level: sal.data.game.level };
        }
        const { data: dp, pushed } = pushDueSlots(sal.data);
        const pet = decayPet(
          dp.petState,
          new Date(),
          weatherEffect(weatherFromData(dp)).petDecayMult,
        );
        let d1 = pet === dp.petState ? dp : { ...dp, petState: pet };
        if (
          d0.streak.lastQualifiedDate !== cur.streak.lastQualifiedDate &&
          d0.inventory.freezes < cur.inventory.freezes
        ) {
          freezeNotice = true;
        }
        const now = new Date();
        const ex = pushDueExtras(d1, now);
        if (ex.data !== d1) d1 = ex.data;
        if (ex.pushed.length) {
          extraNotice = ex.pushed.map((x) => x.title);
        }

        // Smart Reminder: 5 minutes before each class.
        upcomingSlots(d1, now).forEach((s) => {
          const key = `${dateStr(now)}:${s.id}`;
          if (reminded.current.has(key)) return;
          reminded.current.add(key);
          ting();
          toast(`🔔 5 phút nữa: ${s.title}`, {
            description: `${s.start} - ${s.end}`,
          });
          try {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`🔔 5 phút nữa: ${s.title}`, {
                body: `${s.start} - ${s.end}`,
              });
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
          d1 = logPetEvent(
            next,
            "expedition",
            `🧭 ${petTitle(next.petState)} thám hiểm về với ${expedition.drops.length} chiến lợi phẩm!`,
          );
          expeditionNotice = {
            title: petTitle(d1.petState),
            count: expedition.drops.length,
            drops: expedition.drops,
          };
        }

        const ach = applyAchievements(d1, {});
        freshAchievements = ach.fresh;
        dueSlotNotices = pushed.map((s) => s.title);
        return ach.data;
      });

      const sn = salaryNotice as { coins: number; level: number } | null;
      if (sn) {
        ting();
        toast.success(`💰 Lương ngày mới: +${sn.coins} 😺 (Lv ${sn.level})`);
      }
      if (freezeNotice) {
        toast("🧊 Bình đóng băng đã cứu chuỗi streak của bạn!");
      }
      if (extraNotice.length) {
        toast("📌 Nhắc việc hôm nay", {
          description: extraNotice.join(", "),
        });
      }
      const en = expeditionNotice as { title: string; count: number; drops: MaterialId[] } | null;
      if (en) {
        ting();
        toast.success(`🧭 ${en.title} đã trở về từ chuyến thám hiểm!`);
        en.drops.forEach(announceDrop);
      }
      announceAchievements(freshAchievements);
      if (dueSlotNotices.length) {
        dueSlotNotices.forEach((title) => {
          toast(`⏰ Đến giờ: ${title}`, {
            description: "Đã thêm vào việc hôm nay",
          });
        });
        ting();
      }
    };
    check();
    const iv = setInterval(check, 20000);
    return () => clearInterval(iv);
  }, [ready, setData]);

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

  // 📋 Weekly review: mỗi Chủ nhật mở app, pet chấm tuần vừa qua vào nhật ký.
  useEffect(() => {
    if (!ready) return;
    const now = new Date();
    if (now.getDay() !== 0) return;
    const today = dateStr(now);
    if (dataRef.current.lastPetReview === today) return;
    update((d) => ({ ...withWeeklyReview(d, now), lastPetReview: today }));
  }, [ready, update]);

  // ⚡ Auto-spin: quay giùm mình khi mở app (tuỳ chọn trong vòng quay).
  // Miễn phí trước, cuối tuần ưu tiên MEGA; ngày thường giữ 2 lượt cho MEGA.
  const autoSpin = () => {
    const prizes: string[] = [];
    let levels = 0;
    let endLevel = 1;

    setData((d) => {
      if (d.settings.autoSpin !== true) return d;
      const now = new Date();
      const weekend = isWeekend(now);
      let g = d.game;
      let next = d;
      for (let guard = 60; guard > 0; guard -= 1) {
        const mode = autoSpinModes(g, weekend, now)[0];
        if (!mode) break;
        const begun = beginSpin(g, mode, now);
        const r = recordSpin(begun.game, begun.prize, begun.jackpot, mode, now.toISOString());
        const drop = rollDrop();
        next = addMaterial({ ...next, game: r.game }, drop);
        g = r.game;
        levels += r.levelsGained;
        prizes.push(begun.prize);
      }
      endLevel = g.level;
      return next;
    });

    if (prizes.length) {
      ting();
      toast.success(`⚡ Quay giùm mình: ${prizes.join(" · ")}`);
      onLevels(levels, endLevel);
    }
  };

  useEffect(() => {
    if (ready) autoSpin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data.settings.autoSpin]);

  const restore = (raw: unknown) => {
    const probe = raw as { app?: unknown } | null;
    if (probe && probe.app === "tpp-share") {
      toast.error("Đây là file chia sẻ chỉ để xem — không thể nạp làm dữ liệu của app.");
      return;
    }
    setData(ensureDailyPins(migrate(raw)));
    setReady(true);
  };

  const finishPomodoro = (
    boss: boolean,
    minutes: number,
    kind?: "pomodoro" | "warmup",
    interruptions?: number,
  ) => {
    let bossDue = false;
    let freshAchievements: AchievementId[] = [];
    let nudgeWater = false;
    const pauses = interruptions ?? runPauses.current;
    runPauses.current = 0;

    setData((cur) => {
      const today = dateStr(new Date());
      bossDue = boss && !(cur.dailyBoss.date === today && cur.dailyBoss.defeated);
      const game = bossDue
        ? defeatBoss(cur.game)
        : { ...cur.game, catCoins: cur.game.catCoins + POMODORO_REWARD };
      const dailyBoss: DailyBossState = boss ? { date: today, defeated: true } : cur.dailyBoss;
      const r = completePomodoroSession(
        { ...cur, game, petState: bumpPet(cur.petState, 0, 10), dailyBoss },
        minutes,
        undefined,
        kind,
        pauses,
      );
      freshAchievements = r.fresh;
      if (shouldNudgeWater(r.data)) {
        nudgeWater = true;
        return markWaterNudged(r.data);
      }
      return r.data;
    });

    if (nudgeWater) {
      toast("💧 Uống một ly nước nhé!", {
        description: "Hai phiên tập trung liên tiếp rồi đó 🍅🍅",
      });
    }
    announceAchievements(freshAchievements);
    return { bossDue };
  };
  const bossCancel = () => setData((d) => ({ ...d, petState: bossCounterAttack(d.petState) }));
  const claimAchievement = (id: AchievementId) => {
    let ok = false;
    setData((d) => {
      const next = claimAchievementReward(d, id);
      if (!next) return d;
      ok = true;
      return next;
    });
    if (ok) {
      ting();
      toast.success(`🏆 Đã nhận thưởng +${ACHIEVEMENT_REWARD} 🦎`);
    }
    return ok;
  };

  const drinkWater = () => {
    let goalReached = false;
    let freshAchievements: AchievementId[] = [];
    let levelsGained = 0;
    let newLevel = 1;

    setData((d) => {
      const r = addWaterCup(d);
      if (r.data === d) return d;
      goalReached = r.goalReached;
      freshAchievements = r.fresh;
      levelsGained = r.levelsGained;
      newLevel = r.data.game.level;
      return r.data;
    });

    if (goalReached) {
      celebrate();
      toast.success("Đủ 8 ly nước hôm nay! 🎉 (+1 lượt quay)");
    }
    announceAchievements(freshAchievements);
    onLevels(levelsGained, newLevel);
  };

  const spin = (mode: SpinMode = "normal") => {
    let prize: string | null = null;
    let jackpot = false;
    let drop: MaterialId | null = null;
    let levelsGained = 0;
    let newLevel = 1;

    setData((d) => {
      if (!canSpin(d.game, mode)) return d;
      const begun = beginSpin(d.game, mode);
      prize = begun.prize;
      jackpot = begun.jackpot;
      const spun = recordSpin(begun.game, prize, jackpot, mode);
      drop = rollDrop();
      levelsGained = spun.levelsGained;
      newLevel = spun.game.level;
      return addMaterial({ ...d, game: spun.game }, drop);
    });

    if (prize) {
      setTimeout(() => {
        if (drop) announceDrop(drop);
        ting();
        toast.success(
          jackpot ? `🎰 JACKPOT! +${JACKPOT_TICKETS} lượt quay!` : `🎡 Bạn nhận được ${prize}`,
        );
        onLevels(levelsGained, newLevel);
      }, 2600);
    }
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
        showEvolution: (evo) => setEvolution(evo),
        restore,
        finishPomodoro,
        bossCancel,
        claimAchievement,
        dismissBackupReminder,
        claimQuest,
        claimRaid,
        claimChallenge,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
