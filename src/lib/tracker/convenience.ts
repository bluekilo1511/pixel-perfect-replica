// Tiệm Tiện Ích — everyday convenience store: unlimited coin-bought consumables.
// Unlike Chợ Hư Không (weekly rotation, 1 buy/item/week) these are always in stock.
// Pure logic: the caller owns the data object, this only reshapes it.
import { bumpPet, type Inventory, type PetState } from "./gamify";
import { grantPetXp, petTitle } from "./extras";
import { addXp, dateStr, type GameState } from "./model";

export type ConvenienceId = "charm" | "feast" | "carousel" | "stardust" | "honeyMini";

export interface ConvenienceItem {
  id: ConvenienceId;
  emoji: string;
  name: string;
  desc: string;
  price: number; // 😺 cat coins
}

export const CONVENIENCE_ITEMS: Record<ConvenienceId, ConvenienceItem> = {
  charm: {
    id: "charm",
    emoji: "🛡️",
    name: "Bùa Giữ Chuỗi",
    desc: "+1 🧊 bảo hộ streak — mua thoải mái, không giới hạn tuần",
    price: 30,
  },
  feast: {
    id: "feast",
    emoji: "🍜",
    name: "Bữa Thịnh Soạn",
    desc: "Thú cưng no căng: +60 🍖 no bụng, +10 💗 vui vẻ",
    price: 10,
  },
  carousel: {
    id: "carousel",
    emoji: "🎠",
    name: "Vòng Xoay Nhạc",
    desc: "Thú cưng vui hết nấc: +60 💗 vui vẻ",
    price: 10,
  },
  stardust: {
    id: "stardust",
    emoji: "✨",
    name: "Hạt Bụi Sao",
    desc: "+40 ⭐ kinh nghiệm cho chính bạn — ăn nhanh gấp Mật Tuệ",
    price: 8,
  },
  honeyMini: {
    id: "honeyMini",
    emoji: "🍯",
    name: "Mật Nhỏ",
    desc: "+30 💫 kinh nghiệm thú cưng",
    price: 8,
  },
};

/** Minimal shape the shop needs — full app data is a superset. */
export interface ConvenienceData {
  game: Pick<GameState, "level" | "xp" | "catCoins">;
  inventory: Pick<Inventory, "freezes">;
  petState: Pick<PetState, "hunger" | "happiness" | "petLevel" | "petXp">;
  dailyStats?: Record<string, { treats?: number }>;
}

export type ConvenienceBuyResult<T extends ConvenienceData> =
  | {
      ok: true;
      data: T;
      message: string;
      levelsGained: number;
      petLevelsGained: number;
      /** True when the pet crossed a tier boundary (title/form changed). */
      petEvolved: boolean;
    }
  | { ok: false; reason: "unknown" | "not-enough-coins" };

/** Buys one convenience item. Mutates nothing; returns a new data object or a failure reason. */
export function buyConvenience<T extends ConvenienceData>(
  data: T,
  id: ConvenienceId,
): ConvenienceBuyResult<T> {
  const item = CONVENIENCE_ITEMS[id];
  if (!item) return { ok: false, reason: "unknown" };
  if (data.game.catCoins < item.price) return { ok: false, reason: "not-enough-coins" };

  const base: T = {
    ...data,
    game: { ...data.game, catCoins: data.game.catCoins - item.price },
  };
  switch (id) {
    case "charm":
      return {
        ok: true,
        data: {
          ...base,
          inventory: { ...base.inventory, freezes: base.inventory.freezes + 1 },
        },
        message: "🛡️ +1 🧊 bảo hộ streak!",
        levelsGained: 0,
        petLevelsGained: 0,
        petEvolved: false,
      };
    case "feast": {
      // A shop feast is still feeding the pet — it counts toward the daily quest.
      const today = dateStr();
      const ds = base.dailyStats ?? {};
      const treats = ds[today]?.treats ?? 0;
      return {
        ok: true,
        data: {
          ...base,
          dailyStats: { ...ds, [today]: { ...ds[today], treats: treats + 1 } },
          petState: bumpPet(base.petState as PetState, 60, 10),
        },
        message: "🍜 Thú cưng no căng bụng!",
        levelsGained: 0,
        petLevelsGained: 0,
        petEvolved: false,
      };
    }
    case "carousel":
      return {
        ok: true,
        data: { ...base, petState: bumpPet(base.petState as PetState, 0, 60) },
        message: "🎠 Thú cưng vui hết nấc!",
        levelsGained: 0,
        petLevelsGained: 0,
        petEvolved: false,
      };
    case "stardust": {
      const { game, levelsGained } = addXp(base.game as GameState, 40);
      return {
        ok: true,
        data: { ...base, game },
        message: "✨ +40 ⭐ kinh nghiệm!",
        levelsGained,
        petLevelsGained: 0,
        petEvolved: false,
      };
    }
    case "honeyMini": {
      const r = grantPetXp(base.petState as PetState, 30);
      const title = r.evolved ? petTitle(r.pet) : null;
      return {
        ok: true,
        data: { ...base, petState: r.pet },
        message: title
          ? `🍯 Thú cưng +30 💫 và tiến hóa thành ${title}!`
          : r.levelsGained > 0
            ? "🍯 Thú cưng +30 💫 và tăng cấp!"
            : "🍯 Thú cưng +30 💫 kinh nghiệm!",
        levelsGained: 0,
        petLevelsGained: r.levelsGained,
        petEvolved: r.evolved,
      };
    }
  }
}
