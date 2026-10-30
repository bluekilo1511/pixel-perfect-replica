import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { exportShare, summarizeFriend, type FriendParseResult } from "@/lib/tracker/friendView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Read-only viewer: paste a friend's backup JSON, see their progress. Never touches your data. */
export function FriendViewCard() {
  const { data } = useTracker();
  const [text, setText] = useState("");
  const [result, setResult] = useState<FriendParseResult | null>(null);

  const downloadShare = () => {
    const payload = exportShare(data);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tpp-share.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success("📤 Đã tải tpp-share.json — gửi cho bạn rồi dán vào ô bên dưới nhé!");
  };

  const view = () => {
    try {
      setResult(summarizeFriend(JSON.parse(text)));
    } catch {
      setResult({
        ok: false,
        error: "Không đọc được JSON — kiểm tra lại nội dung đã copy đủ chưa.",
      });
    }
  };

  return (
    <section className="glass p-5">
      <h2 className="mb-1 text-lg font-semibold">👀 Xem tiến trình của bạn bè</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Dán nội dung file JSON bạn bè gửi cho bạn. Chỉ xem, không thay đổi dữ liệu của bạn — file
        này không thể nạp vào app làm dữ liệu thật.
      </p>
      <Button className="mb-3 w-full" variant="secondary" onClick={downloadShare}>
        📤 Tạo file chia sẻ của mình (chỉ giờ học &amp; streak)
      </Button>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Dán file JSON vào đây..."
        className="mb-3 min-h-24 font-mono text-xs"
        aria-label="Nội dung JSON của bạn bè"
      />
      <Button className="w-full" variant="outline" onClick={view} disabled={!text.trim()}>
        👀 Xem tiến trình
      </Button>
      {result && !result.ok && (
        <p
          className="mt-3 rounded-xl border border-destructive/40 p-3 text-sm text-destructive"
          role="alert"
        >
          {result.error}
        </p>
      )}
      {result?.ok && (
        <>
          {result.name && (
            <p className="mt-3 text-sm font-medium">👑 Tiến trình của {result.name}</p>
          )}
          {result.last7 && result.last7.some((d) => d.focusMin > 0) && (
            <div className="mt-2 rounded-xl border border-border p-3" aria-hidden>
              <p className="mb-1 text-[10px] text-muted-foreground">
                7 ngày gần nhất (phút tập trung)
              </p>
              <div className="flex h-14 items-end gap-1">
                {result.last7.map((d) => {
                  const max = Math.max(1, ...result.last7!.map((x) => x.focusMin));
                  return (
                    <div key={d.date} title={`${d.date}: ${d.focusMin}p`} className="flex-1">
                      <div
                        className="w-full rounded-t-sm bg-primary/70"
                        style={{ height: `${(d.focusMin / max) * 48}px` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[10px] text-muted-foreground">Cấp độ</dt>
              <dd className="font-semibold">Lv.{result.level}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Chuỗi hiện tại</dt>
              <dd className="font-semibold">🔥 {result.streakNow} ngày</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Kỷ lục chuỗi</dt>
              <dd className="font-semibold">{result.streakBest} ngày</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Tổng nhiệm vụ</dt>
              <dd className="font-semibold">{result.lifetimeTasks}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Tổng phút tập trung</dt>
              <dd className="font-semibold">{result.lifetimeFocusMin}p</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Phiên học</dt>
              <dd className="font-semibold">{result.lifetimePomodoros}</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted-foreground">Thú cưng</dt>
              <dd className="font-semibold">{result.petLabel}</dd>
            </div>
            {result.catCoins > 0 && (
              <div>
                <dt className="text-[10px] text-muted-foreground">😺 / 🦎</dt>
                <dd className="font-semibold">
                  {result.catCoins} / {result.lizardGems}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[10px] text-muted-foreground">Ngày hoạt động</dt>
              <dd className="font-semibold">{result.activeDays} ngày</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
