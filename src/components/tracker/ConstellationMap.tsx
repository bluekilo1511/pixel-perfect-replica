import { useTracker } from "@/lib/tracker/store";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_REWARD,
  type AchievementId,
  type Constellation,
} from "@/lib/tracker/extras";
import { Button } from "@/components/ui/button";

const CONSTELLATION_META: Record<Constellation, { emoji: string; name: string }> = {
  eagle: { emoji: "🦅", name: "Đại Bàng" },
  whale: { emoji: "🐋", name: "Cá Voi" },
};

const groups = (Object.keys(CONSTELLATION_META) as Constellation[]).map((constellation) => ({
  constellation,
  achievements: (Object.keys(ACHIEVEMENTS) as AchievementId[]).filter(
    (id) => ACHIEVEMENTS[id].constellation === constellation,
  ),
}));

export function ConstellationMap() {
  const { data, claimAchievement } = useTracker();

  return (
    <section className="glass p-5">
      <h2 className="mb-3 text-lg font-semibold">✨ Bản Đồ Chòm Sao</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(({ constellation, achievements }) => (
          <section key={constellation} className="rounded-2xl bg-muted p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-2xl">{CONSTELLATION_META[constellation].emoji}</span>
              <h3 className="font-semibold">{CONSTELLATION_META[constellation].name}</h3>
            </div>
            <ul className="space-y-2">
              {achievements.map((id) => {
                const achievement = ACHIEVEMENTS[id];
                const unlockedAt = data.achievements.unlocked[id];
                const claimedAt = data.claimedAchievements[id] ?? data.achievements.claimed[id];
                return (
                  <li
                    key={id}
                    className={`rounded-xl p-3 text-sm ${unlockedAt ? "bg-secondary" : "bg-background/50"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{unlockedAt ? achievement.emoji : "❓"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {unlockedAt ? achievement.name : "Thành tựu ẩn"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {unlockedAt
                            ? `${achievement.desc} · ${new Date(unlockedAt).toLocaleDateString("vi-VN")}`
                            : achievement.clue}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      {!unlockedAt && (
                        <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                          Chưa mở khóa
                        </span>
                      )}
                      {unlockedAt && !claimedAt && (
                        <Button size="sm" onClick={() => claimAchievement(id)}>
                          {`Nhận +${ACHIEVEMENT_REWARD} 🦎`}
                        </Button>
                      )}
                      {claimedAt && (
                        <span className="rounded-full bg-success px-2.5 py-1 text-xs font-medium text-primary-foreground">
                          Đã nhận
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
