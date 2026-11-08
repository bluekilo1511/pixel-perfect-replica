import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import { streakMultiplier } from "@/lib/tracker/gamify";
import { Button } from "@/components/ui/button";

export type WorkspaceTab =
  | "today"
  | "eisenhower"
  | "timeline"
  | "week"
  | "exams"
  | "grades"
  | "study"
  | "shop"
  | "stats"
  | "chronicle"
  | "settings";

interface Props {
  currentTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

interface NavItem {
  id: WorkspaceTab;
  label: string;
  icon: string;
  badge?: number | string;
}

export function WorkspaceSidebar({ currentTab, onTabChange, collapsed, onToggleCollapsed }: Props) {
  const { data, update } = useTracker();
  const today = dateStr();
  const pendingCount = data.tasks.filter((t) => t.date === today && !t.completed).length;
  const level = data.game.level;
  const streak = data.game.streak;
  const coins = data.game.catCoins;
  const gems = data.game.lizardGems;

  const GROUPS: { title: string; items: NavItem[] }[] = [
    {
      title: "Nhiệm vụ & Tiến độ",
      items: [
        {
          id: "today",
          label: "Hôm nay",
          icon: "☀️",
          badge: pendingCount > 0 ? pendingCount : undefined,
        },
        { id: "eisenhower", label: "Ma trận Eisenhower", icon: "🧭" },
        { id: "timeline", label: "Timeline 24h", icon: "⏳" },
      ],
    },
    {
      title: "Học tập & Lịch trình",
      items: [
        { id: "week", label: "Thời khóa biểu & Lịch", icon: "📅" },
        { id: "exams", label: "Kỳ thi & Mục tiêu", icon: "🎯" },
        { id: "grades", label: "Môn học & Bảng điểm", icon: "📚" },
        { id: "study", label: "Thư viện (Thẻ / Sơ đồ)", icon: "🎓" },
      ],
    },
    {
      title: "Tiện ích & Thống kê",
      items: [
        { id: "shop", label: "Cửa hàng & Vòng quay", icon: "🛍️" },
        { id: "stats", label: "Thống kê & Giờ vàng", icon: "📊" },
        { id: "chronicle", label: "Biên niên sử", icon: "📖" },
        { id: "settings", label: "Cài đặt", icon: "⚙️" },
      ],
    },
  ];

  return (
    <aside
      className={`flex h-full flex-col border-r border-border bg-card/60 backdrop-blur-md transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Profile / Workspace Header */}
      <div className="flex items-center justify-between border-b border-border/60 p-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-lg font-bold text-primary shadow-sm">
            Lv.{level}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-xs tracking-tight">
                {data.settings.ownerName || "Học sinh"}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span title="Chuỗi ngày học liên tục">🔥 {streak} ngày</span>
                <span title="Xu mèo">🪙 {coins}</span>
                <span title="Đá thằn lằn">💎 {gems}</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition text-xs"
          title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}
        >
          {collapsed ? "▶" : "◀"}
        </button>
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 space-y-4 overflow-y-auto p-2.5">
        {GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!collapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const active = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                      : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!collapsed && item.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer controls */}
      <div className="border-t border-border/60 p-2.5">
        <button
          type="button"
          onClick={() => {
            const current = data.settings.themeMode ?? "auto";
            const next = current === "dark" ? "light" : "dark";
            update((d) => ({
              ...d,
              settings: { ...d.settings, themeMode: next },
            }));
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/60 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
          title="Đổi giao diện Sáng / Tối"
        >
          <span>{(data.settings.themeMode ?? "auto") === "light" ? "☀️ Sáng" : "🌙 Tối"}</span>
        </button>
      </div>
    </aside>
  );
}
