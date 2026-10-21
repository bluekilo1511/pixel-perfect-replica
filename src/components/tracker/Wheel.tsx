import { useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { WHEEL_PRIZES } from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";

const seg = 360 / WHEEL_PRIZES.length;
const fills = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
];

export function Wheel() {
  const { data, spin } = useTracker();
  const [rot, setRot] = useState(0);
  const [busy, setBusy] = useState(false);

  const go = () => {
    const prize = spin();
    if (!prize) return;
    const i = WHEEL_PRIZES.indexOf(prize);
    const target = 360 - (i * seg + seg / 2);
    setBusy(true);
    setRot((r) => r - (r % 360) + 360 * 5 + target);
    setTimeout(() => setBusy(false), 2700);
  };

  const bg = `conic-gradient(${WHEEL_PRIZES.map((_, i) => `${fills[i]} ${i * seg}deg ${(i + 1) * seg}deg`).join(",")})`;

  return (
    <section className="glass mx-auto max-w-md p-6 text-center">
      <h2 className="text-lg font-semibold">🎡 Vòng quay may mắn</h2>
      <p className="text-sm text-muted-foreground">Mỗi nhiệm vụ hoàn thành = 1 lượt quay.</p>
      <div className="relative mx-auto my-6 size-64">
        <div className="absolute left-1/2 -top-2 z-10 size-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-foreground" />
        <div
          className="size-full rounded-full border-4 border-border transition-transform duration-[2500ms] ease-out"
          style={{ background: bg, transform: `rotate(${rot}deg)` }}
        >
          {WHEEL_PRIZES.map((p, i) => (
            <span
              key={p}
              className="absolute left-1/2 top-1/2 origin-left text-sm font-bold text-primary-foreground"
              style={{ transform: `rotate(${i * seg + seg / 2 - 90}deg) translateX(58px)` }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
      <Button size="lg" onClick={go} disabled={busy || data.game.spinTickets <= 0}>
        Quay ngay ({data.game.spinTickets} lượt)
      </Button>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        {data.game.spinHistory.slice(0, 5).map((h) => (
          <li key={h.at}>
            {new Date(h.at).toLocaleString("vi-VN")} — {h.prize}
          </li>
        ))}
      </ul>
    </section>
  );
}
