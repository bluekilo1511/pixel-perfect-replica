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
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTracker } from "@/lib/tracker/store";
import { zodiacById, zodiacForBirthday, type NavTabKey } from "@/lib/tracker/zodiac";
import { dateStr } from "@/lib/tracker/model";
import { SHOOTING_STAR_REWARD, catchesRemaining, recordCatch } from "@/lib/tracker/shootingStar";

const items = [
  { value: "today", label: "Hôm nay", icon: Check },
  { value: "stats", label: "Thống kê", icon: ChartColumn },
  { value: "week", label: "Thời khóa biểu", icon: CalendarDays },
  { value: "shop", label: "Pet Shop", icon: PawPrint },
  { value: "wheel", label: "Vòng quay", icon: Sparkles },
  { value: "chronicle", label: "Nhật báo tuần", icon: Newspaper },
  { value: "settings", label: "Cài đặt", icon: Settings },
] as const;

const PRESETS = [
  { name: "Trái trên", x: 12, y: 20 },
  { name: "Phải trên", x: 88, y: 20 },
  { name: "Trái dưới", x: 12, y: 80 },
  { name: "Phải dưới", x: 88, y: 80 },
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

  const { data, update } = useTracker();
  const s = data.settings;
  // Constellation: auto-picked from the birthday when enabled, manual pick otherwise.
  const birthdayZodiac = (() => {
    if (!s.navZodiacAuto || !s.birthday) return null;
    const [, m, d] = s.birthday.split("-");
    return zodiacForBirthday(Number(m), Number(d));
  })();
  const zodiac = birthdayZodiac ?? zodiacById(s.navZodiac);
  const personal = s.personalStar;

  // Streak constellation: one little star lights up every 10 streak days (display only).
  const streakLit = Math.min(6, Math.floor(data.streak.count / 10));

  // Shooting star: spawns every few minutes when catches remain; +3 coins per catch.
  const [shoot, setShoot] = useState<{ top: number; key: number } | null>(null);
  const catchRef = useRef(data.shootingStar);
  catchRef.current = data.shootingStar;
  useEffect(() => {
    if (shoot) return;
    if (catchesRemaining(catchRef.current, dateStr()) <= 0) return;
    const t = setTimeout(
      () => setShoot({ top: 12 + Math.round(Math.random() * 50), key: Date.now() }),
      90000 + Math.random() * 180000,
    );
    return () => clearTimeout(t);
  }, [shoot]);
  const catchStar = () => {
    const next = recordCatch(catchRef.current, dateStr());
    setShoot(null);
    if (!next) return;
    update((d) => ({
      ...d,
      shootingStar: next,
      game: { ...d.game, catCoins: d.game.catCoins + SHOOTING_STAR_REWARD },
    }));
    toast.success(`☄️ Bắt được sao băng! +${SHOOTING_STAR_REWARD} xu`);
  };

  // Personal star: drag on desktop (committed on release), click opens its editor.
  const [editing, setEditing] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ moved: boolean; startX: number; startY: number } | null>(null);
  const starPos = dragPos ?? { x: personal.x, y: personal.y };

  const onStarDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    drag.current = { moved: false, startX: e.clientX, startY: e.clientY };
    if (e.pointerType === "mouse") e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onStarMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 5) d.moved = true;
    if (!d.moved) return;
    const box = nav.current?.getBoundingClientRect();
    if (!box) return;
    const cx = ((e.clientX - box.left) / box.width) * 100;
    const cy = ((e.clientY - box.top) / box.height) * 100;
    // clamp: keep the star fully inside the sky (no clipping at edges/corners)
    setDragPos({
      x: Math.min(94, Math.max(6, cx)),
      y: Math.min(90, Math.max(10, cy)),
    });
  };
  const onStarUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      if (dragPos)
        update((d) => ({
          ...d,
          settings: { ...d.settings, personalStar: { ...d.settings.personalStar, ...dragPos } },
        }));
      setDragPos(null);
    } else {
      setEditing((v) => !v);
    }
  };

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
            {zodiac.stars.map((star) => {
              const item = items.find((i) => i.value === star.tab)!;
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.value}
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
          {/* The user's own star */}
          <button
            type="button"
            className="personal-star"
            title={personal.name ? `Ngôi sao của bạn: ${personal.name}` : "Ngôi sao của bạn"}
            style={{ left: `${starPos.x}%`, top: `${starPos.y}%` }}
            onPointerDown={onStarDown}
            onPointerMove={onStarMove}
            onPointerUp={onStarUp}
            aria-label="Ngôi sao của bạn"
          />
          {/* Streak constellation: 6 slots, one lit star per 10 streak days */}
          <div
            className="streak-stars"
            title={`Chuỗi ${data.streak.count} ngày — mỗi 10 ngày thắp 1 sao`}
            aria-hidden
          >
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < streakLit ? "lit" : ""} />
            ))}
          </div>
          {/* Catchable shooting star */}
          {shoot && (
            <button
              type="button"
              key={shoot.key}
              className="shooting-star"
              style={{ top: `${shoot.top}%` }}
              aria-label="Bắt sao băng"
              title="Chạm để bắt sao băng!"
              onClick={catchStar}
              onAnimationEnd={() => setShoot(null)}
            />
          )}
          {editing && (
            <div className="personal-star-editor">
              <div className="text-xs font-semibold">⭐ Ngôi sao của bạn</div>
              <input
                value={personal.name}
                maxLength={24}
                placeholder="Đặt tên cho sao..."
                onChange={(e) =>
                  update((d) => ({
                    ...d,
                    settings: {
                      ...d.settings,
                      personalStar: { ...d.settings.personalStar, name: e.target.value },
                    },
                  }))
                }
              />
              <div className="personal-star-presets">
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        settings: {
                          ...d.settings,
                          personalStar: { ...d.settings.personalStar, x: p.x, y: p.y },
                        },
                      }))
                    }
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="personal-star-editor-note">Kéo ngôi sao để tự chọn vị trí</div>
              <button
                type="button"
                className="personal-star-close"
                onClick={() => setEditing(false)}
              >
                Xong
              </button>
            </div>
          )}
        </div>
      </div>
      {children}
    </Tabs>
  );
}
