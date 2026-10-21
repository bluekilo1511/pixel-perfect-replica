import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { POMODORO_PRESETS, type AppSettings, type ThemeMode } from "@/lib/tracker/model";
import { openFile } from "@/lib/tracker/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AmbientControl } from "./AmbientControl";

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-[180px]">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function SettingsPanel() {
  const { data, update, download, restore } = useTracker();
  const s = data.settings;
  const [name, setName] = useState(data.ownerName ?? "");
  const [preset, setPreset] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission(null);
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  const set = (patch: Partial<AppSettings>) =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const saveName = () => {
    const clean = name.trim().slice(0, 30);
    update((d) => {
      const { ownerName: _o, ...rest } = d;
      return { ...rest, ...(clean ? { ownerName: clean } : {}) };
    });
    toast.success(clean ? "Đã lưu tên hiển thị" : "Đã xoá tên hiển thị");
  };

  const addPreset = () => {
    const minutes = Math.round(Number(preset));
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
      toast.error("Nhập số phút từ 1 đến 180.");
      return;
    }
    if (POMODORO_PRESETS.includes(minutes as (typeof POMODORO_PRESETS)[number])) {
      toast.error("Mặc định đã có sẵn, hãy chọn số khác.");
      return;
    }
    if (s.customPresets.includes(minutes)) {
      toast.error("Đã có preset này rồi.");
      return;
    }
    set({ customPresets: [...s.customPresets, minutes].slice(0, 4).sort((a, b) => a - b) });
    setPreset("");
  };

  const importBackup = async () => {
    try {
      const r = await openFile();
      if (!r) return;
      let raw: unknown = null;
      try {
        raw = r.text.trim() ? JSON.parse(r.text) : null;
      } catch {
        toast.error("File không phải JSON hợp lệ.");
        return;
      }
      restore(raw);
      toast.success(`Đã nhập dữ liệu từ "${r.name}" ✅`, {
        description: "Kiểm tra lại nhiệm vụ và số dư nhé.",
      });
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") toast.error("Không mở được file");
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="glass p-5">
        <h2 className="mb-1 text-lg font-semibold">⚙️ Cài đặt</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Mọi thứ đang chạy, lưu thẳng vào file của bạn.
        </p>
        <div className="divide-y divide-border">
          <Row label="Tên hiển thị" hint="Tối đa 30 ký tự, hiện ở góc trên">
            <>
              <Input
                className="h-9 w-44"
                value={name}
                maxLength={30}
                placeholder="Tên của bạn"
                aria-label="Tên hiển thị"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
              />
              <Button size="sm" onClick={saveName}>
                Lưu
              </Button>
            </>
          </Row>
          <Row label="Giao diện" hint="Tự động = sáng ban ngày, tối về đêm">
            <Select value={s.themeMode} onValueChange={(v) => set({ themeMode: v as ThemeMode })}>
              <SelectTrigger className="h-9 w-[130px]" aria-label="Giao diện sáng/tối">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">🌗 Tự động</SelectItem>
                <SelectItem value="light">☀️ Sáng</SelectItem>
                <SelectItem value="dark">🌙 Tối</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Âm thanh nền" hint="Mưa hoặc sóng biển khi học">
            <AmbientControl />
          </Row>
          <Row
            label="Thông báo"
            hint={
              notifPermission === "granted"
                ? "Đã bật — nhắc trước tiết học và nghỉ giải lao"
                : notifPermission === "denied"
                  ? "Bị chặn — mở lại trong cài đặt trình duyệt"
                  : "Nhắc trước tiết học 5 phút"
            }
          >
            {notifPermission === "granted" ? (
              <span className="text-xs text-success">✓ Đã bật</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={notifPermission === "denied" || notifPermission === null}
                onClick={async () => {
                  try {
                    const p = await Notification.requestPermission();
                    setNotifPermission(p);
                    if (p === "granted") toast.success("Đã bật thông báo");
                    else if (p === "denied")
                      toast.error("Thông báo đã bị chặn. Hãy mở lại trong cài đặt trình duyệt.");
                  } catch {
                    toast.error("Không bật được thông báo");
                  }
                }}
              >
                🔔 Bật thông báo
              </Button>
            )}
          </Row>
        </div>
      </section>

      <section className="glass p-5">
        <h2 className="mb-1 text-lg font-semibold">⏱️ Pomodoro</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Độ dài mặc định và các preset của riêng bạn.
        </p>
        <div className="divide-y divide-border">
          <Row label="Phút mặc định" hint="Áp dụng cho nhiệm vụ Pomodoro mới">
            <Input
              type="number"
              min={1}
              max={180}
              className="h-9 w-20"
              value={s.pomodoroMinutes}
              aria-label="Phút Pomodoro mặc định"
              onChange={(e) =>
                set({
                  pomodoroMinutes: Math.min(180, Math.max(1, Math.round(+e.target.value || 1))),
                })
              }
            />
          </Row>
          <Row label="Preset riêng" hint="Tối đa 4, ngoài 15/25/50 mặc định">
            <>
              {s.customPresets.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
                  title="Bấm để xoá preset"
                  aria-label={`Xoá preset ${m} phút`}
                  onClick={() => set({ customPresets: s.customPresets.filter((x) => x !== m) })}
                >
                  {m}p ✕
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={180}
                className="h-9 w-16"
                value={preset}
                placeholder="45"
                aria-label="Số phút preset mới"
                onChange={(e) => setPreset(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPreset()}
              />
              <Button size="sm" variant="outline" onClick={addPreset}>
                + Thêm
              </Button>
            </>
          </Row>
          <Row label="Hiệu ứng âm thanh" hint="Tiếng ting khi Pomodoro xong, nhạc khai mở chòm sao">
            <Switch
              checked={s.fxSound}
              aria-label="Hiệu ứng âm thanh"
              onCheckedChange={(v) => set({ fxSound: v })}
            />
          </Row>
          <Row label="Nghỉ tự động" hint="Tự bắt đầu nghỉ sau mỗi Pomodoro">
            <Switch
              checked={s.autoBreak}
              aria-label="Nghỉ tự động"
              onCheckedChange={(v) => set({ autoBreak: v })}
            />
          </Row>
          <Row label="Phút nghỉ" hint="0 = không nghỉ">
            <Input
              type="number"
              min={0}
              max={30}
              className="h-9 w-20"
              value={s.breakMinutes}
              aria-label="Phút nghỉ"
              onChange={(e) =>
                set({ breakMinutes: Math.min(30, Math.max(0, Math.round(+e.target.value || 0))) })
              }
            />
          </Row>
        </div>
      </section>

      <section className="glass p-5 lg:col-span-2">
        <h2 className="mb-1 text-lg font-semibold">💾 Dữ liệu</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {data.backup.lastBackupAt
            ? `Lần sao lưu cuối: ${new Date(data.backup.lastBackupAt).toLocaleString("vi-VN")}`
            : "Chưa sao lưu lần nào — nên tải file JSON để giữ an toàn."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={download}>
            ⬇️ Tải file JSON
          </Button>
          <Button
            variant="outline"
            title="Đọc file backup JSON và thay thế dữ liệu đang chạy"
            onClick={importBackup}
          >
            ⬆️ Nhập backup
          </Button>
        </div>
      </section>
    </div>
  );
}
