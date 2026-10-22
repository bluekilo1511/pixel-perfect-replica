import { useEffect, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { supportsFSA } from "@/lib/tracker/storage";
import { Button } from "@/components/ui/button";

export function LevelUpOverlay() {
  const { levelUp, dismissLevelUp } = useTracker();
  if (!levelUp) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-md"
      onClick={dismissLevelUp}
    >
      <div className="glass glass-glow animate-pop max-w-sm p-8 text-center">
        <div className="text-6xl">🏆</div>
        <p className="mt-3 text-sm uppercase tracking-widest text-muted-foreground">Level Up!</p>
        <h2 className="bg-xp bg-clip-text font-display text-6xl font-bold text-transparent">
          Cấp {levelUp}
        </h2>
        <p className="mt-2 text-muted-foreground">Tuyệt vời! Tiếp tục giữ nhịp nhé.</p>
        <Button className="mt-6" onClick={dismissLevelUp}>
          Tiếp tục
        </Button>
      </div>
    </div>
  );
}

export function Welcome() {
  const { open, create, startOffline, startAdmin } = useTracker();
  const [fsa, setFsa] = useState(true);
  useEffect(() => setFsa(supportsFSA()), []);
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="glass glass-glow w-full max-w-lg p-8 text-center">
        <div className="text-5xl">🐱🦎</div>
        <h1 className="mt-3 text-3xl font-bold">Task Tracker Pro</h1>
        <p className="mt-2 text-muted-foreground">
          Chạy 100% offline. Dữ liệu nằm trong file .json trên máy bạn và được tự động lưu sau mỗi
          thao tác.
        </p>
        <div className="mt-6 grid gap-2">
          <Button size="lg" onClick={open}>
            📂 Mở file dữ liệu
          </Button>
          <Button size="lg" variant="secondary" onClick={create}>
            ✨ Tạo file mới
          </Button>
          <Button variant="ghost" onClick={startOffline}>
            Dùng thử không cần file
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground/70 hover:text-muted-foreground"
            title="Dữ liệu thử ngay trong bộ nhớ, có quyền admin để test chức năng — không đụng file"
            onClick={startAdmin}
          >
            🧪 Chế độ test (Admin)
          </Button>
        </div>
        {!fsa && (
          <p className="mt-4 text-xs text-muted-foreground">
            Trình duyệt này không hỗ trợ ghi file trực tiếp — hãy dùng Chrome/Edge để tự động lưu,
            hoặc bấm "Tải file JSON" để lưu thủ công.
          </p>
        )}
      </div>
    </div>
  );
}
