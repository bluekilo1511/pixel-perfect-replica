import { useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "ppr-tour-v1";

const STEPS = [
  {
    emoji: "👋",
    title: "Chào mừng đến Task Tracker Pro!",
    desc: "Mọi dữ liệu nằm trong một file JSON trên máy bạn — không cần tài khoản, không cần mạng. Đừng quên tải backup định kỳ nhé!",
  },
  {
    emoji: "🍅",
    title: "Học cùng thú cưng",
    desc: "Bấm “Học bài 25p” cạnh thú cưng để bắt đầu. Xong tự nghỉ 5 phút, hoặc bấm “🚀 5p thôi” khi lười, và “🧘 Zen” để vào chế độ tập trung toàn màn hình.",
  },
  {
    emoji: "✅",
    title: "Nhiệm vụ & thời khóa biểu",
    desc: "Tab “Hôm nay” chứa việc trong ngày, thêm nhanh bằng Ctrl/Cmd+K. Tab “Thời khóa biểu” xếp lịch cố định theo tuần.",
  },
  {
    emoji: "🎮",
    title: "Chơi để học đều",
    desc: "Daily quest, quái vật weekly, vòng quay, chòm sao và cửa hàng thú cưng — phần thưởng đến khi bạn giữ streak thôi!",
  },
  {
    emoji: "💾",
    title: "Đừng quên backup",
    desc: "Nút “Tải file JSON” ở đầu trang lưu toàn bộ tiến trình. Muốn khôi phục, bấm “Nhập backup” ngay cạnh. Chúc học tốt!",
  },
];

/** First-run tour: shows once per browser (localStorage flag, not stored in the data file). */
export function OnboardingTour() {
  const [step, setStep] = useState(() =>
    typeof window !== "undefined" && !window.localStorage.getItem(STORAGE_KEY) ? 0 : -1,
  );
  if (step < 0) return null;
  const s = STEPS[step]!;
  const close = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* private mode */
    }
    setStep(-1);
  };
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/50 p-4"
      role="dialog"
      aria-label="Hướng dẫn lần đầu"
    >
      <div className="glass w-full max-w-sm rounded-3xl p-6 text-center">
        <div className="text-5xl">{s.emoji}</div>
        <h2 className="mt-3 text-lg font-bold">{s.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`size-2 rounded-full ${i === step ? "bg-primary" : "bg-muted-foreground/40"}`}
            />
          ))}
        </div>
        <div className="mt-5 flex justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={close}>
            Bỏ qua
          </Button>
          <Button size="sm" onClick={() => (step < STEPS.length - 1 ? setStep(step + 1) : close())}>
            {step < STEPS.length - 1 ? "Tiếp ➜" : "Bắt đầu thôi! 🎉"}
          </Button>
        </div>
      </div>
    </div>
  );
}
