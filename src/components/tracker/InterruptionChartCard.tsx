import { useTracker } from "@/lib/tracker/store";
import { interruptionSummary } from "@/lib/tracker/interruptions";

/** Distraction chart for the Statistics tab: pauses per day and the worst hour. */
export function InterruptionChartCard() {
  const { data } = useTracker();
  const s = interruptionSummary(data);
  const max = Math.max(1, ...s.days.map((d) => d.interruptions));

  return (
    <section className="glass p-5" aria-label="Biểu đồ gián đoạn">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">🚧 Gián đoạn phiên</h2>
        <span className="text-sm text-muted-foreground">{s.total} lần / 14 ngày</span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Mỗi lần tạm dừng hoặc thoát tab giữa phiên được tính một lần.
      </p>
      {s.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có lần gián đoạn nào — tập trung super đỉnh đó! 🔥
        </p>
      ) : (
        <>
          <div className="mb-2 flex h-24 items-end gap-1" aria-hidden>
            {s.days.map((d) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.interruptions} lần / ${d.sessions} phiên`}
                className="flex-1"
              >
                <div
                  className="w-full rounded-t-sm bg-destructive/70 transition-all"
                  style={{ height: `${(d.interruptions / max) * 88}px` }}
                />
              </div>
            ))}
          </div>
          <div className="mb-2 flex justify-between text-[10px] text-muted-foreground">
            <span>14 ngày trước</span>
            <span>Hôm nay</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {s.worstDay && (
              <>
                Ngày nhiều gián đoạn nhất: <strong>{s.worstDay.date.slice(5)}</strong> (
                {s.worstDay.interruptions} lần).{" "}
              </>
            )}
            {s.worstHour !== null && (
              <>
                Hay bị ngắt lúc <strong>{s.worstHour}h</strong>.
              </>
            )}
          </p>
        </>
      )}
    </section>
  );
}
