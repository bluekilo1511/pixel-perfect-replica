import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TrackerProvider, useTracker } from "@/lib/tracker/store";
import { HeaderHud } from "@/components/tracker/HeaderHud";
import { TodayPanel } from "@/components/tracker/TodayPanel";
import { WeeklyReportCard } from "@/components/tracker/WeeklyReport";
import { SubjectChartCard } from "@/components/tracker/SubjectChartCard";
import { FocusJournalCard } from "@/components/tracker/FocusJournal";
import { MonthlyReportCard } from "@/components/tracker/MonthlyReport";
import { FriendViewCard } from "@/components/tracker/FriendView";
import { Timetable } from "@/components/tracker/Timetable";
import { PetShop } from "@/components/tracker/PetShop";
import { Wheel } from "@/components/tracker/Wheel";
import { Chronicle } from "@/components/tracker/Chronicle";
import { WeatherLayer } from "@/components/tracker/WeatherLayer";
import { LevelUpOverlay, Welcome } from "@/components/tracker/Overlays";
import { TabsContent } from "@/components/ui/tabs";
import { ConstellationTabs } from "@/components/tracker/ConstellationTabs";
import { BackupReminder } from "@/components/tracker/BackupReminder";
import { QuickAdd } from "@/components/tracker/QuickAdd";
import { SkyExperience } from "@/components/tracker/SkyExperience";
import { Toaster } from "@/components/ui/sonner";
import { OnboardingTour } from "@/components/tracker/OnboardingTour";
import { ScrollTop } from "@/components/tracker/ScrollTop";
import { SettingsPanel } from "@/components/tracker/SettingsPanel";
import { skyBand } from "@/lib/tracker/skyTime";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Task Tracker Pro — Thời khóa biểu & nhiệm vụ offline" },
      {
        name: "description",
        content:
          "Quản lý nhiệm vụ, thời khóa biểu tuần từ Chủ Nhật, Pomodoro, uống nước và level XP — chạy offline, lưu vào file của bạn.",
      },
      { property: "og:title", content: "Task Tracker Pro" },
      {
        property: "og:description",
        content: "Thời khóa biểu tuần, Pomodoro, XP và vòng quay — 100% offline.",
      },
      { property: "og:type", content: "website" },
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
  }, [data.settings.themeMode, band]);
  if (!ready) return <Welcome />;
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <HeaderHud />
      <BackupReminder />
      <QuickAdd />
      <ConstellationTabs>
        <TabsContent value="today" className="mt-5">
          <TodayPanel />
        </TabsContent>
        <TabsContent value="stats" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <WeeklyReportCard />
            <SubjectChartCard />
            <FocusJournalCard />
            <MonthlyReportCard />
            <FriendViewCard />
          </div>
        </TabsContent>
        <TabsContent value="week" className="mt-5">
          <Timetable />
        </TabsContent>
        <TabsContent value="shop" className="mt-5">
          <PetShop />
        </TabsContent>
        <TabsContent value="wheel" className="mt-5">
          <Wheel />
        </TabsContent>
        <TabsContent value="chronicle" className="mt-5">
          <Chronicle />
        </TabsContent>
        <TabsContent value="settings" className="mt-5">
          <SettingsPanel />
        </TabsContent>
      </ConstellationTabs>
      <LevelUpOverlay />
    </main>
  );
}

function Index() {
  return (
    <TrackerProvider>
      <App />
      <Toaster position="top-center" />
    </TrackerProvider>
  );
}
