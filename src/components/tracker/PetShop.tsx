import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import {
  ACCESSORIES,
  buyDecor,
  bumpPet,
  CONSUMABLES,
  DECORATIONS,
  FREEZE_PRICE,
  MAX_ACTIVE_DECOR,
  SPECIES,
  toggleDecor,
  type Accessory,
  type DecorId,
  type Species,
} from "@/lib/tracker/gamify";
import { ting } from "@/lib/tracker/effects";
import { Button } from "@/components/ui/button";
import {
  canCraft,
  bumpStats,
  MATERIAL_IDS,
  MATERIALS,
  payRecipe,
  RECIPES,
  type Recipe,
} from "@/lib/tracker/extras";
import { dateStr } from "@/lib/tracker/model";
import { MarketCard } from "./MarketCard";
import { celebrate } from "@/lib/tracker/effects";

export function PetShop() {
  const { data, update } = useTracker();
  const g = data.game;
  const pet = data.petState;
  const inv = data.inventory;

  const buyItem = (id: string) => {
    const it = CONSUMABLES[id]!;
    if (g.catCoins < it.price) {
      toast.error("Chưa đủ 😺");
      return;
    }
    update((d) => ({
      ...d,
      game: { ...d.game, catCoins: d.game.catCoins - it.price },
      inventory: {
        ...d.inventory,
        items: { ...d.inventory.items, [id]: (d.inventory.items[id] ?? 0) + 1 },
      },
    }));
    ting();
    toast.success(`Đã mua ${it.emoji} ${it.name}`);
  };
  const applyItem = (id: string) => {
    const it = CONSUMABLES[id]!;
    if (!inv.items[id]) return;
    update((d) => ({
      ...d,
      dailyStats: bumpStats(d.dailyStats, dateStr(), { treats: 1 }),
      petState: bumpPet(d.petState, it.hunger, it.happiness),
      inventory: {
        ...d.inventory,
        items: { ...d.inventory.items, [id]: (d.inventory.items[id] ?? 1) - 1 },
      },
    }));
    ting();
    toast(`${SPECIES[pet.species].emoji} Măm măm! Cảm ơn ${it.emoji}`);
  };
  const gem = (price: number, apply: (d: typeof data) => typeof data, msg: string) => {
    if (g.lizardGems < price) {
      toast.error("Chưa đủ 🦎");
      return;
    }
    update((d) => apply({ ...d, game: { ...d.game, lizardGems: d.game.lizardGems - price } }));
    ting();
    toast.success(msg);
  };

  const mats = inv.materials;
  const craft = (r: Recipe) => {
    if (!canCraft(mats, r)) {
      toast.error("Chưa đủ nguyên liệu");
      return;
    }
    if ("accessory" in r.result && pet.ownedAccessories.includes(r.result.accessory)) {
      toast("Bạn đã sở hữu món này rồi ✨");
      return;
    }
    update((d) => {
      const inventory = { ...d.inventory, materials: payRecipe(d.inventory.materials, r) };
      if ("freezes" in r.result)
        return { ...d, inventory: { ...inventory, freezes: inventory.freezes + r.result.freezes } };
      if (!("accessory" in r.result)) return { ...d, inventory };
      const ac = r.result.accessory;
      return {
        ...d,
        inventory,
        petState: {
          ...d.petState,
          ownedAccessories: [...d.petState.ownedAccessories, ac],
          accessory: ac,
        },
      };
    });
    celebrate();
    toast.success(`⚗️ Rèn thành công ${r.emoji} ${r.name}!`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2" data-pet-interactions>
      <section className="glass p-5 lg:col-span-2">
        <h2 className="mb-1 text-lg font-semibold">⚗️ Lò Giả Kim</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Hoàn thành task hoặc quay thưởng có 20% cơ hội rơi nguyên liệu. Kết hợp chúng để rèn đồ
          siêu hiếm — không tốn 🦎.
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {MATERIAL_IDS.map((id) => (
            <span key={id} className="rounded-full bg-secondary px-3 py-1.5 text-sm">
              {MATERIALS[id].emoji} {MATERIALS[id].name} ×{mats[id] ?? 0}
            </span>
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {RECIPES.map((r) => {
            const ok = canCraft(mats, r);
            const owned =
              "accessory" in r.result && pet.ownedAccessories.includes(r.result.accessory);
            return (
              <li
                key={r.id}
                className={`flex items-center gap-3 rounded-xl p-3 ${ok && !owned ? "bg-secondary glass-glow" : "bg-muted"}`}
              >
                <span className="text-4xl">{r.emoji}</span>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {MATERIAL_IDS.filter((id) => r.cost[id])
                      .map((id) => `${MATERIALS[id].emoji}×${r.cost[id]}`)
                      .join(" + ")}
                  </p>
                </div>
                <Button size="sm" disabled={!ok || owned} onClick={() => craft(r)}>
                  {owned ? "Đã có" : "Rèn"}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="glass p-5">
        <h2 className="mb-1 text-lg font-semibold">🛒 Cửa hàng 😺</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Thức ăn & đồ chơi cho thú cưng. Bạn có {g.catCoins} 😺
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {Object.entries(CONSUMABLES).map(([id, it]) => (
            <li key={id} className="flex items-center gap-3 rounded-xl bg-muted p-3">
              <span className="text-3xl">{it.emoji}</span>
              <div className="flex-1 text-sm">
                <p className="font-medium">{it.name}</p>
                <p className="text-xs text-muted-foreground">
                  {it.hunger ? `+${it.hunger}🍖 ` : ""}
                  {it.happiness ? `+${it.happiness}💖` : ""}
                </p>
              </div>
              <Button size="sm" onClick={() => buyItem(id)}>
                {it.price} 😺
              </Button>
            </li>
          ))}
        </ul>
        <h3 className="mb-2 mt-6 font-semibold">🎒 Tủ đồ</h3>
        <ul className="flex flex-wrap gap-2">
          {Object.entries(CONSUMABLES)
            .filter(([id]) => (inv.items[id] ?? 0) > 0)
            .map(([id, it]) => (
              <li key={id}>
                <Button variant="outline" size="sm" onClick={() => applyItem(id)}>
                  {it.emoji} {it.name} ×{inv.items[id]} · Dùng
                </Button>
              </li>
            ))}
          <li className="rounded-full bg-secondary px-3 py-1.5 text-sm">
            🧊 Bình đóng băng ×{inv.freezes}
          </li>
        </ul>
      </section>

      <section className="glass p-5">
        <h2 className="mb-1 text-lg font-semibold">✨ Cửa hàng 🦎</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Mở khóa linh thú, phụ kiện và bảo vệ streak. Bạn có {g.lizardGems} 🦎
        </p>
        <h3 className="mb-2 font-semibold">Linh thú</h3>
        <ul className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(SPECIES) as Species[]).map((sp) => {
            const m = SPECIES[sp];
            const owned = pet.ownedSpecies.includes(sp);
            const active = pet.species === sp;
            return (
              <li
                key={sp}
                className={`rounded-xl p-3 text-center ${active ? "bg-secondary glass-glow" : "bg-muted"}`}
              >
                <div className="text-4xl">{m.emoji}</div>
                <p className="my-1 text-sm font-medium">{m.name}</p>
                {owned ? (
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "outline"}
                    disabled={active}
                    onClick={() =>
                      update((d) => ({ ...d, petState: { ...d.petState, species: sp } }))
                    }
                  >
                    {active ? "Đang dùng" : "Chọn"}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() =>
                      gem(
                        m.price,
                        (d) => ({
                          ...d,
                          petState: {
                            ...d.petState,
                            ownedSpecies: [...d.petState.ownedSpecies, sp],
                            species: sp,
                          },
                        }),
                        `Đã mở khóa ${m.emoji} ${m.name}!`,
                      )
                    }
                  >
                    {m.price} 🦎
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <h3 className="mb-2 font-semibold">Phụ kiện đội đầu</h3>
        <ul className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {(Object.keys(ACCESSORIES) as Accessory[])
            .filter((ac) => !ACCESSORIES[ac].craftOnly || pet.ownedAccessories.includes(ac))
            .map((ac) => {
              const m = ACCESSORIES[ac];
              const owned = pet.ownedAccessories.includes(ac);
              const worn = pet.accessory === ac;
              return (
                <li
                  key={ac}
                  className={`rounded-xl p-3 text-center ${worn ? "bg-secondary glass-glow" : "bg-muted"}`}
                >
                  <div className="text-3xl">{m.emoji}</div>
                  <p className="my-1 text-xs font-medium">{m.name}</p>
                  {owned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          petState: { ...d.petState, accessory: worn ? null : ac },
                        }))
                      }
                    >
                      {worn ? "Tháo" : "Đội"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        gem(
                          m.price,
                          (d) => ({
                            ...d,
                            petState: {
                              ...d.petState,
                              ownedAccessories: [...d.petState.ownedAccessories, ac],
                              accessory: ac,
                            },
                          }),
                          `Đã mua ${m.emoji} ${m.name}!`,
                        )
                      }
                    >
                      {m.price} 🦎
                    </Button>
                  )}
                </li>
              );
            })}
        </ul>
        <h3 className="mb-2 mt-6 font-semibold">🏠 Trang trí phòng</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Đồ trang trí cho góc học tập của thú cưng — bày tự do trong phòng 3D, không giới hạn!
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(DECORATIONS) as DecorId[])
            .filter((id) => !DECORATIONS[id].marketOnly)
            .map((id) => {
              const m = DECORATIONS[id];
              const owned = pet.decorOwned.includes(id);
              const placed = pet.decorActive.includes(id);
              return (
                <li
                  key={id}
                  className={`rounded-xl p-3 text-center ${placed ? "bg-secondary glass-glow" : "bg-muted"}`}
                >
                  <div className="text-3xl">{m.emoji}</div>
                  <p className="my-1 text-xs font-medium">{m.name}</p>
                  {owned ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!placed && pet.decorActive.length >= MAX_ACTIVE_DECOR) {
                          toast.error('Phòng đã bày đủ tất cả các món rồi!');
                          return;
                        }
                        update((d) => {
                          const r = toggleDecor(d.petState, id);
                          return r ? { ...d, petState: r.pet } : d;
                        });
                        toast(
                          placed
                            ? `Đã cất ${m.emoji} ${m.name} vào tủ`
                            : `Đã bày ${m.emoji} ${m.name} trong phòng 🏠`,
                        );
                      }}
                    >
                      {placed ? "Cất đi" : "Bày ra"}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() =>
                        gem(
                          m.price,
                          (d) => ({ ...d, petState: buyDecor(d.petState, id) ?? d.petState }),
                          `Đã mua ${m.emoji} ${m.name}!`,
                        )
                      }
                    >
                      {m.price} 🦎
                    </Button>
                  )}
                </li>
              );
            })}
        </ul>
        <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted p-3">
          <span className="text-3xl">🧊</span>
          <div className="flex-1 text-sm">
            <p className="font-medium">Bình đóng băng</p>
            <p className="text-xs text-muted-foreground">
              Tự cứu chuỗi streak nếu bạn quên vào web 1 ngày.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              gem(
                FREEZE_PRICE,
                (d) => ({ ...d, inventory: { ...d.inventory, freezes: d.inventory.freezes + 1 } }),
                "Đã mua 🧊 Bình đóng băng",
              )
            }
          >
            {FREEZE_PRICE} 🦎
          </Button>
        </div>
      </section>
      <MarketCard />
    </div>
  );
}
