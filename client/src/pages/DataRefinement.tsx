import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PencilLine,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Plus,
  Trash2,
} from "lucide-react";

// ─── 型別 ──────────────────────────────────────────────────────────────────

interface WorkstationRow {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  sequenceOrder: number;
  description?: string;
  actionStepCount?: number;
  totalStepSec?: number;
  valueAddedSec?: number;
  nonValueAddedSec?: number;
  necessaryWasteSec?: number;
  valueAddedRate?: number | null;
}

interface EditRow extends WorkstationRow {
  _origCycleTime: number;
  _origManpower: number;
  _origName: string;
  _dirty: boolean;
}

// ─── KPI 即時計算 ──────────────────────────────────────────────────────────

function calcKpi(rows: EditRow[], taktTime: number | null) {
  if (rows.length === 0) return null;
  const times = rows.map(r => r.cycleTime);
  const totalTime = times.reduce((s, t) => s + t, 0);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = totalTime / rows.length;
  const balanceRate = maxTime > 0 ? (totalTime / (maxTime * rows.length)) * 100 : 0;
  const totalManpower = rows.reduce((s, r) => s + r.manpower, 0);
  const upph = maxTime > 0 && totalManpower > 0 ? 3600 / maxTime / totalManpower : 0;
  const bottleneck = rows.find(r => r.cycleTime === maxTime);
  const taktPassCount = taktTime ? rows.filter(r => r.cycleTime <= taktTime).length : null;
  const taktPassRate = taktTime && rows.length > 0 ? (taktPassCount! / rows.length) * 100 : null;
  return { totalTime, maxTime, minTime, avgTime, balanceRate, totalManpower, upph, bottleneck, taktPassCount, taktPassRate };
}

// ─── 主元件 ────────────────────────────────────────────────────────────────

export default function DataRefinement() {
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedSnapId, setSelectedSnapId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [snapName, setSnapName] = useState("");
  const [snapNote, setSnapNote] = useState("");
  const [taktTimeInput, setTaktTimeInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsCt, setNewWsCt] = useState("");
  const [newWsManpower, setNewWsManpower] = useState("1");

  // ─── 查詢 ──────────────────────────────────────────────────────────────
  const { data: lines = [] } = trpc.productionLine.list.useQuery();
  const { data: snapshots = [], refetch: refetchSnaps } = trpc.snapshot.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: selectedLineId != null }
  );
  const { data: snapDetail, refetch: refetchDetail } = trpc.snapshot.getById.useQuery(
    { id: selectedSnapId! },
    { enabled: selectedSnapId != null }
  );

  // ─── 載入快照資料至編輯列 ──────────────────────────────────────────────
  useEffect(() => {
    if (!snapDetail) return;
    const ws = (snapDetail.workstationsData as WorkstationRow[] | null) ?? [];
    const sorted = [...ws].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    setEditRows(sorted.map(w => ({
      ...w,
      _origCycleTime: w.cycleTime,
      _origManpower: w.manpower,
      _origName: w.name,
      _dirty: false,
    })));
    setSnapName(snapDetail.name);
    setSnapNote(snapDetail.note ?? "");
    setTaktTimeInput(snapDetail.taktTime ? String(snapDetail.taktTime) : "");
    setIsDirty(false);
  }, [snapDetail]);

  // ─── 新增工站 ──────────────────────────────────────────────────────────
  const handleAddWorkstation = useCallback(() => {
    const name = newWsName.trim();
    const ct = parseFloat(newWsCt);
    const mp = parseFloat(newWsManpower);
    if (!name) { toast.error("請輸入工站名稱"); return; }
    if (isNaN(ct) || ct <= 0) { toast.error("請輸入有效的週期時間"); return; }
    if (isNaN(mp) || mp <= 0) { toast.error("請輸入有效的人力"); return; }
    const maxOrder = editRows.length > 0 ? Math.max(...editRows.map(r => r.sequenceOrder)) : 0;
    const tempId = -(Date.now()); // 負數 id 代表新增（尚未持久化）
    const newRow: EditRow = {
      id: tempId,
      name,
      cycleTime: ct,
      manpower: mp,
      sequenceOrder: maxOrder + 1,
      description: "",
      _origCycleTime: ct,
      _origManpower: mp,
      _origName: name,
      _dirty: true,
    };
    setEditRows(prev => [...prev, newRow]);
    setIsDirty(true);
    setNewWsName("");
    setNewWsCt("");
    setNewWsManpower("1");
    setShowAddForm(false);
    toast.success(`已新增工站「${name}」，請記得按「儲存變更」`);
  }, [newWsName, newWsCt, newWsManpower, editRows]);

  // ─── 刪除工站（僅限新增的暫存列） ─────────────────────────────────────
  const handleRemoveRow = useCallback((idx: number) => {
    setEditRows(prev => {
      const next = [...prev];
      next.splice(idx, 1);
      // 重新排序
      return next.map((r, i) => ({ ...r, sequenceOrder: i + 1 }));
    });
    setIsDirty(true);
  }, []);

  // ─── 更新 mutation ─────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const updateMutation = trpc.snapshot.updateData.useMutation({
    onSuccess: () => {
      toast.success("快照數據已儲存，KPI 已自動重算");
      refetchDetail();
      refetchSnaps();
      utils.snapshot.getAllLinesLatest.invalidate();
      utils.snapshot.getAllLinesHistory.invalidate();
      setIsDirty(false);
    },
    onError: (err) => {
      toast.error(`儲存失敗：${err.message}`);
    },
  });

  // ─── 欄位更新 ──────────────────────────────────────────────────────────
  const updateRow = useCallback((idx: number, field: keyof EditRow, raw: string) => {
    setEditRows(prev => {
      const next = [...prev];
      const row = { ...next[idx] };
      if (field === "cycleTime") {
        const v = parseFloat(raw);
        row.cycleTime = isNaN(v) ? row.cycleTime : v;
        row._dirty = row.cycleTime !== row._origCycleTime || row.manpower !== row._origManpower || row.name !== row._origName;
      } else if (field === "manpower") {
        const v = parseFloat(raw);
        row.manpower = isNaN(v) ? row.manpower : v;
        row._dirty = row.cycleTime !== row._origCycleTime || row.manpower !== row._origManpower || row.name !== row._origName;
      } else if (field === "name") {
        row.name = raw;
        row._dirty = row.cycleTime !== row._origCycleTime || row.manpower !== row._origManpower || row.name !== row._origName;
      }
      next[idx] = row;
      return next;
    });
    setIsDirty(true);
  }, []);

  // ─── 重置 ──────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!snapDetail) return;
    const ws = (snapDetail.workstationsData as WorkstationRow[] | null) ?? [];
    const sorted = [...ws].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    setEditRows(sorted.map(w => ({
      ...w,
      _origCycleTime: w.cycleTime,
      _origManpower: w.manpower,
      _origName: w.name,
      _dirty: false,
    })));
    setSnapName(snapDetail.name);
    setSnapNote(snapDetail.note ?? "");
    setTaktTimeInput(snapDetail.taktTime ? String(snapDetail.taktTime) : "");
    setIsDirty(false);
    toast.info("已還原至原始數據");
  }, [snapDetail]);

  // ─── 儲存 ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedSnapId) return;
    const taktTime = taktTimeInput ? parseFloat(taktTimeInput) : null;
    updateMutation.mutate({
      id: selectedSnapId,
      name: snapName,
      note: snapNote || null,
      taktTime: taktTime && !isNaN(taktTime) ? taktTime : null,
      workstationsData: editRows.map(r => ({
        id: r.id,
        name: r.name,
        cycleTime: r.cycleTime,
        manpower: r.manpower,
        sequenceOrder: r.sequenceOrder,
        description: r.description,
        actionStepCount: r.actionStepCount,
        totalStepSec: r.totalStepSec,
        valueAddedSec: r.valueAddedSec,
        nonValueAddedSec: r.nonValueAddedSec,
        necessaryWasteSec: r.necessaryWasteSec,
        valueAddedRate: r.valueAddedRate,
      })),
    });
  }, [selectedSnapId, snapName, snapNote, taktTimeInput, editRows, updateMutation]);

  // ─── 即時 KPI ──────────────────────────────────────────────────────────
  const taktNum = taktTimeInput ? parseFloat(taktTimeInput) : null;
  const kpi = calcKpi(editRows, taktNum && !isNaN(taktNum) ? taktNum : null);
  const dirtyCount = editRows.filter(r => r._dirty).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* 頁首 */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <PencilLine className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">數據修整</h1>
            <p className="text-sm text-muted-foreground">選取歷史快照，直接修改工站 CT、人力與名稱，KPI 將自動重算</p>
          </div>
        </div>

        {/* 選取產線 & 快照 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">選取快照</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5 min-w-[200px]">
                <Label className="text-xs text-muted-foreground">產線</Label>
                <Select
                  value={selectedLineId ? String(selectedLineId) : ""}
                  onValueChange={v => {
                    setSelectedLineId(Number(v));
                    setSelectedSnapId(null);
                    setEditRows([]);
                    setIsDirty(false);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="選擇產線..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lines.map(l => (
                      <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedLineId && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ChevronRight className="h-4 w-4" />
                </div>
              )}

              {selectedLineId && (
                <div className="space-y-1.5 min-w-[240px]">
                  <Label className="text-xs text-muted-foreground">快照</Label>
                  <Select
                    value={selectedSnapId ? String(selectedSnapId) : ""}
                    onValueChange={v => {
                      setSelectedSnapId(Number(v));
                      setIsDirty(false);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="選擇快照..." />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshots.length === 0 && (
                        <SelectItem value="__none__" disabled>此產線無快照</SelectItem>
                      )}
                      {snapshots.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {new Date(s.createdAt).toLocaleDateString("zh-TW")}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 快照基本資訊編輯 */}
        {selectedSnapId && snapDetail && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">快照基本資訊</CardTitle>
              <CardDescription className="text-xs">修改快照名稱、備註與 Takt Time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">快照名稱</Label>
                  <Input
                    value={snapName}
                    onChange={e => { setSnapName(e.target.value); setIsDirty(true); }}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Takt Time（秒，留空則不設定）</Label>
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={taktTimeInput}
                    onChange={e => { setTaktTimeInput(e.target.value); setIsDirty(true); }}
                    placeholder="例：60"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">備註</Label>
                  <Textarea
                    value={snapNote}
                    onChange={e => { setSnapNote(e.target.value); setIsDirty(true); }}
                    rows={1}
                    className="resize-none"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 工站數據編輯表格 */}
        {editRows.length > 0 && (
          <>
            {/* 即時 KPI 預覽 */}
            {kpi && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { label: "平衡率", value: `${kpi.balanceRate.toFixed(1)}%`, highlight: kpi.balanceRate >= 85 },
                  { label: "瓶頸 CT", value: `${kpi.maxTime.toFixed(1)}s`, highlight: false },
                  { label: "平均 CT", value: `${kpi.avgTime.toFixed(1)}s`, highlight: false },
                  { label: "總人力", value: `${kpi.totalManpower.toFixed(1)} 人`, highlight: false },
                  { label: "UPPH", value: kpi.upph.toFixed(2), highlight: false },
                  ...(kpi.taktPassRate != null
                    ? [{ label: "Takt 達標率", value: `${kpi.taktPassRate.toFixed(1)}%`, highlight: kpi.taktPassRate >= 80 }]
                    : []),
                ].map(item => (
                  <Card key={item.label} className="py-3 px-4">
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className={`text-lg font-semibold ${item.highlight ? "text-emerald-400" : "text-foreground"}`}>
                      {item.value}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* 操作列 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {dirtyCount > 0 && (
                  <Badge variant="outline" className="text-amber-400 border-amber-400/40 bg-amber-400/10 gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {dirtyCount} 個工站已修改
                  </Badge>
                )}
                {!isDirty && editRows.length > 0 && (
                  <Badge variant="outline" className="text-emerald-400 border-emerald-400/40 bg-emerald-400/10 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    無未儲存變更
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(v => !v)}
                  className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新增工站
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!isDirty || updateMutation.isPending}
                  className="gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  還原
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!isDirty || updateMutation.isPending}
                  className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Save className="h-3.5 w-3.5" />
                  {updateMutation.isPending ? "儲存中..." : "儲存變更"}
                </Button>
              </div>
            </div>

            {/* 新增工站表單 */}
            {showAddForm && (
              <Card className="border-emerald-500/30 bg-emerald-500/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                    <Plus className="h-4 w-4" />新增工站至快照
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="space-y-1.5 flex-1 min-w-[160px]">
                      <Label className="text-xs text-muted-foreground">工站名稱 <span className="text-red-400">*</span></Label>
                      <Input
                        value={newWsName}
                        onChange={e => setNewWsName(e.target.value)}
                        placeholder="例：WS-05"
                        className="h-9"
                        onKeyDown={e => e.key === "Enter" && handleAddWorkstation()}
                      />
                    </div>
                    <div className="space-y-1.5 w-36">
                      <Label className="text-xs text-muted-foreground">週期時間（秒）<span className="text-red-400">*</span></Label>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={newWsCt}
                        onChange={e => setNewWsCt(e.target.value)}
                        placeholder="例：45"
                        className="h-9"
                        onKeyDown={e => e.key === "Enter" && handleAddWorkstation()}
                      />
                    </div>
                    <div className="space-y-1.5 w-28">
                      <Label className="text-xs text-muted-foreground">人力（人）<span className="text-red-400">*</span></Label>
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={newWsManpower}
                        onChange={e => setNewWsManpower(e.target.value)}
                        className="h-9"
                        onKeyDown={e => e.key === "Enter" && handleAddWorkstation()}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleAddWorkstation}
                        className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Plus className="h-3.5 w-3.5" />確認新增
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setShowAddForm(false); setNewWsName(""); setNewWsCt(""); setNewWsManpower("1"); }}
                        className="h-9"
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 提示 */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>直接點擊工站名稱、CT 或人力欄位即可編輯；點擊「新增工站」可在快照中增加工站。修改後按「儲存變更」，系統將自動重算平衡率、UPPH 等所有 KPI。此操作不可逆，建議修改前先記錄原始數據。</span>
            </div>

            {/* 工站表格 */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/60">
                      <TableHead className="w-12 text-xs text-muted-foreground pl-4">順序</TableHead>
                      <TableHead className="text-xs text-muted-foreground">工站名稱</TableHead>
                      <TableHead className="text-xs text-muted-foreground w-36">週期時間（秒）</TableHead>
                      <TableHead className="text-xs text-muted-foreground w-28">人力（人）</TableHead>
                      <TableHead className="text-xs text-muted-foreground w-24">增值率</TableHead>
                      <TableHead className="text-xs text-muted-foreground w-20">狀態</TableHead>
                      <TableHead className="text-xs text-muted-foreground w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editRows.map((row, idx) => {
                      const taktOk = taktNum && !isNaN(taktNum) ? row.cycleTime <= taktNum : null;
                      return (
                        <TableRow
                          key={row.id}
                          className={`border-border/40 ${row._dirty ? "bg-amber-500/5" : ""}`}
                        >
                          <TableCell className="pl-4 text-sm text-muted-foreground">{row.sequenceOrder}</TableCell>
                          <TableCell>
                            <Input
                              value={row.name}
                              onChange={e => updateRow(idx, "name", e.target.value)}
                              className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border px-2"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={row.cycleTime}
                                onChange={e => updateRow(idx, "cycleTime", e.target.value)}
                                className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border px-2 w-24"
                              />
                              {row._dirty && row.cycleTime !== row._origCycleTime && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  原 {row._origCycleTime}s
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={row.manpower}
                              onChange={e => updateRow(idx, "manpower", e.target.value)}
                              className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border px-2 w-20"
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.valueAddedRate != null
                              ? <span className="text-emerald-400">{row.valueAddedRate.toFixed(1)}%</span>
                              : <span className="text-muted-foreground/50">—</span>
                            }
                          </TableCell>
                          <TableCell>
                            {taktOk === true && (
                              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-xs">達標</Badge>
                            )}
                            {taktOk === false && (
                              <Badge variant="outline" className="text-red-400 border-red-400/30 bg-red-400/10 text-xs">超出</Badge>
                            )}
                            {taktOk === null && (
                              <span className="text-muted-foreground/50 text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {row.id < 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
                                onClick={() => handleRemoveRow(idx)}
                                title="移除此新增工站"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* 空狀態 */}
        {selectedSnapId && editRows.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            此快照無工站數據
          </div>
        )}
        {!selectedLineId && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            請先選擇產線與快照以開始修整數據
          </div>
        )}
    </div>
  );
}
