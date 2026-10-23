import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrackerProvider, useTracker } from "@/lib/tracker/store";
import { HeaderHud } from "@/components/tracker/HeaderHud";
import { TodayPanel } from "@/components/tracker/TodayPanel";
import { WeeklyReportCard } from "@/components/tracker/WeeklyReport";
import { HeatmapCard } from "@/components/tracker/HeatmapCard";
import { SubjectChartCard } from "@/components/tracker/SubjectChartCard";
import { GradeBookCard } from "@/components/tracker/GradeBookCard";
import { FocusJournalCard } from "@/components/tracker/FocusJournal";
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
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <WeeklyReportCard />
            <HeatmapCard />
            <GradeBookCard />
            <SubjectChartCard />
            <FocusJournalCard />
            <MonthlyReportCard />
            <FriendViewCard />
          </div>
        </TabsContent>
        <TabsContent value="week" className="mt-4 sm:mt-5">
          <Timetable />
          <div className="mt-4 sm:mt-5">
            <PersonalScheduleCard />
          </div>
        </TabsContent>
        <TabsContent value="shop" className="mt-4 sm:mt-5">
          <PetShop />
        </TabsContent>
        <TabsContent value="wheel" className="mt-4 sm:mt-5">
          <Wheel />
        </TabsContent>
        <TabsContent value="chronicle" className="mt-4 sm:mt-5">
          <Chronicle />
        </TabsContent>
        <TabsContent value="settings" className="mt-4 sm:mt-5">
          <SettingsPanel />
        </TabsContent>
      </ConstellationTabs>
      <LevelUpOverlay />
      <EvolutionFx />
      <KeyboardShortcuts />
      <Flashbang />
      <TabTitleHud />
      <OriginOverlay />
    </main>
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
