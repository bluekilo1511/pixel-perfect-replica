import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import {
  buyMarket,
  MARKET_ITEMS,
  marketPrice,
  marketStock,
  weekStart,
  type MarketItemId,
} from "@/lib/tracker/market";
import { petEmoji, petTitle, tierOf } from "@/lib/tracker/extras";
import { levelUpFx } from "@/lib/tracker/effects";
import { Button } from "@/components/ui/button";

/** Chợ Hư Không — weekly rotating shop paid in cat coins. */
export function MarketCard() {
  const { data, update, showEvolution } = useTracker();
  const now = new Date();
  const stock = marketStock(now);
  const week = weekStart(now);

  return (
    <section className="glass p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold">🌀 Chợ Hư Không</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
          {data.game.catCoins} 😺
        </span>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Chợ nạp hàng ngẫu nhiên mỗi thứ Hai, mỗi món mua 1 lần/tuần — hàng hiếm cần đủ cấp độ và chỉ
        có ở đây.
        {tierOf(data.petState.petLevel || 1) >= 2 &&
          ` ${petEmoji(data.petState)} Thú cưng tier 2 của bạn được giảm 10% mọi món!`}
      </p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {stock.map((id: MarketItemId) => {
          const m = MARKET_ITEMS[id];
          const soldOut = data.market.bought[id] === week;
          const locked = m.minLevel != null && data.game.level < m.minLevel;
          const ownedDecor =
            (id === "galaxy" || id === "starClock" || id === "moonLamp" || id === "phoenix") &&
            data.petState.decorOwned.includes(id);
          const price = marketPrice(m, data.petState);
          const discounted = price < m.price;
          return (
            <li
              key={id}
              className={`rounded-xl p-3 text-center ${soldOut || locked || ownedDecor ? "bg-muted opacity-70" : "bg-muted"}`}
            >
              <div className="text-3xl">{locked ? "🔒" : m.emoji}</div>
              <p className="my-1 text-xs font-medium">{m.name}</p>
              <p className="mb-2 text-[11px] text-muted-foreground">{m.desc}</p>
              {ownedDecor ? (
                <Button size="sm" variant="outline" disabled>
                  Đã sở hữu ✓
                </Button>
              ) : soldOut ? (
                <Button size="sm" variant="outline" disabled>
                  Đã mua tuần này
                </Button>
              ) : locked ? (
                <Button size="sm" variant="outline" disabled>
                  🔒 Cần Lv {m.minLevel}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    const r = buyMarket(data, id, new Date());
                    if (!r.ok) {
                      toast.error(
                        r.reason === "not-enough-coins"
                          ? "Chưa đủ 😺 — làm nhiệm vụ thêm nào!"
                          : r.reason === "owned"
                            ? "Bạn đang sở hữu món decor này rồi ✨"
                            : r.reason === "locked"
                              ? `🔒 Cần Lv ${m.minLevel} mới mua được món này`
                              : "Hiện không mua được món này",
                      );
                      return;
                    }
                    update(() => r.data);
                    toast.success(r.message);
                    if (r.petEvolved) {
                      levelUpFx();
                      showEvolution({
                        from: petEmoji(data.petState),
                        to: petEmoji(r.data.petState),
                        title: petTitle(r.data.petState),
                      });
                    }
                  }}
                >
                  {discounted ? (
                    <span title="🐾 Ưu đãi thú cưng tier 2: giảm 10%">
                      <s className="mr-1 opacity-60">{m.price}</s>
                      {price} 😺
                    </span>
                  ) : (
                    `${m.price} 😺`
                  )}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
