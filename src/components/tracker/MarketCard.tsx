import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import {
  buyMarket,
  haggleWon,
  MARKET_ITEMS,
  marketPrice,
  marketPriceWithHaggle,
  marketStock,
  resolveHaggle,
  startHaggle,
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
  const [openHaggle, setOpenHaggle] = useState<MarketItemId | null>(null);

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
          const won = haggleWon(data, id, week);
          const price = marketPriceWithHaggle(m, data.petState, won);
          const tierPrice = marketPrice(m, data.petState);
          const deal = data.market.haggle[id];
          const dealt = !!deal && deal.week === week;
          const haggleOpen = openHaggle === id;
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
              ) : haggleOpen && !dealt ? (
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">
                    Chọn 1 rương — 1 trong 3 giấu ưu đãi 🤝
                  </p>
                  <div className="flex justify-center gap-1">
                    {[0, 1, 2].map((crate) => (
                      <Button
                        key={crate}
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        onClick={() => {
                          const d1 = startHaggle(data, id, now);
                          const d2 = resolveHaggle(d1, id, crate);
                          update(() => d2);
                          const h = d2.market.haggle[id];
                          const wonNow = !!h && h.picked === h.win;
                          toast[wonNow ? "success" : "info"](
                            wonNow
                              ? "🤝 Đàm phán thần thánh! Giảm 20% món này tuần này"
                              : "😤 Ông chủ lắc đầu… không giảm được gì",
                          );
                        }}
                      >
                        🎁
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {dealt && (
                    <p
                      className="text-[10px] text-muted-foreground"
                      title="Mỗi món chỉ trả giá 1 lần/tuần"
                    >
                      {won ? "🤝 Đã trả giá: -20%" : "🤝 Đã trả giá: thất bại"}
                    </p>
                  )}
                  {!dealt && (
                    <button
                      type="button"
                      className="mx-auto block text-[10px] text-primary hover:underline"
                      title="Thử trả giá: 1/3 rương giấu ưu đãi giảm 20%"
                      onClick={() => setOpenHaggle(id)}
                    >
                      🤝 Trả giá?
                    </button>
                  )}
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
                    {price < m.price ? (
                      <span
                        title={
                          won
                            ? "🤝 Giá sau khi trả giá thành công (-20%)"
                            : "🐾 Ưu đãi thú cưng tier 2: giảm 10%"
                        }
                      >
                        <s className="mr-1 opacity-60">{m.price}</s>
                        {price} 😺
                      </span>
                    ) : (
                      `${m.price} 😺`
                    )}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
