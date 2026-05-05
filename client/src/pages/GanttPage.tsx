/**
 * GanttPage.tsx
 * 多產品序號並排甘特圖頁面
 * 左側：產線選擇 + 序號多選（可全選 / 反選）
 * 右側：ProductGantt 甘特圖
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import ProductGantt from "@/components/ProductGantt";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  CheckSquare, Square, LayoutList, AlertCircle, Clock, CheckCircle2,
  RotateCcw, XCircle,
} from "lucide-react";

// ─── 型別 ─────────────────────────────────────────────────────────────────────
type InstanceStatus = "in_progress" | "completed" | "rework" | "scrapped";

const STATUS_META: Record<InstanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  in_progress: { label: "生產中", color: "text-blue-400", icon: <Clock className="w-3 h-3" /> },
  completed:   { label: "完成",   color: "text-emerald-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  rework:      { label: "重工中", color: "text-amber-400", icon: <RotateCcw className="w-3 h-3" /> },
  scrapped:    { label: "報廢",   color: "text-red-400", icon: <XCircle className="w-3 h-3" /> },
};

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export default function GanttPage() {
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // ─── tRPC 查詢 ─────────────────────────────────────────────────────────────
  const { data: lines = [] } = trpc.productionLine.list.useQuery();
  const { data: workstations = [] } = trpc.workstation.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const { data: allInstances = [] } = trpc.productTracking.listInstances.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const instanceIds = useMemo(
    () => Array.from(selectedInstanceIds),
    [selectedInstanceIds]
  );
  const { data: batchFlowRecords = [], isLoading: isLoadingRecords } =
    trpc.productTracking.listFlowRecordsBatch.useQuery(
      { instanceIds },
      { enabled: instanceIds.length > 0 }
    );

  // ─── 篩選後的 instances ───────────────────────────────────────────────────
  const filteredInstances = useMemo(() => {
    return allInstances.filter((inst: typeof allInstances[0]) => {
      const matchSearch = !searchQuery ||
        inst.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inst.batchNumber ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || inst.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [allInstances, searchQuery, statusFilter]);

  // ─── 選取的 instances（用於甘特圖） ──────────────────────────────────────
  const selectedInstances = useMemo(
    () => allInstances.filter((inst: typeof allInstances[0]) => selectedInstanceIds.has(inst.id)),
    [allInstances, selectedInstanceIds]
  );

  // ─── 工站名稱列表 ─────────────────────────────────────────────────────────
  const wsNames = useMemo(
    () => workstations.map((w: typeof workstations[0]) => w.name),
    [workstations]
  );

  // ─── 選取控制 ────────────────────────────────────────────────────────────
  function toggleInstance(id: number) {
    setSelectedInstanceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedInstanceIds(new Set(filteredInstances.map((i: typeof allInstances[0]) => i.id)));
  }

  function selectNone() {
    setSelectedInstanceIds(new Set());
  }

  function selectFiltered() {
    setSelectedInstanceIds(new Set(filteredInstances.map((i: typeof allInstances[0]) => i.id)));
  }

  const allFilteredSelected = filteredInstances.length > 0 &&
    filteredInstances.every((i: typeof allInstances[0]) => selectedInstanceIds.has(i.id));

  // ─── UI ────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="flex h-full min-h-[calc(100vh-4rem)]">
        {/* ─── 左側：控制面板 ──────────────────────────────────────────── */}
        <div className="w-64 border-r border-border flex flex-col bg-card/30 shrink-0">
          {/* 標題 */}
          <div className="p-4 border-b border-border space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">甘特圖比較</h2>

            {/* 產線選擇 */}
            <Select
              value={selectedLineId ? String(selectedLineId) : ""}
              onValueChange={(v) => {
                setSelectedLineId(parseInt(v));
                setSelectedInstanceIds(new Set());
              }}
            >
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
              <>
                {/* 狀態篩選 */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    <SelectItem value="in_progress">生產中</SelectItem>
                    <SelectItem value="completed">完成</SelectItem>
                    <SelectItem value="rework">重工中</SelectItem>
                    <SelectItem value="scrapped">報廢</SelectItem>
                  </SelectContent>
                </Select>

                {/* 搜尋 */}
                <Input
                  placeholder="搜尋序號 / 批次"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 text-xs"
                />

                {/* 全選 / 取消 */}
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs flex-1"
                    onClick={allFilteredSelected ? selectNone : selectAll}
                  >
                    {allFilteredSelected ? (
                      <><CheckSquare className="w-3 h-3 mr-1" />取消全選</>
                    ) : (
                      <><Square className="w-3 h-3 mr-1" />全選</>
                    )}
                  </Button>
                  {selectedInstanceIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={selectNone}
                    >
                      清除
                    </Button>
                  )}
                </div>

                {/* 已選計數 */}
                {selectedInstanceIds.size > 0 && (
                  <p className="text-xs text-primary">
                    已選 {selectedInstanceIds.size} / {allInstances.length} 個序號
                  </p>
                )}
              </>
            )}
          </div>

          {/* 序號列表 */}
          <div className="flex-1 overflow-y-auto">
            {!selectedLineId ? (
              <div className="p-4 text-center text-muted-foreground text-xs">請先選擇產線</div>
            ) : filteredInstances.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">
                <LayoutList className="w-6 h-6 mx-auto mb-2 opacity-30" />
                無符合的序號
              </div>
            ) : (
              filteredInstances.map((inst: typeof allInstances[0]) => {
                const isSelected = selectedInstanceIds.has(inst.id);
                const meta = STATUS_META[inst.status as InstanceStatus];
                return (
                  <div
                    key={inst.id}
                    onClick={() => toggleInstance(inst.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer border-b border-border/40 transition-colors hover:bg-accent/40 ${isSelected ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                  >
                    {/* 勾選框 */}
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                      {isSelected && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono font-medium truncate">{inst.serialNumber}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-xs flex items-center gap-0.5 ${meta?.color ?? ""}`}>
                          {meta?.icon}{meta?.label ?? inst.status}
                        </span>
                        {inst.batchNumber && (
                          <span className="text-xs text-muted-foreground/60 truncate">· {inst.batchNumber}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── 右側：甘特圖 ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedInstanceIds.size === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">請從左側勾選要比較的產品序號</p>
                <p className="text-xs mt-1 opacity-60">可多選，建議 2–20 個序號以獲得最佳視覺效果</p>
                {selectedLineId && allInstances.length > 0 && (
                  <Button size="sm" className="mt-4" onClick={selectAll}>
                    <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                    全選此產線序號
                  </Button>
                )}
              </div>
            </div>
          ) : isLoadingRecords ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm">載入流程記錄中…</p>
              </div>
            </div>
          ) : (
            <ProductGantt
              instances={selectedInstances.map((inst: typeof allInstances[0]) => ({
                id: inst.id,
                serialNumber: inst.serialNumber,
                batchNumber: inst.batchNumber,
                status: inst.status,
              }))}
              flowRecords={batchFlowRecords.map((r: typeof batchFlowRecords[0]) => ({
                id: r.id,
                productInstanceId: r.productInstanceId,
                workstationId: r.workstationId,
                workstationName: r.workstationName,
                sequenceOrder: r.sequenceOrder,
                entryTime: r.entryTime,
                exitTime: r.exitTime,
                actualCycleTime: r.actualCycleTime,
                waitTime: r.waitTime,
                status: r.status,
                operatorName: r.operatorName,
              }))}
              workstationNames={wsNames}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
