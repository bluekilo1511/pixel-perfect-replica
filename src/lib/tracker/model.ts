import {
  checkStreak, defaultInventory, defaultPet, defaultStreak, normalizePet, recordCompletion, streakMultiplier, bumpPet, POMODORO_MINUTES,
  type Inventory, type PetState, type StreakState,
} from "./gamify";
import {
  addPetXp, bumpLifetime, bumpStats, checkAchievements, claimReward, isNightOwlHour, normalizeExtras, recordWaterGoal, rollDrop, startExpedition, writeDiary,
  type AchievementId, type AchievementState, type DayStats, type DiaryEntry, type ExpeditionState, type MaterialId,
} from "./extras";
import { shiftDate, SPECIES } from "./gamify";
import { dailyQuests, defaultQuests, defaultRaid, questProgress, RAID_REWARD, raidStatus, type QuestsState, type RaidState } from "./quests";
import { defaultExams, newExamId, normalizeExams, type ExamEvent } from "./exams";

// Pure data model + logic for Task Tracker Pro (no browser APIs here, so it is testable).

export type TaskKind = "pomodoro" | "exercise" | "water" | "custom";

export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  minutes: number; // 0 = no timer
  remainingSeconds: number;
  date: string; // YYYY-MM-DD
  completed: boolean;
  completedAt: string | null;
  rewardClaimed: boolean; // anti-spam lock
  pinned?: boolean;
  timeRange?: string; // "07:30 - 08:15" badge from timetable
  fromSlotId?: string;
  examId?: string | undefined; // linked exam countdown
  createdAt: string;
  [extra: string]: unknown; // keep unknown fields from old files
}

export interface Slot {
  id: string;
  start: string; // "HH:MM"
  end: string;
  title: string;
  kind: TaskKind;
  minutes: number;
}

export interface TimetableDay {
  dayIndex: number; // 0 = Sunday ... 6 = Saturday (same as Date.getDay())
  label: string;
  slots: Slot[];
}

export interface Timetable {
  weekStartsOn: 0;
  days: TimetableDay[]; // always 7 items, days[0] = Sunday
}

export interface GameState {
  level: number;
  xp: number;
  catCoins: number;
  lizardGems: number;
  spinTickets: number;
  spinHistory: { at: string; prize: string }[];
  water: { date: string; cups: number; rewarded: boolean };
  lastDailyPinDate: string | null;
  [extra: string]: unknown;
}

export type AmbientSettingKind = "rain" | "ocean" | null;
export interface AppSettings {
  pomodoroMinutes: number;
  ambient: { kind: AmbientSettingKind; volume: number };
}

export interface AppData {
  app: "local-task-tracker-pro";
  version: 3;
  updatedAt: string;
  tasks: Task[];
  game: GameState;
  timetable: Timetable;
  timetableLog: string[]; // "YYYY-MM-DD:slotId" already pushed to today's list
  avatarBase64: string | null;
  petState: PetState;
  streak: StreakState;
  inventory: Inventory;
  settings: AppSettings;
  achievements: AchievementState;
  claimedAchievements: Partial<Record<AchievementId, string>>;
  adventureLog: DiaryEntry[]; // newest first
  dailyStats: Record<string, DayStats>;
  expedition: ExpeditionState;
  lastDiaryDate: string | null;
  backup: { lastBackupAt: string | null; lastReminderAt: string | null };
  quests: QuestsState;
  raid: RaidState;
  exams: ExamEvent[];
  [extra: string]: unknown;
}

export const DAY_LABELS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export const WATER_GOAL = 8;
export const EXERCISE_SESSIONS = 3;
export const POMODORO_PRESETS = [15, 25, 50] as const;

export const KIND_META: Record<TaskKind, { emoji: string; label: string; minutes: number }> = {
  water: { emoji: "💧", label: "Uống nước", minutes: 0 },
  exercise: { emoji: "🤸", label: "Tập thể dục 5p", minutes: 5 },
  pomodoro: { emoji: "📚", label: "Học bài Pomodoro 25p", minutes: 25 },
  custom: { emoji: "✍️", label: "Việc tự nhập", minutes: 0 },
};

export const uid = (p = "id") => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function dateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const xpForLevel = (level: number) => level * 100;

export function emptyTimetable(): Timetable {
  return { weekStartsOn: 0, days: DAY_LABELS.map((label, dayIndex) => ({ dayIndex, label, slots: [] })) };
}

export function defaultGame(today = dateStr()): GameState {
  return {
    level: 1, xp: 0, catCoins: 0, lizardGems: 0, spinTickets: 0, spinHistory: [],
    water: { date: today, cups: 0, rewarded: false },
    lastDailyPinDate: null,
  };
}

const clamp01 = (v: number, d: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
export function defaultSettings(): AppSettings {
  return {
    pomodoroMinutes: POMODORO_MINUTES,
    ambient: { kind: null, volume: 0.4 },
  };
}

export function defaultData(): AppData {
  return {
    app: "local-task-tracker-pro", version: 3, updatedAt: new Date().toISOString(),
    tasks: [], game: defaultGame(), timetable: emptyTimetable(), timetableLog: [],
    avatarBase64: null, petState: defaultPet(), streak: defaultStreak(dateStr()), inventory: defaultInventory(),
    settings: defaultSettings(),
    ...normalizeExtras(null), lastDiaryDate: dateStr(),
    backup: { lastBackupAt: null, lastReminderAt: null },
    quests: defaultQuests(), raid: defaultRaid(),
    exams: defaultExams(),
  };
}

export function makeTask(title: string, kind: TaskKind, minutes: number, date: string, extra: Partial<Task> = {}): Task {
  return {
    id: uid("task"), title, kind, minutes, remainingSeconds: minutes * 60, date,
    completed: false, completedAt: null, rewardClaimed: false, createdAt: new Date().toISOString(), ...extra,
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const KINDS: TaskKind[] = ["pomodoro", "exercise", "water", "custom"];
const normalizePomodoroMinutes = (v: unknown) => {
  const minutes = Math.round(num(v, POMODORO_MINUTES));
  return POMODORO_PRESETS.includes(minutes as (typeof POMODORO_PRESETS)[number]) ? minutes : POMODORO_MINUTES;
};

function normalizeSlot(s: any): Slot {
  const kind: TaskKind = KINDS.includes(s?.kind) ? s.kind : "custom";
  return {
    id: typeof s?.id === "string" ? s.id : uid("slot"),
    start: typeof s?.start === "string" ? s.start : "08:00",
    end: typeof s?.end === "string" ? s.end : "08:30",
    title: typeof s?.title === "string" && s.title ? s.title : KIND_META[kind].label,
    kind,
    minutes: num(s?.minutes, KIND_META[kind].minutes),
  };
}

/** Accepts any old/new JSON and fills missing fields without losing old tasks. */
export function migrate(raw: unknown): AppData {
  const base = defaultData();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as any;
  const oldGame = r.game ?? r.gameState ?? {};

  const tasks: Task[] = (Array.isArray(r.tasks) ? r.tasks : []).map((t: any) => {
    const minutes = num(t.minutes ?? t.customMinutes, 25);
    return {
      ...t,
      id: typeof t.id === "string" ? t.id : uid("task"),
      title: String(t.title ?? "Nhiệm vụ"),
      kind: KINDS.includes(t.kind) ? t.kind : "custom",
      minutes,
      remainingSeconds: num(t.remainingSeconds, minutes * 60),
      date: typeof t.date === "string" ? t.date : dateStr(),
      completed: !!t.completed,
      completedAt: t.completedAt ?? null,
      rewardClaimed: t.rewardClaimed ?? !!t.completed,
      createdAt: t.createdAt ?? new Date().toISOString(),
    };
  });

  // Timetable: new format {days:[7]}, or old flat array of slots with a `day` field.
  const tt = emptyTimetable();
  const src = r.timetable ?? oldGame.timetable;
  if (src && Array.isArray(src.days)) {
    src.days.forEach((d: any, i: number) => {
      const idx = typeof d?.dayIndex === "number" ? d.dayIndex : i;
      if (idx >= 0 && idx < 7) tt.days[idx]!.slots = (d.slots ?? []).map(normalizeSlot);
    });
  } else if (Array.isArray(src)) {
    src.forEach((s: any) => {
      const idx = num(s?.day ?? s?.dayIndex, -1);
      if (idx >= 0 && idx < 7) tt.days[idx]!.slots.push(normalizeSlot(s));
    });
  }
  tt.days.forEach((d) => d.slots.sort((a, b) => a.start.localeCompare(b.start)));

  const { timetable: _old, ...gameRest } = oldGame;
  const game: GameState = {
    ...base.game, ...gameRest,
    level: Math.max(1, num(oldGame.level, 1)),
    xp: Math.max(0, num(oldGame.xp, 0)),
    catCoins: num(oldGame.catCoins, 0),
    lizardGems: num(oldGame.lizardGems, 0),
    spinTickets: num(oldGame.spinTickets, 0),
    spinHistory: Array.isArray(oldGame.spinHistory) ? oldGame.spinHistory : [],
    water: { ...base.game.water, ...(oldGame.water ?? {}) },
  };

  const { gameState: _g, ...rest } = r;
  const rawSettings = r.settings;
  const settings: AppSettings = {
    pomodoroMinutes: normalizePomodoroMinutes(rawSettings?.pomodoroMinutes),
    ambient: {
      kind: rawSettings?.ambient?.kind === "rain" || rawSettings?.ambient?.kind === "ocean" ? rawSettings.ambient.kind : null,
      volume: clamp01(num(rawSettings?.ambient?.volume, 0.4), 0.4),
    },
  };
  return {
    ...rest, app: "local-task-tracker-pro", version: 3, updatedAt: r.updatedAt ?? base.updatedAt,
    tasks, game, timetable: tt, timetableLog: Array.isArray(r.timetableLog) ? r.timetableLog : [],
    avatarBase64: typeof r.avatarBase64 === "string" ? r.avatarBase64 : null,
    petState: normalizePet(r.petState),
    streak: r.streak && typeof r.streak === "object" ? { ...base.streak, ...r.streak, freezeActive: r.streak.freezeActive === true, today: { ...base.streak.today, ...(r.streak.today ?? {}) } } : { ...base.streak, freezeActive: false },
    settings,
    ...extrasFrom(r),
    inventory: { items: { ...(r.inventory?.items ?? {}) }, freezes: num(r.inventory?.freezes, 0), materials: normalizeExtras(r).materials },
    backup: {
      lastBackupAt: typeof r.backup?.lastBackupAt === "string" ? r.backup.lastBackupAt : null,
      lastReminderAt: typeof r.backup?.lastReminderAt === "string" ? r.backup.lastReminderAt : null,
    },
    quests: {
      date: typeof r.quests?.date === "string" ? r.quests.date : null,
      claimed: Array.isArray(r.quests?.claimed) ? r.quests.claimed.filter((x: unknown) => typeof x === "string") : [],
    },
    raid: {
      weekStart: typeof r.raid?.weekStart === "string" ? r.raid.weekStart : null,
      claimed: r.raid?.claimed === true,
    },
    exams: normalizeExams(r.exams),
  };
}

function extrasFrom(r: any) {
  const { materials: _m, ...e } = normalizeExtras(r);
  return e;
}

/** Adds XP and handles multiple level-ups. Returns number of levels gained. */
export function addXp(game: GameState, amount: number): { game: GameState; levelsGained: number } {
  let { level, xp } = game;
  xp += amount;
  let levelsGained = 0;
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
    levelsGained++;
  }
  return { game: { ...game, level, xp }, levelsGained };
}

export function rewardFor(kind: TaskKind) {
  return {
    xp: kind === "pomodoro" ? 30 : kind === "exercise" ? 15 : 10,
    cat: 1,
    lizard: kind === "pomodoro" ? 1 : 0,
    spins: 1,
  };
}

/** Completes a task once. Second call is a no-op (anti-spam). */
export interface CompleteResult {
  data: AppData; rewarded: boolean; levelsGained: number;
  drop: MaterialId | null; petEvolved: boolean; petLevels: number; fresh: AchievementId[];
}

export function addMaterial(data: AppData, id: MaterialId | null, n = 1): AppData {
  if (!id) return data;
  const m = data.inventory.materials;
  return { ...data, inventory: { ...data.inventory, materials: { ...m, [id]: (m[id] ?? 0) + n } } };
}

/** Unlocks hidden achievements; rewards are claimed manually from the map. */
export function applyAchievements(data: AppData, ctx: { nightOwl?: boolean }, now = new Date()): { data: AppData; fresh: AchievementId[] } {
  const r = checkAchievements(data.achievements, { pet: data.petState, nightOwl: !!ctx.nightOwl }, now);
  if (!r.fresh.length) return { data, fresh: [] };
  return {
    fresh: r.fresh,
    data: { ...data, achievements: r.achievements, claimedAchievements: { ...r.achievements.claimed } },
  };
}

export function claimAchievementReward(data: AppData, id: AchievementId, now = new Date()): AppData | null {
  const achievements = claimReward(data.achievements, id, now);
  if (!achievements) return null;
  return {
    ...data,
    achievements,
    claimedAchievements: { ...achievements.claimed },
    game: { ...data.game, lizardGems: data.game.lizardGems + 10 },
  };
}

/** Completes a task once. Second call is a no-op (anti-spam). */
export function completeTask(data: AppData, taskId: string, now = new Date(), rng: () => number = Math.random, xpMult = 1): CompleteResult {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || task.completed || task.rewardClaimed) return { data, rewarded: false, levelsGained: 0, drop: null, petEvolved: false, petLevels: 0, fresh: [] };
  const r = rewardFor(task.kind);
  const today = dateStr(now);
  const mult = streakMultiplier(data.streak.count);
  const earned = Math.round(r.xp * mult * xpMult);
  const { game, levelsGained } = addXp(data.game, earned);
  const pet = addPetXp(bumpPet(data.petState, 0, 5), earned);
  const drop = rollDrop(rng);
  const pomodoroPatch = task.kind === "pomodoro" ? { focusMin: task.minutes, pomodoros: 1 } : {};
  const achievements = bumpLifetime(data.achievements, { tasks: 1, ...pomodoroPatch });
  const base: AppData = {
      ...data,
      streak: recordCompletion(data.streak, today),
      petState: pet.pet,
      achievements,
      claimedAchievements: { ...achievements.claimed },
      dailyStats: bumpStats(data.dailyStats, today, { tasks: 1, ...(task.kind === "pomodoro" ? { focusMin: task.minutes, pomodoros: 1 } : {}) }),
      game: { ...game, catCoins: game.catCoins + r.cat, lizardGems: game.lizardGems + r.lizard, spinTickets: game.spinTickets + r.spins },
      tasks: data.tasks.map((t) =>
        t.id === taskId ? { ...t, completed: true, rewardClaimed: true, remainingSeconds: 0, completedAt: now.toISOString() } : t,
      ),
  };
  const ach = applyAchievements(addMaterial(base, drop), { nightOwl: isNightOwlHour(now) }, now);
  return { rewarded: true, levelsGained, drop, petEvolved: pet.evolved, petLevels: pet.levelsGained, fresh: ach.fresh, data: ach.data };
}

/** Pet-widget Pomodoro finished: logs focus time, records a completed "Pomodoro focus" entry (no extra reward), checks Night Owl. */
export function completePomodoroSession(data: AppData, minutes: number, now = new Date()): { data: AppData; fresh: AchievementId[] } {
  const today = dateStr(now);
  const focusToday = (data.dailyStats[today]?.focusMin ?? 0) + minutes;
  const achievements = bumpLifetime(data.achievements, { focusMin: minutes, pomodoros: 1 });
  const record = makeTask(`Pomodoro tập trung (${minutes} phút)`, "pomodoro", minutes, today, {
    completed: true, rewardClaimed: true, remainingSeconds: 0, completedAt: now.toISOString(),
  });
  const d = {
    ...data,
    achievements,
    claimedAchievements: { ...achievements.claimed },
    expedition: startExpedition(data.expedition, focusToday, now),
    dailyStats: bumpStats(data.dailyStats, dateStr(now), { focusMin: minutes, pomodoros: 1 }),
    tasks: [...data.tasks, record],
  };
  return applyAchievements(d, { nightOwl: isNightOwlHour(now) }, now);
}

// ---- Daily quests & weekly raid ----
/** Claims a daily quest reward when its target is met. Resets automatically on a new day. */
export function claimQuest(data: AppData, questId: string, now = new Date()): { data: AppData; ok: boolean } {
  const today = dateStr(now);
  const quest = dailyQuests(today).find((q) => q.id === questId);
  if (!quest) return { data, ok: false };
  const claimed = data.quests.date === today ? data.quests.claimed : [];
  if (claimed.includes(questId)) return { data, ok: false };
  if (questProgress(data.dailyStats[today], quest) < quest.target) return { data, ok: false };
  return {
    ok: true,
    data: {
      ...data,
      quests: { date: today, claimed: [...claimed, questId] },
      game: { ...data.game, catCoins: data.game.catCoins + quest.reward.catCoins, lizardGems: data.game.lizardGems + quest.reward.lizardGems },
    },
  };
}

/** Claims the weekly raid reward once the boss is defeated. */
export function claimRaid(data: AppData, now = new Date()): { data: AppData; ok: boolean } {
  const st = raidStatus(data.dailyStats, dateStr(now), data.raid);
  if (!st.claimable) return { data, ok: false };
  return {
    ok: true,
    data: {
      ...data,
      raid: { weekStart: st.weekStart, claimed: true },
      game: { ...data.game, catCoins: data.game.catCoins + RAID_REWARD.catCoins, lizardGems: data.game.lizardGems + RAID_REWARD.lizardGems },
    },
  };
}

// ---- Backup reminder ----
// ---- Exam countdown ----
/** Adds an exam event. No-op when the name or date is invalid. */
export function addExam(data: AppData, name: string, date: string, now = new Date()): AppData {
  const clean = name.trim();
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return data;
  const exam: ExamEvent = { id: newExamId(), name: clean, date };
  return { ...data, exams: [...data.exams, exam], updatedAt: now.toISOString() };
}

/** Removes an exam event and untags its tasks. No-op for unknown ids. */
export function removeExam(data: AppData, examId: string, now = new Date()): AppData {
  if (!data.exams.some((e) => e.id === examId)) return data;
  return {
    ...data,
    exams: data.exams.filter((e) => e.id !== examId),
    tasks: data.tasks.map((t) => (t.examId === examId ? { ...t, examId: undefined } : t)),
    updatedAt: now.toISOString(),
  };
}

/** Links/unlinks a task to an exam. No-op when examId does not exist. */
export function setTaskExam(data: AppData, taskId: string, examId: string | null, now = new Date()): AppData {
  if (examId && !data.exams.some((e) => e.id === examId)) return data;
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, examId: examId ?? undefined } : t)),
    updatedAt: now.toISOString(),
  };
}

export const BACKUP_REMINDER_DAYS = 7;
const REMINDER_SNOOZE_MS = 24 * 60 * 60 * 1000;
/** True when the last backup is older than 7 days (or never) and the banner was not snoozed in the last 24h. */
export function needsBackupReminder(data: AppData, now = new Date()): boolean {
  const { lastBackupAt, lastReminderAt } = data.backup;
  const backupMs = lastBackupAt ? new Date(lastBackupAt).getTime() : NaN;
  const stale = !Number.isFinite(backupMs) || now.getTime() - backupMs >= BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
  if (!stale) return false;
  const remMs = lastReminderAt ? new Date(lastReminderAt).getTime() : NaN;
  return !Number.isFinite(remMs) || now.getTime() - remMs >= REMINDER_SNOOZE_MS;
}

/** Once per day: reset water, carry pinned tasks into today (uncompleted), check streak, pin exercise sessions. */
export function ensureDailyPins(data: AppData, today = dateStr()): AppData {
  let next = data;
  if (data.game.water.date !== today) {
    next = { ...next, game: { ...next.game, water: { date: today, cups: 0, rewarded: false } } };
  }
  // Pinned tasks from earlier days move to today with completed = false (dedupe by title+kind, keep newest).
  const old = next.tasks.filter((t) => t.pinned && t.date < today);
  if (old.length) {
    const keys = new Set(next.tasks.filter((t) => t.pinned && t.date === today).map((t) => `${t.kind}|${t.title}`));
    const keep = new Set<string>();
    [...old].sort((a, b) => b.date.localeCompare(a.date)).forEach((t) => {
      const k = `${t.kind}|${t.title}`;
      if (!keys.has(k)) { keys.add(k); keep.add(t.id); }
    });
    next = {
      ...next,
      tasks: next.tasks
        .filter((t) => !(t.pinned && t.date < today) || keep.has(t.id))
        .map((t) => keep.has(t.id)
          ? { ...t, date: today, completed: false, completedAt: null, rewardClaimed: false, remainingSeconds: t.minutes * 60 }
          : t),
    };
  }
  const sc = checkStreak(next.streak, next.inventory, today);
  if (sc.streak !== next.streak) next = { ...next, streak: sc.streak, inventory: sc.inventory };
  // Pet's adventure diary for the previous day, once per new calendar day.
  if (next.lastDiaryDate !== today) {
    if (next.lastDiaryDate) {
      const y = shiftDate(today, -1);
      const entry = writeDiary(y, next.dailyStats[y], { petName: SPECIES[next.petState.species].name, freezeUsed: sc.usedFreeze, streakBroke: sc.broke });
      next = { ...next, adventureLog: [entry, ...next.adventureLog.filter((e) => e.date !== y)].slice(0, 60) };
    }
    next = { ...next, lastDiaryDate: today };
  }
  if (next.game.lastDailyPinDate !== today) {
    const hasExercise = next.tasks.some((t) => t.pinned && t.kind === "exercise" && t.date === today);
    const pins = hasExercise ? [] : Array.from({ length: EXERCISE_SESSIONS }, (_, i) =>
      makeTask(`Tập thể dục giãn cơ (5 phút) #${i + 1}`, "exercise", 5, today, { pinned: true }),
    );
    next = { ...next, tasks: [...next.tasks, ...pins], game: { ...next.game, lastDailyPinDate: today } };
  }
  return next;
}

export function addWaterCup(data: AppData, now = new Date()): { data: AppData; goalReached: boolean; levelsGained: number; fresh: AchievementId[] } {
  const w = data.game.water;
  if (w.cups >= WATER_GOAL) return { data, goalReached: false, levelsGained: 0, fresh: [] };
  const today = dateStr(now);
  const cups = w.cups + 1;
  let game: GameState = { ...data.game, water: { ...w, cups } };
  let levelsGained = 0;
  const step = addXp(game, 5);
  game = step.game;
  levelsGained += step.levelsGained;
  let goalReached = false;
  if (cups >= WATER_GOAL && !w.rewarded) {
    const bonus = addXp(game, 20);
    game = { ...bonus.game, catCoins: bonus.game.catCoins + 1, spinTickets: bonus.game.spinTickets + 1, water: { ...game.water, rewarded: true } };
    levelsGained += bonus.levelsGained;
    goalReached = true;
  }
  let next: AppData = { ...data, game, dailyStats: bumpStats(data.dailyStats, today, { water: 1 }) };
  if (goalReached) next = { ...next, achievements: recordWaterGoal(next.achievements, today) };
  const ach = applyAchievements(next, {}, now);
  return { data: ach.data, goalReached, levelsGained, fresh: ach.fresh };
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Pushes slots whose start time has arrived (for today's weekday) into today's tasks, once per day per slot. */
export function pushDueSlots(data: AppData, now = new Date()): { data: AppData; pushed: Slot[] } {
  const today = dateStr(now);
  const day = data.timetable.days[now.getDay()];
  if (!day) return { data, pushed: [] };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const due = day.slots.filter((s) => toMin(s.start) <= nowMin && !data.timetableLog.includes(`${today}:${s.id}`));
  if (!due.length) return { data, pushed: [] };
  const newTasks = due.map((s) => makeTask(s.title, s.kind, s.minutes, today, { fromSlotId: s.id, timeRange: `${s.start} - ${s.end}` }));
  const log = [...data.timetableLog.filter((k) => k >= today.slice(0, 10)), ...due.map((s) => `${today}:${s.id}`)];
  return { data: { ...data, tasks: [...data.tasks, ...newTasks], timetableLog: log }, pushed: due };
}

export const WHEEL_PRIZES = ["+10 XP", "+2 😺", "+1 🦎", "+30 XP", "+1 🎡", "+5 😺"];

export function applyPrize(game: GameState, prize: string): { game: GameState; levelsGained: number } {
  const n = parseInt(prize.replace(/[^0-9]/g, ""), 10) || 0;
  if (prize.includes("XP")) return addXp(game, n);
  if (prize.includes("😺")) return { game: { ...game, catCoins: game.catCoins + n }, levelsGained: 0 };
  if (prize.includes("🦎")) return { game: { ...game, lizardGems: game.lizardGems + n }, levelsGained: 0 };
  return { game: { ...game, spinTickets: game.spinTickets + n }, levelsGained: 0 };
}

/** "Đồng bộ nhanh lịch hôm nay": add every slot of today's weekday not yet in the list. */
export function syncTodaySlots(data: AppData, now = new Date()): { data: AppData; added: number } {
  const today = dateStr(now);
  const day = data.timetable.days[now.getDay()];
  if (!day) return { data, added: 0 };
  const todo = day.slots.filter((s) => !data.timetableLog.includes(`${today}:${s.id}`) && !data.tasks.some((t) => t.date === today && t.fromSlotId === s.id));
  if (!todo.length) return { data, added: 0 };
  const newTasks = todo.map((s) => makeTask(s.title, s.kind, s.minutes, today, { fromSlotId: s.id, timeRange: `${s.start} - ${s.end}` }));
  return {
    data: { ...data, tasks: [...data.tasks, ...newTasks], timetableLog: [...data.timetableLog, ...todo.map((s) => `${today}:${s.id}`)] },
    added: todo.length,
  };
}

/** Slots starting in exactly <=5 minutes (and not yet started) today. */
export function upcomingSlots(data: AppData, now = new Date(), leadMin = 5): Slot[] {
  const day = data.timetable.days[now.getDay()];
  if (!day) return [];
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return day.slots.filter((s) => { const d = toMin(s.start) - nowMin; return d > 0 && d <= leadMin; });
}
