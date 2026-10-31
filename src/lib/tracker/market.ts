import { DECORATIONS, daysBetween, shiftDate, type DecorId, type PetState } from "./gamify";
import { grantPetXp, petTitle, tierOf, type Materials } from "./extras";

/**
 * Chợ Hư Không — a weekly shop that rotates its stock every Monday.
 * Pure logic: the caller owns the data object, this only reshapes it.
 */

export type MarketItemId =
  | "shield"
  | "honey"
  | "box"
  | "galaxy"
  | "starClock"
  | "heal"
  | "ticket"
  | "tome"
  | "megaBox"
  | "moonLamp"
  | "phoenix"
  | "gemPouch";

export interface MarketItem {
  id: MarketItemId;
  emoji: string;
  name: string;
  desc: string;
  price: number; // 😺 cat coins
  minLevel?: number; // rare goods: locked until the player reaches this level
  rare?: boolean; // only up to 2 rares are stocked each week
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
  tome: {
    id: "tome",
    emoji: "📕",
    name: "Sách Cổ Chép",
    desc: "+80 ⭐ kinh nghiệm cho chính bạn — đường tắt lên cấp",
    price: 20,
    minLevel: 2,
    rare: true,
  },
  megaBox: {
    id: "megaBox",
    emoji: "🧰",
    name: "Rương Thần Kì",
    desc: "Ngẫu nhiên 3–6 nguyên liệu luyện chế — bản lớn của Hộp May Mắn",
    price: 25,
    minLevel: 3,
    rare: true,
  },
  moonLamp: {
    id: "moonLamp",
    emoji: "🌙",
    name: "Đèn Trăng Non",
    desc: "Decor hiếm phát sáng cho góc học — chỉ có ở Chợ Hư Không",
    price: 40,
    minLevel: 4,
    rare: true,
  },
  phoenix: {
    id: "phoenix",
    emoji: "🔥",
    name: "Tranh Phượng Hoàng",
    desc: "Decor hiếm: bức họa phượng hoàng lửa — chỉ có ở Chợ Hư Không",
    price: 45,
    minLevel: 5,
    rare: true,
  },
  gemPouch: {
    id: "gemPouch",
    emoji: "💎",
    name: "Túi Ngọc Rồng",
    desc: "+2 🦎 ngọc thằn lằn — đổi xu lấy ngọc hiếm",
    price: 35,
    minLevel: 6,
    rare: true,
  },
};

// Rare decors are paid in the market, never in the Pet Shop.
export const MARKET_DECOR: DecorId[] = ["galaxy", "starClock"];
export const isMarketDecor = (id: DecorId) => DECORATIONS[id]?.marketOnly === true;

/**
 * Random restock — the shop reshuffles its shelves every Monday.
 * The draw is seeded by the week's Monday so the stock stays the same
 * all week (no refresh-spam), yet is genuinely random week to week.
 * Every week guarantees 2 rare goods + 3 everyday goods.
 */

/** FNV-1a hash of a string, as a uint32 seed. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
  }
  return h >>> 0;
}

/** Mulberry32 — tiny deterministic PRNG, enough for shop shelves. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWith<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

export function marketStock(now: Date): MarketItemId[] {
  const rnd = mulberry32(hashSeed(weekStart(now)));
  const ids = Object.keys(MARKET_ITEMS) as MarketItemId[];
  const commons = ids.filter((id) => !MARKET_ITEMS[id]!.rare);
  const rares = ids.filter((id) => MARKET_ITEMS[id]!.rare);
  const picked = [...shuffleWith(rares, rnd).slice(0, 2), ...shuffleWith(commons, rnd).slice(0, 3)];
  return shuffleWith(picked, rnd);
}

/** The Monday (YYYY-MM-DD) of the week containing `d`. */
export function weekStart(d: Date): string {
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const dow = d.getDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  return shiftDate(date, -back);
}

/** One haggling minigame: 3 crates, one hides the 20% discount. One try per item per week. */
export interface MarketHaggle {
  week: string; // weekStart the deal belongs to
  win: number; // lucky crate index 0..2 (the shopkeeper's secret)
  picked: number | null; // crate the user opened; null until the minigame is played
}

export interface MarketState {
  lastWeek: string | null;
  bought: Partial<Record<MarketItemId, string>>; // itemId -> weekStart it was bought in
  haggle: Record<string, MarketHaggle>; // itemId -> this week's deal state
}

export const defaultMarket = (): MarketState => ({ lastWeek: null, bought: {}, haggle: {} });

/** Winning the haggle cuts 20% off the final price. */
export const HAGGLE_DISCOUNT = 0.8;

/** Opens the haggling minigame for one item this week (no-op if already dealt). */
export function startHaggle<T extends MarketData>(
  data: T,
  id: MarketItemId,
  now: Date,
  random: () => number = Math.random,
): T {
  const week = weekStart(now);
  const cur = data.market.haggle[id];
  if (cur && cur.week === week) return data; // one deal per item per week
  return {
    ...data,
    market: {
      ...data.market,
      haggle: {
        ...data.market.haggle,
        [id]: { week, win: Math.floor(random() * 3), picked: null },
      },
    },
  };
}

/** Opens crate `pick` (0..2); the first open this week is final. Pure. */
export function resolveHaggle<T extends MarketData>(data: T, id: MarketItemId, pick: number): T {
  const cur = data.market.haggle[id];
  if (!cur || cur.picked !== null || pick < 0 || pick > 2) return data;
  return {
    ...data,
    market: {
      ...data.market,
      haggle: { ...data.market.haggle, [id]: { ...cur, picked: pick } },
    },
  };
}

/** True when this week's haggle for `id` was played and won. */
export function haggleWon(data: MarketData, id: MarketItemId, week: string): boolean {
  const h = data.market.haggle[id];
  return !!h && h.week === week && h.picked !== null && h.picked === h.win;
}

/** Final price: VIP tier cut, then a won haggle on top (never below 1 coin). */
export function marketPriceWithHaggle(item: MarketItem, petState: PetState, won: boolean): number {
  const base = marketPrice(item, petState);
  return won ? Math.max(1, Math.floor(base * HAGGLE_DISCOUNT)) : base;
}

export type MarketBuyResult<T> =
  | {
      ok: true;
      data: T;
      message: string;
      /** True when the pet crossed a tier boundary (title/form changed). */
      petEvolved?: boolean;
    }
  | {
      ok: false;
      reason: "not-in-stock" | "already-bought" | "not-enough-coins" | "locked" | "owned";
    };

/** Minimal shape the buyer needs. */
export interface MarketData {
  game: {
    catCoins: number;
    spinTickets?: number;
    level: number;
    xp?: number;
    lizardGems?: number;
  };
  inventory: { freezes: number; materials: Materials };
  petState: PetState;
  market: MarketState;
}

/**
 * Final price of a market item. Tier 2 pets (level 6+) get a standing 10% VIP
 * discount on everything at the Void Market, rounded and never below 1 coin.
 */
export function marketPrice(item: MarketItem, petState: PetState): number {
  const off = tierOf(petState.petLevel || 1) >= 2 ? 0.9 : 1;
  return Math.max(1, Math.round(item.price * off));
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
  // Decor restocks weekly — refuse to charge twice for one the pet already owns.
  if (
    (id === "galaxy" || id === "starClock" || id === "moonLamp" || id === "phoenix") &&
    data.petState.decorOwned.includes(id)
  )
    return { ok: false, reason: "owned" };
  const minLevel = MARKET_ITEMS[id].minLevel;
  if (minLevel != null && data.game.level < minLevel) return { ok: false, reason: "locked" };
  const item = MARKET_ITEMS[id];
  const wonHaggle = haggleWon(data, id, week);
  const price = marketPriceWithHaggle(item, data.petState, wonHaggle);
  if (data.game.catCoins < price) return { ok: false, reason: "not-enough-coins" };

  const base: T = {
    ...data,
    game: { ...data.game, catCoins: data.game.catCoins - price },
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
    const r = grantPetXp(data.petState, 60);
    return {
      ok: true,
      data: { ...base, petState: r.pet },
      message: r.evolved
        ? `🍯 Thú cưng +60 💫 và tiến hóa thành ${petTitle(r.pet)}!`
        : r.levelsGained > 0
          ? "🍯 Thú cưng +60 💫 và tăng cấp!"
          : "🍯 Thú cưng +60 💫!",
      petEvolved: r.evolved,
    };
  }
  if (id === "tome") {
    // XP book: same rule as addXp in model.ts, inlined to avoid an import cycle.
    let level = data.game.level;
    let xp = (data.game.xp ?? 0) + 80;
    while (xp >= level * 100) {
      xp -= level * 100;
      level += 1;
    }
    return {
      ok: true,
      data: { ...base, game: { ...base.game, level, xp } },
      message: level > data.game.level ? "📕 +80 ⭐ và TĂNG CẤP!" : "📕 +80 ⭐ kinh nghiệm!",
    };
  }
  if (id === "gemPouch") {
    return {
      ok: true,
      data: {
        ...base,
        game: { ...base.game, lizardGems: ((base.game.lizardGems as number) ?? 0) + 2 },
      },
      message: "💎 +2 🦎 ngọc thằn lằn!",
    };
  }
  if (id === "moonLamp" || id === "phoenix") {
    return {
      ok: true,
      data: {
        ...base,
        petState: { ...data.petState, decorOwned: [...data.petState.decorOwned, id] },
      },
      message: `${item.emoji} ${item.name} vào kho decor — bày ở Pet Shop nhé!`,
    };
  }
  // Mystery box: 1–3 of one random material kind.
  const kinds: (keyof Materials)[] = ["magicFeather", "starShard", "mysticHerb"];
  const matId = kinds[Math.floor(random() * kinds.length)]!;
  if (id === "megaBox") {
    const n2 = 3 + Math.floor(random() * 4); // 3–6
    return {
      ok: true,
      data: {
        ...base,
        inventory: {
          ...data.inventory,
          materials: {
            ...data.inventory.materials,
            [matId]: data.inventory.materials[matId] + n2,
          },
        },
      },
      message: `🧰 Rương Thần Kì: +${n2} nguyên liệu!`,
    };
  }
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
