import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { CONVENIENCE_ITEMS, buyConvenience, type ConvenienceId } from "@/lib/tracker/convenience";
import { petEmoji, petTitle } from "@/lib/tracker/extras";
import type { PetState } from "@/lib/tracker/gamify";
import { levelUpFx, ting } from "@/lib/tracker/effects";
import { Button } from "@/components/ui/button";

/** Tiệm Tiện Ích — everyday coin shop: unlimited consumables, no weekly cap. */
export function ConvenienceCard() {
  const { data, update, showEvolution } = useTracker();

  const buy = (id: ConvenienceId) => {
    let resultMsg = "";
    let levelsGained = 0;
    let petEvolved = false;
    let evo: { from: string; to: string; title: string } | null = null;

    update((prev) => {
      const r = buyConvenience(prev, id);
      if (!r.ok) {
        toast.error("Chưa đủ 😺");
        return prev;
      }
      resultMsg = r.message;
      levelsGained = r.levelsGained;
      petEvolved = r.petEvolved;
      if (r.petEvolved) {
        evo = {
          from: petEmoji(prev.petState as PetState),
          to: petEmoji(r.data.petState as PetState),
          title: petTitle(r.data.petState as PetState),
        };
      }
      return r.data;
    });

    if (resultMsg) {
      ting();
      toast.success(resultMsg);
      if (levelsGained > 0) levelUpFx();
      if (petEvolved && evo) {
        levelUpFx();
        showEvolution(evo);
      }
    }
  };

  return (
    <section className="glass p-5">
      <h2 className="mb-1 text-lg font-semibold">🏪 Tiệm Tiện Ích</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Đồ tiêu hao mỗi ngày — mua thoải mái bằng 😺, không giới hạn số lần trong tuần.
      </p>
      <ul className="space-y-3">
        {Object.values(CONVENIENCE_ITEMS).map((it) => (
          <li key={it.id} className="flex items-center gap-3 rounded-xl bg-muted p-3">
            <span className="text-3xl">{it.emoji}</span>
            <div className="flex-1 text-sm">
              <p className="font-medium">{it.name}</p>
              <p className="text-xs text-muted-foreground">{it.desc}</p>
            </div>
            <Button size="sm" onClick={() => buy(it.id)}>
              {it.price} 😺
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
