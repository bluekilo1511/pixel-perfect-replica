import { useRef, useState, type ReactNode, useEffect } from "react";
import {
  CalendarDays,
  Check,
  ChartColumn,
  PawPrint,
  Sparkles,
  Newspaper,
  Settings,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const items = [
  { value: "today", label: "Hôm nay", icon: Check },
  { value: "stats", label: "Thống kê", icon: ChartColumn },
  { value: "week", label: "Thời khóa biểu", icon: CalendarDays },
  { value: "shop", label: "Pet Shop", icon: PawPrint },
  { value: "wheel", label: "Vòng quay", icon: Sparkles },
  { value: "chronicle", label: "Nhật báo tuần", icon: Newspaper },
  { value: "settings", label: "Cài đặt", icon: Settings },
];

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
  return (
    <Tabs value={active} onValueChange={change}>
      <div className="constellation-navigation" ref={nav}>
        {beam && (
          <svg className="constellation-beam" aria-hidden>
            <line
              key={beam.key}
              {...{ x1: beam.x1, y1: beam.y1, x2: beam.x2, y2: beam.y2 }}
              pathLength="1"
            />
          </svg>
        )}
        <TabsList className="constellation-list">
          {items.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} data-tab={value} className="constellation-tab">
              <span className="star-node">
                <Icon size={17} strokeWidth={1.8} />
              </span>
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {children}
    </Tabs>
  );
}
