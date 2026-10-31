import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrackerProvider, useTracker } from "@/lib/tracker/store";
import { HeaderHud } from "@/components/tracker/HeaderHud";
import { TodayPanel } from "@/components/tracker/TodayPanel";
import { WeeklyReportCard } from "@/components/tracker/WeeklyReport";
import { HeatmapCard } from "@/components/tracker/HeatmapCard";
import { SubjectChartCard } from "@/components/tracker/SubjectChartCard";
import { InterruptionChartCard } from "@/components/tracker/InterruptionChartCard";
import { GradeBookCard } from "@/components/tracker/GradeBookCard";
import { FocusJournalCard } from "@/components/tracker/FocusJournal";
import { FlashcardsCard } from "@/components/tracker/FlashcardsCard";
import { MonthlyReportCard } from "@/components/tracker/MonthlyReport";
import { FriendViewCard } from "@/components/tracker/FriendView";
import { Timetable } from "@/components/tracker/Timetable";
import { PersonalScheduleCard } from "@/components/tracker/PersonalScheduleCard";
import { PetShop } from "@/components/tracker/PetShop";
import { Wheel } from "@/components/tracker/Wheel";
import { Chronicle } from "@/components/tracker/Chronicle";
import { WeatherLayer } from "@/components/tracker/WeatherLayer";
import { LevelUpOverlay, Welcome } from "@/components/tracker/Overlays";
import { EvolutionFx } from "@/components/tracker/EvolutionFx";
import { KeyboardShortcuts } from "@/components/tracker/KeyboardShortcuts";
import { CommandPalette } from "@/components/tracker/CommandPalette";
import { TabsContent } from "@/components/ui/tabs";
import { ConstellationTabs } from "@/components/tracker/ConstellationTabs";
import { BackupReminder } from "@/components/tracker/BackupReminder";
import { QuickAdd } from "@/components/tracker/QuickAdd";
import { TaskReminders } from "@/components/tracker/TaskReminders";
import { SkyExperience } from "@/components/tracker/SkyExperience";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingTour } from "@/components/tracker/OnboardingTour";
import { ScrollTop } from "@/components/tracker/ScrollTop";
import { TabTitleHud } from "@/components/tracker/TabTitleHud";
import { Flashbang } from "@/components/tracker/Flashbang";
import { OriginOverlay } from "@/components/tracker/OriginOverlay";
import { TimerFullscreen } from "@/components/tracker/TimerFullscreen";
import { SettingsPanel } from "@/components/tracker/SettingsPanel";
import { skyBand } from "@/lib/tracker/skyTime";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Task Tracker Pro — Thời khóa biểu & nhiệm vụ offline" },
      {
        name: "description",
        content:
          "Quản lý nhiệm vụ, thời khóa biểu tuần từ Chủ Nhật, phiên học, uống nước và level XP — chạy offline, lưu vào file của bạn.",
      },
      { property: "og:title", content: "Task Tracker Pro" },
      {
        property: "og:description",
        content: "Thời khóa biểu tuần, phiên học, XP và vòng quay — 100% offline.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/og.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Task Tracker Pro — pixel-art study room with black cat, dragon and whale",
      },
      { name: "twitter:image", content: "/og.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function App() {
  return (
    <SkyExperience>
      <WeatherLayer />
      <AppInner />
    </SkyExperience>
  );
}

function AppInner() {
  const { ready, data } = useTracker();
  const [band, setBand] = useState(() => skyBand(new Date().getHours()));
  useEffect(() => {
    const t = setInterval(() => setBand(skyBand(new Date().getHours())), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const mode = data.settings.themeMode;
    const light = mode === "light" || (mode === "auto" && band === "day");
    document.documentElement.dataset["theme"] = light ? "light" : "dark";
    // Dragon skin forces the dark look (starry night) and lowers effects in battery saver.
    const dragon = data.settings.dragonTheme === true;
    if (dragon) document.documentElement.dataset["theme"] = "dark";
    document.documentElement.classList.toggle("theme-dragon", dragon);
    document.documentElement.classList.toggle("fx-lite", data.settings.batterySaver === true);
  }, [data.settings.themeMode, data.settings.dragonTheme, data.settings.batterySaver, band]);
  if (!ready) return <Welcome />;
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-3 sm:space-y-5 sm:p-6">
      <HeaderHud />
      <BackupReminder />
      <QuickAdd />
      <TaskReminders />
      <ConstellationTabs>
        <TabsContent value="today" className="mt-4 sm:mt-5">
          <TodayPanel />
        </TabsContent>
        <TabsContent value="stats" className="mt-4 sm:mt-5">
          <StatsPanel />
        </TabsContent>
        <TabsContent value="week" className="mt-4 sm:mt-5">
          <Timetable />
          <div className="mt-4 sm:mt-5">
            <PersonalScheduleCard />
          </div>
        </TabsContent>
        <TabsContent value="shop" className="mt-4 sm:mt-5">
          <PetShop />
          <div className="mt-4 sm:mt-5">
            <Wheel />
          </div>
        </TabsContent>
        <TabsContent value="wheel" className="mt-4 sm:mt-5">
          <Wheel />
        </TabsContent>
        <TabsContent value="chronicle" className="mt-4 sm:mt-5">
          <WeeklyReportCard />
          <div className="mt-4 sm:mt-5">
            <Chronicle />
          </div>
        </TabsContent>
        <TabsContent value="settings" className="mt-4 sm:mt-5">
          <SettingsPanel />
        </TabsContent>
      </ConstellationTabs>
      <LevelUpOverlay />
      <TimerFullscreen />
      <EvolutionFx />
      <KeyboardShortcuts />
      <CommandPalette />
      <Flashbang />
      <TabTitleHud />
      <OriginOverlay />
    </main>
  );
}

const STATS_SECTIONS = [
  { key: "overview", label: "📊 Tổng quan" },
  { key: "study", label: "📚 Học tập" },
  { key: "journal", label: "🕘 Nhật ký" },
] as const;
type StatsSectionKey = (typeof STATS_SECTIONS)[number]["key"];
function readStatsSection(): StatsSectionKey {
  try {
    const v = localStorage.getItem("ppr.statsSection");
    if (v && STATS_SECTIONS.some((s) => s.key === v)) return v as StatsSectionKey;
  } catch {
    /* storage unavailable */
  }
  return "overview";
}
function StatsPanel() {
  const [section, setSection] = useState<StatsSectionKey>(readStatsSection);
  const pick = (key: StatsSectionKey) => {
    setSection(key);
    try {
      localStorage.setItem("ppr.statsSection", key);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <div className="space-y-4">
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Thống kê các nhóm"
      >
        {STATS_SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={section === s.key}
            onClick={() => pick(s.key)}
            className={
              section === s.key
                ? "shrink-0 rounded-full px-4 py-2 text-sm font-semibold bg-primary text-primary-foreground shadow"
                : "shrink-0 rounded-full px-4 py-2 text-sm font-medium bg-secondary/60 text-foreground/75 hover:bg-secondary hover:text-foreground"
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      {section === "overview" && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          <HeatmapCard />
          <InterruptionChartCard />
          <MonthlyReportCard />
        </div>
      )}
      {section === "study" && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          <GradeBookCard />
          <SubjectChartCard />
          <FlashcardsCard />
        </div>
      )}
      {section === "journal" && (
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
          <FocusJournalCard />
          <FriendViewCard />
        </div>
      )}
    </div>
  );
}

function Index() {
  return (
    <TrackerProvider>
      <App />
      <Toaster position="top-center" expand visibleToasts={5} gap={10} />
    </TrackerProvider>
  );
}
