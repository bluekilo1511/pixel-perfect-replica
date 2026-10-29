import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import { ZODIAC_LIST, zodiacForBirthday } from "@/lib/tracker/zodiac";
import { DateInputVN } from "./DateInputVN";
import type { AdminBoostKind } from "@/lib/tracker/model";
import {
  DRAGON_UNLOCK_LEVEL,
  POMODORO_PRESETS,
  type AppSettings,
  type ThemeMode,
} from "@/lib/tracker/model";
import { openFile } from "@/lib/tracker/storage";
import { clearCustomChime, saveCustomChime } from "@/lib/tracker/chimeStore";
import { ting } from "@/lib/tracker/effects";
import { Slider } from "@/components/ui/slider";
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
import { OriginButton } from "./OriginOverlay";

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
  const { data, update, download, restore, adminBoost } = useTracker();
  const s = data.settings;
  const [name, setName] = useState(data.ownerName ?? "");
  const [preset, setPreset] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const chimeInput = useRef<HTMLInputElement>(null);

  const onChimeFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/") && !/\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name)) {
      toast.error("Chỉ nhận file âm thanh (mp3, wav, ogg...)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File quá lớn — tối đa 5 MB");
      return;
    }
    const ok = await saveCustomChime(file, file.name);
    if (!ok) {
      toast.error("Trình duyệt không hỗ trợ lưu file âm thanh");
      return;
    }
    set({ customChime: true });
    toast.success(`Đã dùng "${file.name}" làm chuông hết phiên`);
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission(null);
      return;
    }
    setNotifPermission(Notification.permission);
  }, []);

  const set = (patch: Partial<AppSettings>) =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  // Which constellation is actually active (auto from birthday, or manual pick)?
  const activeZodiacId = (() => {
    if (s.navZodiacAuto && s.birthday) {
      const [, m, d] = s.birthday.split("-");
      const z = zodiacForBirthday(Number(m), Number(d));
      if (z) return z.id;
    }
    return s.navZodiac;
  })();

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
    set({
      customPresets: [...s.customPresets, minutes].slice(0, 4).sort((a, b) => a - b),
    });
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
        <p className="mb-4 text-xs text-muted-foreground">
          ⌨️ Phím tắt: <b>Space</b> tạm dừng/tiếp tục phiên học · <b>N</b> thêm nhiệm vụ ·{" "}
          <b>1–7</b> chuyển tab
        </p>
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
          <Row
            label="Theme Rồng 🐉"
            hint={
              data.game.level >= DRAGON_UNLOCK_LEVEL
                ? "Viền rồng lung linh quanh nút + nền bầu trời sao"
                : `Mở khóa vĩnh viễn khi đạt Lv.${DRAGON_UNLOCK_LEVEL}`
            }
          >
            <Switch
              checked={s.dragonTheme === true}
              disabled={data.game.level < DRAGON_UNLOCK_LEVEL}
              onCheckedChange={(v) => set({ dragonTheme: v })}
              aria-label="Bật/tắt theme rồng"
            />
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
        <h2 className="mb-1 text-lg font-semibold">⏱️ Tập trung</h2>
        <p className="mb-2 text-xs text-muted-foreground">
          Độ dài mặc định và các preset của riêng bạn.
        </p>
        <div className="divide-y divide-border">
          <Row label="Phút mặc định" hint="Áp dụng cho nhiệm vụ học mới">
            <Input
              type="number"
              min={1}
              max={180}
              className="h-9 w-20"
              value={s.pomodoroMinutes}
              aria-label="Phút học mặc định"
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
                  onClick={() =>
                    set({
                      customPresets: s.customPresets.filter((x) => x !== m),
                    })
                  }
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
          <Row
            label="Hiệu ứng âm thanh"
            hint="Tiếng ting khi phiên học xong, nhạc khai mở chòm sao"
          >
            <Switch
              checked={s.fxSound}
              aria-label="Hiệu ứng âm thanh"
              onCheckedChange={(v) => set({ fxSound: v })}
            />
          </Row>
          <Row label="Kiểu chuông" hint="Âm báo khi hết phiên học">
            <select
              className="h-8 rounded-md border border-input bg-popover px-2 text-sm"
              value={s.chime}
              onChange={(e) => set({ chime: e.target.value as typeof s.chime })}
              aria-label="Kiểu chuông"
            >
              <option value="soft">🔔 Chuông nhẹ</option>
              <option value="bowl">🪘 Bát Tây Tạng</option>
              <option value="retro">🎮 8-bit retro</option>
              <option value="birds">🐦 Chim hót</option>
            </select>
          </Row>
          <Row
            label="Âm lượng hiệu ứng"
            hint="Chuông & âm báo khi hết phiên — 50% bằng âm cũ, kéo lên để to hơn"
          >
            <span className="w-10 text-right text-xs text-muted-foreground">{s.fxVolume}%</span>
            <Slider
              className="w-36"
              min={0}
              max={100}
              step={5}
              value={[s.fxVolume]}
              aria-label="Âm lượng hiệu ứng"
              onValueChange={(v) => set({ fxVolume: v[0] ?? s.fxVolume })}
            />
            <Button size="sm" variant="outline" onClick={() => ting(true)}>
              ▶ Thử
            </Button>
          </Row>
          <Row
            label="Chuông của tôi"
            hint={
              s.customChime
                ? "Đang dùng file âm của bạn cho chuông hết phiên"
                : "Nạp file mp3/wav/ogg (≤ 5 MB) làm chuông hết phiên"
            }
          >
            <input
              ref={chimeInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                void onChimeFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button size="sm" variant="outline" onClick={() => chimeInput.current?.click()}>
              📁 Chọn file
            </Button>
            {s.customChime && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void clearCustomChime();
                  set({ customChime: false });
                  toast.success("Đã quay lại chuông mặc định");
                }}
              >
                🗑 Xoá
              </Button>
            )}
          </Row>
          <Row
            label="Chế độ tiết kiệm pin"
            hint="Hạ độ nét phòng 3D, tắt bóng đổ & lấp lánh — máy yếu chạy mượt hơn hẳn"
          >
            <Switch
              checked={s.batterySaver}
              aria-label="Chế độ tiết kiệm pin"
              onCheckedChange={(v) => set({ batterySaver: v })}
            />
          </Row>
          <Row label="Nghỉ tự động" hint="Tự bắt đầu nghỉ sau mỗi phiên học">
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
                set({
                  breakMinutes: Math.min(30, Math.max(0, Math.round(+e.target.value || 0))),
                })
              }
            />
          </Row>
        </div>
      </section>

      <section className="glass p-5 lg:col-span-2">
        <h2 className="mb-1 text-lg font-semibold">🌌 Chòm sao điều hướng</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Chọn hình chòm sao treo 7 tab của app — mỗi tab là một ngôi sao trong chòm thật.
        </p>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-medium">🌟 Chòm theo ngày sinh</p>
            <p className="text-xs text-muted-foreground">
              Tự chọn chòm đúng cung của bạn — vẫn đổi tay được bên dưới.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DateInputVN
              className="h-9 w-32"
              value={s.birthday ?? ""}
              onChange={(iso) => set({ birthday: iso || null })}
              ariaLabel="Ngày sinh"
            />
            <Switch
              checked={s.navZodiacAuto === true}
              onCheckedChange={(v) => set({ navZodiacAuto: v })}
              aria-label="Tự chọn chòm theo ngày sinh"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {ZODIAC_LIST.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => set({ navZodiac: z.id })}
              className={`rounded-xl border p-2 text-left text-xs transition-colors ${
                activeZodiacId === z.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <span className="block font-semibold">{z.name}</span>
              <span className="text-[10px] opacity-70">{z.range}</span>
            </button>
          ))}
        </div>
      </section>

      {s.admin && (
        <section className="glass p-5 lg:col-span-2">
          <h2 className="mb-1 text-lg font-semibold">🧪 Chế độ test (Admin)</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Đang chạy dữ liệu thử trong bộ nhớ. Nút tăng tài nguyên cộng thẳng vào số liệu, không
            ghi lịch sử; tải backup bị khóa khi chế độ này bật.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["xp", "+100 XP"],
                ["catCoins", "+100 Coin"],
                ["lizardGems", "+10 Gem"],
                ["spinTickets", "+5 Lượt quay"],
                ["streak", "+1 Streak"],
                ["petXp", "+50 XP Pet"],
              ] as [AdminBoostKind, string][]
            ).map(([kind, label]) => (
              <Button
                key={kind}
                variant="outline"
                size="sm"
                onClick={() => adminBoost(kind, boostAmount(kind))}
              >
                {label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => {
              set({ admin: false });
            }}
          >
            Tắt chế độ test
          </Button>
        </section>
      )}

      <section className="glass p-5 lg:col-span-2">
        <h2 className="mb-1 text-lg font-semibold">💾 Dữ liệu</h2>
        <StorageUsage />
        <p className="mb-3 text-xs text-muted-foreground">
          {data.backup.lastBackupAt
            ? `Lần sao lưu cuối: ${new Date(data.backup.lastBackupAt).toLocaleString("vi-VN")}`
            : "Chưa sao lưu lần nào — nên tải file JSON để giữ an toàn."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={s.admin}
            title={
              s.admin
                ? "Chế độ test (Admin) đang bật — tắt trước khi tải backup"
                : "Tải dữ liệu hiện tại ra file JSON"
            }
            onClick={download}
          >
            {s.admin ? "🔒 Tải file JSON (khóa)" : "⬇️ Tải file JSON"}
          </Button>
          <Button
            variant="outline"
            title="Đọc file backup JSON và thay thế dữ liệu đang chạy"
            onClick={importBackup}
          >
            ⬆️ Nhập backup
          </Button>
        </div>
        <OriginButton />
      </section>
    </div>
  );
}

function boostAmount(kind: AdminBoostKind): number {
  switch (kind) {
    case "xp":
      return 100;
    case "catCoins":
      return 100;
    case "lizardGems":
      return 10;
    case "spinTickets":
      return 5;
    case "streak":
      return 1;
    case "petXp":
      return 50;
  }
}

/** Rough estimate of how much localStorage the app occupies (limit is ~5 MB). */
function StorageUsage() {
  const [kb, setKb] = useState<number | null>(null);
  useEffect(() => {
    try {
      let n = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        n += key.length + (localStorage.getItem(key)?.length ?? 0);
      }
      setKb(Math.round(n / 1024));
    } catch {
      setKb(null);
    }
  }, []);
  if (kb == null) return null;
  const pct = Math.min(100, Math.round((kb / 5120) * 100));
  return (
    <p className="mb-4 text-xs text-muted-foreground">
      📦 Dữ liệu đang chiếm ~<b>{kb.toLocaleString("vi-VN")} KB</b> / ~5 MB của trình duyệt
      {pct > 60 && " — gần giới hạn, nên xuất backup thường xuyên nhé"}
    </p>
  );
}
