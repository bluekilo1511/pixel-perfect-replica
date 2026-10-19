import { useEffect, useState } from "react";
import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import { weatherOf, type Weather } from "@/lib/tracker/extras";

const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };

export function useWeather(): Weather {
  const { data } = useTracker();
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => { const n = new Date(); setNowMin(n.getHours() * 60 + n.getMinutes()); };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);
  const today = dateStr();
  const todayDone = data.tasks.filter((t) => t.date === today && t.completed).length;
  const overdue = nowMin === null ? 0 : data.tasks.filter((t) => {
    if (t.completed) return false;
    if (t.date < today && !t.pinned) return true;
    const end = t.timeRange?.split(" - ")[1];
    return t.date === today && !!end && toMin(end) < nowMin;
  }).length;
  return weatherOf({ todayDone, pomodorosToday: data.dailyStats[today]?.pomodoros ?? 0, overdue, pet: data.petState });
}

export const WEATHER_LABEL: Record<Weather, string> = { sunny: "☀️ Nắng đẹp", rainy: "🌧️ Mưa buồn", foggy: "🌫️ Sương mờ" };

export function WeatherLayer() {
  const w = useWeather();
  return (
    <div className={`weather weather-${w}`} aria-hidden>
      <div className="aurora" />
      {w === "sunny" && <><div className="sun-glow" /><div className="stars" /></>}
      {w === "rainy" && <><div className="rain rain-a" /><div className="rain rain-b" /></>}
      {w === "foggy" && <><div className="fog fog-a" /><div className="fog fog-b" /></>}
    </div>
  );
}
