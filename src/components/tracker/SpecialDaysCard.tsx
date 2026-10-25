import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import {
  MAX_SPECIAL_DAYS,
  daysUntil,
  describeCountdown,
  specialToday,
  type SpecialDayKind,
} from "@/lib/tracker/specialDays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInputVN } from "./DateInputVN";

/**
 * Holidays & birthdays reminder. Display only — no XP/coins/streak effects,
 * so the celebration can never be farmed.
 */
export function SpecialDaysCard() {
  const { data, update } = useTracker();
  const list = data.specialDays;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SpecialDayKind>("birthday");
  const [date, setDate] = useState("");
  const now = new Date();
  const todays = specialToday(list, now);

  const add = () => {
    const clean = name.trim().slice(0, 40);
    if (!clean) {
      toast.error("Nhập tên ngày đặc biệt trước nhé");
      return;
    }
    const [, m, d] = date.split("-");
    const month = Number(m);
    const day = Number(d);
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) {
      toast.error("Chọn ngày (dd/mm/yyyy) trước nhé");
      return;
    }
    if (list.length >= MAX_SPECIAL_DAYS) {
      toast.error(`Tối đa ${MAX_SPECIAL_DAYS} mục, xoá bớt để thêm`);
      return;
    }
    const id = `sp-${Date.now().toString(36)}`;
    update((d) => ({
      ...d,
      specialDays: [...d.specialDays, { id, name: clean, kind, month, day }],
    }));
    toast.success(`Đã thêm "${clean}" 🎊`);
    setName("");
    setDate("");
  };

  return (
    <section className="glass p-4">
      <h2 className="mb-1 text-lg font-semibold">🎊 Ngày đặc biệt</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Lễ, sinh nhật bạn bè & của bạn — chỉ nhắc để kỷ niệm, không thưởng (cho công bằng).
      </p>

      {todays.length > 0 && (
        <div className="mb-3 rounded-xl border border-primary/40 bg-primary/10 p-3">
          {todays.map((i) => (
            <p key={i.id} className="text-sm font-semibold">
              {i.kind === "birthday" ? "🎂" : "🎉"} Hôm nay là {i.name}!
            </p>
          ))}
        </div>
      )}

      {list.length > 0 && (
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Tất cả ngày đã lưu ({list.length}/{MAX_SPECIAL_DAYS})
          </p>
        </div>
      )}
      {list.length > 0 && (
        <ul className="mb-3 max-h-44 space-y-1.5 overflow-y-auto pr-1 thin-scroll">
          {[...list]
            .sort((a, b) => daysUntil(a, now) - daysUntil(b, now))
            .map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {item.kind === "birthday" ? "🎂" : "🗓️"} {item.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({item.day}/{item.month})
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-primary">
                    {describeCountdown(daysUntil(item, now))}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    title={`Xoá ${item.name}`}
                    aria-label={`Xoá ${item.name}`}
                    onClick={() =>
                      update((d) => ({
                        ...d,
                        specialDays: d.specialDays.filter((x) => x.id !== item.id),
                      }))
                    }
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
        </ul>
      )}

      {list.length === 0 && (
        <p className="mb-3 text-xs text-muted-foreground">Chưa có ngày nào — thêm ở dưới nhé.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="h-9 w-40"
          value={name}
          maxLength={40}
          placeholder="Tên (Sinh nhật Lan...)"
          aria-label="Tên ngày đặc biệt"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button
          type="button"
          variant={kind === "birthday" ? "default" : "outline"}
          size="sm"
          aria-label="Chọn loại sinh nhật"
          onClick={() => setKind("birthday")}
        >
          🎂 Sinh nhật
        </Button>
        <Button
          type="button"
          variant={kind === "holiday" ? "default" : "outline"}
          size="sm"
          aria-label="Chọn loại ngày lễ"
          onClick={() => setKind("holiday")}
        >
          🗓️ Ngày lễ
        </Button>
        <DateInputVN
          className="h-9 w-32"
          value={date}
          onChange={setDate}
          ariaLabel="Ngày (dd/mm/yyyy, năm bất kỳ)"
        />
        <Button size="sm" onClick={add}>
          Thêm
        </Button>
      </div>
    </section>
  );
}
