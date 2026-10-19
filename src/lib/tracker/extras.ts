// Pure rules for premium extras: materials & alchemy, pet evolution, achievements,
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
  return pickMaterial(rng);
}
export function pickMaterial(rng: () => number = Math.random): MaterialId {
  return MATERIAL_IDS[Math.min(MATERIAL_IDS.length - 1, Math.floor(rng() * MATERIAL_IDS.length))]!;
}

export type Materials = Record<MaterialId, number>;
export const emptyMaterials = (): Materials => ({ magicFeather: 0, starShard: 0, mysticHerb: 0 });

export type RecipeResult = { accessory: Accessory } | { freezes: number } | { petXp: number; boostHours: number };
export interface Recipe {
  id: "wings" | "freeze" | "elixir"; name: string; emoji: string; desc: string; cost: Partial<Materials>;
  result: RecipeResult;
}
/** Forge recipes. A recipe matches only when the forge holds exactly these materials. */
export const RECIPES: Recipe[] = [
  { id: "wings", name: "Cánh Thiên Thần Vũ Trụ", emoji: "🪽", desc: "Phụ kiện trang bị — thú cưng mọc cánh và bay khi thám hiểm.", cost: { magicFeather: 2, starShard: 1 }, result: { accessory: "wings" } },
  { id: "freeze", name: "Bình Đóng Băng", emoji: "🧊", desc: "+1 Bình đóng băng bảo vệ chuỗi streak.", cost: { mysticHerb: 2, starShard: 1 }, result: { freezes: 1 } },
  { id: "elixir", name: "Tiên Dược May Mắn", emoji: "🧪", desc: "+500 XP thú cưng và ⚡ Tăng tốc 24h (+50% chiến lợi phẩm thám hiểm).", cost: { magicFeather: 1, starShard: 1, mysticHerb: 1 }, result: { petXp: 500, boostHours: 24 } },
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

/** Adds raw pet XP (no share applied) with multi level-ups. */
export function grantPetXp(pet: PetState, amount: number): { pet: PetState; levelsGained: number; evolved: boolean } {
  let petLevel = pet.petLevel || 1;
  let petXp = (pet.petXp || 0) + Math.max(0, Math.round(amount));
  let levelsGained = 0;
  while (petXp >= petXpForLevel(petLevel)) { petXp -= petXpForLevel(petLevel); petLevel++; levelsGained++; }
  return { pet: { ...pet, petLevel, petXp }, levelsGained, evolved: tierOf(petLevel) !== tierOf(pet.petLevel || 1) };
}
/** Pet earns 10% of the user's XP. Returns new pet and whether its tier changed. */
export function addPetXp(pet: PetState, userXp: number) {
  return grantPetXp(pet, Math.max(0, Math.round(userXp * PET_XP_SHARE)));
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

// ---- Achievements (Constellation Map) ----
export type AchievementId =
  | "nightOwl" | "hydroHomie" | "neglectfulMaster"
  | "firstFocus" | "focus100" | "pomo10" | "focus500" | "pomo25" | "focus1000"
  | "streak3" | "tasks25" | "streak7" | "tasks100" | "streak14";
export const ACHIEVEMENT_REWARD = 10;
export type Constellation = "eagle" | "whale";
export interface AchievementDef { emoji: string; name: string; desc: string; clue: string; constellation: Constellation }
export const ACHIEVEMENTS: Record<AchievementId, AchievementDef> = {
  // Eagle — focus
  firstFocus: { emoji: "🍅", name: "Tia Lửa Đầu Tiên", desc: "Hoàn thành 1 phiên Pomodoro.", clue: "Mọi hành trình bắt đầu bằng một tiếng tích tắc…", constellation: "eagle" },
  focus100: { emoji: "🎯", name: "Mắt Đại Bàng", desc: "Tích lũy 100 phút tập trung.", clue: "Trăm phút lặng im, một tầm nhìn sắc bén.", constellation: "eagle" },
  nightOwl: { emoji: "🦉", name: "Cú Đêm", desc: "Hoàn thành task/Pomodoro trong khoảng 1h–4h sáng.", clue: "Khi cả thành phố đã ngủ say…", constellation: "eagle" },
  pomo10: { emoji: "🔥", name: "Mười Ngọn Đuốc", desc: "Hoàn thành 10 phiên Pomodoro.", clue: "Mười lần thắp lửa, không lần nào tắt.", constellation: "eagle" },
  focus500: { emoji: "🪽", name: "Sải Cánh Bất Tận", desc: "Tích lũy 500 phút tập trung.", clue: "Cánh chim không mỏi giữa tầng mây.", constellation: "eagle" },
  pomo25: { emoji: "⚡", name: "Tia Sét Tập Trung", desc: "Hoàn thành 25 phiên Pomodoro.", clue: "Hai mươi lăm tia sét xé toạc xao nhãng.", constellation: "eagle" },
  focus1000: { emoji: "🦅", name: "Chúa Tể Bầu Trời", desc: "Tích lũy 1000 phút tập trung.", clue: "Ngàn phút bay cao, đỉnh trời trong tầm mắt.", constellation: "eagle" },
  // Whale — endurance
  hydroHomie: { emoji: "💦", name: "Chiến Thần Uống Nước", desc: "Đạt 8 ly nước 3 ngày liên tiếp.", clue: "Dòng nước chảy mãi không ngừng…", constellation: "whale" },
  streak3: { emoji: "🌊", name: "Con Sóng Đầu", desc: "Đạt chuỗi streak 3 ngày.", clue: "Ba con sóng nối nhau vào bờ.", constellation: "whale" },
  tasks25: { emoji: "🐚", name: "Vỏ Ốc Kiên Nhẫn", desc: "Hoàn thành tổng cộng 25 nhiệm vụ.", clue: "Từng hạt cát nhỏ dựng nên vỏ ốc.", constellation: "whale" },
  streak7: { emoji: "🐋", name: "Hành Trình Đại Dương", desc: "Đạt chuỗi streak 7 ngày.", clue: "Một tuần lặn sâu không trồi lên.", constellation: "whale" },
  tasks100: { emoji: "⚓", name: "Mỏ Neo Thép", desc: "Hoàn thành tổng cộng 100 nhiệm vụ.", clue: "Trăm lần thả neo, thuyền vẫn vững.", constellation: "whale" },
  streak14: { emoji: "🌌", name: "Cá Voi Ngân Hà", desc: "Đạt chuỗi streak 14 ngày.", clue: "Hai tuần bơi giữa dải ngân hà.", constellation: "whale" },
  neglectfulMaster: { emoji: "🥀", name: "Chủ Nhân Vô Tâm", desc: "Để Độ no của thú cưng xuống dưới 10%.", clue: "Có ai đó đang réo bụng rất lâu rồi…", constellation: "whale" },
};
export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[];

export interface Lifetime { tasks: number; focusMin: number; pomodoros: number }
export interface AchievementState {
  unlocked: Partial<Record<AchievementId, string>>; // id -> ISO
  claimed: Partial<Record<AchievementId, string>>; // id -> ISO (reward paid)
  waterStreak: { count: number; lastDate: string | null };
  lifetime: Lifetime;
}
export const defaultAchievements = (): AchievementState => ({ unlocked: {}, claimed: {}, waterStreak: { count: 0, lastDate: null }, lifetime: { tasks: 0, focusMin: 0, pomodoros: 0 } });
export interface ExpeditionState { startedAt: string | null; endAt: string | null; lastTriggerDate?: string | null }
export const EXPEDITION_TRIGGER_MINUTES = 50;
export const EXPEDITION_DURATION_MINUTES = 30;
export const defaultExpedition = (): ExpeditionState => ({ startedAt: null, endAt: null, lastTriggerDate: null });

export const isNightOwlHour = (d: Date) => d.getHours() >= 1 && d.getHours() < 4;

export function recordWaterGoal(a: AchievementState, today: string): AchievementState {
  const w = a.waterStreak;
  if (w.lastDate === today) return a;
  const count = w.lastDate && daysBetween(w.lastDate, today) === 1 ? w.count + 1 : 1;
  return { ...a, waterStreak: { count, lastDate: today } };
}

export function bumpLifetime(a: AchievementState, patch: Partial<Lifetime>): AchievementState {
  const l = a.lifetime;
  return { ...a, lifetime: { tasks: l.tasks + (patch.tasks ?? 0), focusMin: l.focusMin + (patch.focusMin ?? 0), pomodoros: l.pomodoros + (patch.pomodoros ?? 0) } };
}

export interface AchievementCtx { pet: PetState; nightOwl?: boolean; streakBest?: number }

/** Returns newly unlocked ids. Unlocking does not pay; rewards are claimed on the map. */
export function checkAchievements(a: AchievementState, ctx: AchievementCtx, now = new Date()) {
  const L = a.lifetime ?? defaultAchievements().lifetime;
  const best = ctx.streakBest ?? 0;
  const rules: Record<AchievementId, boolean> = {
    nightOwl: !!ctx.nightOwl,
    hydroHomie: a.waterStreak.count >= 3,
    neglectfulMaster: ctx.pet.hunger < 10,
    firstFocus: L.pomodoros >= 1,
    focus100: L.focusMin >= 100,
    pomo10: L.pomodoros >= 10,
    focus500: L.focusMin >= 500,
    pomo25: L.pomodoros >= 25,
    focus1000: L.focusMin >= 1000,
    streak3: best >= 3,
    tasks25: L.tasks >= 25,
    streak7: best >= 7,
    tasks100: L.tasks >= 100,
    streak14: best >= 14,
  };
  const fresh = ACHIEVEMENT_IDS.filter((id) => rules[id] && !a.unlocked[id]);
  if (!fresh.length) return { achievements: a, fresh };
  const unlocked = { ...a.unlocked };
  fresh.forEach((id) => { unlocked[id] = now.toISOString(); });
  return { achievements: { ...a, unlocked }, fresh };
}

/** Claims an unlocked, unclaimed achievement. Returns null when not claimable. */
export function claimReward(a: AchievementState, id: AchievementId, now = new Date()): AchievementState | null {
  if (!a.unlocked[id] || a.claimed[id]) return null;
  return { ...a, claimed: { ...a.claimed, [id]: now.toISOString() } };
}

export function startExpedition(expedition: ExpeditionState, minutes: number, now = new Date(), durationMinutes = EXPEDITION_DURATION_MINUTES): ExpeditionState {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (expedition.endAt || expedition.lastTriggerDate === today || minutes < EXPEDITION_TRIGGER_MINUTES) return expedition;
  return {
    startedAt: now.toISOString(),
    lastTriggerDate: today,
    endAt: new Date(now.getTime() + durationMinutes * 60_000).toISOString(),
  };

export function resolveExpedition(expedition: ExpeditionState, now = new Date(), rng: () => number = Math.random): { expedition: ExpeditionState; drops: MaterialId[] } | null {
  if (!expedition.endAt) return null;
  const endAt = new Date(expedition.endAt).getTime();
  if (!Number.isFinite(endAt) || endAt > now.getTime()) return null;
  const count = rng() < 0.5 ? 2 : 3;
  return {
    expedition: defaultExpedition(),
    drops: Array.from({ length: count }, () => pickMaterial(rng)),
  };
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
/** sunny = Starry Sparks, rainy = pet vitals < 40%, snowy = tasks overdue, foggy = neutral. */
export type Weather = "sunny" | "rainy" | "snowy" | "foggy";
export function weatherOf(input: { todayDone: number; pomodorosToday: number; overdue: number; pet: PetState }): Weather {
  if (input.todayDone > 3 || input.pomodorosToday > 0) return "sunny";
  if (input.pet.hunger < 40 || input.pet.happiness < 40) return "rainy";
  if (input.overdue > 0) return "snowy";
  return "foggy";
}

// ---- Extras container (stored at top level of the JSON) ----
export interface ExtrasState {
  materials: Materials;
  achievements: AchievementState;
  claimedAchievements: Partial<Record<AchievementId, string>>;
  adventureLog: DiaryEntry[];
  dailyStats: Record<string, DayStats>;
  expedition: ExpeditionState;
  lastDiaryDate: string | null;
}

const n0 = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
export function normalizeExtras(r: any): ExtrasState {
  const mats = emptyMaterials();
  MATERIAL_IDS.forEach((id) => { mats[id] = n0(r?.inventory?.materials?.[id] ?? r?.materials?.[id]); });
  const stats: Record<string, DayStats> = {};
  if (r?.dailyStats && typeof r.dailyStats === "object") {
    Object.entries(r.dailyStats).forEach(([d, s]: [string, any]) => {
      stats[d] = { tasks: n0(s?.tasks), focusMin: n0(s?.focusMin), water: n0(s?.water), treats: n0(s?.treats), pomodoros: n0(s?.pomodoros) };
    });
  }
  const ach = defaultAchievements();
  const ra = r?.achievements;
  if (ra && typeof ra === "object") {
    ACHIEVEMENT_IDS.forEach((id) => { const v = ra.unlocked?.[id]; if (typeof v === "string") ach.unlocked[id] = v; });
    ach.waterStreak = { count: n0(ra.waterStreak?.count), lastDate: typeof ra.waterStreak?.lastDate === "string" ? ra.waterStreak.lastDate : null };
    const claimed = r?.claimedAchievements && typeof r.claimedAchievements === "object" ? r.claimedAchievements : ra.claimed;
    if (claimed && typeof claimed === "object") {
      ACHIEVEMENT_IDS.forEach((id) => { const v = claimed[id]; if (typeof v === "string" && ach.unlocked[id]) ach.claimed[id] = v; });
    } else {
      // Older files paid the reward on unlock, so those are already claimed.
      ach.claimed = { ...ach.unlocked };
    }
  }
  if (ra?.lifetime && typeof ra.lifetime === "object") {
    ach.lifetime = { tasks: n0(ra.lifetime.tasks), focusMin: n0(ra.lifetime.focusMin), pomodoros: n0(ra.lifetime.pomodoros) };
  } else {
    Object.values(stats).forEach((s) => { ach.lifetime.tasks += s.tasks; ach.lifetime.focusMin += s.focusMin; ach.lifetime.pomodoros += s.pomodoros; });
  }
  const expeditionRaw = r?.expedition;
  const expedition = {
    startedAt: typeof expeditionRaw?.startedAt === "string" ? expeditionRaw.startedAt : null,
    endAt: typeof expeditionRaw?.endAt === "string" ? expeditionRaw.endAt : null,
  };
  return {
    materials: mats,
    achievements: ach,
    claimedAchievements: { ...ach.claimed },
    adventureLog: Array.isArray(r?.adventureLog) ? r.adventureLog.filter((e: any) => typeof e?.date === "string" && typeof e?.text === "string").slice(0, 60) : [],
    dailyStats: stats,
    expedition: expedition.startedAt || expedition.endAt ? expedition : defaultExpedition(),
    lastDiaryDate: typeof r?.lastDiaryDate === "string" ? r.lastDiaryDate : null,
  };
}
