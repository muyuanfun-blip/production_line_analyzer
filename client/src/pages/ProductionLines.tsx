import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Factory, Plus, Pencil, Trash2, BarChart3, Brain,
  ChevronRight, MoreVertical, Settings, Target, TrendingUp, AlertTriangle,
  Activity, Users
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type LineFormData = {
  name: string;
  description: string;
  targetCycleTime: string;
};

/** 依平衡率回傳顏色 class */
function getBalanceColor(rate: number) {
  if (rate >= 90) return { text: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "優秀" };
  if (rate >= 80) return { text: "text-cyan-400", bg: "bg-cyan-400/10 border-cyan-400/30", label: "良好" };
  if (rate >= 70) return { text: "text-amber-400", bg: "bg-amber-400/10 border-amber-400/30", label: "待改善" };
  return { text: "text-red-400", bg: "bg-red-400/10 border-red-400/30", label: "需優化" };
}

export default function ProductionLines() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: lines, isLoading } = trpc.productionLine.list.useQuery();
  const { data: allLatest } = trpc.snapshot.getAllLinesLatest.useQuery();

  // 建立 lineId → 最新快照的 Map，方便卡片查詢
  const latestMap = useMemo(() => {
    const map = new Map<number, { balanceRate: number; upph: number | null; snapshotName: string }>();
    if (!allLatest) return map;
    for (const item of allLatest) {
      if (item.snapshot) {
        map.set(item.lineId, {
          balanceRate: item.snapshot.balanceRate,
          upph: item.snapshot.upph ?? null,
          snapshotName: item.snapshot.name,
        });
      }
    }
    return map;
  }, [allLatest]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<LineFormData>({ name: "", description: "", targetCycleTime: "" });

  const createMutation = trpc.productionLine.create.useMutation({
    onSuccess: () => {
      utils.productionLine.list.invalidate();
      toast.success("生產線建立成功");
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error("建立失敗，請稍後再試"),
  });

  const updateMutation = trpc.productionLine.update.useMutation({
    onSuccess: () => {
      utils.productionLine.list.invalidate();
      toast.success("生產線更新成功");
      setShowForm(false);
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("更新失敗，請稍後再試"),
  });

  const deleteMutation = trpc.productionLine.delete.useMutation({
    onSuccess: () => {
      utils.productionLine.list.invalidate();
      toast.success("生產線已刪除");
      setDeleteId(null);
    },
    onError: () => toast.error("刪除失敗，請稍後再試"),
  });

  const resetForm = () => setForm({ name: "", description: "", targetCycleTime: "" });

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (line: any) => {
    setForm({
      name: line.name,
      description: line.description ?? "",
      targetCycleTime: line.targetCycleTime ?? "",
    });
    setEditingId(line.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("請輸入生產線名稱"); return; }
    const payload = {
      name: form.name.trim(),
      description: form.description || undefined,
      targetCycleTime: form.targetCycleTime ? parseFloat(form.targetCycleTime) : undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      active: { label: "運行中", className: "badge-efficient" },
      inactive: { label: "停用", className: "badge-normal" },
      archived: { label: "已封存", className: "badge-bottleneck" },
    };
    return map[status] ?? { label: status, className: "badge-normal" };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">生產線管理</h1>
          <p className="text-muted-foreground text-sm mt-1">管理所有生產線，進行工站配置與效率分析</p>
        </div>
        <Button onClick={openCreate} className="glow-primary">
          <Plus className="h-4 w-4 mr-2" />
          新增生產線
        </Button>
      </div>

      {/* Lines Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : lines?.length === 0 ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-12 text-center">
            <Factory className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">尚無生產線</h3>
            <p className="text-muted-foreground text-sm mb-6">點擊「新增生產線」開始建立您的第一條產線</p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              新增生產線
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lines?.map((line) => {
            const st = statusLabel(line.status);
            const latest = latestMap.get(line.id) ?? null;
            const balColor = latest ? getBalanceColor(latest.balanceRate) : null;
            return (
              <Card key={line.id} className="border-border bg-card hover:border-primary/30 transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Factory className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{line.name}</CardTitle>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${st.className} mt-1 inline-block`}>
                          {st.label}
                        </span>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(line)}>
                          <Pencil className="h-4 w-4 mr-2" />編輯
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteId(line.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />刪除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {line.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{line.description}</p>
                  )}

                  {/* ── 最新快照指標區塊 ── */}
                  {latest ? (
                    <div className="grid grid-cols-2 gap-2">
                      {/* 平衡率 */}
                      <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${balColor!.bg}`}>
                        <BarChart3 className={`h-4 w-4 shrink-0 ${balColor!.text}`} />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground leading-none mb-0.5">平衡率</p>
                          <p className={`text-sm font-bold leading-none ${balColor!.text}`}>
                            {latest.balanceRate.toFixed(1)}%
                          </p>
                          <p className={`text-xs leading-none mt-0.5 ${balColor!.text} opacity-70`}>
                            {balColor!.label}
                          </p>
                        </div>
                      </div>
                      {/* UPPH */}
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/30">
                        <Users className="h-4 w-4 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground leading-none mb-0.5">UPPH</p>
                          {latest.upph != null ? (
                            <>
                              <p className="text-sm font-bold text-amber-400 leading-none">
                                {latest.upph.toFixed(1)}
                              </p>
                              <p className="text-xs text-amber-400/70 leading-none mt-0.5">件/人/時</p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground/60 leading-none">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 無快照時的提示 */
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-dashed border-border">
                      <Activity className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      <p className="text-xs text-muted-foreground/60">尚無分析資料，請先進行平衡分析並儲存快照</p>
                    </div>
                  )}

                  {/* Takt Time */}
                  {line.targetCycleTime ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-400/8 border border-violet-400/20">
                      <Target className="h-4 w-4 text-violet-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground">目標節拍時間（Takt Time）</p>
                        <p className="text-sm font-bold text-violet-400">{parseFloat(line.targetCycleTime).toFixed(1)} 秒</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-dashed border-border">
                      <Target className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      <p className="text-xs text-muted-foreground/60">尚未設定目標節拍時間</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex flex-col gap-1 h-auto py-2 text-xs hover:bg-cyan-400/10 hover:text-cyan-400"
                      onClick={() => setLocation(`/lines/${line.id}/workstations`)}
                    >
                      <Settings className="h-4 w-4" />
                      工站管理
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex flex-col gap-1 h-auto py-2 text-xs hover:bg-emerald-400/10 hover:text-emerald-400"
                      onClick={() => setLocation(`/lines/${line.id}/balance`)}
                    >
                      <BarChart3 className="h-4 w-4" />
                      平衡分析
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex flex-col gap-1 h-auto py-2 text-xs hover:bg-amber-400/10 hover:text-amber-400"
                      onClick={() => setLocation(`/lines/${line.id}/ai`)}
                    >
                      <Brain className="h-4 w-4" />
                      AI 建議
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "編輯生產線" : "新增生產線"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>生產線名稱 <span className="text-destructive">*</span></Label>
              <Input
                placeholder="例：A線 / 總裝線 / SMT線"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-input border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>描述說明</Label>
              <Textarea
                placeholder="簡述此產線的用途或特性..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-input border-border resize-none"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="h-3.5 w-3.5 text-violet-400" />
                目標節拍時間 Takt Time（秒）
              </Label>
              <Input
                type="number"
                placeholder="例：60（依客戶需求計算：可用時間 ÷ 需求數量）"
                value={form.targetCycleTime}
                onChange={e => setForm(f => ({ ...f, targetCycleTime: e.target.value }))}
                className="bg-input border-border"
                min="0"
                step="0.1"
              />
              {form.targetCycleTime && parseFloat(form.targetCycleTime) > 0 && (
                <p className="text-xs text-muted-foreground">
                  每小時產能目標：約 {Math.floor(3600 / parseFloat(form.targetCycleTime))} 件
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            刪除此生產線將同時刪除所有相關工站與動作步驟資料，此操作無法復原。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
