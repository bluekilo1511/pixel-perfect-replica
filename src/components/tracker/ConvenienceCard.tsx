import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { CONVENIENCE_ITEMS, buyConvenience, type ConvenienceId } from "@/lib/tracker/convenience";
import { levelUpFx, ting } from "@/lib/tracker/effects";
import { Button } from "@/components/ui/button";

/** Tiệm Tiện Ích — everyday coin shop: unlimited consumables, no weekly cap. */
export function ConvenienceCard() {
  const { data, update } = useTracker();

  const buy = (id: ConvenienceId) => {
    const r = buyConvenience(data, id);
    if (!r.ok) {
      toast.error("Chưa đủ 😺");
      return;
    }
    update(() => r.data);
    ting();
    toast.success(r.message);
    if (r.levelsGained > 0) levelUpFx();
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
