import { useRef, useState, type ReactNode, useEffect } from "react";
import { CalendarDays, Check, ChartColumn, PawPrint, Newspaper, Settings } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTracker } from "@/lib/tracker/store";
import { zodiacById, zodiacForBirthday } from "@/lib/tracker/zodiac";

const items = [
  { value: "today", label: "Hôm nay", icon: Check },
  { value: "stats", label: "Thống kê", icon: ChartColumn },
  { value: "week", label: "Thời khóa biểu", icon: CalendarDays },
  { value: "shop", label: "Pet Shop", icon: PawPrint },
  { value: "chronicle", label: "Nhật báo tuần", icon: Newspaper },
  { value: "settings", label: "Cài đặt", icon: Settings },
] as const;

export function ConstellationTabs({ children }: { children: ReactNode }) {
  const [active, setActive] = useState("today");
  const [beam, setBeam] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    key: number;
  } | null>(null);
  const nav = useRef<HTMLDivElement>(null);
  const change = (value: string) => {
    const container = nav.current;
    const from = container?.querySelector(`[data-tab="${active}"] .star-node`);
    const to = container?.querySelector(`[data-tab="${value}"] .star-node`);
    if (container && from && to && value !== active) {
      const base = container.getBoundingClientRect(),
        a = from.getBoundingClientRect(),
        b = to.getBoundingClientRect();
      setBeam({
        x1: a.x + a.width / 2 - base.x,
        y1: a.y + a.height / 2 - base.y,
        x2: b.x + b.width / 2 - base.x,
        y2: b.y + b.height / 2 - base.y,
        key: Date.now(),
      });
    }
    setActive(value);
  };
  useEffect(() => {
    const go = (e: Event) => change((e as CustomEvent<string>).detail);
    window.addEventListener("ppr:goto-tab", go);
    return () => window.removeEventListener("ppr:goto-tab", go);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const { data } = useTracker();
  const s = data.settings;
  // Constellation: auto-picked from the birthday when enabled, manual pick otherwise.
  const birthdayZodiac = (() => {
    if (!s.navZodiacAuto || !s.birthday) return null;
    const [, m, d] = s.birthday.split("-");
    return zodiacForBirthday(Number(m), Number(d));
  })();
  const zodiac = birthdayZodiac ?? zodiacById(s.navZodiac);

  return (
    <Tabs value={active} onValueChange={change}>
      <div className="zodiac-sky-wrap">
        <div className="zodiac-sky" ref={nav}>
          <div className="zodiac-aurora" aria-hidden />
          <svg
            className="zodiac-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {zodiac.lines.map(([a, b], i) => {
              const pa = zodiac.stars[a];
              const pb = zodiac.stars[b];
              if (!pa || !pb) return null;
              return <line key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />;
            })}
          </svg>
          <TabsList className="zodiac-star-list">
            {zodiac.stars.map((star, i) => {
              const item = items.find((i) => i.value === star.tab)!;
              const Icon = item.icon;
              const isFirst = zodiac.stars.findIndex((s) => s.tab === star.tab) === i;
              if (!isFirst) {
                // Extra stars sharing a tab render as decorative twinkles so the
                // constellation keeps its shape without duplicate tab triggers.
                return (
                  <span
                    key={`star-ghost-${i}`}
                    className="zodiac-star zodiac-star-ghost"
                    aria-hidden
                    style={{
                      left: `${star.x}%`,
                      top: `${star.y}%`,
                      ["--node-r" as string]: `${star.r}px`,
                    }}
                  >
                    <span className="star-node">
                      <Icon size={15} strokeWidth={1.8} aria-hidden />
                    </span>
                  </span>
                );
              }
              return (
                <TabsTrigger
                  key={`${star.tab}-${i}`}
                  value={item.value}
                  data-tab={item.value}
                  className="zodiac-star"
                  title={`${item.label} · ${zodiac.name}`}
                  style={{
                    left: `${star.x}%`,
                    top: `${star.y}%`,
                    ["--node-r" as string]: `${star.r}px`,
                  }}
                >
                  <span className="star-node">
                    <Icon size={15} strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="zodiac-star-label">{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
      </div>
      {children}
    </Tabs>
  );
}
