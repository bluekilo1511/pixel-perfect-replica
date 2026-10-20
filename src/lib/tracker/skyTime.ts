// Pure rules for the time-of-day sky. No browser APIs here, so it is testable.

export type SkyBand = "night" | "dawn" | "day" | "dusk";

/** 5-7 sáng sớm, 8-16 ban ngày, 17-19 hoàng hôn, còn lại là đêm. */
export function skyBand(hour: number): SkyBand {
  const h = Math.floor(Number.isFinite(hour) ? hour : 12) % 24;
  if (h >= 5 && h <= 7) return "dawn";
  if (h >= 8 && h <= 16) return "day";
  if (h >= 17 && h <= 19) return "dusk";
  return "night";
}

export const SKY_BAND_CLASS: Record<SkyBand, string> = {
  night: "sky-night",
  dawn: "sky-dawn",
  day: "sky-day",
  dusk: "sky-dusk",
};
