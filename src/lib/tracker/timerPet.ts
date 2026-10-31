// Pure pet reactions for the fullscreen timer: the pet mirrors your progress
// through the session (sleepy at the start, watching the clock mid-way,
// cheering near the finish). No browser APIs, so it is fully testable.

export type TimerPetAnim = "idle" | "watch" | "cheer" | "dance";

export interface TimerPetState {
  face: string;
  say: string;
  anim: TimerPetAnim;
}

/** Picks the pet's reaction from the completion ratio (0..1) of the pinned task. */
export function timerPetState(pct: number, running: boolean): TimerPetState {
  if (!running) return { face: "🫡", say: "chờ mình tiếp nha…", anim: "idle" };
  if (pct < 0.15) return { face: "😴", say: "mới bắt đầu, mình ngủ chút đã…", anim: "idle" };
  if (pct < 0.55) return { face: "👀", say: "đang canh đồng hồ thay chủ nhân…", anim: "watch" };
  if (pct < 0.85) return { face: "💪", say: "sắp xong rồi, cố lên chủ nhân!", anim: "cheer" };
  return { face: "🎉", say: "gần về đích rồi — ăn mừng nhiệt liệt!", anim: "dance" };
}
