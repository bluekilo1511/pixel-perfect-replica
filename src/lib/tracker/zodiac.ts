// Zodiac navigation sky: 12 constellations, each mapping the 7 app tabs onto
// the stars of a real constellation shape. Pure data + lookup helpers.
export type NavTabKey = "today" | "stats" | "week" | "shop" | "wheel" | "chronicle" | "settings";

export interface ZodiacStar {
  x: number; // % from left
  y: number; // % from top
  r: number; // star radius (px)
  tab: NavTabKey;
}

export interface Zodiac {
  id: string;
  name: string; // Vietnamese sign name
  range: string; // date range label
  stars: ZodiacStar[]; // exactly 7, one per tab
  lines: [number, number][]; // constellation line pairs (star indices)
}

export const ZODIAC_LIST: Zodiac[] = [
  {
    id: "aries",
    name: "Bạch Dương",
    range: "21/3 – 19/4",
    stars: [
      { x: 22, y: 30, r: 10, tab: "today" },
      { x: 38, y: 46, r: 7, tab: "stats" },
      { x: 56, y: 52, r: 7, tab: "week" },
      { x: 74, y: 42, r: 7, tab: "shop" },
      { x: 86, y: 60, r: 6, tab: "wheel" },
      { x: 68, y: 72, r: 6, tab: "chronicle" },
      { x: 40, y: 76, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "taurus",
    name: "Kim Ngưu",
    range: "20/4 – 20/5",
    stars: [
      { x: 50, y: 74, r: 10, tab: "today" }, // Aldebaran, V bottom
      { x: 36, y: 62, r: 7, tab: "stats" },
      { x: 26, y: 46, r: 7, tab: "week" },
      { x: 18, y: 26, r: 6, tab: "shop" },
      { x: 64, y: 62, r: 7, tab: "wheel" },
      { x: 74, y: 44, r: 7, tab: "chronicle" },
      { x: 84, y: 24, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "gemini",
    name: "Song Tử",
    range: "21/5 – 20/6",
    stars: [
      { x: 28, y: 78, r: 10, tab: "today" }, // Pollux
      { x: 30, y: 54, r: 7, tab: "stats" },
      { x: 32, y: 30, r: 6, tab: "week" },
      { x: 34, y: 14, r: 6, tab: "shop" },
      { x: 68, y: 80, r: 9, tab: "wheel" }, // Castor twin
      { x: 70, y: 56, r: 7, tab: "chronicle" },
      { x: 68, y: 32, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [4, 5],
      [5, 6],
      [3, 6],
    ],
  },
  {
    id: "cancer",
    name: "Cự Giải",
    range: "21/6 – 22/7",
    stars: [
      { x: 50, y: 40, r: 10, tab: "today" }, // center
      { x: 34, y: 26, r: 7, tab: "stats" },
      { x: 22, y: 16, r: 6, tab: "week" },
      { x: 66, y: 26, r: 7, tab: "shop" },
      { x: 78, y: 16, r: 6, tab: "wheel" },
      { x: 42, y: 70, r: 7, tab: "chronicle" },
      { x: 60, y: 74, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [0, 3],
      [3, 4],
      [0, 5],
      [5, 6],
    ],
  },
  {
    id: "leo",
    name: "Sư Tử",
    range: "23/7 – 22/8",
    stars: [
      { x: 62, y: 46, r: 10, tab: "today" }, // Regulus
      { x: 48, y: 60, r: 7, tab: "stats" },
      { x: 34, y: 66, r: 7, tab: "week" },
      { x: 84, y: 34, r: 7, tab: "shop" },
      { x: 74, y: 20, r: 6, tab: "wheel" },
      { x: 58, y: 16, r: 6, tab: "chronicle" },
      { x: 44, y: 26, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [0, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "virgo",
    name: "Xử Nữ",
    range: "23/8 – 22/9",
    stars: [
      { x: 74, y: 26, r: 10, tab: "today" }, // Spica
      { x: 56, y: 40, r: 7, tab: "stats" },
      { x: 40, y: 34, r: 7, tab: "week" },
      { x: 24, y: 22, r: 6, tab: "shop" },
      { x: 30, y: 52, r: 6, tab: "wheel" },
      { x: 46, y: 68, r: 7, tab: "chronicle" },
      { x: 66, y: 62, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "libra",
    name: "Thiên Bình",
    range: "23/9 – 22/10",
    stars: [
      { x: 50, y: 46, r: 10, tab: "today" },
      { x: 34, y: 58, r: 7, tab: "stats" },
      { x: 66, y: 58, r: 7, tab: "week" },
      { x: 24, y: 74, r: 7, tab: "shop" },
      { x: 76, y: 74, r: 7, tab: "wheel" },
      { x: 50, y: 22, r: 6, tab: "chronicle" },
      { x: 50, y: 84, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 3],
      [2, 4],
      [0, 5],
      [3, 6],
      [4, 6],
    ],
  },
  {
    id: "scorpio",
    name: "Thiên Yết",
    range: "23/10 – 21/11",
    stars: [
      { x: 40, y: 34, r: 11, tab: "today" }, // Antares, the red heart
      { x: 26, y: 22, r: 7, tab: "stats" },
      { x: 16, y: 34, r: 7, tab: "week" },
      { x: 56, y: 46, r: 8, tab: "shop" },
      { x: 68, y: 62, r: 7, tab: "wheel" },
      { x: 80, y: 76, r: 7, tab: "chronicle" },
      { x: 88, y: 58, r: 6, tab: "settings" }, // tail hook tip
    ],
    lines: [
      [1, 0],
      [2, 0],
      [0, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "sagittarius",
    name: "Nhân Mã",
    range: "22/11 – 21/12",
    stars: [
      { x: 52, y: 52, r: 10, tab: "today" },
      { x: 38, y: 40, r: 7, tab: "stats" },
      { x: 28, y: 62, r: 7, tab: "week" },
      { x: 66, y: 34, r: 7, tab: "shop" },
      { x: 80, y: 48, r: 7, tab: "wheel" },
      { x: 44, y: 76, r: 6, tab: "chronicle" },
      { x: 66, y: 72, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [0, 2],
      [0, 3],
      [3, 4],
      [2, 5],
      [0, 6],
    ],
  },
  {
    id: "capricorn",
    name: "Ma Kết",
    range: "22/12 – 19/1",
    stars: [
      { x: 22, y: 44, r: 10, tab: "today" },
      { x: 40, y: 62, r: 7, tab: "stats" },
      { x: 60, y: 66, r: 7, tab: "week" },
      { x: 80, y: 52, r: 7, tab: "shop" },
      { x: 86, y: 32, r: 6, tab: "wheel" },
      { x: 62, y: 30, r: 6, tab: "chronicle" },
      { x: 38, y: 28, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 0],
    ],
  },
  {
    id: "aquarius",
    name: "Bảo Bình",
    range: "20/1 – 18/2",
    stars: [
      { x: 70, y: 26, r: 10, tab: "today" }, // the jar
      { x: 58, y: 36, r: 7, tab: "stats" },
      { x: 82, y: 40, r: 7, tab: "week" },
      { x: 50, y: 54, r: 7, tab: "shop" },
      { x: 40, y: 66, r: 7, tab: "wheel" },
      { x: 30, y: 78, r: 6, tab: "chronicle" },
      { x: 18, y: 84, r: 6, tab: "settings" }, // poured water stream
    ],
    lines: [
      [0, 1],
      [0, 2],
      [1, 3],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
  },
  {
    id: "pisces",
    name: "Song Ngư",
    range: "19/2 – 20/3",
    stars: [
      { x: 24, y: 30, r: 10, tab: "today" }, // circlet fish
      { x: 34, y: 18, r: 6, tab: "stats" },
      { x: 40, y: 34, r: 6, tab: "week" },
      { x: 76, y: 70, r: 9, tab: "shop" }, // other fish
      { x: 86, y: 58, r: 6, tab: "wheel" },
      { x: 50, y: 50, r: 6, tab: "chronicle" },
      { x: 62, y: 60, r: 6, tab: "settings" },
    ],
    lines: [
      [0, 1],
      [0, 2],
      [2, 5],
      [5, 6],
      [6, 3],
      [3, 4],
    ],
  },
];

export const DEFAULT_ZODIAC_ID = "scorpio";

const BY_ID = new Map(ZODIAC_LIST.map((z) => [z.id, z]));

export function zodiacById(id: string): Zodiac {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_ZODIAC_ID)!;
}

export function isValidZodiacId(id: string): boolean {
  return BY_ID.has(id);
}
