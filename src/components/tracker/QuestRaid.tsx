import { useTracker } from "@/lib/tracker/store";
import { dateStr } from "@/lib/tracker/model";
import { dailyQuests, questProgress, RAID_MAX_HP, raidStatus } from "@/lib/tracker/quests";
import { weatherEffect, weatherFromData } from "@/lib/tracker/extras";
import { Button } from "@/components/ui/button";

export function DailyQuestsCard() {
  const { data, claimQuest } = useTracker();
  const today = dateStr();
  const quests = dailyQuests(today);
  const claimed = data.quests.date === today ? data.quests.claimed : [];
  const stats = data.dailyStats[today];
  const effect = weatherEffect(weatherFromData(data));

  return (
    <section className="glass p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-semibold">🎯 Nhiệm vụ ngày</h2>
        <span className="text-sm text-muted-foreground">
          {claimed.length}/{quests.length}
        </span>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{effect.label}</p>
      <ul className="space-y-2">
        {quests.map((q) => {
          const prog = questProgress(stats, q);
          const done = prog >= q.target;
          const isClaimed = claimed.includes(q.id);
          return (
            <li
              key={q.id}
              className={`rounded-xl border border-border p-3 ${isClaimed ? "opacity-60" : "bg-muted"}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{q.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{q.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {q.desc} · {prog}/{q.target}
                  </p>
                </div>
                {isClaimed ? (
                  <span className="rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                    ✓
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant={done ? "default" : "outline"}
                    disabled={!done}
                    onClick={() => claimQuest(q.id)}
                  >
                    {q.reward.catCoins > 0 && `+${q.reward.catCoins} 😺`}
                    {q.reward.lizardGems > 0 && `+${q.reward.lizardGems} 🦎`}
                  </Button>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="bg-xp h-full rounded-full transition-all duration-500"
                  style={{ width: `${(prog / q.target) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function RaidBossCard() {
  const { data, claimRaid } = useTracker();
  const st = raidStatus(data.dailyStats, dateStr(), data.raid);
  const pct = (st.hpLeft / RAID_MAX_HP) * 100;

  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">⚔️ Boss tuần</h2>
        <span className="text-sm text-muted-foreground">{st.pomodoros} 🍅 tuần này</span>
      </div>
      <div className="mb-2 flex items-center gap-3">
        <span className={`text-4xl ${st.defeated ? "opacity-40 grayscale" : ""}`} aria-hidden>
          👹
        </span>
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>{st.defeated ? "Đã hạ gục!" : "Quái vật Xao Nhãng"}</span>
            <span>
              {st.hpLeft}/{RAID_MAX_HP} HP
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-destructive transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Mỗi phiên Pomodoro trong tuần gây 12 sát thương. Hạ boss để nhận +10 😺 +3 🦎.
      </p>
      <Button className="w-full" disabled={!st.claimable} onClick={claimRaid}>
        {st.claimable
          ? "🎁 Nhận thưởng Boss tuần"
          : st.defeated
            ? "Đã nhận thưởng tuần này"
            : "Chưa hạ được boss"}
      </Button>
    </section>
  );
}
