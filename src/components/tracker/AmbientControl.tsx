import { useEffect, useState } from "react";
import {
  pauseAmbient,
  playAmbient,
  setAmbientVolume,
  type AmbientKind,
} from "@/lib/tracker/ambient";
import { useTracker } from "@/lib/tracker/store";
import { Button } from "@/components/ui/button";

export function AmbientControl() {
  const { data, update } = useTracker();
  const [kind, setKind] = useState<AmbientKind | null>(data.settings.ambient.kind);
  const [on, setOn] = useState(false);
  const [vol, setVol] = useState(data.settings.ambient.volume);

  useEffect(() => {
    setKind(data.settings.ambient.kind);
  }, [data.settings.ambient.kind]);
  useEffect(() => {
    setVol(data.settings.ambient.volume);
  }, [data.settings.ambient.volume]);
  useEffect(
    () => () => {
      void pauseAmbient();
    },
    [],
  );
  const toggle = async () => {
    if (on) {
      await pauseAmbient();
      setOn(false);
    } else {
      await playAmbient(kind ?? "rain", vol);
      setOn(true);
    }
  };
  const pick = async (k: AmbientKind) => {
    setKind(k);
    update((d) => ({
      ...d,
      settings: { ...d.settings, ambient: { ...d.settings.ambient, kind: k } },
    }));
    if (on) await playAmbient(k, vol);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs">
      <Button
        size="sm"
        variant={on ? "default" : "outline"}
        className="h-7 px-2"
        onClick={toggle}
        aria-label={on ? "Tạm dừng âm thanh" : "Phát âm thanh"}
      >
        {on ? "⏸" : "▶"}
      </Button>
      {(["rain", "ocean"] as AmbientKind[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => pick(k)}
          className={`rounded-full px-2 py-1 font-medium transition ${kind === k ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {k === "rain" ? "🌧️ Mưa" : "🌊 Sóng biển"}
        </button>
      ))}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={vol}
        aria-label="Âm lượng"
        className="h-1 w-24 accent-[var(--primary)]"
        onChange={(e) => {
          const v = +e.target.value;
          setVol(v);
          setAmbientVolume(v);
          update((d) => ({
            ...d,
            settings: { ...d.settings, ambient: { ...d.settings.ambient, volume: v } },
          }));
        }}
      />
    </div>
  );
}
