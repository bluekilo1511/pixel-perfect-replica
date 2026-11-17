export type LineSpacing = "compact" | "normal" | "relaxed" | "loose";
export type FontStyle = "serif" | "sans" | "mono";
export type PaperTheme = "parchment" | "cosmic" | "obsidian" | "emerald";

export interface SecretManifesto {
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  lineSpacing: LineSpacing;
  fontStyle: FontStyle;
  paperTheme: PaperTheme;
  sealed: boolean;
}

const STORAGE_KEY = "blueliz_secret_manifesto_v1";

export const DEFAULT_MANIFESTO_CONTENT = `Gửi tôi của những ngày đang nỗ lực,

Tôi ngồi vào bàn học và làm việc mỗi ngày không phải vì một thói quen vô nghĩa. Tôi làm tất cả những điều này là vì:

• Mục tiêu cốt lõi mà tôi quyết tâm đạt được:
  (Ghi rõ mục tiêu lớn nhất của bạn ở đây...)

• Những người tôi yêu thương mà tôi muốn khiến họ tự hào:
  (Gia đình, bạn bè, hoặc chính phiên bản tương lai của bạn...)

• Cuộc sống và sự tự do mà tôi muốn tự tay kiến tạo:
  (Cảm giác khi hoàn thành, tự do tài chính, chạm tới ước mơ...)

"Khi bạn thấy mệt mỏi và muốn từ bỏ, hãy nhớ lại lý do sâu thẳm nhất đã thôi thúc bạn bắt đầu."`;

export function defaultSecretManifesto(): SecretManifesto {
  const now = new Date().toISOString();
  return {
    title: "Lý do tôi bắt đầu",
    content: DEFAULT_MANIFESTO_CONTENT,
    createdAt: now,
    updatedAt: now,
    lineSpacing: "relaxed",
    fontStyle: "serif",
    paperTheme: "parchment",
    sealed: false,
  };
}

export function loadSecretManifesto(): SecretManifesto {
  if (typeof window === "undefined" || !window.localStorage) {
    return defaultSecretManifesto();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSecretManifesto();
    const parsed = JSON.parse(raw);
    return {
      ...defaultSecretManifesto(),
      ...parsed,
      title: typeof parsed.title === "string" ? parsed.title.normalize("NFC") : defaultSecretManifesto().title,
      content: typeof parsed.content === "string" ? parsed.content.normalize("NFC") : defaultSecretManifesto().content,
    };
  } catch {
    return defaultSecretManifesto();
  }
}

export function saveSecretManifesto(data: SecretManifesto): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const payload = {
      ...data,
      title: data.title.normalize("NFC"),
      content: data.content.normalize("NFC"),
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("manifesto_updated", { detail: payload }));
  } catch {
    // ignore localstorage quota errors
  }
}
