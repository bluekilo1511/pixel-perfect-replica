import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadUrl } from "@/lib/tracker/exportImage";

export interface ImageShot {
  url: string;
  filename: string;
}

/**
 * Fallback for framed previews where automatic downloads are blocked:
 * shows the exported PNG in-app so the user can save it manually.
 */
export function ImageExportDialog({
  shot,
  onClose,
}: {
  shot: ImageShot | null;
  onClose: () => void;
}) {
  if (!shot) return null;
  const save = () => {
    downloadUrl(shot.url, shot.filename);
    toast.success("Đã tạo lệnh tải ảnh — kiểm tra thư mục Downloads nhé");
  };
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="Xuất ảnh"
      onClick={onClose}
    >
      <div
        className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">🖼️ Ảnh đã sẵn sàng</h3>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Đóng">
            ✕
          </Button>
        </div>
        <img
          src={shot.url}
          alt={`Ảnh xuất ${shot.filename}`}
          className="w-full rounded-xl border border-border bg-background"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Bản xem trước chặn tải tự động — bấm “Tải ảnh” bên dưới, hoặc chuột phải (giữ trên điện
          thoại) vào ảnh để lưu.
        </p>
        <Button className="mt-3 w-full" onClick={save}>
          ⬇️ Tải ảnh
        </Button>
      </div>
    </div>
  );
}
