import { createFileRoute } from "@tanstack/react-router";
import { TrackerProvider, useTracker } from "@/lib/tracker/store";
import { HeaderHud } from "@/components/tracker/HeaderHud";
import { TodayPanel } from "@/components/tracker/TodayPanel";
import { Timetable } from "@/components/tracker/Timetable";
import { PetShop } from "@/components/tracker/PetShop";
import { Wheel } from "@/components/tracker/Wheel";
import { Chronicle } from "@/components/tracker/Chronicle";
import { WeatherLayer } from "@/components/tracker/WeatherLayer";
import { LevelUpOverlay, Welcome } from "@/components/tracker/Overlays";
import { TabsContent } from "@/components/ui/tabs";
import { ConstellationTabs } from "@/components/tracker/ConstellationTabs";
import { SkyExperience } from "@/components/tracker/SkyExperience";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Task Tracker Pro — Thời khóa biểu & nhiệm vụ offline" },
      { name: "description", content: "Quản lý nhiệm vụ, thời khóa biểu tuần từ Chủ Nhật, Pomodoro, uống nước và level XP — chạy offline, lưu vào file của bạn." },
      { property: "og:title", content: "Task Tracker Pro" },
      { property: "og:description", content: "Thời khóa biểu tuần, Pomodoro, XP và vòng quay — 100% offline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function App() {
  return <SkyExperience><WeatherLayer /><AppInner /></SkyExperience>;
}

function AppInner() {
  const { ready } = useTracker();
  if (!ready) return <Welcome />;
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <HeaderHud />
      <ConstellationTabs>
        <TabsContent value="today" className="mt-5"><TodayPanel /></TabsContent>
        <TabsContent value="week" className="mt-5"><Timetable /></TabsContent>
        <TabsContent value="shop" className="mt-5"><PetShop /></TabsContent>
        <TabsContent value="wheel" className="mt-5"><Wheel /></TabsContent>
        <TabsContent value="chronicle" className="mt-5"><Chronicle /></TabsContent>
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
