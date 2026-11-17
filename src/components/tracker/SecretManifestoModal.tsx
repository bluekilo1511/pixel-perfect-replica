import { useEffect, useRef, useState } from "react";
import {
  HeartHandshake,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Sparkles,
  Save,
  RotateCcw,
  Feather,
  BookOpen,
  X,
  AlignLeft,
  Type,
  Palette,
} from "lucide-react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { ting } from "@/lib/tracker/effects";
import {
  DEFAULT_MANIFESTO_CONTENT,
  loadSecretManifesto,
  saveSecretManifesto,
  type FontStyle,
  type LineSpacing,
  type PaperTheme,
  type SecretManifesto,
} from "@/lib/tracker/secretManifesto";

interface SecretManifestoModalProps {
  open: boolean;
  onClose: () => void;
  petName?: string;
}

const LINE_SPACING_MAP: Record<LineSpacing, { label: string; cls: string }> = {
  compact: { label: "Chặt", cls: "leading-snug" },
  normal: { label: "Vừa", cls: "leading-normal" },
  relaxed: { label: "Thoáng", cls: "leading-relaxed" },
  loose: { label: "Rộng", cls: "leading-loose" },
};

const FONT_MAP: Record<FontStyle, { label: string; cls: string }> = {
  serif: { label: "Cổ điển", cls: "font-serif tracking-wide" },
  sans: { label: "Hiện đại", cls: "font-sans" },
  mono: { label: "Đánh máy", cls: "font-mono" },
};

const THEME_MAP: Record<
  PaperTheme,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    accent: string;
    quoteBg: string;
  }
> = {
  parchment: {
    label: "Giấy Da Hoàng Kim",
    bg: "bg-gradient-to-b from-[#fbf4e2] via-[#f7ecd1] to-[#eedfbd] dark:from-[#261c14] dark:via-[#1f1610] dark:to-[#17100b]",
    text: "text-[#3d2a1a] dark:text-[#f3e5ce]",
    border: "border-[#d8be8a]/60 dark:border-[#8f6d3f]/60",
    accent: "bg-[#8b4513]/15 text-[#8b4513] dark:bg-[#e2a868]/20 dark:text-[#e2a868]",
    quoteBg: "bg-[#8b4513]/10 dark:bg-[#e2a868]/10 border-l-4 border-[#8b4513] dark:border-[#e2a868]",
  },
  cosmic: {
    label: "Đêm Vũ Trụ",
    bg: "bg-gradient-to-b from-[#0e172a] via-[#09101f] to-[#040812]",
    text: "text-slate-100",
    border: "border-indigo-500/40",
    accent: "bg-indigo-500/20 text-indigo-300",
    quoteBg: "bg-indigo-950/40 border-l-4 border-indigo-400",
  },
  obsidian: {
    label: "Đá Núi Lửa",
    bg: "bg-gradient-to-b from-[#18181b] via-[#121215] to-[#09090b]",
    text: "text-zinc-100",
    border: "border-amber-500/30",
    accent: "bg-amber-500/15 text-amber-300",
    quoteBg: "bg-zinc-900/60 border-l-4 border-amber-400",
  },
  emerald: {
    label: "Ngọc Bích",
    bg: "bg-gradient-to-b from-[#062419] via-[#041a12] to-[#020f0a]",
    text: "text-emerald-100",
    border: "border-emerald-500/40",
    accent: "bg-emerald-500/20 text-emerald-300",
    quoteBg: "bg-emerald-950/40 border-l-4 border-emerald-400",
  },
};

export function SecretManifestoModal({ open, onClose, petName = "Thú cưng" }: SecretManifestoModalProps) {
  const [data, setData] = useState<SecretManifesto>(loadSecretManifesto);
  const [isEditing, setIsEditing] = useState(false);
  const [privacyBlur, setPrivacyBlur] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Re-read storage whenever opened
  useEffect(() => {
    if (open) {
      setData(loadSecretManifesto());
      setIsEditing(false);
      setPrivacyBlur(false);
    }
  }, [open]);

  if (!open) return null;

  const currentTheme = THEME_MAP[data.paperTheme] || THEME_MAP.parchment;
  const currentSpacing = LINE_SPACING_MAP[data.lineSpacing] || LINE_SPACING_MAP.relaxed;
  const currentFont = FONT_MAP[data.fontStyle] || FONT_MAP.serif;

  const handleUpdate = (patch: Partial<SecretManifesto>) => {
    const next = { ...data, ...patch };
    setData(next);
    saveSecretManifesto(next);
  };

  const handleSaveAndSeal = () => {
    handleUpdate({ sealed: true });
    ting(true);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 },
      colors: ["#ffd700", "#ffaa00", "#e0a96d"],
    });
    toast.success("Tâm nguyện đã được niêm phong trang trọng ✨");
    setIsEditing(false);
  };

  const handleResetToDefault = () => {
    if (confirm("Bạn có chắc chắn muốn đặt lại lá thư về gợi ý ban đầu không?")) {
      handleUpdate({ content: DEFAULT_MANIFESTO_CONTENT });
      toast.info("Đã khôi phục nội dung gợi ý.");
    }
  };

  const insertBullet = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const bullet = "\n• ";
    const nextContent = data.content.substring(0, start) + bullet + data.content.substring(end);
    handleUpdate({ content: nextContent });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + bullet.length, start + bullet.length);
    }, 10);
  };

  const wordCount = data.content.trim().split(/\s+/).filter(Boolean).length;
  const lastUpdated = new Date(data.updatedAt).toLocaleDateString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all duration-300 ${currentTheme.bg} ${currentTheme.border} ${currentTheme.text}`}
      >
        {/* Ancient decorative top border */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500/0 via-amber-400 to-amber-500/0 opacity-80" />

        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 pt-5 pb-3 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            {/* Wax Seal Badge */}
            <div
              className="relative size-11 sm:size-12 rounded-full grid place-items-center shadow-lg bg-gradient-to-br from-red-600 via-rose-700 to-red-900 border-2 border-amber-300/60 cursor-pointer select-none group"
              onClick={() => handleUpdate({ sealed: !data.sealed })}
              title={data.sealed ? "Tâm nguyện đang niêm phong (bấm để mở)" : "Bấm để niêm phong"}
            >
              <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-pulse pointer-events-none" />
              {data.sealed ? (
                <Lock className="size-5 text-amber-200 transition-transform group-hover:scale-110" />
              ) : (
                <HeartHandshake className="size-5 text-amber-200 transition-transform group-hover:scale-110" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-widest font-semibold opacity-70 flex items-center gap-1">
                  <Sparkles className="size-3 text-amber-400" />
                  Mật ước cùng {petName}
                </span>
                {data.sealed && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Đã niêm phong
                  </span>
                )}
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={data.title}
                  onChange={(e) => handleUpdate({ title: e.target.value })}
                  placeholder="Tiêu đề lá thư..."
                  className="text-base sm:text-lg font-bold bg-transparent border-b border-dashed border-amber-400/50 outline-none w-full max-w-xs px-0 py-0.5"
                />
              ) : (
                <h3 className="text-base sm:text-lg font-bold tracking-tight">
                  {data.title || "Lý do tôi bắt đầu"}
                </h3>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Privacy toggle */}
            <button
              type="button"
              onClick={() => setPrivacyBlur((v) => !v)}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title={privacyBlur ? "Hiện chữ rõ" : "Làm mờ để riêng tư"}
              aria-label="Chế độ riêng tư"
            >
              {privacyBlur ? <EyeOff className="size-4 text-amber-400" /> : <Eye className="size-4 opacity-70" />}
            </button>

            {/* Read / Edit switch */}
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isEditing
                  ? "bg-amber-500 text-black border-amber-400 shadow-sm"
                  : "bg-black/10 dark:bg-white/10 border-transparent hover:border-black/20 dark:hover:border-white/20"
              }`}
            >
              {isEditing ? (
                <>
                  <BookOpen className="size-3.5" />
                  <span>Xem thư</span>
                </>
              ) : (
                <>
                  <Feather className="size-3.5" />
                  <span>Soạn thảo</span>
                </>
              )}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-colors ml-1"
              aria-label="Đóng"
            >
              <X className="size-5 opacity-70" />
            </button>
          </div>
        </div>

        {/* Customization Toolbar */}
        <div className="px-5 sm:px-7 py-2.5 bg-black/5 dark:bg-white/5 border-b border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0 select-none">
          <div className="flex flex-wrap items-center gap-2">
            {/* Line Spacing Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-black/10 dark:bg-white/10 p-0.5">
              <span className="pl-1.5 pr-1 text-[11px] opacity-70 flex items-center gap-1">
                <AlignLeft className="size-3" />
                Dòng:
              </span>
              {(["compact", "normal", "relaxed", "loose"] as LineSpacing[]).map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => handleUpdate({ lineSpacing: sp })}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                    data.lineSpacing === sp
                      ? "bg-amber-500 text-black font-bold shadow-xs"
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {LINE_SPACING_MAP[sp].label}
                </button>
              ))}
            </div>

            {/* Font Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-black/10 dark:bg-white/10 p-0.5">
              <span className="pl-1.5 pr-1 text-[11px] opacity-70 flex items-center gap-1">
                <Type className="size-3" />
                Chữ:
              </span>
              {(["serif", "sans", "mono"] as FontStyle[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleUpdate({ fontStyle: f })}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                    data.fontStyle === f
                      ? "bg-amber-500 text-black font-bold shadow-xs"
                      : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {FONT_MAP[f].label}
                </button>
              ))}
            </div>

            {/* Theme Selector */}
            <div className="flex items-center gap-1 rounded-lg bg-black/10 dark:bg-white/10 p-0.5">
              <span className="pl-1.5 pr-1 text-[11px] opacity-70 flex items-center gap-1">
                <Palette className="size-3" />
                Giấy:
              </span>
              {(["parchment", "cosmic", "obsidian", "emerald"] as PaperTheme[]).map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => handleUpdate({ paperTheme: th })}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                    data.paperTheme === th
                      ? "bg-amber-500 text-black font-bold shadow-xs"
                      : "opacity-75 hover:opacity-100"
                  }`}
                  title={THEME_MAP[th].label}
                >
                  {THEME_MAP[th].label.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Quick action buttons */}
          {isEditing && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={insertBullet}
                className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors text-[11px]"
                title="Chèn gạch đầu dòng"
              >
                + Gạch dòng
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="p-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                title="Đặt lại bản thảo mẫu"
              >
                <RotateCcw className="size-3.5 opacity-70" />
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-9 py-6 relative">
          {privacyBlur && (
            <div
              className="absolute inset-0 z-20 backdrop-blur-md bg-black/20 flex flex-col items-center justify-center p-6 text-center cursor-pointer select-none"
              onClick={() => setPrivacyBlur(false)}
            >
              <EyeOff className="size-10 text-amber-400 mb-2 animate-bounce" />
              <p className="text-sm font-semibold">Tâm nguyện đang được che mờ để giữ riêng tư</p>
              <p className="text-xs opacity-70 mt-1">Bấm vào đây hoặc nút con mắt để đọc</p>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={data.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                placeholder="Ghi ra tại sao bạn lại làm những việc này..."
                className={`w-full min-h-[320px] bg-transparent resize-y outline-none border-none p-0 ${currentFont.cls} ${currentSpacing.cls} text-sm sm:text-base leading-relaxed placeholder:opacity-40`}
              />
              <p className="text-[11px] opacity-60 italic text-right">
                💡 Tự do xuống dòng, cách dòng hoặc ngắt đoạn theo cảm xúc của bạn.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={`whitespace-pre-wrap ${currentFont.cls} ${currentSpacing.cls} text-sm sm:text-base select-text`}
              >
                {data.content}
              </div>

              {/* Decorative ending quote */}
              <div className={`p-4 rounded-2xl ${currentTheme.quoteBg} mt-6 space-y-1`}>
                <p className="text-xs font-semibold italic opacity-90">
                  "Lời hứa này được canh giữ cẩn mật bởi {petName}. Mỗi khi cảm thấy mệt mỏi, hãy giữ thú cưng 3 giây để nhìn lại ngọn hải đăng của chính mình."
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-7 py-3 bg-black/5 dark:bg-white/5 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
          <div className="text-[11px] opacity-60">
            <span>{wordCount} từ</span>
            <span className="mx-1.5">•</span>
            <span>Cập nhật: {lastUpdated}</span>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={handleSaveAndSeal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-md hover:brightness-110 active:scale-95 transition-all text-xs"
              >
                <Save className="size-3.5" />
                <span>Lưu & Niêm Phong</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-all font-semibold text-xs"
              >
                Đóng lá thư
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
