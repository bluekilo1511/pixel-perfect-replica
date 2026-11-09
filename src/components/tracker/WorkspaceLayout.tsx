import { useEffect, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import { formatDateVN } from "@/lib/tracker/exams";
import { WorkspaceSidebar, type WorkspaceTab } from "./WorkspaceSidebar";
import { TaskDetailInspector } from "./TaskDetailInspector";
import { CompanionZenHud } from "./CompanionZenHud";
import { EisenhowerMatrixView } from "./EisenhowerMatrixView";
import { TimelineView } from "./TimelineView";
import { TodayPanel, ExamCard, WeekGoalsCard, WeekReviewCard } from "./TodayPanel";
import { SpecialDaysCard } from "./SpecialDaysCard";
import { WeeklyGoalCard } from "./WeeklyGoalCard";
import { Timetable } from "./Timetable";
import { PersonalScheduleCard } from "./PersonalScheduleCard";
import { GradeBookCard } from "./GradeBookCard";
import { SubjectChartCard } from "./SubjectChartCard";
import { StudyTab } from "./StudyTab";
import { Wheel } from "./Wheel";
import { PetShop } from "./PetShop";
import { WeeklyReportCard } from "./WeeklyReport";
import { Chronicle } from "./Chronicle";
import { SettingsPanel } from "./SettingsPanel";
import { HeatmapCard } from "./HeatmapCard";
import { InterruptionChartCard } from "./InterruptionChartCard";
import { MonthlyReportCard } from "./MonthlyReport";
import { FocusJournalCard } from "./FocusJournal";
import { FriendViewCard } from "./FriendView";
import { Button } from "@/components/ui/button";

type TodayViewMode = "list" | "eisenhower" | "timeline";

const VIEW_TITLES: Record<WorkspaceTab, { title: string; icon: string }> = {
  today: { title: "Hôm nay", icon: "☀️" },
  eisenhower: { title: "Ma trận Eisenhower", icon: "🧭" },
  timeline: { title: "Timeline 24h", icon: "⏳" },
  week: { title: "Thời khóa biểu & Lịch", icon: "📅" },
  exams: { title: "Kỳ thi & Mục tiêu tuần", icon: "🎯" },
  grades: { title: "Môn học & Bảng điểm", icon: "📚" },
  study: { title: "Thư viện học (Flashcards & Sơ đồ)", icon: "🎓" },
  shop: { title: "Cửa hàng & Vòng quay", icon: "🛍️" },
  stats: { title: "Thống kê & Giờ vàng", icon: "📊" },
  chronicle: { title: "Biên niên sử", icon: "📖" },
  settings: { title: "Cài đặt & Sức khỏe dữ liệu", icon: "⚙️" },
};

export function WorkspaceLayout() {
  const { data } = useTracker();
  const [currentTab, setCurrentTab] = useState<WorkspaceTab>("today");
  const [todayView, setTodayView] = useState<TodayViewMode>("list");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPaneOpen, setRightPaneOpen] = useState(true);

  // Listen to ppr:goto-tab events (from Ctrl+K and keyboard shortcuts 1–7)
  useEffect(() => {
    const onGoto = (e: CustomEvent<string>) => {
      const target = e.detail as WorkspaceTab;
      if (
        [
          "today",
          "eisenhower",
          "timeline",
          "week",
          "exams",
          "grades",
          "study",
          "shop",
          "stats",
          "chronicle",
          "settings",
        ].includes(target)
      ) {
        setCurrentTab(target);
      }
    };
    window.addEventListener("ppr:goto-tab", onGoto as EventListener);
    return () => window.removeEventListener("ppr:goto-tab", onGoto as EventListener);
  }, []);

  // Listen to ppr:select-task events (e.g. clicking task title in Today list)
  useEffect(() => {
    const onSelect = (e: CustomEvent<string>) => {
      if (typeof e.detail === "string") {
        setSelectedTaskId(e.detail);
        setRightPaneOpen(true);
      }
    };
    window.addEventListener("ppr:select-task", onSelect as EventListener);
    return () => window.removeEventListener("ppr:select-task", onSelect as EventListener);
  }, []);

  const todayStr = dateStr();
  const formattedToday = formatDateVN(todayStr);

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full overflow-hidden rounded-2xl border border-border/80 bg-background/90 shadow-2xl backdrop-blur-xl">
      {/* 1. Left Sidebar Pane */}
      <WorkspaceSidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab === "eisenhower") setTodayView("eisenhower");
          if (tab === "timeline") setTodayView("timeline");
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* 2. Middle Work Area Pane */}
      <section className="flex flex-1 flex-col overflow-hidden bg-background/40">
        {/* Top Header Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/40 px-5 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-xl">{VIEW_TITLES[currentTab].icon}</span>
            <div>
              <h1 className="text-base font-bold tracking-tight text-foreground">
                {VIEW_TITLES[currentTab].title}
              </h1>
              <p className="text-xs text-muted-foreground">{formattedToday}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Today sub-view selector chips */}
            {currentTab === "today" && (
              <div className="flex items-center gap-1 rounded-xl border border-border/80 bg-muted/30 p-1">
                <button
                  type="button"
                  onClick={() => setTodayView("list")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    todayView === "list"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  📋 Danh sách
                </button>
                <button
                  type="button"
                  onClick={() => setTodayView("eisenhower")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    todayView === "eisenhower"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  🧭 Eisenhower
                </button>
                <button
                  type="button"
                  onClick={() => setTodayView("timeline")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    todayView === "timeline"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  ⏳ Timeline
                </button>
              </div>
            )}

            {/* Quick Add trigger button */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs font-semibold"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("ppr:open-quick-add"));
              }}
            >
              <span>⚡ Thêm nhanh</span>
              <kbd className="rounded border bg-muted px-1 py-0.2 text-[10px] text-muted-foreground">
                Ctrl+Q
              </kbd>
            </Button>

            {/* Toggle Right Inspector Pane */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              title={rightPaneOpen ? "Ẩn cột phụ" : "Hiện cột phụ (Pet & Chi tiết)"}
              onClick={() => setRightPaneOpen(!rightPaneOpen)}
            >
              {rightPaneOpen ? "◨" : "◧"}
            </Button>
          </div>
        </header>

        {/* Scrollable Main View Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {currentTab === "today" && todayView === "list" && <TodayPanel />}

          {(currentTab === "eisenhower" ||
            (currentTab === "today" && todayView === "eisenhower")) && (
            <EisenhowerMatrixView
              onSelectTask={setSelectedTaskId}
              selectedTaskId={selectedTaskId}
            />
          )}

          {(currentTab === "timeline" || (currentTab === "today" && todayView === "timeline")) && (
            <TimelineView onSelectTask={setSelectedTaskId} selectedTaskId={selectedTaskId} />
          )}

          {currentTab === "week" && (
            <div className="space-y-5">
              <Timetable />
              <PersonalScheduleCard />
            </div>
          )}

          {currentTab === "exams" && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <ExamCard />
                <SpecialDaysCard />
              </div>
              <div className="space-y-5">
                <WeeklyGoalCard />
                <WeekGoalsCard />
                <WeekReviewCard />
              </div>
            </div>
          )}

          {currentTab === "grades" && (
            <div className="space-y-5">
              <GradeBookCard />
              <SubjectChartCard />
            </div>
          )}

          {currentTab === "study" && <StudyTab />}

          {currentTab === "shop" && (
            <div className="space-y-5">
              <Wheel />
              <PetShop />
            </div>
          )}

          {currentTab === "stats" && (
            <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
              <HeatmapCard />
              <InterruptionChartCard />
              <MonthlyReportCard />
              <FocusJournalCard />
              <FriendViewCard />
            </div>
          )}

          {currentTab === "chronicle" && (
            <div className="space-y-5">
              <WeeklyReportCard />
              <Chronicle />
            </div>
          )}

          {currentTab === "settings" && <SettingsPanel />}
        </div>
      </section>

      {/* 3. Right Pane: Task Detail Inspector OR Companion Zen HUD */}
      {rightPaneOpen && (
        <div className="w-80 shrink-0 hidden lg:block overflow-hidden">
          {selectedTaskId ? (
            <TaskDetailInspector taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
          ) : (
            <CompanionZenHud onSelectTask={(id) => setSelectedTaskId(id)} />
          )}
        </div>
      )}
    </div>
  );
}
