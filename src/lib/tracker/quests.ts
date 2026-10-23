// Pure rules for daily quests and the weekly raid boss. No browser APIs.
import { shiftDate } from "./gamify";
import type { DayStats } from "./extras";

// ---- Daily quests ----
export interface QuestDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  metric: keyof DayStats;
  target: number;
  reward: { catCoins: number; lizardGems: number };
}
export const QUEST_POOL: QuestDef[] = [
  {
    id: "tasks3",
    emoji: "✅",
    name: "Người Chăm Chỉ",
    desc: "Hoàn thành 3 nhiệm vụ",
    metric: "tasks",
    target: 3,
    reward: { catCoins: 2, lizardGems: 0 },
  },
  {
    id: "tasks5",
    emoji: "🏃",
    name: "Máy Chạy Không Mỏi",
    desc: "Hoàn thành 5 nhiệm vụ",
    metric: "tasks",
    target: 5,
    reward: { catCoins: 3, lizardGems: 0 },
  },
  {
    id: "focus30",
    emoji: "🎯",
    name: "Tập Trung Cao Độ",
    desc: "Tích lũy 30 phút tập trung",
    metric: "focusMin",
    target: 30,
    reward: { catCoins: 2, lizardGems: 0 },
  },
  {
    id: "focus60",
    emoji: "🧘",
    name: "Thiền Định Sâu",
    desc: "Tích lũy 60 phút tập trung",
    metric: "focusMin",
    target: 60,
    reward: { catCoins: 0, lizardGems: 1 },
  },
  {
    id: "pomo2",
    emoji: "🍅",
    name: "Đôi Cà Chua",
    desc: "Hoàn thành 2 phiên tập trung",
    metric: "pomodoros",
    target: 2,
    reward: { catCoins: 2, lizardGems: 0 },
  },
  {
    id: "water8",
    emoji: "💧",
    name: "Giữ Đủ Nước",
    desc: "Uống đủ 8 ly nước",
    metric: "water",
    target: 8,
    reward: { catCoins: 2, lizardGems: 0 },
  },
  {
    id: "treats1",
    emoji: "🍖",
    name: "Bữa Ngon Cho Boss",
    desc: "Cho thú cưng ăn 1 lần",
    metric: "treats",
    target: 1,
    reward: { catCoins: 1, lizardGems: 0 },
  },
];
export const DAILY_QUEST_COUNT = 3;

export interface QuestsState {
  date: string | null;
  claimed: string[];
}
export const defaultQuests = (): QuestsState => ({ date: null, claimed: [] });

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 3 quests per day, deterministic from the date so every render agrees. */
export function dailyQuests(date: string): QuestDef[] {
  const rng = mulberry32(hashStr(date));
  const pool = [...QUEST_POOL];
  const picked: QuestDef[] = [];
  for (let i = 0; i < DAILY_QUEST_COUNT && pool.length; i++) {
    picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  return picked;
}

export const questProgress = (stats: DayStats | undefined, q: QuestDef): number =>
  Math.min(q.target, stats?.[q.metric] ?? 0);

// ---- Weekly raid boss (Monday-start week, damage from all Pomodoros of the week) ----
export const RAID_MAX_HP = 100;
export const RAID_DAMAGE_PER_POMO = 12;
export const RAID_REWARD = { catCoins: 10, lizardGems: 3 };

export interface RaidState {
  weekStart: string | null;
  claimed: boolean;
}
export const defaultRaid = (): RaidState => ({ weekStart: null, claimed: false });

/** Monday of the week containing `date` (YYYY-MM-DD). */
export function raidWeekKey(date: string): string {
  const p = date.split("-").map(Number);
  const dow = new Date(Date.UTC(p[0]!, p[1]! - 1, p[2]!)).getUTCDay(); // 0 = Sunday
  return shiftDate(date, dow === 0 ? -6 : 1 - dow);
}

export interface RaidStatus {
  weekStart: string;
  pomodoros: number;
  damage: number;
  hpLeft: number;
  defeated: boolean;
  claimable: boolean;
}
export function raidStatus(
  stats: Record<string, DayStats>,
  today: string,
  raid: RaidState,
): RaidStatus {
  const weekStart = raidWeekKey(today);
  const pomodoros = Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i)).reduce(
    (n, d) => n + (stats[d]?.pomodoros ?? 0),
    0,
  );
  const damage = pomodoros * RAID_DAMAGE_PER_POMO;
  const hpLeft = Math.max(0, RAID_MAX_HP - damage);
  const defeated = hpLeft === 0;
  const claimable = defeated && !(raid.weekStart === weekStart && raid.claimed);
  return { weekStart, pomodoros, damage, hpLeft, defeated, claimable };
}
