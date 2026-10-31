import { useEffect, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const TAB_ORDER = ["today", "stats", "week", "shop", "chronicle", "settings"] as const;
const TAB_LABEL: Record<(typeof TAB_ORDER)[number], { name: string; emoji: string }> = {
  today: { name: "Hôm nay", emoji: "📋" },
  stats: { name: "Thống kê", emoji: "📊" },
  week: { name: "Tuần", emoji: "🗓️" },
  shop: { name: "Cửa hàng", emoji: "🛍️" },
  chronicle: { name: "Biên niên", emoji: "📖" },
  settings: { name: "Cài đặt", emoji: "⚙️" },
};

const gotoTab = (value: string) =>
  window.dispatchEvent(new CustomEvent("ppr:goto-tab", { detail: value }));

/** Ctrl+K / ⌘K command palette: jump to any tab or run quick actions. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { data, startTimer } = useTracker();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const addTask = () => {
    gotoTab("today");
    setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>("input[data-task-input]");
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      input?.focus();
    }, 120);
  };

  const startSession = () => {
    const resume = data.tasks.find((t) => !t.completed && t.remainingSeconds > 0);
    const next =
      resume ?? data.tasks.find((t) => !t.completed && t.minutes > 0 && !t.rewardClaimed);
    if (next) startTimer(next.id);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Gõ lệnh hoặc tìm trang… (Ctrl+K)" />
      <CommandList>
        <CommandEmpty>Không tìm thấy lệnh nào.</CommandEmpty>
        <CommandGroup heading="Đi tới">
          {TAB_ORDER.map((t) => (
            <CommandItem key={t} onSelect={() => run(() => gotoTab(t))}>
              <span aria-hidden>{TAB_LABEL[t].emoji}</span>
              {TAB_LABEL[t].name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Hành động">
          <CommandItem onSelect={() => run(addTask)}>
            <span aria-hidden>➕</span> Thêm nhiệm vụ mới
          </CommandItem>
          <CommandItem onSelect={() => run(startSession)}>
            <span aria-hidden>▶️</span> Bắt đầu phiên tập trung tiếp theo
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
