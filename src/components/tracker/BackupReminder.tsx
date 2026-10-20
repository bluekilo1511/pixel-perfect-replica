import { useTracker } from "@/lib/tracker/store";
import { needsBackupReminder } from "@/lib/tracker/model";
import { Button } from "@/components/ui/button";

/** Small banner nudging the user to export their JSON every 7 days. */
export function BackupReminder() {
  const { data, download, dismissBackupReminder } = useTracker();
  if (!needsBackupReminder(data)) return null;
  return (
    <div className="glass flex flex-wrap items-center gap-3 border border-accent/40 p-3 text-sm" role="status">
      <span aria-hidden>💾</span>
      <p className="flex-1 text-muted-foreground">
        Đã lâu chưa sao lưu dữ liệu. Hãy tải file JSON về máy để giữ an toàn tiến trình của bạn nhé!
      </p>
      <Button size="sm" onClick={download}>⬇️ Sao lưu ngay</Button>
      <Button size="sm" variant="ghost" onClick={dismissBackupReminder}>Để sau</Button>
    </div>
  );
}
