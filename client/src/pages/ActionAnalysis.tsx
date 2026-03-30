import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import {
  ArrowLeft, ChevronRight, Plus, Pencil, Trash2, Activity,
  Clock, CheckCircle, XCircle, MinusCircle, PieChart, Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

const ACTION_TYPES = [
  { value: "value_added", label: "增值動作", color: "#4ade80", icon: CheckCircle, desc: "直接為產品增加價值的操作" },
  { value: "non_value_added", label: "非增值動作", color: "#f97316", icon: XCircle, desc: "不增加價值且可消除的浪費" },
  { value: "necessary_waste", label: "必要浪費", color: "#eab308", icon: MinusCircle, desc: "目前必要但不增加價值的操作" },
];

type StepFormData = {
  stepName: string;
  stepOrder: string;
  duration: string;
  actionType: "value_added" | "non_value_added" | "necessary_waste";
  description: string;
};

export default function ActionAnalysis() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const search = useSearch();
  const wsIdFromQuery = new URLSearchParams(search).get("ws");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: workstations } = trpc.workstation.listByLine.useQuery({ productionLineId: lineId });

  const [selectedWsId, setSelectedWsId] = useState<number | null>(
    wsIdFromQuery ? parseInt(wsIdFromQuery) : null
  );
  const activeWsId = selectedWsId ?? workstations?.[0]?.id ?? null;

  const { data: steps, isLoading } = trpc.actionStep.listByWorkstation.useQuery(
    { workstationId: activeWsId! },
    { enabled: !!activeWsId }
  );

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<StepFormData>({
    stepName: "", stepOrder: "", duration: "", actionType: "value_added", description: ""
  });

  const createMutation = trpc.actionStep.create.useMutation({
    onSuccess: () => {
      if (activeWsId) utils.actionStep.listByWorkstation.invalidate({ workstationId: activeWsId });
      toast.success("步驟建立成功");
      setShowForm(false);
      resetForm();
    },
    onError: () => toast.error("建立失敗"),
  });

  const updateMutation = trpc.actionStep.update.useMutation({
    onSuccess: () => {
      if (activeWsId) utils.actionStep.listByWorkstation.invalidate({ workstationId: activeWsId });
      toast.success("步驟更新成功");
      setShowForm(false);
      setEditingId(null);
      resetForm();
    },
    onError: () => toast.error("更新失敗"),
  });

  const deleteMutation = trpc.actionStep.delete.useMutation({
    onSuccess: () => {
      if (activeWsId) utils.actionStep.listByWorkstation.invalidate({ workstationId: activeWsId });
      toast.success("步驟已刪除");
      setDeleteId(null);
    },
    onError: () => toast.error("刪除失敗"),
  });

  const resetForm = () => setForm({ stepName: "", stepOrder: "", duration: "", actionType: "value_added", description: "" });

  const openCreate = () => {
    resetForm();
    setEditingId(null);
    const nextOrder = (steps?.length ?? 0) + 1;
    setForm(f => ({ ...f, stepOrder: nextOrder.toString() }));
    setShowForm(true);
  };

  const openEdit = (step: any) => {
    setForm({
      stepName: step.stepName,
      stepOrder: step.stepOrder.toString(),
      duration: step.duration.toString(),
      actionType: step.actionType,
      description: step.description ?? "",
    });
    setEditingId(step.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.stepName.trim()) { toast.error("請輸入步驟名稱"); return; }
    if (!form.duration || parseFloat(form.duration) <= 0) { toast.error("請輸入有效的時間"); return; }
    if (!activeWsId) { toast.error("請先選擇工站"); return; }
    const payload = {
      stepName: form.stepName.trim(),
      stepOrder: parseInt(form.stepOrder) || 0,
      duration: parseFloat(form.duration),
      actionType: form.actionType,
      description: form.description || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate({ workstationId: activeWsId, ...payload });
    }
  };

  const pieData = useMemo(() => {
    if (!steps?.length) return [];
    const grouped: Record<string, number> = {};
    steps.forEach(s => {
      const t = s.actionType;
      grouped[t] = (grouped[t] ?? 0) + parseFloat(s.duration.toString());
    });
    return ACTION_TYPES.map(at => ({
      name: at.label,
      value: parseFloat((grouped[at.value] ?? 0).toFixed(2)),
      color: at.color,
    })).filter(d => d.value > 0);
  }, [steps]);

  const totalDuration = steps?.reduce((s, step) => s + parseFloat(step.duration.toString()), 0) ?? 0;
  const activeWs = workstations?.find(w => w.id === activeWsId);

  const handleExport = () => {
    if (!steps?.length) { toast.error("沒有步驟資料可導出"); return; }
    const header = "步驟名稱,時間(s),動作類型,描述\n";
    const rows = steps.map(s =>
      `${s.stepName},${s.duration},${ACTION_TYPES.find(a => a.value === s.actionType)?.label ?? s.actionType},${s.description ?? ""}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeWs?.name ?? "steps"}_動作分析.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 已下載");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/lines")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>生產線管理</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate">{line?.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">動作分析記錄</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />導出 CSV
        </Button>
        <Button onClick={openCreate} disabled={!activeWsId} className="glow-primary">
          <Plus className="h-4 w-4 mr-2" />新增步驟
        </Button>
      </div>

      {/* Workstation Selector */}
      {workstations && workstations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {workstations.map(ws => (
            <button
              key={ws.id}
              onClick={() => setSelectedWsId(ws.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                activeWsId === ws.id
                  ? "bg-primary text-primary-foreground border-primary glow-primary"
                  : "bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              {ws.name}
              <span className="ml-2 text-xs opacity-70">{parseFloat(ws.cycleTime.toString()).toFixed(1)}s</span>
            </button>
          ))}
        </div>
      )}

      {!activeWsId ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-12 text-center">
            <Activity className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">請先建立工站</h3>
            <p className="text-muted-foreground text-sm mb-6">前往工站管理頁面新增工站後，即可記錄動作步驟</p>
            <Button onClick={() => setLocation(`/lines/${lineId}/workstations`)}>前往工站管理</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Steps List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">
                {activeWs?.name} — 操作步驟
                <span className="ml-2 text-sm text-muted-foreground font-normal">
                  共 {steps?.length ?? 0} 個步驟，總計 {totalDuration.toFixed(1)}s
                </span>
              </h2>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-card animate-pulse border border-border" />
                ))}
              </div>
            ) : steps?.length === 0 ? (
              <Card className="border-dashed border-primary/30 bg-primary/5">
                <CardContent className="p-8 text-center">
                  <Activity className="h-10 w-10 text-primary/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">此工站尚無動作步驟記錄</p>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />新增第一個步驟
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {steps?.map((step, idx) => {
                  const at = ACTION_TYPES.find(a => a.value === step.actionType)!;
                  const pct = totalDuration > 0 ? (parseFloat(step.duration.toString()) / totalDuration * 100).toFixed(1) : "0";
                  return (
                    <Card key={step.id} className="border-border bg-card hover:border-primary/20 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{ background: `${at.color}20`, color: at.color, border: `1px solid ${at.color}40` }}>
                            {step.stepOrder}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">{step.stepName}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: `${at.color}15`, color: at.color, border: `1px solid ${at.color}30` }}>
                                {at.label}
                              </span>
                            </div>
                            {step.description && (
                              <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                            )}
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: at.color }} />
                              </div>
                              <span className="text-xs font-mono text-muted-foreground shrink-0">
                                {parseFloat(step.duration.toString()).toFixed(1)}s ({pct}%)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-primary" onClick={() => openEdit(step)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={() => setDeleteId(step.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pie Chart */}
          <div className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-primary" />
                  動作類型分佈
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    尚無數據
                  </div>
                ) : (
                  <>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: "oklch(0.16 0.012 240)", border: "1px solid oklch(0.25 0.015 240)", borderRadius: "8px" }}
                            formatter={(value: number) => [`${value.toFixed(1)}s`, ""]}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2 mt-2">
                      {pieData.map(d => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                            <span className="text-muted-foreground">{d.name}</span>
                          </div>
                          <span className="font-mono" style={{ color: d.color }}>
                            {d.value.toFixed(1)}s ({totalDuration > 0 ? (d.value / totalDuration * 100).toFixed(1) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Action Type Legend */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">動作類型說明</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ACTION_TYPES.map(at => (
                  <div key={at.value} className="flex items-start gap-3">
                    <at.icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: at.color }} />
                    <div>
                      <p className="text-xs font-medium" style={{ color: at.color }}>{at.label}</p>
                      <p className="text-xs text-muted-foreground">{at.desc}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) { setShowForm(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editingId ? "編輯動作步驟" : "新增動作步驟"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>步驟名稱 <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="例：取料 / 焊接 / 檢查"
                  value={form.stepName}
                  onChange={e => setForm(f => ({ ...f, stepName: e.target.value }))}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-2">
                <Label>步驟順序</Label>
                <Input
                  type="number"
                  value={form.stepOrder}
                  onChange={e => setForm(f => ({ ...f, stepOrder: e.target.value }))}
                  className="bg-input border-border"
                  min="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>時間（秒）<span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  placeholder="例：5.5"
                  value={form.duration}
                  onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  className="bg-input border-border"
                  min="0"
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>動作類型</Label>
                <Select
                  value={form.actionType}
                  onValueChange={(v) => setForm(f => ({ ...f, actionType: v as any }))}
                >
                  <SelectTrigger className="bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {ACTION_TYPES.map(at => (
                      <SelectItem key={at.value} value={at.value}>
                        <span style={{ color: at.color }}>{at.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>描述說明</Label>
              <Textarea
                placeholder="步驟的詳細說明..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-input border-border resize-none"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingId(null); resetForm(); }}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingId ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader><DialogTitle>確認刪除步驟</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">此操作無法復原。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })} disabled={deleteMutation.isPending}>
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
