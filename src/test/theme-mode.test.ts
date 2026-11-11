import { describe, it, expect } from "vitest";
import {
  AdventureNewspaperCard,
  HallOfFameCard,
  PetAdventureLogCard,
} from "@/components/tracker/Chronicle";

describe("Theme Mode & Chronicle Exports", () => {
  it("Chronicle exports AdventureNewspaperCard, HallOfFameCard, and PetAdventureLogCard as components", () => {
    expect(AdventureNewspaperCard).toBeDefined();
    expect(HallOfFameCard).toBeDefined();
    expect(PetAdventureLogCard).toBeDefined();
  });

  it("evaluates light mode correctly against dragon theme overrides", () => {
    const evaluateTheme = (
      themeMode: "auto" | "light" | "dark",
      band: string,
      dragonTheme: boolean,
    ) => {
      const light = themeMode === "light" || (themeMode === "auto" && band === "day");
      const activeDragon = dragonTheme === true && !light;
      const theme = light ? "light" : "dark";
      return { theme, light, activeDragon };
    };

    const resLight = evaluateTheme("light", "night", true);
    expect(resLight.theme).toBe("light");
    expect(resLight.light).toBe(true);
    expect(resLight.activeDragon).toBe(false);

    const resDark = evaluateTheme("dark", "day", true);
    expect(resDark.theme).toBe("dark");
    expect(resDark.light).toBe(false);
    expect(resDark.activeDragon).toBe(true);

    const resAutoDay = evaluateTheme("auto", "day", true);
    expect(resAutoDay.theme).toBe("light");
    expect(resAutoDay.light).toBe(true);
    expect(resAutoDay.activeDragon).toBe(false);

    const resAutoNight = evaluateTheme("auto", "night", true);
    expect(resAutoNight.theme).toBe("dark");
    expect(resAutoNight.light).toBe(false);
    expect(resAutoNight.activeDragon).toBe(true);
  });
});
