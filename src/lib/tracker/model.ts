import {
  checkStreak,
  defaultInventory,
  defaultPet,
  defaultStreak,
  normalizePet,
  recordCompletion,
  streakMultiplier,
  bumpPet,
  POMODORO_MINUTES,
  type Inventory,
  type PetState,
  type StreakState,
} from "./gamify";
import { defaultMarket, type MarketState } from "./market";
import { DEFAULT_ZODIAC_ID, isValidZodiacId } from "./zodiac";
import {
  addPetXp,
  bumpLifetime,
  bumpStats,
  checkAchievements,
  claimReward,
  isNightOwlHour,
  normalizeExtras,
  recordWaterGoal,
  rollDrop,
  startExpedition,
  writeDiary,
  type AchievementId,
  type AchievementState,
  type DayStats,
  type DiaryEntry,
  type ExpeditionState,
  type MaterialId,
} from "./extras";
import { shiftDate, SPECIES } from "./gamify";
import {
  dailyQuests,
  defaultQuests,
  defaultRaid,
  questProgress,
  RAID_REWARD,
  raidStatus,
  type QuestsState,
  type RaidState,
} from "./quests";
import {
  defaultExams,
  newExamId,
  normalizeExamScores,
  normalizeExams,
  type ExamEvent,
  type ExamScore,
} from "./exams";
import { normalizeJournal } from "./journal";
import {
  normalizeGradeEntries,
  normalizeGradeExtras,
  normalizeGradeTargets,
  type GradeEntry,
  type GradeExtra,
} from "./grades";
import { normalizeWeekGoals } from "./goals";
import { normalizeSubjectNotes, removeSubjectNote, type SubjectNoteMap } from "./subjectNotes";
import type { JournalEntry } from "./journal";
import type { WeekGoal } from "./goals";
import {
  defaultTemplates,
  newTemplateId,
  normalizeTemplates,
  type TaskTemplate,
} from "./templates";

// Pure data model + logic for Task Tracker Pro (no browser APIs here, so it is testable).

export type TaskKind = "pomodoro" | "exercise" | "water" | "custom";

/** A routine to-do the user tracks without a timer — "Dậy sớm", "Đọc 10 trang". Persists every day; the check resets each morning. */
export interface NoteItem {
  id: string;
  title: string;
  lastDoneDate: string | null; // YYYY-MM-DD; shown done when it equals today
  createdAt: string;
}

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
  mood?: number; // 1..4 feeling after finishing a timed task (1 = tuyệt vời)
  subject?: string; // study subject tag (from data.subjects) used by the per-subject chart
  remindAt?: string; // "HH:MM" — same-day reminder time; the app pings when it passes
  createdAt: string;
  [extra: string]: unknown; // keep unknown fields from old files
}

export type SessionKind = "pomodoro" | "warmup"; // warmup = the 5-minute anti-procrastination session

export interface SessionEntry {
  at: string; // ISO time the session finished
  minutes: number;
  kind: SessionKind;
  mood?: number; // mirrored from the related task when the user picks a mood
  subject?: string; // study subject tag for the per-subject chart
}

export type ChimeKind = "soft" | "bowl" | "retro" | "birds";

export interface WeeklyGoalState {
  minutes: number; // focus-minute target for the week (0 = goal off)
  celebratedWeek: string | null; // Monday date of the week whose reward was claimed
}

export interface Slot {
  id: string;
  start: string; // "HH:MM"
  end: string;
  title: string;
  kind: TaskKind;
  minutes: number;
  teacher?: string; // "Ngăn" — teacher shown under the subject
  session?: "morning" | "afternoon"; // buổi in the school grid
  tracked?: boolean; // false = display-only on the school grid: shown, but never auto-tasked
}

export interface TimetableDay {
  dayIndex: number; // 0 = Sunday ... 6 = Saturday (same as Date.getDay())
  label: string;
  slots: Slot[];
}

export interface Timetable {
  weekStartsOn: 0;
  days: TimetableDay[]; // always 7 items, days[0] = Sunday
  morningStart: string; // "HH:MM" — first morning period (quick import)
  afternoonStart: string; // "HH:MM" — first afternoon period (quick import)
  slotMinutes: number; // length of one period when importing without times
}

/** A one-off reminder outside the weekly grid: "Họp nhóm 20h", "Nộp bài tuần sau". */
export interface ExtraScheduleItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time: string | null; // "HH:MM" or null for all-day
  minutes: number; // 0 = no timer
  createdAt: string;
}

export interface GameState {
  level: number;
  xp: number;
  catCoins: number;
  lizardGems: number;
  spinTickets: number;
  spinHistory: { at: string; prize: string; mode?: SpinMode }[];
  freeSpinDate: string | null;
  wheelPity: number;
  totalSpins: number;
  jackpotsWon: number;
  water: { date: string; cups: number; rewarded: boolean; lastNudgePomodoros?: number };
  lastDailyPinDate: string | null;
  lastSalaryDate: string | null;
  [extra: string]: unknown;
}

export type AmbientSettingKind = "rain" | "ocean" | "campfire" | "cafe" | "night" | null;
export type ThemeMode = "auto" | "dark" | "light";

export interface AppSettings {
  themeMode: ThemeMode; // "auto" = light during the day sky band, dark otherwise
  pomodoroMinutes: number;
  customPresets: number[]; // user-saved durations (outside the built-in 15/25/50)
  ambient: { kind: AmbientSettingKind; volume: number };
  breakMinutes: number; // auto-break length after a Pomodoro (0 disables)
  autoBreak: boolean; // start the break automatically when a Pomodoro finishes
  fxSound: boolean; // play little effect sounds (tings, fanfares)
  chime: ChimeKind; // style of the Pomodoro-finished chime
  batterySaver: boolean; // lower 3D room resolution/effects to save battery
  navZodiac: string; // constellation id shown by the tab navigation sky
  personalStar: { name: string; x: number; y: number }; // the user's own star in the nav sky
  admin: boolean; // admin test mode: trial data in memory, backup download locked
  dragonTheme: boolean; // dragon skin: shimmering dragon-scale borders on buttons + starry-sky background
}

export interface AppData {
  app: "local-task-tracker-pro";
  version: 3;
  updatedAt: string;
  tasks: Task[];
  game: GameState;
  timetable: Timetable;
  timetableLog: string[]; // "YYYY-MM-DD:slotId" already pushed to today's list
  personal: Timetable; // lịch riêng ngoài giờ học — cùng cấu trúc TKB trường
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
  examScores: ExamScore[]; // per-subject test scores (see exams.ts)
  templates: TaskTemplate[];
  sessionLog: SessionEntry[];
  notes: NoteItem[];
  market: MarketState;
  subjects: string[]; // user-managed study subjects (max 12)
  subjectNotes: SubjectNoteMap; // per-subject note + weak/strong topic marks
  weekGoals: WeekGoal[]; // goals pinned for the whole week
  gradeBook: GradeEntry[]; // teacher-style grade columns per subject/semester (see grades.ts)
  gradeExtras: GradeExtra[]; // "điểm dư" side notes until promoted into a column
  gradeTargets: Record<string, number>; // per-subject target grade (see grades.ts)
  journal: JournalEntry[]; // hidden personal diary, opened from the wall bookshelf
  weeklyGoal: WeeklyGoalState;
  extraSchedule: ExtraScheduleItem[]; // quick one-off reminders (see tkb.ts)
  extraLog: string[]; // "YYYY-MM-DD:extraId" already pushed to the task list
  ownerName?: string; // display name in the header, editable
  [extra: string]: unknown;
}

export const DAY_LABELS = [
  "Chủ Nhật",
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
];
export const WATER_GOAL = 8;
export const EXERCISE_SESSIONS = 3;
export const POMODORO_PRESETS = [15, 25, 50] as const;

export const KIND_META: Record<TaskKind, { emoji: string; label: string; minutes: number }> = {
  water: { emoji: "💧", label: "Uống nước", minutes: 0 },
  exercise: { emoji: "🤸", label: "Tập thể dục 5p", minutes: 5 },
  pomodoro: { emoji: "📚", label: "Học bài 25p", minutes: 25 },
  custom: { emoji: "✍️", label: "Việc tự nhập", minutes: 0 },
};

export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export function dateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const xpForLevel = (level: number) => level * 100;

export function emptyTimetable(): Timetable {
  return {
    weekStartsOn: 0,
    days: DAY_LABELS.map((label, dayIndex) => ({ dayIndex, label, slots: [] })),
    morningStart: "07:30",
    afternoonStart: "13:00",
    slotMinutes: 45,
  };
}

export function defaultGame(today = dateStr()): GameState {
  return {
    level: 1,
    xp: 0,
    catCoins: 0,
    lizardGems: 0,
    spinTickets: 0,
    spinHistory: [],
    freeSpinDate: null,
    wheelPity: 0,
    totalSpins: 0,
    jackpotsWon: 0,
    water: { date: today, cups: 0, rewarded: false },
    lastDailyPinDate: null,
    lastSalaryDate: null,
  };
}

const clamp01 = (v: number, d: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);
/** Player level that permanently unlocks the dragon theme. */
export const DRAGON_UNLOCK_LEVEL = 5;

export function defaultSettings(): AppSettings {
  return {
    themeMode: "auto",
    pomodoroMinutes: POMODORO_MINUTES,
    customPresets: [],
    ambient: { kind: null, volume: 0.4 },
    batterySaver: false,
    breakMinutes: 5,
    autoBreak: true,
    fxSound: true,
    chime: "soft",
    navZodiac: DEFAULT_ZODIAC_ID,
    personalStar: { name: "", x: 92, y: 18 },
    admin: false,
    dragonTheme: false,
  };
}

export function defaultData(): AppData {
  return {
    app: "local-task-tracker-pro",
    version: 3,
    updatedAt: new Date().toISOString(),
    tasks: [],
    game: defaultGame(),
    timetable: emptyTimetable(),
    personal: emptyTimetable(),
    timetableLog: [],
    avatarBase64: null,
    petState: defaultPet(),
    streak: defaultStreak(dateStr()),
    inventory: defaultInventory(),
    settings: defaultSettings(),
    ...normalizeExtras(null),
    lastDiaryDate: dateStr(),
    backup: { lastBackupAt: null, lastReminderAt: null },
    quests: defaultQuests(),
    raid: defaultRaid(),
    exams: defaultExams(),
    examScores: [],
    gradeBook: [],
    gradeExtras: [],
    gradeTargets: {},
    templates: defaultTemplates(),
    sessionLog: [],
    notes: [],
    market: defaultMarket(),
    subjects: [],
    subjectNotes: {},
    weekGoals: [],
    journal: [],
    weeklyGoal: { minutes: 300, celebratedWeek: null },
    extraSchedule: [],
    extraLog: [],
  };
}

export function makeTask(
  title: string,
  kind: TaskKind,
  minutes: number,
  date: string,
  extra: Partial<Task> = {},
): Task {
  return {
    id: uid("task"),
    title,
    kind,
    minutes,
    remainingSeconds: minutes * 60,
    date,
    completed: false,
    completedAt: null,
    rewardClaimed: false,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Loose record view over unknown legacy-JSON values during migration. */
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const KINDS: TaskKind[] = ["pomodoro", "exercise", "water", "custom"];
const clampPomodoroMinutes = (v: unknown) => {
  const minutes = Math.round(num(v, POMODORO_MINUTES));
  return minutes >= 1 && minutes <= 180 ? minutes : POMODORO_MINUTES;
};
const normalizeCustomPresets = (v: unknown): number[] => {
  const toMin = (x: unknown) => {
    const n = Math.round(Number(x));
    return Number.isFinite(n) && n >= 1 && n <= 180 ? n : null;
  };
  return [...new Set((Array.isArray(v) ? v : []).map(toMin).filter((n): n is number => n !== null))]
    .filter((m) => !POMODORO_PRESETS.includes(m as (typeof POMODORO_PRESETS)[number]))
    .sort((a, b) => a - b)
    .slice(0, 4);
};

function normalizeSlot(input: unknown): Slot {
  const s = obj(input);
  const kind: TaskKind = (KINDS as readonly unknown[]).includes(s.kind)
    ? (s.kind as TaskKind)
    : "custom";
  return {
    id: typeof s.id === "string" ? s.id : uid("slot"),
    start: typeof s.start === "string" ? s.start : "08:00",
    end: typeof s.end === "string" ? s.end : "08:30",
    title: typeof s.title === "string" && s.title ? s.title : KIND_META[kind].label,
    kind,
    minutes: num(s.minutes, KIND_META[kind].minutes),
    ...(typeof s.teacher === "string" && s.teacher.trim() ? { teacher: s.teacher.trim() } : {}),
    ...(s.session === "morning" || s.session === "afternoon" ? { session: s.session } : {}),
    ...(s.tracked === false ? { tracked: false } : {}),
  };
}

export const EXTRA_SCHEDULE_MAX = 200;
export const EXTRA_TITLE_MAX = 80;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function hmTime(v: unknown, fallback: string): string {
  return typeof v === "string" && HM_RE.test(v.trim()) ? v.trim().padStart(5, "0") : fallback;
}

export function normalizeExtraSchedule(input: unknown): ExtraScheduleItem[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, EXTRA_SCHEDULE_MAX).flatMap((it) => {
    const s = obj(it);
    if (typeof s.title !== "string" || !s.title.trim()) return [];
    return [
      {
        id: typeof s.id === "string" ? s.id : uid("extra"),
        date: typeof s.date === "string" && DATE_RE.test(s.date) ? s.date : dateStr(),
        title: s.title.trim().slice(0, EXTRA_TITLE_MAX),
        time:
          typeof s.time === "string" && HM_RE.test(s.time.trim())
            ? s.time.trim().padStart(5, "0")
            : null,
        minutes: Math.min(600, Math.max(0, num(s.minutes, 0))),
        createdAt: typeof s.createdAt === "string" ? s.createdAt : new Date().toISOString(),
      },
    ];
  });
}

/** Accepts any old/new JSON and fills missing fields without losing old tasks. */
const clampPct = (v: unknown, d: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : d;

export function normalizePersonalStar(v: unknown): { name: string; x: number; y: number } {
  const raw = obj(v);
  return {
    name: typeof raw.name === "string" ? raw.name.slice(0, 24) : "",
    x: clampPct(raw.x, 92),
    y: clampPct(raw.y, 18),
  };
}

export type AdminBoostKind = "xp" | "catCoins" | "lizardGems" | "spinTickets" | "streak" | "petXp";
const ADMIN_KINDS: AdminBoostKind[] = [
  "xp",
  "catCoins",
  "lizardGems",
  "spinTickets",
  "streak",
  "petXp",
];
export function isAdminBoostKind(v: unknown): v is AdminBoostKind {
  return (ADMIN_KINDS as readonly unknown[]).includes(v);
}

/** Admin test mode: directly grant resources. No rewards, no history entries. */
export function applyAdminBoost(data: AppData, kind: AdminBoostKind, amount: number): AppData {
  const n = Math.round(amount);
  if (n === 0) return data;
  switch (kind) {
    case "xp":
      return { ...data, game: { ...data.game, xp: Math.max(0, data.game.xp + n) } };
    case "catCoins":
      return { ...data, game: { ...data.game, catCoins: Math.max(0, data.game.catCoins + n) } };
    case "lizardGems":
      return { ...data, game: { ...data.game, lizardGems: Math.max(0, data.game.lizardGems + n) } };
    case "spinTickets":
      return {
        ...data,
        game: { ...data.game, spinTickets: Math.max(0, data.game.spinTickets + n) },
      };
    case "streak":
      return {
        ...data,
        streak: {
          ...data.streak,
          count: Math.max(0, data.streak.count + n),
          best: Math.max(data.streak.best, data.streak.count + n),
        },
      };
    case "petXp":
      return {
        ...data,
        petState: { ...data.petState, petXp: Math.max(0, data.petState.petXp + n) },
      };
  }
}

export function migrate(raw: unknown): AppData {
  const base = defaultData();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const oldGame = obj(r.game ?? r.gameState);

  const tasks: Task[] = (Array.isArray(r.tasks) ? r.tasks : []).map((t) => {
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
  const srcRaw = r.timetable ?? oldGame.timetable;
  const srcObj = obj(srcRaw);
  if (Array.isArray(srcObj.days)) {
    srcObj.days.forEach((d, i) => {
      const dd = obj(d);
      const idx = typeof dd.dayIndex === "number" ? dd.dayIndex : i;
      if (idx >= 0 && idx < 7)
        tt.days[idx]!.slots = (Array.isArray(dd.slots) ? dd.slots : []).map(normalizeSlot);
    });
  } else if (Array.isArray(srcRaw)) {
    srcRaw.forEach((s) => {
      const ss = obj(s);
      const idx = num(ss.day ?? ss.dayIndex, -1);
      if (idx >= 0 && idx < 7) tt.days[idx]!.slots.push(normalizeSlot(ss));
    });
  }
  tt.days.forEach((d) => d.slots.sort((a, b) => a.start.localeCompare(b.start)));
  tt.morningStart = hmTime(srcObj.morningStart, tt.morningStart);
  tt.afternoonStart = hmTime(srcObj.afternoonStart, tt.afternoonStart);
  tt.slotMinutes = Array.isArray(srcRaw)
    ? tt.slotMinutes
    : Math.min(120, Math.max(15, num(srcObj.slotMinutes, tt.slotMinutes)));

  // Personal schedule (missing in older files → empty week).
  const pRaw = obj(r.personal);
  const ptt = emptyTimetable();
  if (Array.isArray(pRaw.days)) {
    pRaw.days.forEach((d, i) => {
      const dd = obj(d);
      const idx = typeof dd.dayIndex === "number" ? dd.dayIndex : i;
      if (idx >= 0 && idx < 7)
        ptt.days[idx]!.slots = (Array.isArray(dd.slots) ? dd.slots : []).map(normalizeSlot);
    });
  }
  ptt.days.forEach((d) => d.slots.sort((a, b) => a.start.localeCompare(b.start)));

  const { timetable: _old, ...gameRest } = oldGame;
  const game: GameState = {
    ...base.game,
    ...(gameRest as Partial<GameState>),
    level: Math.max(1, num(oldGame.level, 1)),
    xp: Math.max(0, num(oldGame.xp, 0)),
    catCoins: num(oldGame.catCoins, 0),
    lizardGems: num(oldGame.lizardGems, 0),
    spinTickets: num(oldGame.spinTickets, 0),
    spinHistory: Array.isArray(oldGame.spinHistory) ? oldGame.spinHistory : [],
    freeSpinDate: typeof oldGame.freeSpinDate === "string" ? oldGame.freeSpinDate : null,
    wheelPity: num(oldGame.wheelPity, 0),
    totalSpins: num(oldGame.totalSpins, 0),
    jackpotsWon: num(oldGame.jackpotsWon, 0),
    water: { ...base.game.water, ...obj(oldGame.water) },
    lastSalaryDate: typeof oldGame.lastSalaryDate === "string" ? oldGame.lastSalaryDate : null,
  };

  const { gameState: _g, ...rest } = r;
  const rawSettings = obj(r.settings);
  const ambientRaw = obj(rawSettings.ambient);
  const settings: AppSettings = {
    themeMode:
      rawSettings.themeMode === "light" || rawSettings.themeMode === "dark"
        ? rawSettings.themeMode
        : "auto",
    dragonTheme: rawSettings.dragonTheme === true,
    pomodoroMinutes: clampPomodoroMinutes(rawSettings.pomodoroMinutes),
    customPresets: normalizeCustomPresets(rawSettings.customPresets),
    ambient: {
      kind: (["rain", "ocean", "campfire", "cafe", "night"] as AmbientSettingKind[]).includes(
        ambientRaw.kind as AmbientSettingKind,
      )
        ? (ambientRaw.kind as AmbientSettingKind)
        : null,
      volume: clamp01(num(ambientRaw.volume, 0.4), 0.4),
    },
    breakMinutes: Math.min(30, Math.max(0, num(rawSettings.breakMinutes, 5))),
    autoBreak: rawSettings.autoBreak !== false,
    fxSound: rawSettings.fxSound !== false,
    chime: (["soft", "bowl", "retro", "birds"] as const).includes(rawSettings.chime as ChimeKind)
      ? (rawSettings.chime as ChimeKind)
      : "soft",
    batterySaver: rawSettings.batterySaver === true,
    navZodiac:
      typeof rawSettings.navZodiac === "string" && isValidZodiacId(rawSettings.navZodiac)
        ? rawSettings.navZodiac
        : DEFAULT_ZODIAC_ID,
    personalStar: normalizePersonalStar(rawSettings.personalStar),
    admin: rawSettings.admin === true,
  };
  const backupRaw = obj(r.backup);
  const questsRaw = obj(r.quests);
  const raidRaw = obj(r.raid);
  return {
    ...(rest as Partial<AppData>),
    app: "local-task-tracker-pro",
    version: 3,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : base.updatedAt,
    tasks,
    game,
    timetable: tt,
    personal: ptt,
    timetableLog: Array.isArray(r.timetableLog) ? r.timetableLog : [],
    extraSchedule: normalizeExtraSchedule(r.extraSchedule),
    extraLog: Array.isArray(r.extraLog)
      ? r.extraLog.filter((k): k is string => typeof k === "string")
      : [],
    avatarBase64: typeof r.avatarBase64 === "string" ? r.avatarBase64 : null,
    petState: normalizePet(r.petState),
    streak:
      r.streak && typeof r.streak === "object"
        ? {
            ...base.streak,
            ...(r.streak as Partial<StreakState>),
            freezeActive: (r.streak as Record<string, unknown>).freezeActive === true,
            today: {
              ...base.streak.today,
              ...obj((r.streak as Record<string, unknown>).today),
            },
            restDates: Array.isArray((r.streak as Record<string, unknown>).restDates)
              ? ((r.streak as Record<string, unknown>).restDates as unknown[]).filter(
                  (x) => typeof x === "string",
                )
              : [],
          }
        : { ...base.streak, freezeActive: false, restDates: [] },
    settings,
    ...extrasFrom(r),
    inventory: {
      items: { ...(obj(obj(r.inventory).items) as Record<string, number>) },
      freezes: num(obj(r.inventory).freezes, 0),
      materials: normalizeExtras(r).materials,
    },
    backup: {
      lastBackupAt: typeof backupRaw.lastBackupAt === "string" ? backupRaw.lastBackupAt : null,
      lastReminderAt:
        typeof backupRaw.lastReminderAt === "string" ? backupRaw.lastReminderAt : null,
    },
    quests: {
      date: typeof questsRaw.date === "string" ? questsRaw.date : null,
      claimed: Array.isArray(questsRaw.claimed)
        ? questsRaw.claimed.filter((x: unknown) => typeof x === "string")
        : [],
    },
    raid: {
      weekStart: typeof raidRaw.weekStart === "string" ? raidRaw.weekStart : null,
      claimed: raidRaw.claimed === true,
    },
    exams: normalizeExams(r.exams),
    examScores: normalizeExamScores(r.examScores),
    templates: normalizeTemplates(r.templates),
    sessionLog: normalizeSessionLog(r.sessionLog),
    notes: normalizeNotes(r.notes),
    market: normalizeMarket(r.market),
    subjects: Array.isArray(r.subjects)
      ? [
          ...new Set(
            r.subjects
              .filter((x: unknown): x is string => typeof x === "string")
              .map((x: string) => x.trim().slice(0, 24))
              .filter(Boolean),
          ),
        ].slice(0, 12)
      : [],
    weeklyGoal: {
      minutes: Math.min(10080, Math.max(0, Math.round(num(obj(r.weeklyGoal).minutes, 300)))),
      celebratedWeek:
        typeof obj(r.weeklyGoal).celebratedWeek === "string"
          ? (obj(r.weeklyGoal).celebratedWeek as string)
          : null,
    },
    subjectNotes: normalizeSubjectNotes(r.subjectNotes),
    gradeBook: normalizeGradeEntries(r.gradeBook),
    gradeExtras: normalizeGradeExtras(r.gradeExtras),
    gradeTargets: normalizeGradeTargets(r.gradeTargets),
    weekGoals: normalizeWeekGoals(r.weekGoals),
    journal: normalizeJournal(r.journal),
    ...(typeof r.ownerName === "string" && r.ownerName.trim()
      ? { ownerName: r.ownerName.trim().slice(0, 30) }
      : {}),
  };
}

export const NOTES_MAX = 20;

const noteDoneToday = (n: NoteItem, today: string) => n.lastDoneDate === today;

/** Counts how many routine notes are checked off for the given day. */
export function notesDoneCount(notes: NoteItem[], today = dateStr()): number {
  return notes.filter((n) => noteDoneToday(n, today)).length;
}

export function addNote(data: AppData, title: string, now = new Date()): AppData {
  const clean = title.trim().slice(0, 120);
  if (!clean || data.notes.length >= NOTES_MAX) return data;
  const note: NoteItem = {
    id: uid("note"),
    title: clean,
    lastDoneDate: null,
    createdAt: now.toISOString(),
  };
  return { ...data, notes: [...data.notes, note] };
}

/** Checks a note off for today (or unchecks it); the check itself does not touch XP, streak or coins. */
export function toggleNote(data: AppData, noteId: string, today = dateStr()): AppData {
  const notes = data.notes.map((n) =>
    n.id === noteId ? { ...n, lastDoneDate: noteDoneToday(n, today) ? null : today } : n,
  );
  return { ...data, notes };
}

export function renameNote(data: AppData, noteId: string, title: string): AppData {
  const clean = title.trim().slice(0, 120);
  if (!clean) return data;
  return { ...data, notes: data.notes.map((n) => (n.id === noteId ? { ...n, title: clean } : n)) };
}

export function removeNote(data: AppData, noteId: string): AppData {
  return { ...data, notes: data.notes.filter((n) => n.id !== noteId) };
}

/** Accepts any old/new JSON for the routine notes and keeps the newest 20 well-formed rows. */
export function normalizeMarket(raw: unknown): MarketState {
  if (!raw || typeof raw !== "object") return defaultMarket();
  const r = raw as Record<string, unknown>;
  const bought: MarketState["bought"] = {};
  if (r.bought && typeof r.bought === "object") {
    for (const [k, v] of Object.entries(r.bought as Record<string, unknown>)) {
      if (typeof v === "string") bought[k as keyof MarketState["bought"]] = v;
    }
  }
  return {
    lastWeek: typeof r.lastWeek === "string" ? r.lastWeek : null,
    bought,
  };
}

export function normalizeNotes(raw: unknown): NoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .filter((n) => typeof n["title"] === "string" && (n["title"] as string).trim())
    .map((n) => ({
      id: typeof n["id"] === "string" ? n["id"] : uid("note"),
      title: (n["title"] as string).trim().slice(0, 120),
      lastDoneDate: typeof n["lastDoneDate"] === "string" ? n["lastDoneDate"] : null,
      createdAt: typeof n["createdAt"] === "string" ? n["createdAt"] : new Date().toISOString(),
    }))
    .slice(0, NOTES_MAX);
}

/** Keeps the last 400 focus-session entries and drops malformed rows from old files. */
function normalizeSessionLog(raw: unknown): SessionEntry[] {
  if (!Array.isArray(raw)) return [];
  const rows = raw.filter((s): s is Record<string, unknown> => !!s && typeof s === "object");
  return rows
    .filter((s) => typeof s["at"] === "string")
    .map((s) => {
      const mood = Math.min(4, Math.max(1, Math.round(num(s["mood"], 0))));
      const subject =
        typeof s["subject"] === "string" && s["subject"].trim()
          ? s["subject"].trim().slice(0, 24)
          : undefined;
      return {
        at: s["at"] as string,
        minutes: num(s["minutes"], 0),
        kind: s["kind"] === "warmup" ? ("warmup" as const) : ("pomodoro" as const),
        ...(mood >= 1 ? { mood } : {}),
        ...(subject ? { subject } : {}),
      };
    })
    .slice(-400);
}

function extrasFrom(r: unknown) {
  const { materials: _m, ...e } = normalizeExtras(r);
  return e;
}

/** Saves the 1..4 mood the user felt right after finishing a timed task; mirrors it into the session log. */
export function setTaskMood(data: AppData, taskId: string, mood: number): AppData {
  const m = Math.min(4, Math.max(1, Math.round(mood)));
  const tasks = data.tasks.map((t) => (t.id === taskId ? { ...t, mood: m } : t));
  const done = tasks.find((t) => t.id === taskId);
  const sessionLog =
    done?.completedAt && done.minutes > 0
      ? data.sessionLog.map((s) => (s.at === done.completedAt ? { ...s, mood: m } : s))
      : data.sessionLog;
  return { ...data, tasks, sessionLog };
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
  data: AppData;
  rewarded: boolean;
  levelsGained: number;
  drop: MaterialId | null;
  petEvolved: boolean;
  petLevels: number;
  fresh: AchievementId[];
}

export function addMaterial(data: AppData, id: MaterialId | null, n = 1): AppData {
  if (!id) return data;
  const m = data.inventory.materials;
  return { ...data, inventory: { ...data.inventory, materials: { ...m, [id]: (m[id] ?? 0) + n } } };
}

/** Unlocks hidden achievements; rewards are claimed manually from the map. */
export function applyAchievements(
  data: AppData,
  ctx: { nightOwl?: boolean },
  now = new Date(),
): { data: AppData; fresh: AchievementId[] } {
  const r = checkAchievements(
    data.achievements,
    { pet: data.petState, nightOwl: !!ctx.nightOwl },
    now,
  );
  if (!r.fresh.length) return { data, fresh: [] };
  return {
    fresh: r.fresh,
    data: {
      ...data,
      achievements: r.achievements,
      claimedAchievements: { ...r.achievements.claimed },
    },
  };
}

export function claimAchievementReward(
  data: AppData,
  id: AchievementId,
  now = new Date(),
): AppData | null {
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
export function completeTask(
  data: AppData,
  taskId: string,
  now = new Date(),
  rng: () => number = Math.random,
  xpMult = 1,
): CompleteResult {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || task.completed || task.rewardClaimed)
    return {
      data,
      rewarded: false,
      levelsGained: 0,
      drop: null,
      petEvolved: false,
      petLevels: 0,
      fresh: [],
    };
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
    dailyStats: bumpStats(data.dailyStats, today, {
      tasks: 1,
      ...(task.kind === "pomodoro" ? { focusMin: task.minutes, pomodoros: 1 } : {}),
    }),
    game: {
      ...game,
      catCoins: game.catCoins + r.cat,
      lizardGems: game.lizardGems + r.lizard,
      spinTickets: game.spinTickets + r.spins,
    },
    tasks: data.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            completed: true,
            rewardClaimed: true,
            remainingSeconds: 0,
            completedAt: now.toISOString(),
          }
        : t,
    ),
    sessionLog:
      task.kind === "pomodoro"
        ? [
            ...data.sessionLog,
            {
              at: now.toISOString(),
              minutes: task.minutes,
              kind: "pomodoro" as const,
              ...(task.subject ? { subject: task.subject } : {}),
            },
          ].slice(-400)
        : data.sessionLog,
  };
  const ach = applyAchievements(addMaterial(base, drop), { nightOwl: isNightOwlHour(now) }, now);
  return {
    rewarded: true,
    levelsGained,
    drop,
    petEvolved: pet.evolved,
    petLevels: pet.levelsGained,
    fresh: ach.fresh,
    data: ach.data,
  };
}

// ---- Edit task ----
export interface TaskEdit {
  title?: string;
  kind?: TaskKind;
  minutes?: number;
  date?: string;
  remindAt?: string | null; // "HH:MM" or null to clear
}

/** Edits an unfinished task. Completed or already-rewarded tasks are locked. Returns null when not editable. */
export function editTask(
  data: AppData,
  taskId: string,
  patch: TaskEdit,
  now = new Date(),
): AppData | null {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || task.completed || task.rewardClaimed) return null;
  const minutes =
    patch.minutes !== undefined
      ? Math.max(0, Math.round(num(patch.minutes, task.minutes)))
      : task.minutes;
  const kind = patch.kind && KINDS.includes(patch.kind) ? patch.kind : task.kind;
  const title =
    patch.title !== undefined ? patch.title.trim() || KIND_META[kind].label : task.title;
  const date =
    typeof patch.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(patch.date)
      ? patch.date
      : task.date;
  const remindAt =
    patch.remindAt === undefined
      ? task.remindAt
      : patch.remindAt && HHMM_RE.test(patch.remindAt)
        ? patch.remindAt
        : undefined;
  const moved = date !== task.date;
  const retimed = minutes !== task.minutes || kind !== task.kind;
  return {
    ...data,
    updatedAt: now.toISOString(),
    tasks: data.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const next = { ...t, title, kind, minutes, date };
      if (patch.remindAt !== undefined) {
        if (remindAt) next.remindAt = remindAt;
        else delete next.remindAt;
      }
      // New duration or kind → restart the countdown; moving days drops the old timetable badge.
      if (retimed) next.remainingSeconds = minutes * 60;
      if (moved) {
        delete next.timeRange;
        delete next.fromSlotId;
      }
      return next;
    }),
  };
}

// ---- Water nudge (every 2 Pomodoro sessions) ----
/** True right after every 2nd finished Pomodoro of the day while the water goal is not reached (once per count). */
export function shouldNudgeWater(data: AppData, now = new Date()): boolean {
  const today = dateStr(now);
  const pomodoros = data.dailyStats[today]?.pomodoros ?? 0;
  if (pomodoros < 2 || pomodoros % 2 !== 0) return false;
  const w = data.game.water;
  const cups = w.date === today ? w.cups : 0;
  if (cups >= WATER_GOAL) return false;
  return w.lastNudgePomodoros !== pomodoros;
}

/** Marks the current Pomodoro count as already nudged so the reminder does not repeat this session. */
export function markWaterNudged(data: AppData, now = new Date()): AppData {
  const today = dateStr(now);
  const pomodoros = data.dailyStats[today]?.pomodoros ?? 0;
  const water =
    data.game.water.date === today
      ? { ...data.game.water, lastNudgePomodoros: pomodoros }
      : { date: today, cups: 0, rewarded: false, lastNudgePomodoros: pomodoros };
  return { ...data, game: { ...data.game, water } };
}

/** Pet-widget Pomodoro finished: logs focus time, records a completed "Pomodoro focus" entry (no extra reward), checks Night Owl. */
export function completePomodoroSession(
  data: AppData,
  minutes: number,
  now = new Date(),
  kind: SessionKind = "pomodoro",
): { data: AppData; fresh: AchievementId[] } {
  const today = dateStr(now);
  const focusToday = (data.dailyStats[today]?.focusMin ?? 0) + minutes;
  const achievements = bumpLifetime(data.achievements, { focusMin: minutes, pomodoros: 1 });
  const record = makeTask(
    kind === "warmup" ? `Khởi động (${minutes} phút)` : `Phiên tập trung (${minutes} phút)`,
    "pomodoro",
    minutes,
    today,
    {
      completed: true,
      rewardClaimed: true,
      remainingSeconds: 0,
      completedAt: now.toISOString(),
    },
  );
  const sessionLog = [...data.sessionLog, { at: now.toISOString(), minutes, kind }].slice(-400);
  const d = {
    ...data,
    achievements,
    claimedAchievements: { ...achievements.claimed },
    expedition: startExpedition(data.expedition, focusToday, now),
    dailyStats: bumpStats(data.dailyStats, dateStr(now), { focusMin: minutes, pomodoros: 1 }),
    tasks: [...data.tasks, record],
    sessionLog,
  };
  return applyAchievements(d, { nightOwl: isNightOwlHour(now) }, now);
}

// ---- Daily salary ----
/** Wages for simply showing up: 1 + level, capped at 15 😺/day. */
export const dailySalary = (level: number) => Math.min(15, 1 + level);

/** Pays the daily salary once per calendar day. Pure: returns the updated data. */
export function claimDailySalary(
  data: AppData,
  today = dateStr(),
): { data: AppData; coins: number } {
  if (data.game.lastSalaryDate === today) return { data, coins: 0 };
  const coins = dailySalary(data.game.level);
  return {
    data: {
      ...data,
      game: { ...data.game, catCoins: data.game.catCoins + coins, lastSalaryDate: today },
    },
    coins,
  };
}

// ---- Daily quests & weekly raid ----
/** Claims a daily quest reward when its target is met. Resets automatically on a new day. */
export function claimQuest(
  data: AppData,
  questId: string,
  now = new Date(),
): { data: AppData; ok: boolean } {
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
      game: {
        ...data.game,
        catCoins: data.game.catCoins + quest.reward.catCoins,
        lizardGems: data.game.lizardGems + quest.reward.lizardGems,
      },
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
      game: {
        ...data.game,
        catCoins: data.game.catCoins + RAID_REWARD.catCoins,
        lizardGems: data.game.lizardGems + RAID_REWARD.lizardGems,
      },
    },
  };
}

// ---- Backup reminder ----
// ---- Exam countdown ----
/** Adds an exam event. No-op when the name or date is invalid. */
export function addExam(
  data: AppData,
  name: string,
  date: string,
  extra: Partial<Pick<ExamEvent, "buoi" | "gioBatDau" | "thoiGian" | "khoi">> = {},
  now = new Date(),
): AppData {
  const clean = name.trim();
  if (!clean || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return data;
  const exam: ExamEvent = {
    id: newExamId(),
    name: clean,
    date,
    ...normalizeExamExtras(extra),
  };
  return { ...data, exams: [...data.exams, exam], updatedAt: now.toISOString() };
}

/** Edits an exam event (name, date, session details). No-op for unknown ids or a bad date. */
export function updateExam(
  data: AppData,
  examId: string,
  patch: Partial<Pick<ExamEvent, "name" | "date" | "buoi" | "gioBatDau" | "thoiGian" | "khoi">>,
  now = new Date(),
): AppData {
  if (!data.exams.some((e) => e.id === examId)) return data;
  if (patch.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) return data;
  if (patch.name !== undefined && !patch.name.trim()) return data;
  const extras = normalizeExamExtras(patch);
  return {
    ...data,
    exams: data.exams.map((e) => {
      if (e.id !== examId) return e;
      const out: ExamEvent = { ...e };
      if (patch.name !== undefined) out.name = patch.name.trim();
      if (patch.date !== undefined) out.date = patch.date;
      // a present-but-invalid/empty optional field clears it instead of keeping the old value
      if (patch.buoi !== undefined) {
        if (extras.buoi) out.buoi = extras.buoi;
        else delete out.buoi;
      }
      if (patch.gioBatDau !== undefined) {
        if (extras.gioBatDau) out.gioBatDau = extras.gioBatDau;
        else delete out.gioBatDau;
      }
      if (patch.thoiGian !== undefined) {
        if (extras.thoiGian) out.thoiGian = extras.thoiGian;
        else delete out.thoiGian;
      }
      if (patch.khoi !== undefined) {
        if (extras.khoi) out.khoi = extras.khoi;
        else delete out.khoi;
      }
      return out;
    }),
    updatedAt: now.toISOString(),
  };
}

/** Trims/validates the optional exam session fields; unknown fields are dropped. */
function normalizeExamExtras(
  extra: Partial<Pick<ExamEvent, "buoi" | "gioBatDau" | "thoiGian" | "khoi">>,
): Partial<ExamEvent> {
  const out: Partial<ExamEvent> = {};
  const buoi = typeof extra.buoi === "string" ? extra.buoi.trim().slice(0, 8) : undefined;
  const thoiGian =
    typeof extra.thoiGian === "string" ? extra.thoiGian.trim().slice(0, 20) : undefined;
  const khoi = typeof extra.khoi === "string" ? extra.khoi.trim().slice(0, 20) : undefined;
  if (buoi) out.buoi = buoi;
  if (typeof extra.gioBatDau === "string" && /^\d{1,2}:\d{2}$/.test(extra.gioBatDau.trim())) {
    out.gioBatDau = extra.gioBatDau.trim();
  }
  if (thoiGian) out.thoiGian = thoiGian;
  if (khoi) out.khoi = khoi;
  return out;
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
export function setTaskExam(
  data: AppData,
  taskId: string,
  examId: string | null,
  now = new Date(),
): AppData {
  if (examId && !data.exams.some((e) => e.id === examId)) return data;
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, examId: examId ?? undefined } : t)),
    updatedAt: now.toISOString(),
  };
}

/** Saves a task's shape as a reusable template. No-op for blank titles or exact duplicates. */
export function saveTaskAsTemplate(
  data: AppData,
  shape: Pick<Task, "title" | "kind" | "minutes">,
  now = new Date(),
): AppData {
  const title = shape.title.trim();
  if (!title) return data;
  if (
    data.templates.some(
      (t) => t.title === title && t.kind === shape.kind && t.minutes === shape.minutes,
    )
  )
    return data;
  const template: TaskTemplate = {
    id: newTemplateId(),
    title,
    kind: shape.kind,
    minutes: shape.minutes,
  };
  return { ...data, templates: [...data.templates, template], updatedAt: now.toISOString() };
}

/** Creates a task from a template for the given date. Returns null for unknown template ids. */
export function taskFromTemplate(
  data: AppData,
  templateId: string,
  date: string,
  now = new Date(),
): { data: AppData; task: Task } | null {
  const tpl = data.templates.find((t) => t.id === templateId);
  if (!tpl) return null;
  const task = makeTask(tpl.title, tpl.kind, tpl.minutes, date);
  return { data: { ...data, tasks: [...data.tasks, task], updatedAt: now.toISOString() }, task };
}

/** Removes a template. Existing tasks stay untouched. */
export function removeTemplate(data: AppData, templateId: string, now = new Date()): AppData {
  if (!data.templates.some((t) => t.id === templateId)) return data;
  return {
    ...data,
    templates: data.templates.filter((t) => t.id !== templateId),
    updatedAt: now.toISOString(),
  };
}

export const BACKUP_REMINDER_DAYS = 7;
const REMINDER_SNOOZE_MS = 24 * 60 * 60 * 1000;
/** True when the last backup is older than 7 days (or never) and the banner was not snoozed in the last 24h. */
export function needsBackupReminder(data: AppData, now = new Date()): boolean {
  const { lastBackupAt, lastReminderAt } = data.backup;
  const backupMs = lastBackupAt ? new Date(lastBackupAt).getTime() : NaN;
  const stale =
    !Number.isFinite(backupMs) ||
    now.getTime() - backupMs >= BACKUP_REMINDER_DAYS * 24 * 60 * 60 * 1000;
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
    const keys = new Set(
      next.tasks.filter((t) => t.pinned && t.date === today).map((t) => `${t.kind}|${t.title}`),
    );
    const keep = new Set<string>();
    [...old]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((t) => {
        const k = `${t.kind}|${t.title}`;
        if (!keys.has(k)) {
          keys.add(k);
          keep.add(t.id);
        }
      });
    next = {
      ...next,
      tasks: next.tasks
        .filter((t) => !(t.pinned && t.date < today) || keep.has(t.id))
        .map((t) =>
          keep.has(t.id)
            ? {
                ...t,
                date: today,
                completed: false,
                completedAt: null,
                rewardClaimed: false,
                remainingSeconds: t.minutes * 60,
              }
            : t,
        ),
    };
  }
  const sc = checkStreak(next.streak, next.inventory, today);
  if (sc.streak !== next.streak) next = { ...next, streak: sc.streak, inventory: sc.inventory };
  // Pet's adventure diary for the previous day, once per new calendar day.
  if (next.lastDiaryDate !== today) {
    if (next.lastDiaryDate) {
      const y = shiftDate(today, -1);
      const entry = writeDiary(y, next.dailyStats[y], {
        petName: SPECIES[next.petState.species].name,
        freezeUsed: sc.usedFreeze,
        streakBroke: sc.broke,
      });
      next = {
        ...next,
        adventureLog: [entry, ...next.adventureLog.filter((e) => e.date !== y)].slice(0, 60),
      };
    }
    next = { ...next, lastDiaryDate: today };
  }
  if (next.game.lastDailyPinDate !== today) {
    const hasExercise = next.tasks.some(
      (t) => t.pinned && t.kind === "exercise" && t.date === today,
    );
    const pins = hasExercise
      ? []
      : Array.from({ length: EXERCISE_SESSIONS }, (_, i) =>
          makeTask(`Tập thể dục giãn cơ (5 phút) #${i + 1}`, "exercise", 5, today, {
            pinned: true,
          }),
        );
    next = {
      ...next,
      tasks: [...next.tasks, ...pins],
      game: { ...next.game, lastDailyPinDate: today },
    };
  }
  return next;
}

export function addWaterCup(
  data: AppData,
  now = new Date(),
): { data: AppData; goalReached: boolean; levelsGained: number; fresh: AchievementId[] } {
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
    game = {
      ...bonus.game,
      catCoins: bonus.game.catCoins + 1,
      spinTickets: bonus.game.spinTickets + 1,
      water: { ...game.water, rewarded: true },
    };
    levelsGained += bonus.levelsGained;
    goalReached = true;
  }
  let next: AppData = {
    ...data,
    game,
    dailyStats: bumpStats(data.dailyStats, today, { water: 1 }),
  };
  if (goalReached) next = { ...next, achievements: recordWaterGoal(next.achievements, today) };
  const ach = applyAchievements(next, {}, now);
  return { data: ach.data, goalReached, levelsGained, fresh: ach.fresh };
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

const personalOf = (data: AppData, dayIndex: number): Slot[] =>
  data.personal?.days?.[dayIndex]?.slots ?? [];

/** Pushes personal-schedule slots whose start time has arrived (for today's weekday) into today's tasks, once per day per slot.
 * School TKB periods are display-only: they feed "Học trước cho ngày mai" but never auto-create tasks. */
export function pushDueSlots(data: AppData, now = new Date()): { data: AppData; pushed: Slot[] } {
  const today = dateStr(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const due = personalOf(data, now.getDay()).filter(
    (s) =>
      s.tracked !== false &&
      toMin(s.start) <= nowMin &&
      !data.timetableLog.includes(`${today}:p:${s.id}`),
  );
  if (!due.length) return { data, pushed: [] };
  const newTasks = due.map((s) =>
    makeTask(s.title, s.kind, s.minutes, today, {
      fromSlotId: s.id,
      timeRange: `${s.start} - ${s.end}`,
    }),
  );
  const log = [
    ...data.timetableLog.filter((k) => k >= today.slice(0, 10)),
    ...due.map((s) => `${today}:p:${s.id}`),
  ];
  return { data: { ...data, tasks: [...data.tasks, ...newTasks], timetableLog: log }, pushed: due };
}

export const WHEEL_PRIZES = ["+10 XP", "+2 😺", "+1 🦎", "+30 XP", "+1 🎡", "+5 😺", "+15 XP"];

/** Vòng quay mở rộng: jackpot + pity + mega cuối tuần + lượt miễn phí mỗi ngày. */
export const JACKPOT_PRIZE = "🎰 JACKPOT";
export const JACKPOT_TICKETS = 10;
export const MEGA_PRIZES = ["+20 XP", "+4 😺", "+2 🦎", "+60 XP", "+2 🎡", "+10 😺", "+80 XP"];
export const PITY_LIMIT = 25;
export type SpinMode = "normal" | "free" | "mega";
export const SPIN_COST: Record<SpinMode, number> = { normal: 1, free: 0, mega: 2 };
export const FREE_SPIN_LABEL = "🎁 Lượt miễn phí";

export function applyPrize(
  game: GameState,
  prize: string,
): { game: GameState; levelsGained: number } {
  if (prize === JACKPOT_PRIZE)
    return { game: { ...game, spinTickets: game.spinTickets + JACKPOT_TICKETS }, levelsGained: 0 };
  const n = parseInt(prize.replace(/[^0-9]/g, ""), 10) || 0;
  if (prize.includes("XP")) return addXp(game, n);
  if (prize.includes("😺"))
    return { game: { ...game, catCoins: game.catCoins + n }, levelsGained: 0 };
  if (prize.includes("🦎"))
    return { game: { ...game, lizardGems: game.lizardGems + n }, levelsGained: 0 };
  return { game: { ...game, spinTickets: game.spinTickets + n }, levelsGained: 0 };
}

/** Weighted roll; jackpot is rare but guaranteed once pity reaches the limit. */
export function rollWheel(
  mode: SpinMode,
  pity: number,
  rng: () => number = Math.random,
): { prize: string; jackpot: boolean } {
  if (pity >= PITY_LIMIT - 1) return { prize: JACKPOT_PRIZE, jackpot: true };
  const prizes = mode === "mega" ? MEGA_PRIZES : WHEEL_PRIZES;
  const jackpotWeight = mode === "mega" ? 0.15 : 0.07;
  const roll = rng() * (prizes.length + jackpotWeight);
  if (roll >= prizes.length) return { prize: JACKPOT_PRIZE, jackpot: true };
  return { prize: prizes[Math.floor(roll)]!, jackpot: false };
}

export function isWeekend(now = new Date()): boolean {
  const d = now.getDay();
  return d === 0 || d === 6;
}

/** Whether this spin mode is allowed right now (tickets, once-per-day free, weekend mega). */
export function canSpin(game: GameState, mode: SpinMode, now = new Date()): boolean {
  if (game.spinTickets < SPIN_COST[mode]) return false;
  if (mode === "free") return game.freeSpinDate !== dateStr(now);
  if (mode === "mega") return isWeekend(now);
  return true;
}

/** Phase 1 of a spin: consume the cost, lock the free spin, roll the prize. Caller checked canSpin. */
export function beginSpin(
  game: GameState,
  mode: SpinMode,
  now = new Date(),
  rng: () => number = Math.random,
): { game: GameState; prize: string; jackpot: boolean } {
  const { prize, jackpot } = rollWheel(mode, game.wheelPity, rng);
  const next: GameState = { ...game, spinTickets: game.spinTickets - SPIN_COST[mode] };
  if (mode === "free") next.freeSpinDate = dateStr(now);
  return { game: next, prize, jackpot };
}

/** Phase 2 of a spin (after the wheel animation): grant the prize and record stats/history. */
export function recordSpin(
  game: GameState,
  prize: string,
  jackpot: boolean,
  mode: SpinMode,
  at = new Date().toISOString(),
): { game: GameState; levelsGained: number } {
  const r = applyPrize(game, prize);
  return {
    levelsGained: r.levelsGained,
    game: {
      ...r.game,
      wheelPity: jackpot ? 0 : r.game.wheelPity + 1,
      totalSpins: r.game.totalSpins + 1,
      jackpotsWon: r.game.jackpotsWon + (jackpot ? 1 : 0),
      spinHistory: [{ at, prize, mode }, ...r.game.spinHistory].slice(0, 50),
    },
  };
}

/** "Đồng bộ nhanh lịch hôm nay": add every personal-schedule slot of today not yet in the list (school TKB stays display-only). */
export function syncTodaySlots(data: AppData, now = new Date()): { data: AppData; added: number } {
  const today = dateStr(now);
  const notPushed = (s: Slot, logKey: string) =>
    !data.timetableLog.includes(logKey) &&
    !data.tasks.some((t) => t.date === today && t.fromSlotId === s.id);
  const todo = personalOf(data, now.getDay())
    .filter((s) => s.tracked !== false && notPushed(s, `${today}:p:${s.id}`))
    .map((s) => ({ s, key: `${today}:p:${s.id}` }));
  if (!todo.length) return { data, added: 0 };
  const newTasks = todo.map(({ s }) =>
    makeTask(s.title, s.kind, s.minutes, today, {
      fromSlotId: s.id,
      timeRange: `${s.start} - ${s.end}`,
    }),
  );
  return {
    data: {
      ...data,
      tasks: [...data.tasks, ...newTasks],
      timetableLog: [...data.timetableLog, ...todo.map(({ key }) => key)],
    },
    added: todo.length,
  };
}

/** Slots starting in exactly <=5 minutes (and not yet started) today. */
export function upcomingSlots(data: AppData, now = new Date(), leadMin = 5): Slot[] {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return [
    ...(data.timetable.days[now.getDay()]?.slots ?? []),
    ...personalOf(data, now.getDay()),
  ].filter((s) => {
    const d = toMin(s.start) - nowMin;
    return d > 0 && d <= leadMin;
  });
}

/** The slot running right now (start <= now < end), or null. */
export function runningSlotToday(data: AppData, now = new Date()): Slot | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    [...(data.timetable.days[now.getDay()]?.slots ?? []), ...personalOf(data, now.getDay())].find(
      (s) => toMin(s.start) <= nowMin && nowMin < toMin(s.end),
    ) ?? null
  );
}

/** The next timetable slot today that has not started yet, or null when the day is done. */
export function nextSlotToday(data: AppData, now = new Date()): Slot | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    [...(data.timetable.days[now.getDay()]?.slots ?? []), ...personalOf(data, now.getDay())]
      .sort((a, b) => toMin(a.start) - toMin(b.start))
      .find((s) => toMin(s.start) > nowMin) ?? null
  );
}

// ---- Study subjects & per-subject chart ----

export const SUBJECTS_MAX = 12;
export const SUBJECT_MAX_LEN = 24;
export const UNTAGGED_LABEL = "Chưa gán";

function cleanSubjectName(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, SUBJECT_MAX_LEN) : "";
}

/** Adds a new study subject. Returns null when the name is empty, duplicated or the list is full. */
export function addSubject(data: AppData, name: string): AppData | null {
  const n = cleanSubjectName(name);
  if (!n) return null;
  if (data.subjects.some((x) => x.toLowerCase() === n.toLowerCase())) return null;
  if (data.subjects.length >= SUBJECTS_MAX) return null;
  return { ...data, subjects: [...data.subjects, n] };
}

/** Removes a subject from the picker list. History (tasks/sessions) keeps its tag; its note is dropped. */
export function removeSubject(data: AppData, name: string): AppData {
  const withoutSubject = { ...data, subjects: data.subjects.filter((x) => x !== name) };
  return removeSubjectNote(withoutSubject, name);
}

/** Tags (or untags with null) an unfinished task with a study subject. */
export function setTaskSubject(
  data: AppData,
  taskId: string,
  subject: string | null,
): AppData | null {
  const task = data.tasks.find((t) => t.id === taskId);
  if (!task || task.completed || task.rewardClaimed) return null;
  const tag = subject && data.subjects.includes(subject) ? subject : undefined;
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id !== taskId) return t;
      if (!tag) {
        const withoutSubject = Object.fromEntries(
          Object.entries(t).filter(([k]) => k !== "subject"),
        ) as Task;
        return withoutSubject;
      }
      return { ...t, subject: tag };
    }),
  };
}
