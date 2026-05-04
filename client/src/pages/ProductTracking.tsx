import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import ProductTimeline from "@/components/ProductTimeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronRight, ArrowLeft, Edit2, Save, Clock, CheckCircle2,
  AlertCircle, RotateCcw, XCircle, ClipboardList, BarChart2, List,
} from "lucide-react";

// ─── 型別 ─────────────────────────────────────────────────────────────────────
type InstanceStatus = "in_progress" | "completed" | "rework" | "scrapped";
type FlowStatus = "normal" | "rework" | "waiting" | "skipped";
type ViewTab = "records" | "timeline";

const INSTANCE_STATUS_META: Record<InstanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  in_progress: { label: "生產中", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <Clock className="w-3 h-3" /> },
  completed:   { label: "完成",   color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
  rework:      { label: "重工中", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: <RotateCcw className="w-3 h-3" /> },
  scrapped:    { label: "報廢",   color: "bg-red-500/15 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" /> },
};

const FLOW_STATUS_META: Record<FlowStatus, { label: string; color: string }> = {
  normal:  { label: "正常", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  rework:  { label: "重工", color: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  waiting: { label: "等待", color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  skipped: { label: "跳過", color: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export default function ProductTracking() {
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<number | null>(null);
  const [showNewInstanceDialog, setShowNewInstanceDialog] = useState(false);
  const [showFlowDialog, setShowFlowDialog] = useState(false);
  const [editingFlowId, setEditingFlowId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("records");

  // 新增產品個體表單
  const [newInstance, setNewInstance] = useState({
    serialNumber: "", batchNumber: "", status: "in_progress" as InstanceStatus,
    startTime: "", notes: "", productModelId: "",
  });

  // 新增/編輯流程記錄表單
  const [flowForm, setFlowForm] = useState({
    workstationId: "", workstationName: "", sequenceOrder: 0,
    entryTime: "", exitTime: "", actualCycleTime: "",
    waitTime: "0", status: "normal" as FlowStatus,
    operatorName: "", notes: "",
  });

  // ─── tRPC 查詢 ─────────────────────────────────────────────────────────────
  const { data: lines = [] } = trpc.productionLine.list.useQuery();
  const { data: workstations = [] } = trpc.workstation.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const { data: models = [] } = trpc.productModel.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const { data: instances = [], refetch: refetchInstances } = trpc.productTracking.listInstances.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const { data: flowRecords = [], refetch: refetchFlows } = trpc.productTracking.listFlowRecords.useQuery(
    { productInstanceId: selectedInstanceId! },
    { enabled: !!selectedInstanceId }
  );

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createInstance = trpc.productTracking.createInstance.useMutation({
    onSuccess: () => { refetchInstances(); setShowNewInstanceDialog(false); toast.success("產品序號已建立"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const updateInstance = trpc.productTracking.updateInstance.useMutation({
    onSuccess: () => { refetchInstances(); toast.success("狀態已更新"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const deleteInstance = trpc.productTracking.deleteInstance.useMutation({
    onSuccess: () => { refetchInstances(); setSelectedInstanceId(null); toast.success("已刪除"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const createFlow = trpc.productTracking.createFlowRecord.useMutation({
    onSuccess: () => { refetchFlows(); setShowFlowDialog(false); resetFlowForm(); toast.success("流程記錄已新增"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const updateFlow = trpc.productTracking.updateFlowRecord.useMutation({
    onSuccess: () => { refetchFlows(); setShowFlowDialog(false); setEditingFlowId(null); toast.success("已更新"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const deleteFlow = trpc.productTracking.deleteFlowRecord.useMutation({
    onSuccess: () => { refetchFlows(); toast.success("已刪除"); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  // ─── 計算 ──────────────────────────────────────────────────────────────────
  const selectedInstance = useMemo(
    () => instances.find((i) => i.id === selectedInstanceId) ?? null,
    [instances, selectedInstanceId]
  ) as (typeof instances[0] | null);

  const filteredInstances = useMemo(() => {
    if (!searchQuery) return instances;
    const q = searchQuery.toLowerCase();
    return instances.filter(
      (i: typeof instances[0]) => i.serialNumber.toLowerCase().includes(q) || (i.batchNumber ?? "").toLowerCase().includes(q)
    );
  }, [instances, searchQuery]);

  const totalCycleTime = useMemo(
    () => flowRecords.reduce((s: number, r: typeof flowRecords[0]) => s + (parseFloat(String(r.actualCycleTime ?? 0))), 0),
    [flowRecords]
  );
  const totalWaitTime = useMemo(
    () => flowRecords.reduce((s: number, r: typeof flowRecords[0]) => s + (parseFloat(String(r.waitTime ?? 0))), 0),
    [flowRecords]
  );

  // ─── 輔助函式 ──────────────────────────────────────────────────────────────
  function resetFlowForm() {
    setFlowForm({ workstationId: "", workstationName: "", sequenceOrder: 0, entryTime: "", exitTime: "", actualCycleTime: "", waitTime: "0", status: "normal", operatorName: "", notes: "" });
  }

  function openNewFlowDialog() {
    resetFlowForm();
    setEditingFlowId(null);
    setShowFlowDialog(true);
  }

  function openEditFlowDialog(record: typeof flowRecords[0]) {
    setFlowForm({
      workstationId: String(record.workstationId),
      workstationName: record.workstationName,
      sequenceOrder: record.sequenceOrder,
      entryTime: record.entryTime ? new Date(record.entryTime).toISOString().slice(0, 16) : "",
      exitTime: record.exitTime ? new Date(record.exitTime).toISOString().slice(0, 16) : "",
      actualCycleTime: record.actualCycleTime != null ? String(record.actualCycleTime) : "",
      waitTime: record.waitTime != null ? String(record.waitTime) : "0",
      status: (record.status ?? "normal") as FlowStatus,
      operatorName: record.operatorName ?? "",
      notes: record.notes ?? "",
    });
    setEditingFlowId(record.id);
    setShowFlowDialog(true);
  }

  function handleSubmitFlowForm() {
    if (!selectedInstanceId) return;
    const wsId = parseInt(flowForm.workstationId);
    const wsName = flowForm.workstationName || workstations.find((w: typeof workstations[0]) => w.id === wsId)?.name || "未知工站";
    const payload = {
      productInstanceId: selectedInstanceId,
      workstationId: wsId,
      workstationName: wsName,
      sequenceOrder: flowForm.sequenceOrder,
      entryTime: flowForm.entryTime ? new Date(flowForm.entryTime) : undefined,
      exitTime: flowForm.exitTime ? new Date(flowForm.exitTime) : undefined,
      actualCycleTime: flowForm.actualCycleTime ? parseFloat(flowForm.actualCycleTime) : undefined,
      waitTime: parseFloat(flowForm.waitTime || "0"),
      status: flowForm.status,
      operatorName: flowForm.operatorName || undefined,
      notes: flowForm.notes || undefined,
    };
    if (editingFlowId) {
      updateFlow.mutate({ id: editingFlowId, ...payload });
    } else {
      createFlow.mutate(payload);
    }
  }

  function handleCreateInstance() {
    if (!selectedLineId || !newInstance.serialNumber) return;
    createInstance.mutate({
      productionLineId: selectedLineId,
      serialNumber: newInstance.serialNumber,
      batchNumber: newInstance.batchNumber || undefined,
      status: newInstance.status,
      startTime: newInstance.startTime ? new Date(newInstance.startTime) : undefined,
      notes: newInstance.notes || undefined,
      productModelId: newInstance.productModelId ? parseInt(newInstance.productModelId) : undefined,
    });
  }

  function formatSeconds(sec: number) {
    if (sec < 60) return `${sec.toFixed(1)}s`;
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(0);
    return `${m}m ${s}s`;
  }

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="flex h-full min-h-[calc(100vh-4rem)]">
        {/* 左欄：產品序號列表 */}
        <div className="w-72 border-r border-border flex flex-col bg-card/30">
          {/* 頂部：產線選擇 */}
          <div className="p-4 border-b border-border space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">產品追蹤</h2>
            <Select value={selectedLineId ? String(selectedLineId) : ""} onValueChange={(v) => { setSelectedLineId(parseInt(v)); setSelectedInstanceId(null); }}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="選擇產線" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((l: typeof lines[0]) => (
                  <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedLineId && (
              <div className="flex gap-2">
                <Input
                  placeholder="搜尋序號 / 批次"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs"
                />
                <Button size="sm" className="h-7 px-2 shrink-0" onClick={() => setShowNewInstanceDialog(true)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* 產品列表 */}
          <div className="flex-1 overflow-y-auto">
            {!selectedLineId ? (
              <div className="p-6 text-center text-muted-foreground text-sm">請先選擇產線</div>
            ) : filteredInstances.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>尚無產品記錄</p>
                <p className="text-xs mt-1">點擊 + 新增產品序號</p>
              </div>
            ) : (
              filteredInstances.map((inst) => {
                const meta = INSTANCE_STATUS_META[inst.status as InstanceStatus];
                const isSelected = inst.id === selectedInstanceId;
                return (
                  <div
                    key={inst.id}
                    onClick={() => { setSelectedInstanceId(inst.id); setActiveTab("records"); }}
                    className={`px-4 py-3 cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/40 ${isSelected ? "bg-accent/60 border-l-2 border-l-primary" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-medium truncate">{inst.serialNumber}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${meta.color}`}>
                        {meta.icon}{meta.label}
                      </span>
                      {inst.batchNumber && (
                        <span className="text-xs text-muted-foreground truncate">批次 {inst.batchNumber}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 右欄：流程記錄 / 時間軸 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedInstanceId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">從左側選擇產品序號</p>
                <p className="text-xs mt-1 opacity-60">查看該產品流經各工站的時間記錄</p>
              </div>
            </div>
          ) : (
            <>
              {/* 產品資訊 Header */}
              <div className="px-6 py-4 border-b border-border bg-card/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedInstanceId(null)} className="text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-lg">{selectedInstance?.serialNumber}</span>
                        {selectedInstance && (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${INSTANCE_STATUS_META[selectedInstance.status as InstanceStatus].color}`}>
                            {INSTANCE_STATUS_META[selectedInstance.status as InstanceStatus].icon}
                            {INSTANCE_STATUS_META[selectedInstance.status as InstanceStatus].label}
                          </span>
                        )}
                      </div>
                      {selectedInstance?.batchNumber && (
                        <p className="text-xs text-muted-foreground mt-0.5">批次：{selectedInstance.batchNumber}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Tab 切換 */}
                    <div className="flex rounded-md border border-border overflow-hidden">
                      <button
                        onClick={() => setActiveTab("records")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${activeTab === "records" ? "bg-primary text-primary-foreground" : "hover:bg-accent/50"}`}
                      >
                        <List className="w-3.5 h-3.5" />記錄
                      </button>
                      <button
                        onClick={() => setActiveTab("timeline")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors ${activeTab === "timeline" ? "bg-primary text-primary-foreground" : "hover:bg-accent/50"}`}
                      >
                        <BarChart2 className="w-3.5 h-3.5" />時間軸
                      </button>
                    </div>
                    {/* 狀態快速切換 */}
                    <Select
                      value={selectedInstance?.status ?? "in_progress"}
                      onValueChange={(v) => updateInstance.mutate({ id: selectedInstanceId, status: v as InstanceStatus })}
                    >
                      <SelectTrigger className="h-7 text-xs w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(INSTANCE_STATUS_META).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={openNewFlowDialog}>
                      <Plus className="w-3.5 h-3.5 mr-1" />新增工站記錄
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("確定刪除此產品及所有流程記錄？")) deleteInstance.mutate({ id: selectedInstanceId }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* KPI 統計列（僅在記錄 Tab 顯示，時間軸 Tab 有自己的 KPI） */}
                {activeTab === "records" && flowRecords.length > 0 && (
                  <div className="flex gap-6 mt-3 pt-3 border-t border-border/50">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">流經工站</p>
                      <p className="text-lg font-bold">{flowRecords.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">總加工時間</p>
                      <p className="text-lg font-bold text-primary">{formatSeconds(totalCycleTime)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">總等待時間</p>
                      <p className="text-lg font-bold text-amber-400">{formatSeconds(totalWaitTime)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Lead Time</p>
                      <p className="text-lg font-bold">{formatSeconds(totalCycleTime + totalWaitTime)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">增值率</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {totalCycleTime + totalWaitTime > 0
                          ? `${((totalCycleTime / (totalCycleTime + totalWaitTime)) * 100).toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">重工/等待工站</p>
                      <p className="text-lg font-bold text-amber-400">
                        {flowRecords.filter((r: typeof flowRecords[0]) => r.status === "rework" || r.status === "waiting").length}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 內容區：根據 Tab 切換 */}
              <div className="flex-1 overflow-auto">
                {activeTab === "records" ? (
                  /* ── 記錄表格 ── */
                  <div className="p-6">
                    {flowRecords.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">尚無工站流程記錄</p>
                        <p className="text-xs mt-1 opacity-60">點擊「新增工站記錄」開始記錄此產品的流程</p>
                        <Button size="sm" className="mt-4" onClick={openNewFlowDialog}>
                          <Plus className="w-3.5 h-3.5 mr-1" />新增第一筆記錄
                        </Button>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>工站名稱</TableHead>
                            <TableHead>進入時間</TableHead>
                            <TableHead>離開時間</TableHead>
                            <TableHead className="text-right">加工時間</TableHead>
                            <TableHead className="text-right">等待時間</TableHead>
                            <TableHead>狀態</TableHead>
                            <TableHead>作業員</TableHead>
                            <TableHead className="w-20">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {flowRecords.map((record: typeof flowRecords[0]) => {
                            const fMeta = FLOW_STATUS_META[record.status as FlowStatus];
                            return (
                              <TableRow key={record.id}>
                                <TableCell className="text-muted-foreground text-xs">{record.sequenceOrder}</TableCell>
                                <TableCell className="font-medium">{record.workstationName}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {record.entryTime ? new Date(record.entryTime).toLocaleString() : "—"}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {record.exitTime ? new Date(record.exitTime).toLocaleString() : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {record.actualCycleTime != null ? formatSeconds(parseFloat(String(record.actualCycleTime))) : "—"}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm text-amber-400">
                                  {record.waitTime != null && parseFloat(String(record.waitTime)) > 0
                                    ? formatSeconds(parseFloat(String(record.waitTime)))
                                    : "—"}
                                </TableCell>
                                <TableCell>
                                  <span className={`inline-flex items-center text-xs px-1.5 py-0.5 rounded border ${fMeta.color}`}>
                                    {fMeta.label}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{record.operatorName ?? "—"}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <button onClick={() => openEditFlowDialog(record)} className="p-1 hover:text-primary">
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => { if (confirm("確定刪除此記錄？")) deleteFlow.mutate({ id: record.id }); }}
                                      className="p-1 hover:text-destructive">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ) : (
                  /* ── 時間軸視圖 ── */
                  <ProductTimeline
                    records={flowRecords.map((r: typeof flowRecords[0]) => ({
                      id: r.id,
                      workstationId: r.workstationId,
                      workstationName: r.workstationName,
                      sequenceOrder: r.sequenceOrder,
                      entryTime: r.entryTime,
                      exitTime: r.exitTime,
                      actualCycleTime: r.actualCycleTime,
                      waitTime: r.waitTime,
                      status: r.status,
                      operatorName: r.operatorName,
                      notes: r.notes,
                    }))}
                    serialNumber={selectedInstance?.serialNumber ?? ""}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── 新增產品序號 Dialog ─────────────────────────────────────────────── */}
      <Dialog open={showNewInstanceDialog} onOpenChange={setShowNewInstanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>新增產品序號</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">產品序號 *</Label>
                <Input
                  placeholder="如 SN-2026-0001"
                  value={newInstance.serialNumber}
                  onChange={(e) => setNewInstance(p => ({ ...p, serialNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">批次號</Label>
                <Input
                  placeholder="如 LOT-2026-05"
                  value={newInstance.batchNumber}
                  onChange={(e) => setNewInstance(p => ({ ...p, batchNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">狀態</Label>
                <Select value={newInstance.status} onValueChange={(v) => setNewInstance(p => ({ ...p, status: v as InstanceStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INSTANCE_STATUS_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">對應型號</Label>
                <Select value={newInstance.productModelId} onValueChange={(v) => setNewInstance(p => ({ ...p, productModelId: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇型號（可選）" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">無</SelectItem>
                    {models.map((m: typeof models[0]) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.modelCode} {m.modelName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">進入產線時間</Label>
              <Input
                type="datetime-local"
                value={newInstance.startTime}
                onChange={(e) => setNewInstance(p => ({ ...p, startTime: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">備註</Label>
              <Textarea
                placeholder="選填備註"
                value={newInstance.notes}
                onChange={(e) => setNewInstance(p => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewInstanceDialog(false)}>取消</Button>
            <Button onClick={handleCreateInstance} disabled={!newInstance.serialNumber || createInstance.isPending}>
              {createInstance.isPending ? "建立中…" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 新增/編輯流程記錄 Dialog ─────────────────────────────────────────── */}
      <Dialog open={showFlowDialog} onOpenChange={(o) => { setShowFlowDialog(o); if (!o) { setEditingFlowId(null); resetFlowForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFlowId ? "編輯工站記錄" : "新增工站記錄"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">工站 *</Label>
                <Select
                  value={flowForm.workstationId}
                  onValueChange={(v) => {
                    const ws = workstations.find((w: typeof workstations[0]) => w.id === parseInt(v));
                    setFlowForm(p => ({
                      ...p,
                      workstationId: v,
                      workstationName: ws?.name ?? "",
                      sequenceOrder: ws?.sequenceOrder ?? 0,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="選擇工站" /></SelectTrigger>
                  <SelectContent>
                    {workstations.map((w: typeof workstations[0]) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.sequenceOrder}. {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">狀態</Label>
                <Select value={flowForm.status} onValueChange={(v) => setFlowForm(p => ({ ...p, status: v as FlowStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FLOW_STATUS_META).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">進入工站時間</Label>
                <Input type="datetime-local" value={flowForm.entryTime} onChange={(e) => setFlowForm(p => ({ ...p, entryTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">離開工站時間</Label>
                <Input type="datetime-local" value={flowForm.exitTime} onChange={(e) => setFlowForm(p => ({ ...p, exitTime: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">實際加工時間（秒）</Label>
                <Input type="number" min="0" step="0.1" placeholder="如 45.5" value={flowForm.actualCycleTime} onChange={(e) => setFlowForm(p => ({ ...p, actualCycleTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">等待時間（秒）</Label>
                <Input type="number" min="0" step="0.1" placeholder="0" value={flowForm.waitTime} onChange={(e) => setFlowForm(p => ({ ...p, waitTime: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">作業員</Label>
                <Input placeholder="姓名" value={flowForm.operatorName} onChange={(e) => setFlowForm(p => ({ ...p, operatorName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">備註</Label>
              <Textarea placeholder="選填備註" value={flowForm.notes} onChange={(e) => setFlowForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowFlowDialog(false); setEditingFlowId(null); resetFlowForm(); }}>取消</Button>
            <Button
              onClick={handleSubmitFlowForm}
              disabled={!flowForm.workstationId || createFlow.isPending || updateFlow.isPending}
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {editingFlowId ? "儲存" : "新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
