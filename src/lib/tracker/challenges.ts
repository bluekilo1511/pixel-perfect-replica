// Pure rules for the daily random challenge: one special challenge per day,
// deterministic from the date so every render (and every device) agrees.
import type { AppData } from "./model";
import { hashStr, mulberry32 } from "./quests";

export interface ChallengeDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  /** Reward paid on claim (see claimChallenge in model.ts). */
  reward: { catCoins: number; lizardGems: number };
}

export const CHALLENGE_REWARD = { catCoins: 6, lizardGems: 1 };

/** Pool of rotating daily challenges; the day picks one deterministically. */
export const CHALLENGE_POOL: ChallengeDef[] = [
  {
    id: "earlyBird",
    emoji: "🌅",
    name: "Dậy sớm chiến thắng",
    desc: "Hoàn thành ít nhất 1 nhiệm vụ trước 7h sáng.",
    reward: CHALLENGE_REWARD,
  },
  {
    id: "noonRush",
    emoji: "🌞",
    name: "Cơn lốc buổi trưa",
    desc: "Hoàn thành 3 nhiệm vụ trước 12h trưa.",
    reward: CHALLENGE_REWARD,
  },
  {
    id: "unbroken",
    emoji: "🧘",
    name: "Phiên bất khả xâm phạm",
    desc: "Hoàn thành 1 phiên ≥25 phút mà không pause hay thoát tab lần nào.",
    reward: CHALLENGE_REWARD,
  },
  {
    id: "marathon",
    emoji: "🏃",
    name: "Marathon mini",
    desc: "Hoàn thành 1 phiên tập trung ≥45 phút.",
    reward: CHALLENGE_REWARD,
  },
  {
    id: "owl",
    emoji: "🦉",
    name: "Cú đêm chăm chỉ",
    desc: "Hoàn thành ít nhất 2 nhiệm vụ sau 20h tối.",
    reward: CHALLENGE_REWARD,
  },
  {
    id: "powerSix",
    emoji: "⚡",
    name: "Siêu xả nhiệm vụ",
    desc: "Hoàn thành 6 nhiệm vụ trong ngày.",
    reward: CHALLENGE_REWARD,
  },
];

/** Persisted once-per-day claim state, mirrored from the quests pattern. */
export interface ChallengeState {
  date: string | null;
  claimed: boolean;
}
export const defaultChallenge = (): ChallengeState => ({ date: null, claimed: false });

/** The day's challenge, deterministic from the YYYY-MM-DD string. */
export function challengeFor(date: string): ChallengeDef {
  const rng = mulberry32(hashStr(`challenge:${date}`));
  return CHALLENGE_POOL[Math.floor(rng() * CHALLENGE_POOL.length)]!;
}

const hourOf = (iso: string) => new Date(iso).getHours();
const completedOn = (data: AppData, today: string) =>
  data.tasks.filter((t) => t.completed && t.completedAt?.slice(0, 10) === today);

export interface ChallengeProgress {
  done: boolean;
  /** Human-readable current progress, shown under the challenge. */
  detail: string;
}

/** Evaluates today's challenge against the user's real data. */
export function challengeProgress(
  data: AppData,
  def: ChallengeDef,
  today: string,
): ChallengeProgress {
  const done = completedOn(data, today);
  switch (def.id) {
    case "earlyBird": {
      const n = done.filter((t) => hourOf(t.completedAt!) < 7).length;
      return { done: n >= 1, detail: `Trước 7h: ${n}/1 nhiệm vụ.` };
    }
    case "noonRush": {
      const n = done.filter((t) => hourOf(t.completedAt!) < 12).length;
      return { done: n >= 3, detail: `Trước 12h: ${Math.min(n, 3)}/3 nhiệm vụ.` };
    }
    case "unbroken": {
      const ok = data.sessionLog.some(
        (s) =>
          s.at.slice(0, 10) === today &&
          s.kind === "pomodoro" &&
          s.minutes >= 25 &&
          !s.interruptions,
      );
      return {
        done: ok,
        detail: ok ? "Đã có phiên không gián đoạn!" : "Cần 1 phiên ≥25p không pause/thoát tab.",
      };
    }
    case "marathon": {
      const best = Math.max(
        0,
        ...data.sessionLog.filter((s) => s.at.slice(0, 10) === today).map((s) => s.minutes),
      );
      return { done: best >= 45, detail: `Phiên dài nhất hôm nay: ${best}/45 phút.` };
    }
    case "owl": {
      const n = done.filter((t) => hourOf(t.completedAt!) >= 20).length;
      return { done: n >= 2, detail: `Sau 20h: ${Math.min(n, 2)}/2 nhiệm vụ.` };
    }
    case "powerSix": {
      const n = done.length;
      return { done: n >= 6, detail: `Hôm nay: ${Math.min(n, 6)}/6 nhiệm vụ hoàn thành.` };
    }
    default:
      return { done: false, detail: "" };
  }
}
