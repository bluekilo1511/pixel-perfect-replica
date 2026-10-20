import { useState } from "react";
import { summarizeFriend, type FriendParseResult } from "@/lib/tracker/friendView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Read-only viewer: paste a friend's backup JSON, see their progress. Never touches your data. */
export function FriendViewCard() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<FriendParseResult | null>(null);

  const view = () => {
    try {
      setResult(summarizeFriend(JSON.parse(text)));
    } catch {
      setResult({ ok: false, error: "Không đọc được JSON — kiểm tra lại nội dung đã copy đủ chưa." });
    }
  };

  return (
    <section className="glass p-5">
      <h2 className="mb-1 text-lg font-semibold">👀 Xem tiến trình của bạn bè</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Dán nội dung file JSON bạn bè gửi cho bạn. Chỉ xem, không thay đổi dữ liệu của bạn.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder='Dán file JSON vào đây...'
        className="mb-3 min-h-24 font-mono text-xs"
        aria-label="Nội dung JSON của bạn bè"
      />
      <Button className="w-full" variant="outline" onClick={view} disabled={!text.trim()}>
        👀 Xem tiến trình
      </Button>
      {result && !result.ok && (
        <p className="mt-3 rounded-xl border border-destructive/40 p-3 text-sm text-destructive" role="alert">
          {result.error}
        </p>
      )}
      {result?.ok && (
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
            <dt className="text-[10px] text-muted-foreground">Pomodoro</dt>
            <dd className="font-semibold">{result.lifetimePomodoros}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Thú cưng</dt>
            <dd className="font-semibold">{result.petLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">😺 / 🦎</dt>
            <dd className="font-semibold">
              {result.catCoins} / {result.lizardGems}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">Ngày hoạt động</dt>
            <dd className="font-semibold">{result.activeDays} ngày</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
