import { useState } from "react";
import { toast } from "sonner";
import { useTracker } from "@/lib/tracker/store";
import {
  CAP2_SUBJECT_CONFIGS,
  clearSubjectCombo,
  comboMembers,
  detectCap2Merges,
  matchCap2Config,
  mergeAllCap2,
  mergeCap2Integrated,
  seedCap2Subjects,
  setSubjectCombo,
  STANDARD_CAP2_SUBJECTS,
  COMBO_MEMBERS_MIN,
  COMBO_MEMBERS_MAX,
} from "@/lib/tracker/combos";
import { addSubject } from "@/lib/tracker/model";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Layers, BookOpen, Trash2, Plus, Check } from "lucide-react";

interface SubjectComboManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubjectComboManagerModal({
  open,
  onOpenChange,
}: SubjectComboManagerModalProps) {
  const { data, update } = useTracker();
  const [activeTab, setActiveTab] = useState<"cap2" | "custom">("cap2");

  // Custom combo state
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const subjects = data.subjects;
  const cap2Merges = detectCap2Merges(data, subjects);

  const handleSeedCap2 = () => {
    const next = seedCap2Subjects(data);
    if (next === data) {
      toast.error("Danh sách đã đủ 12 môn hoặc đã có bộ môn Cấp 2 rồi.");
      return;
    }
    update(() => next);
    toast.success("Đã thêm bộ môn THCS chuẩn. 📚");
  };

  const handleMergeAll = () => {
    const names = cap2Merges.flatMap((merge) => merge.orphanSubjects);
    if (!window.confirm(`Gộp ${names.join(", ")} vào môn tích hợp? Các môn con sẽ bị gỡ khỏi danh sách, nhưng điểm và ghi chú được giữ và chuyển sang môn tích hợp.`)) return;
    update((d) => mergeAllCap2(d, subjects));
    toast.success("Đã gộp toàn bộ phân môn Cấp 2 vào môn tích hợp! 🎉");
  };

  const handleAddSubjectQuick = (name: string) => {
    update((d) => addSubject(d, name) ?? d);
    toast.success(`Đã thêm môn "${name}" vào danh sách!`);
  };

  const handleToggleMember = (sub: string) => {
    if (selectedMembers.includes(sub)) {
      setSelectedMembers(selectedMembers.filter((m) => m !== sub));
    } else {
      if (selectedMembers.length >= COMBO_MEMBERS_MAX) {
        toast.error(`Tổ hợp chỉ được tối đa ${COMBO_MEMBERS_MAX} môn thành viên`);
        return;
      }
      setSelectedMembers([...selectedMembers, sub]);
    }
  };

  const handleSaveCustomCombo = () => {
    if (!selectedTarget) {
      toast.error("Vui lòng chọn môn chính của tổ hợp");
      return;
    }
    if (selectedMembers.length < COMBO_MEMBERS_MIN) {
      toast.error(`Cần chọn tối thiểu ${COMBO_MEMBERS_MIN} môn thành viên`);
      return;
    }
    const updated = setSubjectCombo(data, selectedTarget, selectedMembers);
    if (!updated) {
      toast.error("Không thể ghép tổ hợp (môn đã thuộc tổ hợp khác hoặc dữ liệu trùng)");
      return;
    }
    update(() => updated);
    toast.success(`Đã ghép tổ hợp: ${selectedTarget} = ${selectedMembers.join(" + ")} 🧩`);
    setSelectedTarget("");
    setSelectedMembers([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto p-5">
        <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <span className="text-xl">🧩</span> Quản lý Môn tổ hợp & Cấp 2 (THCS)
          </DialogTitle>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Hỗ trợ cấu hình môn tích hợp Cấp 2 (KHTN: Lý-Hóa-Sinh; LS&ĐL: Sử-Địa) theo Thông tư 22,
            hoặc ghép tổ hợp môn tự do.
          </p>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant={activeTab === "cap2" ? "default" : "outline"}
            className="flex-1 text-xs font-semibold gap-1.5 h-8"
            onClick={() => setActiveTab("cap2")}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Môn tích hợp Cấp 2 (Thông tư 22)
          </Button>
          <Button
            size="sm"
            variant={activeTab === "custom" ? "default" : "outline"}
            className="flex-1 text-xs font-semibold gap-1.5 h-8"
            onClick={() => setActiveTab("custom")}
          >
            <Layers className="h-3.5 w-3.5" />
            Ghép tổ hợp tự do ({Object.keys(data.subjectCombos ?? {}).length})
          </Button>
        </div>

        {/* Tab 1: Cấp 2 THCS */}
        {activeTab === "cap2" && (
          <div className="space-y-4 pt-1">
            {/* Quick Seed Action Banner */}
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  Nạp nhanh danh sách môn Cấp 2 chuẩn
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Thêm các môn tích hợp và môn học phổ biến; không sửa hoặc xóa môn hiện có.
                </p>
              </div>
              <Button
                size="sm"
                className="h-7 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
                onClick={handleSeedCap2}
              >
                ⚡ Nạp bộ môn Cấp 2
              </Button>
            </div>

            {/* Merge notification if orphans detected */}
            {cap2Merges.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      ⚠️ Phát hiện phân môn con lẻ cần gộp:
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {cap2Merges.map((m) => (
                        <span key={m.targetSubject} className="mr-2">
                          <strong>{m.orphanSubjects.join(", ")}</strong> → gộp vào 4 cột TX của{" "}
                          <strong>{m.targetSubject}</strong>
                        </span>
                      ))}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                    onClick={handleMergeAll}
                  >
                    ⚡ Gộp tất cả ngay
                  </Button>
                </div>
              </div>
            )}

            {/* Integrated Subject Cards */}
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.values(CAP2_SUBJECT_CONFIGS).map((cfg) => {
                const existing = subjects.find((s) =>
                  cfg.aliases.some((a) => a.toLowerCase() === s.trim().toLowerCase()),
                );
                const orphans = subjects.filter((s) => {
                  const lower = s.trim().toLowerCase();
                  if (existing && lower === existing.trim().toLowerCase()) return false;
                  return cfg.subDisciplines.some((sub) =>
                    sub.aliases.some((a) => a.toLowerCase() === lower),
                  );
                });

                return (
                  <div
                    key={cfg.key}
                    className="rounded-2xl border border-border/80 bg-card p-4 space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🧬</span>
                        <div>
                          <h4 className="font-bold text-sm">{cfg.name}</h4>
                          <p className="text-[11px] text-muted-foreground">
                            {cfg.key === "KHTN" ? "Khoa học tự nhiên" : "Lịch sử và Địa lí"}
                          </p>
                        </div>
                      </div>
                      {existing ? (
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold flex items-center gap-1">
                          <Check className="h-3 w-3" /> Đã có môn
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] px-2 font-medium"
                          onClick={() => handleAddSubjectQuick(cfg.name)}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Thêm môn
                        </Button>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-[11px] font-medium text-muted-foreground">Phân môn tích hợp:</p>
                      <div className="flex flex-wrap gap-1">
                        {cfg.subDisciplines.map((sub) => (
                          <span
                            key={sub.short}
                            className="rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px]"
                          >
                            {sub.badge} ({sub.name})
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Thông tư 22: Môn có <strong>4 cột Thường xuyên (TX)</strong> bao quát các phân môn, 1 Giữa kỳ và 1 Cuối kỳ trong Sổ điểm.
                    </p>

                    {orphans.length > 0 && (
                      <div className="pt-1 border-t border-border/50">
                        <Button
                          size="sm"
                          className="w-full h-7 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white"
                          onClick={() => {
                            const merge = {
                              targetSubject: existing || cfg.name,
                              config: cfg,
                              orphanSubjects: orphans,
                            };
                            if (!window.confirm(`Gộp ${orphans.join(", ")} vào ${existing || cfg.name}? Các môn con sẽ bị gỡ khỏi danh sách, nhưng điểm và ghi chú được giữ và chuyển sang môn tích hợp.`)) return;
                            update((d) => mergeCap2Integrated(d, merge));
                            toast.success(`Đã gộp [${orphans.join(", ")}] vào ${existing || cfg.name}! 🎉`);
                          }}
                        >
                          ⚡ Gộp [{orphans.join(", ")}] vào {existing || cfg.name}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Ghép tổ hợp tự do */}
        {activeTab === "custom" && (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dành cho môn tổ hợp Cấp 3 hoặc ghép tuỳ ý (vd: KHXH = Sử + Địa + GDCD). Môn chính sẽ
              tự động tính điểm trung bình từ các môn thành viên trong Sổ điểm.
            </p>

            {/* Creation form */}
            <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
              <h4 className="font-semibold text-xs flex items-center gap-1.5">
                <span>➕</span> Ghép tổ hợp mới
              </h4>

              <div className="space-y-2">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                    1. Chọn môn chính của tổ hợp:
                  </label>
                  <select
                    className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs"
                    value={selectedTarget}
                    onChange={(e) => {
                      setSelectedTarget(e.target.value);
                      setSelectedMembers([]);
                    }}
                  >
                    <option value="">-- Chọn môn chính --</option>
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s} {comboMembers(data, s) ? "(đang là tổ hợp)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTarget && (
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                      2. Chọn 2–3 môn thành viên tạo nên {selectedTarget}:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {subjects
                        .filter((s) => s !== selectedTarget && !comboMembers(data, s))
                        .map((s) => {
                          const picked = selectedMembers.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              className={`rounded-lg px-2.5 py-1 text-xs border transition ${
                                picked
                                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                                  : "border-border bg-muted/60 text-foreground hover:bg-muted"
                              }`}
                              onClick={() => handleToggleMember(s)}
                            >
                              {picked ? "✓ " : "+ "}
                              {s}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    className="h-8 text-xs font-semibold"
                    disabled={!selectedTarget || selectedMembers.length < COMBO_MEMBERS_MIN}
                    onClick={handleSaveCustomCombo}
                  >
                    Lưu môn tổ hợp
                  </Button>
                </div>
              </div>
            </div>

            {/* Current Active Combos */}
            <div className="space-y-2">
              <h4 className="font-semibold text-xs text-muted-foreground">
                Các tổ hợp đang ghép ({Object.keys(data.subjectCombos ?? {}).length}):
              </h4>
              {Object.keys(data.subjectCombos ?? {}).length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Chưa có tổ hợp tự do nào.</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(data.subjectCombos ?? {}).map(([name, ms]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-border/80 bg-muted/30 p-3"
                    >
                      <div>
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          <span>🧩</span> {name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Gồm các môn: <strong>{ms.join(" + ")}</strong>
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          update((d) => clearSubjectCombo(d, name));
                          toast.success(`Đã gỡ tổ hợp ${name}`);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Gỡ tổ hợp
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
