// Pure rules for v3 premium extras: materials & alchemy, pet evolution, achievements,
// adventure diary, daily stats/weekly chronicle, weather. No browser APIs.
import { daysBetween, shiftDate, type Accessory, type PetState, type Species } from "./gamify";

export type MaterialId = "magicFeather" | "starShard" | "mysticHerb";
export const MATERIALS: Record<MaterialId, { emoji: string; name: string }> = {
  magicFeather: { emoji: "🪶", name: "Lông Vũ Ma Thuật" },
  starShard: { emoji: "🌟", name: "Mảnh Sao" },
  mysticHerb: { emoji: "🌿", name: "Thảo Dược Huyền Bí" },
};
export const MATERIAL_IDS = Object.keys(MATERIALS) as MaterialId[];
export const DROP_CHANCE = 0.2;

/** 20% chance to drop one random material. `rng` returns [0,1). */
export function rollDrop(rng: () => number = Math.random): MaterialId | null {
  if (rng() >= DROP_CHANCE) return null;
  return MATERIAL_IDS[Math.min(MATERIAL_IDS.length - 1, Math.floor(rng() * MATERIAL_IDS.length))]!;
}

export type Materials = Record<MaterialId, number>;
export const emptyMaterials = (): Materials => ({ magicFeather: 0, starShard: 0, mysticHerb: 0 });

export interface Recipe {
  id: string; name: string; emoji: string; cost: Partial<Materials>;
  result: { accessory: Accessory } | { freezes: number };
}
export const RECIPES: Recipe[] = [
  { id: "wings", name: "Cánh Thiên Thần", emoji: "🪽", cost: { magicFeather: 3, starShard: 2 }, result: { accessory: "wings" } },
  { id: "freeze", name: "Bình đóng băng", emoji: "🧊", cost: { mysticHerb: 2, starShard: 1 }, result: { freezes: 1 } },
];

export function canCraft(m: Materials, r: Recipe) {
  return MATERIAL_IDS.every((id) => (m[id] ?? 0) >= (r.cost[id] ?? 0));
}
export function payRecipe(m: Materials, r: Recipe): Materials {
  const next = { ...m };
  MATERIAL_IDS.forEach((id) => { next[id] = (next[id] ?? 0) - (r.cost[id] ?? 0); });
  return next;
}

// ---- Pet evolution ----
export const PET_XP_SHARE = 0.1;
export const petXpForLevel = (lvl: number) => lvl * 100;

const TIERS: Record<Species, [string, string, string]> = {
  cat: ["Mèo Con", "Mèo Hộ Vệ", "Mèo Thần Thoại"],
  lizard: ["Thằn Lằn Nhí", "Thằn Lằn Chiến Binh", "Rồng Thằn Lằn"],
  dog: ["Cún Con", "Cún Hộ Vệ", "Sói Thần"],
  owl: ["Cú Non", "Cú Hiền Triết", "Cú Pháp Sư"],
};
export const TIER_BADGE = ["🌱", "🛡️", "✨"];
export const tierOf = (petLevel: number) => (petLevel >= 6 ? 2 : petLevel >= 3 ? 1 : 0);
export const petTitle = (pet: PetState) => TIERS[pet.species][tierOf(pet.petLevel)];

export const ADVANCED_LINES = [
  "Sức mạnh của chúng ta đang tiến hóa! ⚡",
  "Mình đã đủ mạnh để bảo vệ sự tập trung của bạn!",
  "Hãy cùng chinh phục thêm một Boss nữa nào! ⚔️",
  "Mình cảm nhận được ý chí học tập của bạn đó ✨",
];

/** Pet earns 10% of the user's XP. Returns new pet and whether its tier changed. */
export function addPetXp(pet: PetState, userXp: number): { pet: PetState; levelsGained: number; evolved: boolean } {
  let petLevel = pet.petLevel || 1;
  let petXp = (pet.petXp || 0) + Math.max(0, Math.round(userXp * PET_XP_SHARE));
  let levelsGained = 0;
  while (petXp >= petXpForLevel(petLevel)) { petXp -= petXpForLevel(petLevel); petLevel++; levelsGained++; }
  return { pet: { ...pet, petLevel, petXp }, levelsGained, evolved: tierOf(petLevel) !== tierOf(pet.petLevel || 1) };
}

// ---- Daily stats ----
export interface DayStats { tasks: number; focusMin: number; water: number; treats: number; pomodoros: number }
export type StatKey = keyof DayStats;
export const emptyDay = (): DayStats => ({ tasks: 0, focusMin: 0, water: 0, treats: 0, pomodoros: 0 });

export function bumpStats(stats: Record<string, DayStats>, date: string, patch: Partial<DayStats>): Record<string, DayStats> {
  const cur = { ...emptyDay(), ...(stats[date] ?? {}) };
  (Object.keys(patch) as StatKey[]).forEach((k) => { cur[k] += patch[k] ?? 0; });
  // keep ~60 days
  const keep = Object.fromEntries(Object.entries(stats).filter(([d]) => daysBetween(d, date) <= 60));
  return { ...keep, [date]: cur };
}

/** Sunday-start week containing `today`. */
export function weekRange(today: string): string[] {
  const p = today.split("-").map(Number);
  const dow = new Date(Date.UTC(p[0]!, p[1]! - 1, p[2]!)).getUTCDay();
  return Array.from({ length: 7 }, (_, i) => shiftDate(today, i - dow));
}
export function weekSummary(stats: Record<string, DayStats>, today: string): DayStats & { days: string[]; bestDay: string | null } {
  const days = weekRange(today);
  const sum = emptyDay();
  let bestDay: string | null = null; let best = 0;
  days.forEach((d) => {
    const s = stats[d]; if (!s) return;
    (Object.keys(sum) as StatKey[]).forEach((k) => { sum[k] += s[k] ?? 0; });
    if (s.tasks > best) { best = s.tasks; bestDay = d; }
  });
  return { ...sum, days, bestDay };
}

// ---- Achievements ----
export type AchievementId = "nightOwl" | "hydroHomie" | "neglectfulMaster";
export const ACHIEVEMENT_REWARD = 10;
export const ACHIEVEMENTS: Record<AchievementId, { emoji: string; name: string; desc: string; clue: string }> = {
  nightOwl: { emoji: "🦉", name: "Cú Đêm", desc: "Hoàn thành task/Pomodoro trong khoảng 1h–4h sáng.", clue: "Khi cả thành phố đã ngủ say…" },
  hydroHomie: { emoji: "💦", name: "Chiến Thần Uống Nước", desc: "Đạt 8 ly nước 3 ngày liên tiếp.", clue: "Dòng nước chảy mãi không ngừng…" },
  neglectfulMaster: { emoji: "🥀", name: "Chủ Nhân Vô Tâm", desc: "Để Độ no của thú cưng xuống dưới 10%.", clue: "Có ai đó đang réo bụng rất lâu rồi…" },
};

export interface AchievementState {
  unlocked: Partial<Record<AchievementId, string>>; // id -> ISO
  waterStreak: { count: number; lastDate: string | null };
}
export const defaultAchievements = (): AchievementState => ({ unlocked: {}, waterStreak: { count: 0, lastDate: null } });

export const isNightOwlHour = (d: Date) => d.getHours() >= 1 && d.getHours() < 4;

export function recordWaterGoal(a: AchievementState, today: string): AchievementState {
  const w = a.waterStreak;
  if (w.lastDate === today) return a;
  const count = w.lastDate && daysBetween(w.lastDate, today) === 1 ? w.count + 1 : 1;
  return { ...a, waterStreak: { count, lastDate: today } };
}

/** Returns newly unlocked ids. */
export function checkAchievements(a: AchievementState, ctx: { pet: PetState; nightOwl?: boolean }, now = new Date()) {
  const fresh: AchievementId[] = [];
  const has = (id: AchievementId) => !!a.unlocked[id];
  if (ctx.nightOwl && !has("nightOwl")) fresh.push("nightOwl");
  if (a.waterStreak.count >= 3 && !has("hydroHomie")) fresh.push("hydroHomie");
  if (ctx.pet.hunger < 10 && !has("neglectfulMaster")) fresh.push("neglectfulMaster");
  if (!fresh.length) return { achievements: a, fresh };
  const unlocked = { ...a.unlocked };
  fresh.forEach((id) => { unlocked[id] = now.toISOString(); });
  return { achievements: { ...a, unlocked }, fresh };
}

// ---- Adventure diary ----
export interface DiaryEntry { date: string; text: string; mood: "great" | "ok" | "lonely" }

const fmtDay = (d: string) => { const [, m, day] = d.split("-"); return `${day}/${m}`; };

export function writeDiary(date: string, s: DayStats | undefined, opts: { petName: string; freezeUsed: boolean; streakBroke: boolean }): DiaryEntry {
  const st = { ...emptyDay(), ...(s ?? {}) };
  const head = `${fmtDay(date)}:`;
  if (st.tasks === 0 && st.pomodoros === 0) {
    const tail = opts.freezeUsed ? " nhưng may quá, Bình đóng băng 🧊 đã cứu chuỗi streak của tụi mình!"
      : opts.streakBroke ? " và chuỗi streak của tụi mình đã vỡ mất rồi 💔" : " Mai nhớ ghé thăm mình nha.";
    return { date, mood: "lonely", text: `${head} Chủ nhân đi đâu cả ngày… ${opts.petName} thấy cô đơn và đói bụng lắm,${tail}` };
  }
  if (st.tasks >= 3 || st.focusMin >= 50) {
    return { date, mood: "great", text: `${head} Chủ nhân học siêu chăm! Xong ${st.tasks} nhiệm vụ, tập trung ${st.focusMin} phút${st.water ? `, uống ${st.water} ly nước` : ""}. ${opts.petName} cổ vũ đến ngủ gục luôn${st.treats ? ` và được thưởng ${st.treats} món ngon` : ""}! 🎉` };
  }
  return { date, mood: "ok", text: `${head} Hôm nay chủ nhân làm được ${st.tasks} nhiệm vụ. Không tệ chút nào! ${opts.petName} tin ngày mai sẽ còn tuyệt hơn 🌤️` };
}

// ---- Weather ----
export type Weather = "sunny" | "rainy" | "foggy";
export function weatherOf(input: { todayDone: number; pomodorosToday: number; overdue: number; pet: PetState }): Weather {
  if (input.todayDone > 3 || input.pomodorosToday > 0) return "sunny";
  if (input.overdue > 0 || input.pet.hunger < 40 || input.pet.happiness < 40) return "rainy";
  return "foggy";
}

// ---- Extras container (stored at top level of the v3 JSON) ----
export interface ExtrasState {
  materials: Materials;
  achievements: AchievementState;
  adventureLog: DiaryEntry[];
  dailyStats: Record<string, DayStats>;
  lastDiaryDate: string | null;
}

const n0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
export function normalizeExtras(r: any): ExtrasState {
  const mats = emptyMaterials();
  MATERIAL_IDS.forEach((id) => { mats[id] = n0(r?.inventory?.materials?.[id] ?? r?.materials?.[id]); });
  const ach = defaultAchievements();
  const ra = r?.achievements;
  if (ra && typeof ra === "object") {
    Object.keys(ACHIEVEMENTS).forEach((id) => { const v = ra.unlocked?.[id]; if (typeof v === "string") ach.unlocked[id as AchievementId] = v; });
    ach.waterStreak = { count: n0(ra.waterStreak?.count), lastDate: typeof ra.waterStreak?.lastDate === "string" ? ra.waterStreak.lastDate : null };
  }
  const stats: Record<string, DayStats> = {};
  if (r?.dailyStats && typeof r.dailyStats === "object") {
    Object.entries(r.dailyStats).forEach(([d, s]: [string, any]) => {
      stats[d] = { tasks: n0(s?.tasks), focusMin: n0(s?.focusMin), water: n0(s?.water), treats: n0(s?.treats), pomodoros: n0(s?.pomodoros) };
    });
  }
  return {
    materials: mats,
    achievements: ach,
    adventureLog: Array.isArray(r?.adventureLog) ? r.adventureLog.filter((e: any) => typeof e?.date === "string" && typeof e?.text === "string").slice(0, 60) : [],
    dailyStats: stats,
    lastDiaryDate: typeof r?.lastDiaryDate === "string" ? r.lastDiaryDate : null,
  };
}
