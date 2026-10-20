import type { Materials } from "./extras";
// Pure gamification rules: pet, streak, shop, inventory. No browser APIs.

export type Species = "cat" | "lizard" | "dog" | "owl";
export type Accessory = "gradcap" | "sunglasses" | "crown" | "wings";
export type Mood = "excited" | "normal" | "hungry" | "sulky";

export interface PetState {
  species: Species;
  ownedSpecies: Species[];
  accessory: Accessory | null;
  ownedAccessories: Accessory[];
  hunger: number; // 0-100 (Độ no)
  happiness: number; // 0-100
  lastDecayAt: string; // ISO
  petLevel: number;
  petXp: number;
}

export interface StreakState {
  freezeActive?: boolean;
  count: number;
  best: number;
  lastQualifiedDate: string | null; // day with >=3 completed tasks
  today: { date: string; done: number };
  lastCheckDate: string | null;
}

export interface Inventory {
  items: Record<string, number>; // food/toy id -> qty
  freezes: number; // 🧊
  materials: Materials; // crafting materials
}

export const STREAK_GOAL = 3;
export const POMODORO_MINUTES = 25;
export const POMODORO_REWARD = 5;
export const HUNGER_DECAY = 5;
export const HAPPY_DECAY = 3;

export const SPECIES: Record<Species, { emoji: string; name: string; price: number }> = {
  cat: { emoji: "🐱", name: "Mèo", price: 0 },
  lizard: { emoji: "🦎", name: "Thằn Lằn", price: 10 },
  dog: { emoji: "🐶", name: "Cún", price: 12 },
  owl: { emoji: "🦉", name: "Cú", price: 15 },
};

export const ACCESSORIES: Record<Accessory, { emoji: string; name: string; price: number; craftOnly?: boolean }> = {
  gradcap: { emoji: "🎓", name: "Mũ cử nhân", price: 5 },
  sunglasses: { emoji: "🕶️", name: "Kính râm", price: 6 },
  crown: { emoji: "👑", name: "Vương miện", price: 12 },
  wings: { emoji: "🪽", name: "Cánh Thiên Thần", price: 0, craftOnly: true },
};

export const FREEZE_PRICE = 15;

export const CONSUMABLES: Record<string, { emoji: string; name: string; price: number; hunger: number; happiness: number }> = {
  fish: { emoji: "🐟", name: "Cá khô", price: 3, hunger: 25, happiness: 0 },
  cake: { emoji: "🍰", name: "Bánh thưởng", price: 5, hunger: 40, happiness: 5 },
  yarn: { emoji: "🧶", name: "Cuộn len", price: 4, hunger: 0, happiness: 20 },
  ball: { emoji: "⚽", name: "Bóng nảy", price: 8, hunger: 0, happiness: 40 },
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function defaultPet(now = new Date()): PetState {
  return { species: "cat", ownedSpecies: ["cat"], accessory: null, ownedAccessories: [], hunger: 80, happiness: 80, lastDecayAt: now.toISOString(), petLevel: 1, petXp: 0 };
}
export function defaultStreak(today: string): StreakState {
  return { count: 0, best: 0, lastQualifiedDate: null, today: { date: today, done: 0 }, lastCheckDate: today };
}
export const defaultInventory = (): Inventory => ({ items: {}, freezes: 0, materials: { magicFeather: 0, starShard: 0, mysticHerb: 0 } });

/** -5% no, -3% vui for every full hour elapsed since lastDecayAt. */
export function decayPet(pet: PetState, now = new Date()): PetState {
  const last = new Date(pet.lastDecayAt).getTime();
  if (!Number.isFinite(last)) return { ...pet, lastDecayAt: now.toISOString() };
  const hours = Math.floor((now.getTime() - last) / 3_600_000);
  if (hours <= 0) return pet;
  return {
    ...pet,
    hunger: clamp(pet.hunger - HUNGER_DECAY * hours),
    happiness: clamp(pet.happiness - HAPPY_DECAY * hours),
    lastDecayAt: new Date(last + hours * 3_600_000).toISOString(),
  };
}

export function moodOf(pet: PetState): Mood {
  if (pet.happiness < 30) return "sulky";
  if (pet.hunger < 40) return "hungry";
  if (pet.hunger > 80 && pet.happiness > 80) return "excited";
  return "normal";
}

export const MOOD_META: Record<Mood, { face: string; label: string; lines: string[] }> = {
  excited: { face: "🤩", label: "Hưng phấn", lines: ["Yeah! Mình đang tràn năng lượng!", "Làm thêm task nữa đi, vui quá!", "Bạn là số 1! 🎉", "Nhảy nhót cùng mình nào~"] },
  normal: { face: "🙂", label: "Bình thường", lines: ["Hôm nay mình học gì nhỉ?", "Cố lên nhé, mình ở đây!", "Uống nước chưa đó? 💧", "Một Pomodoro nữa thôi!"] },
  hungry: { face: "🥺", label: "Đói lả", lines: ["Bụng mình kêu ọt ọt…", "Cho mình ăn chút gì đi 🍖", "Đói quá không học nổi…"] },
  sulky: { face: "😤", label: "Hờn dỗi", lines: ["Hứ! Bỏ rơi mình lâu quá!", "Không chơi với bạn nữa đâu…", "Chơi với mình chút đi mà 😢"] },
};

export const randomLine = (pet: PetState) => {
  const lines = MOOD_META[moodOf(pet)].lines;
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0]!;
};

export const bumpPet = (pet: PetState, hunger: number, happiness: number): PetState => ({
  ...pet, hunger: clamp(pet.hunger + hunger), happiness: clamp(pet.happiness + happiness),
});

/** Streak multiplier: 2-3 days x1.2, 4-6 x1.5, >=7 x2.0 (max). */
export function streakMultiplier(count: number): number {
  if (count >= 7) return 2;
  if (count >= 4) return 1.5;
  if (count >= 2) return 1.2;
  return 1;
}

export function daysBetween(a: string, b: string): number {
  const pa = a.split("-").map(Number);
  const pb = b.split("-").map(Number);
  const da = Date.UTC(pa[0]!, pa[1]! - 1, pa[2]!);
  const db = Date.UTC(pb[0]!, pb[1]! - 1, pb[2]!);
  return Math.round((db - da) / 86_400_000);
}
const isWeekday = (date: string) => { const d = new Date(`${date}T12:00:00`); return d.getDay() >= 1 && d.getDay() <= 5; };
/** Record one completed task today. When the 3rd lands, streak +1 (or restarts at 1). */
export function recordCompletion(s: StreakState, today: string): StreakState {
  const done = (s.today.date === today ? s.today.done : 0) + 1;
  let next: StreakState = { ...s, freezeActive: false, today: { date: today, done } };
  if (done >= STREAK_GOAL && s.lastQualifiedDate !== today) {
    const continues = s.lastQualifiedDate !== null && daysBetween(s.lastQualifiedDate, today) === 1;
    const count = continues ? s.count + 1 : 1;
    next = { ...next, count, best: Math.max(s.best, count), lastQualifiedDate: today };
  }
  return next;
}

/** On a new day: break the streak if a day was missed, unless exactly 1 day was missed and a 🧊 is available. */
export function checkStreak(s: StreakState, inv: Inventory, today: string): { streak: StreakState; inventory: Inventory; usedFreeze: boolean; broke: boolean } {
  if (s.lastCheckDate === today) return { streak: s, inventory: inv, usedFreeze: false, broke: false };
  let streak: StreakState = { ...s, lastCheckDate: today, today: s.today.date === today ? s.today : { date: today, done: 0 } };
  let inventory = inv;
  let usedFreeze = false;
  let broke = false;
  if (s.lastQualifiedDate && s.count > 0) {
    const missed = daysBetween(s.lastQualifiedDate, today) - 1;
    if (missed === 1 && isWeekday(shiftDate(today, -1))) {
      streak = { ...streak, lastQualifiedDate: shiftDate(today, -1) };
    } else if (missed === 1 && inv.freezes > 0) {
      const yesterday = shiftDate(today, -1);
      streak = { ...streak, lastQualifiedDate: yesterday, freezeActive: true };
      inventory = { ...inv, freezes: inv.freezes - 1 };
      usedFreeze = true;
    } else if (missed >= 1) {
      streak = { ...streak, count: 0, freezeActive: false };
      broke = true;
    }

  }
  return { streak, inventory, usedFreeze, broke };
}

export function shiftDate(d: string, days: number): string {
  const p = d.split("-").map(Number);
  const dt = new Date(Date.UTC(p[0]!, p[1]! - 1, p[2]! + days));
  return dt.toISOString().slice(0, 10);
}

export function normalizePet(raw: any, now = new Date()): PetState {
  const b = defaultPet(now);
  if (!raw || typeof raw !== "object") return b;
  const sp = Object.keys(SPECIES) as Species[];
  const ac = Object.keys(ACCESSORIES) as Accessory[];
  const owned = Array.isArray(raw.ownedSpecies) ? raw.ownedSpecies.filter((x: any) => sp.includes(x)) : [];
  return {
    species: sp.includes(raw.species) ? raw.species : "cat",
    ownedSpecies: Array.from(new Set<Species>(["cat", ...owned])),
    accessory: ac.includes(raw.accessory) ? raw.accessory : null,
    ownedAccessories: Array.isArray(raw.ownedAccessories) ? raw.ownedAccessories.filter((x: any) => ac.includes(x)) : [],
    hunger: typeof raw.hunger === "number" ? clamp(raw.hunger) : b.hunger,
    happiness: typeof raw.happiness === "number" ? clamp(raw.happiness) : b.happiness,
    lastDecayAt: typeof raw.lastDecayAt === "string" ? raw.lastDecayAt : b.lastDecayAt,
    petLevel: typeof raw.petLevel === "number" && raw.petLevel >= 1 ? Math.floor(raw.petLevel) : 1,
    petXp: typeof raw.petXp === "number" && raw.petXp >= 0 ? raw.petXp : 0,
  };
}
