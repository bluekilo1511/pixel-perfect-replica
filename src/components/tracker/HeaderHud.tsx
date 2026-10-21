import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { compressImage } from "@/lib/tracker/image";
import { useTracker } from "@/lib/tracker/store";
import { xpForLevel, type AppSettings } from "@/lib/tracker/model";
import { openFile } from "@/lib/tracker/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeCapsuleButton } from "./TimeCapsule";

const statusText = {
  none: "Chưa kết nối file",
  saving: "Đang lưu…",
  saved: "Đã lưu",
  dirty: "Chưa lưu — bấm Tải file",
  error: "Lỗi lưu file",
} as const;

export function HeaderHud() {
  const { data, fileName, status, lastSaved, download, update, restore } = useTracker();
  const fileRef = useRef<HTMLInputElement>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | null>(null);
  const g = data.game;
  const need = xpForLevel(g.level);
  const pct = Math.min(100, (g.xp / need) * 100);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission(null);
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  return (
    <header className="glass glass-glow p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Đổi ảnh đại diện"
            className="group relative size-14 overflow-hidden rounded-2xl bg-xp ring-2 ring-card"
          >
            {data.avatarBase64 ? (
              <img src={data.avatarBase64} alt="Ảnh đại diện" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-2xl">🙂</span>
            )}
            <span className="absolute inset-0 grid place-items-center bg-foreground/40 text-xs font-semibold text-background opacity-0 transition group-hover:opacity-100">
              📷 Đổi
            </span>
            <span className="absolute bottom-0 right-0 rounded-tl-lg bg-xp px-1.5 text-xs font-bold text-primary-foreground">
              {g.level}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              try {
                const b64 = await compressImage(f, 256);
                update((d) => ({ ...d, avatarBase64: b64 }));
                toast.success("Đã cập nhật ảnh đại diện");
              } catch {
                toast.error("Không đọc được ảnh");
              }
            }}
          />
          <NameBadge
            name={data.ownerName}
            level={g.level}
            onChange={(v) =>
              update((d) => {
                const { ownerName: _o, ...rest } = d;
                return { ...rest, ...(v ? { ownerName: v } : {}) };
              })
            }
          />
        </div>

        <div className="min-w-[200px] flex-1">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>XP</span>
            <span>
              {g.xp} / {need}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-xp animate-shine h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2 text-sm">
          <span className="rounded-full bg-secondary px-3 py-1.5">😺 {g.catCoins}</span>
          <span className="rounded-full bg-secondary px-3 py-1.5">🦎 {g.lizardGems}</span>
          <span className="rounded-full bg-secondary px-3 py-1.5">🎡 {g.spinTickets}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 font-medium">
          <span
            className={`size-2 rounded-full ${status === "saved" ? "bg-success" : status === "error" ? "bg-destructive" : "bg-accent"}`}
          />
          Tự động lưu
        </span>
        <span className="text-muted-foreground">
          {fileName ? `📄 ${fileName}` : "Chế độ không file"} · {statusText[status]}
          {lastSaved && status === "saved" ? ` lúc ${lastSaved.toLocaleTimeString("vi-VN")}` : ""}
        </span>
        <span className="ml-auto" />
        <TimeCapsuleButton />
      </div>
    </header>
  );
}

function NameBadge({
  name,
  level,
  onChange,
}: {
  name?: string | undefined;
  level: number;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing)
    return (
      <div className="flex items-center gap-1.5">
        <Input
          value={draft}
          autoFocus
          maxLength={30}
          className="h-8 w-44"
          aria-label="Tên hiển thị"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange(draft.trim());
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          className="h-8"
          onClick={() => {
            onChange(draft.trim());
            setEditing(false);
          }}
        >
          Lưu
        </Button>
      </div>
    );
  return (
    <div className="flex items-center gap-1">
      <div>
        <h1 className="flex items-center gap-1 text-xl font-bold">
          {name?.trim() || "Task Tracker Pro"}
          <button
            type="button"
            aria-label="Đổi tên hiển thị"
            title="Đổi tên hiển thị"
            className="text-xs opacity-50 transition hover:opacity-100"
            onClick={() => {
              setDraft(name?.trim() ?? "");
              setEditing(true);
            }}
          >
            ✏️
          </button>
        </h1>
        <p className="text-xs text-muted-foreground">Cấp độ {level}</p>
      </div>
    </div>
  );
}
