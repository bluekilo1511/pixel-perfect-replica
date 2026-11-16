import { useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { useTracker } from "@/lib/tracker/store";
import {
  canCraft,
  payRecipe,
  RECIPES,
  type Recipe,
  type MaterialId,
  MATERIALS,
  MATERIAL_IDS,
} from "@/lib/tracker/extras";
import { ACCESSORY_SLOT } from "@/lib/tracker/gamify";
import { celebrate } from "@/lib/tracker/effects";
import { Button } from "@/components/ui/button";
import { Sparkles, Hammer, Check, Lock, Flame } from "lucide-react";

// 3x3 layout patterns for each recipe (indices 0..8)
const RECIPE_GRIDS: Record<string, Record<number, MaterialId>> = {
  freeze: {
    1: "mysticHerb",
    4: "starShard",
    7: "mysticHerb",
  },
  wings: {
    0: "magicFeather",
    2: "magicFeather",
    4: "starShard",
  },
  elixir: {
    1: "magicFeather",
    4: "starShard",
    7: "mysticHerb",
  },
};

export function AlchemyForge() {
  const { data, update } = useTracker();
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>("freeze");
  const [isBlasting, setIsBlasting] = useState(false);

  const materials = data.inventory.materials;
  const pet = data.petState;

  const selectedRecipe = RECIPES.find((r) => r.id === selectedRecipeId) ?? RECIPES[0]!;

  const hasMaterials = canCraft(materials, selectedRecipe);
  const alreadyOwned =
    "accessory" in selectedRecipe.result &&
    pet.ownedAccessories.includes(selectedRecipe.result.accessory);

  const activePattern = RECIPE_GRIDS[selectedRecipeId] || {};

  const handleTransmute = () => {
    if (!hasMaterials) {
      toast.error("Chưa đủ nguyên liệu luyện kim trong túi đồ!");
      return;
    }
    if (alreadyOwned) {
      toast("Bạn đã sở hữu bảo vật này rồi ✨");
      return;
    }

    setIsBlasting(true);

    // Golden blast effect
    try {
      void confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#fbbf24", "#f59e0b", "#d97706", "#fef08a", "#ffffff"],
      });
    } catch {
      /* ignore */
    }
    celebrate();

    update((d) => {
      const invMaterials = payRecipe(d.inventory.materials, selectedRecipe);
      const inventory = { ...d.inventory, materials: invMaterials };

      if ("freezes" in selectedRecipe.result) {
        return {
          ...d,
          inventory: {
            ...inventory,
            freezes: inventory.freezes + selectedRecipe.result.freezes,
          },
        };
      }

      if ("accessory" in selectedRecipe.result) {
        const ac = selectedRecipe.result.accessory;
        return {
          ...d,
          inventory,
          petState: {
            ...d.petState,
            ownedAccessories: [...d.petState.ownedAccessories, ac],
            accessories: { ...d.petState.accessories, [ACCESSORY_SLOT[ac]]: ac },
          },
        };
      }

      if ("petXp" in selectedRecipe.result) {
        return {
          ...d,
          inventory,
          petState: {
            ...d.petState,
            petXp: d.petState.petXp + selectedRecipe.result.petXp,
          },
        };
      }

      return { ...d, inventory };
    });

    toast.success(`✨ Luyện kim thành công: ${selectedRecipe.emoji} ${selectedRecipe.name}!`);
    setTimeout(() => setIsBlasting(false), 800);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#1c1305] via-[#120b02] to-[#0a0601] p-6 text-white shadow-2xl">
      {/* Golden Blast Ambient Glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-all duration-700 ${
          isBlasting
            ? "h-96 w-96 bg-amber-400/40 animate-pulse scale-125"
            : "h-64 w-64 bg-amber-600/10"
        }`}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-950/60 shadow-[0_0_20px_rgba(245,158,11,0.35)]">
              <Hammer className={`h-6 w-6 text-amber-300 ${isBlasting ? "animate-bounce" : ""}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Lò Luyện Kim 3x3 (Alchemy Forge)</h2>
                <span className="rounded-full border border-amber-400/30 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                  Golden Blast
                </span>
              </div>
              <p className="text-xs text-amber-200/60">
                Sắp xếp nguyên liệu vào ma trận 3×3 để rèn giáp bảo vệ và trang bị thần thoại cho thú cưng.
              </p>
            </div>
          </div>

          {/* Current Materials Wallet */}
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs">
            {MATERIAL_IDS.map((m) => (
              <div key={m} className="flex items-center gap-1">
                <span>{MATERIALS[m].emoji}</span>
                <span className="font-semibold text-white/90">{materials[m] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Forge Interface */}
        <div className="mt-6 grid gap-6 lg:grid-cols-12 items-center">
          {/* Left Column: Recipe Selection */}
          <div className="lg:col-span-5 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/70">
              Công thức rèn ({RECIPES.length})
            </span>

            <div className="space-y-2">
              {RECIPES.map((r) => {
                const active = selectedRecipeId === r.id;
                const can = canCraft(materials, r);
                const owned = "accessory" in r.result && pet.ownedAccessories.includes(r.result.accessory);

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRecipeId(r.id)}
                    className={`w-full text-left rounded-2xl border p-3.5 transition-all flex items-center justify-between gap-3 ${
                      active
                        ? "border-amber-400 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                        : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{r.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-white">{r.name}</span>
                          {owned && (
                            <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 text-[10px] font-bold">
                              Đã có
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
                          {Object.entries(r.cost).map(([k, count]) => {
                            if (!count) return null;
                            const have = materials[k as MaterialId] || 0;
                            const enough = have >= count;
                            return (
                              <span
                                key={k}
                                className={enough ? "text-amber-200" : "text-destructive font-medium"}
                              >
                                {MATERIALS[k as MaterialId].emoji} {have}/{count}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {owned ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : can ? (
                        <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
                      ) : (
                        <Lock className="h-4 w-4 text-white/30" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: 3x3 Alchemy Matrix & Transmute Action */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center p-4 rounded-3xl border border-amber-500/20 bg-amber-950/20 backdrop-blur-sm">
            <div className="relative mb-6">
              {/* Central Alchemical Runes Ring */}
              <div
                aria-hidden
                className={`absolute inset-0 -m-6 rounded-full border border-dashed border-amber-400/30 transition-transform duration-1000 ${
                  isBlasting ? "animate-spin scale-110 border-amber-400" : ""
                }`}
              />

              {/* 3x3 Grid */}
              <div className="relative grid grid-cols-3 gap-3 p-2">
                {Array.from({ length: 9 }, (_, index) => {
                  const mat = activePattern[index];
                  const hasSlotMat = mat ? (materials[mat] || 0) > 0 : false;

                  return (
                    <div
                      key={index}
                      className={`relative flex h-20 w-20 sm:h-24 sm:w-24 flex-col items-center justify-center rounded-2xl border transition-all duration-300 ${
                        mat
                          ? hasSlotMat
                            ? "border-amber-400/60 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)] scale-100"
                            : "border-destructive/40 bg-destructive/10"
                          : "border-white/5 bg-black/30"
                      } ${isBlasting && mat ? "animate-pulse border-amber-300 scale-105" : ""}`}
                    >
                      {mat ? (
                        <>
                          <span className="text-3xl sm:text-4xl drop-shadow">
                            {MATERIALS[mat].emoji}
                          </span>
                          <span className="mt-1 text-[10px] font-medium text-amber-200/80">
                            {MATERIALS[mat].name}
                          </span>
                        </>
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-white/10" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Transmute Button */}
            <div className="flex flex-col items-center gap-2">
              <Button
                size="lg"
                disabled={!hasMaterials || alreadyOwned || isBlasting}
                onClick={handleTransmute}
                className={`h-12 rounded-full px-8 text-sm font-bold shadow-xl transition-all duration-300 ${
                  hasMaterials && !alreadyOwned
                    ? "border border-amber-300 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black hover:from-amber-400 hover:to-yellow-400 shadow-amber-500/30 hover:scale-105"
                    : "border-white/10 bg-white/10 text-white/40 cursor-not-allowed"
                }`}
              >
                <Flame className="mr-2 h-4 w-4 fill-current" />
                {alreadyOwned
                  ? "Đã sở hữu bảo vật này"
                  : hasMaterials
                    ? `Kích hoạt Luyện Kim: ${selectedRecipe.name}`
                    : "Thiếu nguyên liệu"}
              </Button>
              <p className="text-[11px] text-amber-200/50">
                Hiệu ứng ánh vàng (Golden Blast) sẽ kích hoạt khi hoàn thành công thức.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
