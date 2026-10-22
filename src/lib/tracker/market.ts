import { DECORATIONS, daysBetween, shiftDate, type DecorId, type PetState } from "./gamify";
import { grantPetXp, type Materials } from "./extras";

/**
 * Chợ Hư Không — a weekly shop that rotates its stock every Monday.
 * Pure logic: the caller owns the data object, this only reshapes it.
 */

export type MarketItemId = "shield" | "honey" | "box" | "galaxy" | "starClock" | "heal" | "ticket";

export interface MarketItem {
  id: MarketItemId;
  emoji: string;
  name: string;
  desc: string;
  price: number; // 😺 cat coins
}

export const MARKET_ITEMS: Record<MarketItemId, MarketItem> = {
  shield: {
    id: "shield",
    emoji: "🛡️",
    name: "Khiên Streak",
    desc: "+1 🧊 bảo hộ — thêm một mạng cứu streak",
    price: 20,
  },
  honey: {
    id: "honey",
    emoji: "🍯",
    name: "Mật Tuệ",
    desc: "Thú cưng +60 💫 kinh nghiệm ngay lập tức",
    price: 15,
  },
  box: {
    id: "box",
    emoji: "🎁",
    name: "Hộp May Mắn",
    desc: "Ngẫu nhiên 1–3 nguyên liệu luyện chế",
    price: 12,
  },
  galaxy: {
    id: "galaxy",
    emoji: "🌌",
    name: "Tranh dải ngân hà",
    desc: `Decor hiếm cho góc học — chỉ có ở Chợ Hư Không`,
    price: 30,
  },
  heal: {
    id: "heal",
    emoji: "🧪",
    name: "Bình Chữa Lành",
    desc: "Thú cưng hồi phục: 💗 đầy 100 và +40 🍖 no bụng — giảm đau khi boss phản đòn",
    price: 12,
  },
  starClock: {
    id: "starClock",
    emoji: "🪐",
    name: "Đồng hồ sao",
    desc: "Decor hiếm cho góc học — chỉ có ở Chợ Hư Không",
    price: 25,
  },
  ticket: {
    id: "ticket",
    emoji: "🎟️",
    name: "Vé Quay",
    desc: "+1 lượt quay may mắn — dành tiền lương mèo đổi vé",
    price: 10,
  },
};

// Rare decors are paid in the market, never in the Pet Shop.
export const MARKET_DECOR: DecorId[] = ["galaxy", "starClock"];
export const isMarketDecor = (id: DecorId) => DECORATIONS[id]?.marketOnly === true;

/** Stock rotations — one pool per week, cycling forever. */
const POOLS: MarketItemId[][] = [
  ["shield", "honey", "box"],
  ["honey", "galaxy", "box", "heal", "ticket"],
  ["shield", "starClock", "box"],
  ["galaxy", "honey", "shield", "heal", "ticket"],
  ["starClock", "box", "honey"],
];

/** The Monday (YYYY-MM-DD) of the week containing `d`. */
export function weekStart(d: Date): string {
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const dow = d.getDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return shiftDate(date, -back);
}

export function marketStock(now: Date): MarketItemId[] {
  const weeks = daysBetween("2024-01-01", weekStart(now)) / 7; // 2024-01-01 is a Monday
  return POOLS[Math.max(0, Math.floor(weeks)) % POOLS.length]!;
}

export interface MarketState {
  lastWeek: string | null;
  bought: Partial<Record<MarketItemId, string>>; // itemId -> weekStart it was bought in
}

export const defaultMarket = (): MarketState => ({ lastWeek: null, bought: {} });

export type MarketBuyResult<T> =
  | { ok: true; data: T; message: string }
  | { ok: false; reason: "not-in-stock" | "already-bought" | "not-enough-coins" };

/** Minimal shape the buyer needs. */
export interface MarketData {
  game: { catCoins: number; spinTickets?: number };
  inventory: { freezes: number; materials: Materials };
  petState: PetState;
  market: MarketState;
}

/** Buys one market item. Mutates nothing; returns a new data object or a failure reason. */
export function buyMarket<T extends MarketData>(
  data: T,
  id: MarketItemId,
  now: Date,
  random: () => number = Math.random,
): MarketBuyResult<T> {
  const week = weekStart(now);
  if (!marketStock(now).includes(id)) return { ok: false, reason: "not-in-stock" };
  if (data.market.bought[id] === week) return { ok: false, reason: "already-bought" };
  const item = MARKET_ITEMS[id];
  if (data.game.catCoins < item.price) return { ok: false, reason: "not-enough-coins" };

  const base: T = {
    ...data,
    game: { ...data.game, catCoins: data.game.catCoins - item.price },
    market: { lastWeek: week, bought: { ...data.market.bought, [id]: week } },
  };
  const message = `Đã mua ${item.emoji} ${item.name}!`;
  if (id === "shield") {
    return {
      ok: true,
      data: { ...base, inventory: { ...data.inventory, freezes: data.inventory.freezes + 1 } },
      message: "🛡️ +1 🧊 bảo hộ streak!",
    };
  }
  if (id === "galaxy" || id === "starClock") {
    return {
      ok: true,
      data: {
        ...base,
        petState: { ...data.petState, decorOwned: [...data.petState.decorOwned, id] },
      },
      message: `${item.emoji} ${item.name} vào kho decor — bày ở Pet Shop nhé!`,
    };
  }
  if (id === "ticket") {
    return {
      ok: true,
      data: { ...base, game: { ...base.game, spinTickets: (base.game.spinTickets ?? 0) + 1 } },
      message: "🎟️ +1 lượt quay may mắn!",
    };
  }
  if (id === "heal") {
    return {
      ok: true,
      data: {
        ...base,
        petState: {
          ...data.petState,
          happiness: 100,
          hunger: Math.min(100, data.petState.hunger + 40),
        },
      },
      message: "🧪 Thú cưng hồi phục — 💗 đầy 100 và bụng no hơn!",
    };
  }
  if (id === "honey") {
    const { pet, levelsGained } = grantPetXp(data.petState, 60);
    return {
      ok: true,
      data: { ...base, petState: pet },
      message: levelsGained > 0 ? "🍯 Thú cưng +60 💫 và tăng cấp!" : "🍯 Thú cưng +60 💫!",
    };
  }
  // Mystery box: 1–3 of one random material kind.
  const kinds: (keyof Materials)[] = ["magicFeather", "starShard", "mysticHerb"];
  const matId = kinds[Math.floor(random() * kinds.length)]!;
  const n = 1 + Math.floor(random() * 3);
  return {
    ok: true,
    data: {
      ...base,
      inventory: {
        ...data.inventory,
        materials: {
          ...data.inventory.materials,
          [matId]: data.inventory.materials[matId] + n,
        },
      },
    },
    message: `🎁 Hộp May Mắn: +${n} nguyên liệu!`,
  };
}
