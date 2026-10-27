import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import {
  WHEEL_PRIZES,
  MEGA_PRIZES,
  JACKPOT_PRIZE,
  JACKPOT_TICKETS,
  PITY_LIMIT,
  SPIN_COST,
  SPIN_SELL_COINS,
  canSpin,
  isWeekend,
  sellSpinTickets,
  type SpinMode,
} from "@/lib/tracker/model";
import { Badge } from "@/components/ui/badge";
import { wheelWinFx } from "@/lib/tracker/effects";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const fills = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
  "var(--chart-2)",
];

const MODE_LABEL: Record<SpinMode, string> = {
  normal: "Thường",
  free: "Miễn phí",
  mega: "MEGA",
};

export function Wheel() {
  const { data, spin, update } = useTracker();
  const [rot, setRot] = useState(0);
  const [busy, setBusy] = useState(false);
  const [megaMode, setMegaMode] = useState(false);
  const [lastPrize, setLastPrize] = useState<string | null>(null);

  const weekend = isWeekend();
  const mode: SpinMode = megaMode && weekend ? "mega" : "normal";
  const prizes = mode === "mega" ? MEGA_PRIZES : WHEEL_PRIZES;
  const display = [...prizes, JACKPOT_PRIZE];
  const seg = 360 / display.length;
  const game = data.game;
  const pityLeft = Math.max(0, PITY_LIMIT - 1 - game.wheelPity);
  const freeUsed = !canSpin(game, "free");

  const go = (m: SpinMode) => {
    const prize = spin(m);
    if (!prize) return;
    const i = display.indexOf(prize);
    const target = i >= 0 ? 360 - (i * seg + seg / 2) : 360 - seg / 2;
    setBusy(true);
    setRot((r) => r - (r % 360) + 360 * 5 + target);
    setTimeout(() => {
      setBusy(false);
      setLastPrize(prize); // reveal + pop + FX only once the wheel has stopped
      wheelWinFx(prize === JACKPOT_PRIZE);
    }, 2700);
  };

  const sellAll = () => {
    const r = sellSpinTickets(data.game);
    if (!r.sold) return;
    update((d) => ({ ...d, game: r.game }));
    toast.success(`💱 Đã bán ${r.sold} lượt quay, +${r.coins} 😺`);
  };

  const bg = `conic-gradient(${display
    .map((_, i) => `${fills[i % fills.length]} ${i * seg}deg ${(i + 1) * seg}deg`)
    .join(",")})`;

  return (
    <section className="mx-auto grid max-w-3xl gap-4 md:grid-cols-[auto,1fr]">
      <div className="glass p-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <h2 className="text-lg font-semibold">🎡 Vòng quay may mắn</h2>
          {mode === "mega" && <Badge className="animate-pulse">✨ MEGA</Badge>}
        </div>

        {weekend && (
          <p className="mt-1 text-xs text-amber-500">
            Cuối tuần — Vòng quay MEGA mở! Giải thưởng x2, cơ hội jackpot cao hơn (tốn 2 lượt).
          </p>
        )}

        <div className="relative mx-auto my-6 size-64">
          <div className="absolute left-1/2 -top-2 z-10 size-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-foreground" />
          <div
            className={
              "size-full rounded-full border-4 transition-transform duration-[2500ms] ease-out " +
              (mode === "mega"
                ? "border-amber-500 shadow-[0_0_24px_var(--chart-2)]"
                : "border-border")
            }
            style={{ background: bg, transform: `rotate(${rot}deg)` }}
          >
            {display.map((p, i) => (
              <span
                key={p}
                className={
                  "absolute left-1/2 top-1/2 origin-left font-bold text-primary-foreground " +
                  (p === JACKPOT_PRIZE ? "text-xs" : "text-sm")
                }
                style={{ transform: `rotate(${i * seg + seg / 2 - 90}deg) translateX(58px)` }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {lastPrize && (
          <p
            key={lastPrize + game.totalSpins}
            className={
              "win-pop text-sm font-semibold " +
              (lastPrize === JACKPOT_PRIZE ? "text-amber-500" : "")
            }
          >
            Kết quả: {lastPrize}
          </p>
        )}

        <div className="mt-4 grid gap-2">
          <Button size="lg" onClick={() => go(mode)} disabled={busy || !canSpin(game, mode)}>
            {mode === "mega" ? `Quay MEGA (${SPIN_COST.mega} lượt)` : "Quay ngay"} (
            {game.spinTickets} lượt)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setMegaMode(false);
              go("free");
            }}
            disabled={busy || freeUsed}
          >
            {freeUsed ? "✓ Hôm nay đã quay miễn phí" : "🎁 Quay miễn phí hôm nay"}
          </Button>
          {weekend && (
            <Button
              variant={megaMode ? "default" : "outline"}
              onClick={() => setMegaMode((v) => !v)}
              disabled={busy}
            >
              {megaMode ? "Về vòng thường" : "Bật vòng MEGA"}
            </Button>
          )}
          <Button variant="outline" onClick={sellAll} disabled={busy || game.spinTickets === 0}>
            {game.spinTickets > 0
              ? `💱 Bán ${game.spinTickets} lượt (+${game.spinTickets * SPIN_SELL_COINS} 😺)`
              : "💱 Bán lượt quay (0 lượt)"}
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 px-3 py-2.5">
          <div className="text-left">
            <p className="text-sm font-medium">⚡ Quay giùm mình</p>
            <p className="text-xs text-muted-foreground">
              Tự quay lượt miễn phí + lượt thường khi mở app (ngày thường giữ 2 lượt cho MEGA cuối
              tuần).
            </p>
          </div>
          <Switch
            checked={data.settings.autoSpin === true}
            onCheckedChange={(v) =>
              update((d) => ({ ...d, settings: { ...d.settings, autoSpin: v } }))
            }
          />
        </div>
      </div>

      <div className="grid content-start gap-4">
        <div className="glass p-4">
          <h3 className="mb-2 text-sm font-semibold">🎯 Đảm bảo trúng thưởng</h3>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-chart-2 transition-all"
              style={{ width: `${(game.wheelPity / (PITY_LIMIT - 1)) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Còn <b>{pityLeft}</b> lượt nữa chắc chắn trúng 🎰 JACKPOT (+{JACKPOT_TICKETS} lượt
            quay).
          </p>
        </div>

        <div className="glass p-4">
          <h3 className="mb-2 text-sm font-semibold">🎟️ Cách kiếm lượt quay</h3>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>✅ Hoàn thành một nhiệm vụ — +1 lượt</li>
            <li>💧 Đủ 8 ly nước trong ngày — +1 lượt</li>
            <li>🛒 Chợ Hư Không: 🎟️ Vé Quay giá 10 😺 (luân phiên mỗi tuần)</li>
            <li>🧪 Chế độ Admin test — nút +5 lượt</li>
            <li>💱 Lười quay? Bán lượt — +{SPIN_SELL_COINS} 😺 mỗi lượt</li>
          </ul>
        </div>

        <div className="glass p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">📊 Thống kê</h3>
            <span className="text-xs text-muted-foreground">
              🎟️ Còn {game.spinTickets} lượt quay · 🎰 {game.jackpotsWon} jackpot
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="min-w-0 rounded-lg bg-secondary/60 p-2">
              <div className="text-lg font-bold">{game.totalSpins}</div>
              <div className="truncate text-xs text-muted-foreground">tổng lượt quay</div>
            </div>
            <div className="min-w-0 rounded-lg bg-secondary/60 p-2">
              <div className="text-lg font-bold">{game.jackpotsWon}</div>
              <div className="truncate text-xs text-muted-foreground">jackpot</div>
            </div>
            <div className="min-w-0 rounded-lg bg-secondary/60 p-2">
              <div className="text-lg font-bold">{pityLeft}</div>
              <div className="truncate text-xs text-muted-foreground">lượt tới jackpot</div>
            </div>
          </div>
        </div>

        <div className="glass p-4">
          <h3 className="mb-2 text-sm font-semibold">📜 Lịch sử gần đây</h3>
          {game.spinHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa quay lần nào — quay thử đi!</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto pr-1 text-sm">
              {game.spinHistory.slice(0, 10).map((h) => (
                <li key={h.at} className="flex items-center justify-between gap-2">
                  <span className={h.prize === JACKPOT_PRIZE ? "font-bold text-amber-500" : ""}>
                    {h.prize}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {h.mode && h.mode !== "normal" && (
                      <Badge variant="outline" className="mr-1 px-1.5 py-0 text-[10px]">
                        {MODE_LABEL[h.mode]}
                      </Badge>
                    )}
                    {new Date(h.at).toLocaleString("vi-VN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
