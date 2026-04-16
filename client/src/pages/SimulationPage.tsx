import { useState, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Plus, Copy, Trash2, Play, Save, ChevronDown, ChevronUp,
  Merge, Scissors, BarChart3, Target, Users, Zap, AlertTriangle,
  CheckCircle, XCircle, Download, Loader2, RotateCcw, GitCompare,
  Settings, TrendingUp, TrendingDown, Minus, Edit3, Check, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from "recharts";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────
type SimWorkstation = {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  sequenceOrder: number;
  description?: string;
};

type Scenario = {
  id: number;
  name: string;
  productionLineId: number;
  baseSnapshotId: number | null;
  workstationsData: SimWorkstation[];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// ─── Color Tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  exceed:     "#ef4444",
  bottleneck: "#f97316",
  warning:    "#eab308",
  normal:     "#22d3ee",
  efficient:  "#4ade80",
  taktLine:   "#a78bfa",
  avgLine:    "#64748b",
};

type BarStatus = "exceed" | "bottleneck" | "warning" | "normal" | "efficient";

function getBarStatus(ct: number, maxTime: number, taktTime?: number): BarStatus {
  if (taktTime && ct > taktTime) return "exceed";
  if (ct === maxTime && maxTime > 0) return "bottleneck";
  if (taktTime) {
    const ratio = ct / taktTime;
    if (ratio >= 0.8) return "warning";
    if (ratio <= 0.7) return "efficient";
  } else {
    if (ct / maxTime >= 0.95) return "bottleneck";
    if (ct / maxTime >= 0.8) return "warning";
  }
  return "normal";
}

const STATUS_META: Record<BarStatus, { label: string; color: string }> = {
  exceed:     { label: "超出節拍", color: COLORS.exceed },
  bottleneck: { label: "瓶頸工站", color: COLORS.bottleneck },
  warning:    { label: "接近節拍", color: COLORS.warning },
  normal:     { label: "正常",     color: COLORS.normal },
  efficient:  { label: "高效",     color: COLORS.efficient },
};

// ─── KPI Calculator ───────────────────────────────────────────────────────────
function calcKPI(workstations: SimWorkstation[], taktTime?: number) {
  if (!workstations.length) return null;
  const times = workstations.map(w => w.cycleTime);
  const totalTime = times.reduce((s, t) => s + t, 0);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = totalTime / times.length;
  const bottleneck = workstations.find(w => w.cycleTime === maxTime);
  const balanceRate = (totalTime / (maxTime * workstations.length)) * 100;
  const balanceLoss = 100 - balanceRate;
  const totalManpower = workstations.reduce((s, w) => s + w.manpower, 0);
  const upph = totalManpower > 0 && maxTime > 0 ? 3600 / maxTime / totalManpower : 0;
  const taktStats = taktTime ? {
    passCount: workstations.filter(w => w.cycleTime <= taktTime).length,
    exceedCount: workstations.filter(w => w.cycleTime > taktTime).length,
    passRate: (workstations.filter(w => w.cycleTime <= taktTime).length / workstations.length) * 100,
  } : null;
  const capacity = maxTime > 0 ? 3600 / maxTime : 0;
  return { totalTime, maxTime, minTime, avgTime, bottleneck, balanceRate, balanceLoss, totalManpower, upph, taktStats, capacity };
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function SimTooltip({ active, payload, taktTime }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const meta = STATUS_META[d.status as BarStatus];
  const taktDiff = taktTime ? (d.cycleTime - taktTime).toFixed(1) : null;
  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-2xl text-sm min-w-[160px]">
      <p className="font-semibold text-foreground mb-2 border-b border-border pb-1.5">{d.fullName}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">工序時間</span>
          <span className="font-mono font-bold" style={{ color: meta.color }}>{d.cycleTime.toFixed(1)}s</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">人員</span>
          <span>{d.manpower} 人</span>
        </div>
        {taktTime && taktDiff && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">vs Takt</span>
            <span className={`font-mono font-bold ${parseFloat(taktDiff) > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {parseFloat(taktDiff) > 0 ? "+" : ""}{taktDiff}s
            </span>
          </div>
        )}
        <div className="flex justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">狀態</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────
function DeltaBadge({ a, b, unit = "", higherIsBetter = true }: {
  a: number; b: number; unit?: string; higherIsBetter?: boolean;
}) {
  const delta = b - a;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = Math.abs(delta) < 0.05;
  if (neutral) return <span className="text-muted-foreground text-xs inline-flex items-center gap-0.5"><Minus className="w-3 h-3" />無變化</span>;
  return (
    <span className={`text-xs font-medium inline-flex items-center gap-0.5 ${improved ? "text-emerald-400" : "text-red-400"}`}>
      {improved ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? "+" : ""}{delta.toFixed(1)}{unit}
    </span>
  );
}

// ─── SVG → Canvas 白底 PNG 下載 ───────────────────────────────────────────────
async function downloadChartAsPng(containerRef: React.RefObject<HTMLDivElement | null>, filename: string) {
  if (!containerRef.current) return;
  const svgEl = containerRef.current.querySelector("svg");
  if (!svgEl) { toast.error("找不到圖表"); return; }
  const svgWidth = svgEl.clientWidth || 800;
  const svgHeight = svgEl.clientHeight || 400;
  const scale = 2;
  const svgClone = svgEl.cloneNode(true) as SVGElement;
  svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgClone.setAttribute("width", String(svgWidth));
  svgClone.setAttribute("height", String(svgHeight));
  svgClone.querySelectorAll("foreignObject").forEach(fo => fo.remove());
  const oklchMap: Record<string, string> = {
    "oklch(0.25 0.015 240)": "#2d3748",
    "oklch(0.60 0.01 240)":  "#718096",
  };
  const svgStr = new XMLSerializer()
    .serializeToString(svgClone)
    .replace(/oklch\([^)]+\)/g, (m) => oklchMap[m] ?? "#888888");
  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = svgWidth * scale;
  canvas.height = svgHeight * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast.success("圖表已下載為 PNG");
}

// ─── Balance Chart ────────────────────────────────────────────────────────────
function BalanceChart({
  workstations, taktTime, avgTime, chartRef,
}: {
  workstations: SimWorkstation[];
  taktTime?: number;
  avgTime: number;
  chartRef: React.RefObject<HTMLDivElement | null>;
}) {
  const maxTime = Math.max(...workstations.map(w => w.cycleTime));
  const chartData = workstations
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map(w => {
      const status = getBarStatus(w.cycleTime, maxTime, taktTime);
      return {
        name: w.name.length > 8 ? w.name.substring(0, 8) + "…" : w.name,
        fullName: w.name,
        cycleTime: w.cycleTime,
        manpower: w.manpower,
        status,
        color: COLORS[status],
      };
    });

  const yMax = Math.max(maxTime, taktTime ?? 0) * 1.2;

  return (
    <div ref={containerRef => { if (containerRef) (chartRef as any).current = containerRef; }} className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d3748" />
          <XAxis dataKey="name" tick={{ fill: "#718096", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, yMax]} tick={{ fill: "#718096", fontSize: 11 }} axisLine={false} tickLine={false} unit="s" />
          <Tooltip content={<SimTooltip taktTime={taktTime} />} />
          {taktTime && (
            <ReferenceLine y={taktTime} stroke={COLORS.taktLine} strokeDasharray="6 3" strokeWidth={2}
              label={{ value: `Takt ${taktTime}s`, fill: COLORS.taktLine, fontSize: 11, position: "right" }} />
          )}
          <ReferenceLine y={avgTime} stroke={COLORS.avgLine} strokeDasharray="4 2" strokeWidth={1.5}
            label={{ value: `均 ${avgTime.toFixed(1)}s`, fill: COLORS.avgLine, fontSize: 10, position: "right" }} />
          <Bar dataKey="cycleTime" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Workstation Editor Row ───────────────────────────────────────────────────
function WsRow({
  ws, index, total, onUpdate, onDelete, onMoveUp, onMoveDown,
  onMergeWithNext, onSplit, isSelected, onToggleSelect,
}: {
  ws: SimWorkstation;
  index: number;
  total: number;
  onUpdate: (id: number, field: keyof SimWorkstation, value: string | number) => void;
  onDelete: (id: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onMergeWithNext: (index: number) => void;
  onSplit: (index: number) => void;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (field: string, value: string | number) => {
    setEditingField(field);
    setEditValue(String(value));
  };

  const commitEdit = (field: keyof SimWorkstation) => {
    if (field === "name") {
      if (editValue.trim()) onUpdate(ws.id, field, editValue.trim());
    } else {
      const num = parseFloat(editValue);
      if (!isNaN(num) && num > 0) onUpdate(ws.id, field, num);
    }
    setEditingField(null);
  };

  const cancelEdit = () => setEditingField(null);

  return (
    <tr className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isSelected ? "bg-primary/10" : ""}`}>
      <td className="px-3 py-2 text-center">
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(ws.id)}
          className="rounded border-border cursor-pointer" />
      </td>
      <td className="px-3 py-2 text-muted-foreground text-sm text-center">{index + 1}</td>
      <td className="px-3 py-2">
        {editingField === "name" ? (
          <div className="flex items-center gap-1">
            <Input value={editValue} onChange={e => setEditValue(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitEdit("name"); if (e.key === "Escape") cancelEdit(); }}
              className="h-7 text-sm" autoFocus />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => commitEdit("name")}><Check className="w-3 h-3 text-emerald-400" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}><X className="w-3 h-3 text-red-400" /></Button>
          </div>
        ) : (
          <span className="cursor-pointer hover:text-primary text-sm font-medium"
            onClick={() => startEdit("name", ws.name)}>{ws.name}</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {editingField === "cycleTime" ? (
          <div className="flex items-center gap-1 justify-center">
            <Input value={editValue} onChange={e => setEditValue(e.target.value)} type="number" min="0.1" step="0.1"
              onKeyDown={e => { if (e.key === "Enter") commitEdit("cycleTime"); if (e.key === "Escape") cancelEdit(); }}
              className="h-7 text-sm w-20 text-center" autoFocus />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => commitEdit("cycleTime")}><Check className="w-3 h-3 text-emerald-400" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}><X className="w-3 h-3 text-red-400" /></Button>
          </div>
        ) : (
          <span className="cursor-pointer hover:text-primary font-mono text-sm"
            onClick={() => startEdit("cycleTime", ws.cycleTime)}>{ws.cycleTime.toFixed(1)}s</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        {editingField === "manpower" ? (
          <div className="flex items-center gap-1 justify-center">
            <Input value={editValue} onChange={e => setEditValue(e.target.value)} type="number" min="0.5" step="0.5"
              onKeyDown={e => { if (e.key === "Enter") commitEdit("manpower"); if (e.key === "Escape") cancelEdit(); }}
              className="h-7 text-sm w-16 text-center" autoFocus />
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => commitEdit("manpower")}><Check className="w-3 h-3 text-emerald-400" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEdit}><X className="w-3 h-3 text-red-400" /></Button>
          </div>
        ) : (
          <span className="cursor-pointer hover:text-primary text-sm"
            onClick={() => startEdit("manpower", ws.manpower)}>{ws.manpower} 人</span>
        )}
      </td>
      <td className="px-3 py-2 text-center">
        <div className="flex items-center justify-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0} onClick={() => onMoveUp(index)}>
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === total - 1} onClick={() => onMoveDown(index)}>
            <ChevronDown className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-400" title="拆分工站" onClick={() => onSplit(index)}>
            <Scissors className="w-3 h-3" />
          </Button>
          {index < total - 1 && (
            <Button size="icon" variant="ghost" className="h-6 w-6 text-amber-400" title="與下站合併" onClick={() => onMergeWithNext(index)}>
              <Merge className="w-3 h-3" />
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" onClick={() => onDelete(ws.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SimulationPage() {
  const [, setLocation] = useLocation();

  // ── 產線選擇 ──
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const { data: lines } = trpc.productionLine.list.useQuery();
  const { data: lineDetail } = trpc.productionLine.getById.useQuery(
    { id: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const { data: lineWorkstations } = trpc.workstation.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const { data: lineSnapshots } = trpc.snapshot.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );

  const taktTime = lineDetail?.targetCycleTime ? parseFloat(lineDetail.targetCycleTime.toString()) : undefined;

  // ── 情境管理 ──
  const { data: scenarios, refetch: refetchScenarios } = trpc.simulation.list.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: !!selectedLineId }
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [compareScenarioId, setCompareScenarioId] = useState<number | null>(null);

  // ── 情境工站數據（本地編輯狀態）──
  const [localWorkstations, setLocalWorkstations] = useState<SimWorkstation[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedWsIds, setSelectedWsIds] = useState<Set<number>>(new Set());

  // ── Dialogs ──
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddWsDialog, setShowAddWsDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [splitTargetIndex, setSplitTargetIndex] = useState<number | null>(null);

  // ── 表單狀態 ──
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newScenarioSource, setNewScenarioSource] = useState<"line" | "snapshot">("line");
  const [newScenarioSnapshotId, setNewScenarioSnapshotId] = useState<number | null>(null);
  const [newWsName, setNewWsName] = useState("");
  const [newWsCt, setNewWsCt] = useState("");
  const [newWsManpower, setNewWsManpower] = useState("1");
  const [newWsInsertAfter, setNewWsInsertAfter] = useState<string>("last");
  const [splitRatio, setSplitRatio] = useState("50");
  const [splitName1, setSplitName1] = useState("");
  const [splitName2, setSplitName2] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const chartRef = useRef<HTMLDivElement | null>(null);
  const utils = trpc.useUtils();

  // ── Mutations ──
  const createMutation = trpc.simulation.create.useMutation({
    onSuccess: () => {
      toast.success("情境已建立");
      setShowCreateDialog(false);
      setNewScenarioName("");
      refetchScenarios();
    },
    onError: (e) => toast.error(`建立失敗：${e.message}`),
  });

  const updateMutation = trpc.simulation.update.useMutation({
    onSuccess: () => {
      toast.success("情境已儲存");
      setIsDirty(false);
      refetchScenarios();
    },
    onError: (e) => toast.error(`儲存失敗：${e.message}`),
  });

  const deleteMutation = trpc.simulation.delete.useMutation({
    onSuccess: () => {
      toast.success("情境已刪除");
      setSelectedScenarioId(null);
      setLocalWorkstations([]);
      refetchScenarios();
    },
    onError: (e) => toast.error(`刪除失敗：${e.message}`),
  });

  const duplicateMutation = trpc.simulation.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success("情境已複製");
      refetchScenarios();
      if (data.scenario) {
        setSelectedScenarioId(data.scenario.id);
        setLocalWorkstations((data.scenario.workstationsData as SimWorkstation[]) ?? []);
        setIsDirty(false);
      }
    },
    onError: (e) => toast.error(`複製失敗：${e.message}`),
  });

  const applyMutation = trpc.simulation.applyToLine.useMutation({
    onSuccess: (data) => {
      toast.success(`已套用至產線！更新 ${data.updated} 站、新增 ${data.added} 站、移除 ${data.removed} 站`);
      setShowApplyDialog(false);
      utils.workstation.listByLine.invalidate({ productionLineId: selectedLineId! });
    },
    onError: (e) => toast.error(`套用失敗：${e.message}`),
  });

  // ── 選取情境 ──
  const handleSelectScenario = (scenario: Scenario) => {
    if (isDirty) {
      if (!confirm("有未儲存的變更，確定要切換情境嗎？")) return;
    }
    setSelectedScenarioId(scenario.id);
    setLocalWorkstations(scenario.workstationsData.map(w => ({ ...w })));
    setIsDirty(false);
    setSelectedWsIds(new Set());
  };

  // ── 建立情境 ──
  const handleCreateScenario = () => {
    if (!selectedLineId || !newScenarioName.trim()) return;
    let wsData: SimWorkstation[] = [];
    if (newScenarioSource === "line" && lineWorkstations) {
      wsData = lineWorkstations.map(w => ({
        id: w.id,
        name: w.name,
        cycleTime: parseFloat(w.cycleTime.toString()),
        manpower: parseFloat(w.manpower.toString()),
        sequenceOrder: w.sequenceOrder,
        description: w.description ?? undefined,
      }));
    } else if (newScenarioSource === "snapshot" && newScenarioSnapshotId && lineSnapshots) {
      const snap = lineSnapshots.find(s => s.id === newScenarioSnapshotId);
      if (snap && snap.workstationsData) {
        wsData = (snap.workstationsData as SimWorkstation[]).map((w, i) => ({
          id: w.id ?? -(i + 1),
          name: w.name,
          cycleTime: w.cycleTime,
          manpower: w.manpower,
          sequenceOrder: w.sequenceOrder ?? i,
          description: w.description,
        }));
      }
    }
    createMutation.mutate({
      productionLineId: selectedLineId,
      name: newScenarioName.trim(),
      baseSnapshotId: newScenarioSource === "snapshot" ? (newScenarioSnapshotId ?? undefined) : undefined,
      workstationsData: wsData,
    });
  };

  // ── 工站操作 ──
  const updateWs = (id: number, field: keyof SimWorkstation, value: string | number) => {
    setLocalWorkstations(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    setIsDirty(true);
  };

  const deleteWs = (id: number) => {
    setLocalWorkstations(prev => {
      const filtered = prev.filter(w => w.id !== id);
      return filtered.map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true);
  };

  const moveWs = (index: number, direction: "up" | "down") => {
    setLocalWorkstations(prev => {
      const arr = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= arr.length) return prev;
      [arr[index], arr[targetIndex]] = [arr[targetIndex], arr[index]];
      return arr.map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true);
  };

  const mergeWithNext = (index: number) => {
    setLocalWorkstations(prev => {
      if (index >= prev.length - 1) return prev;
      const a = prev[index];
      const b = prev[index + 1];
      const merged: SimWorkstation = {
        id: a.id,
        name: `${a.name}+${b.name}`,
        cycleTime: parseFloat((a.cycleTime + b.cycleTime).toFixed(2)),
        manpower: parseFloat((a.manpower + b.manpower).toFixed(1)),
        sequenceOrder: index,
        description: [a.description, b.description].filter(Boolean).join("; ") || undefined,
      };
      const newArr = [...prev.slice(0, index), merged, ...prev.slice(index + 2)];
      return newArr.map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true);
  };

  const openSplit = (index: number) => {
    const ws = localWorkstations[index];
    setSplitTargetIndex(index);
    setSplitRatio("50");
    setSplitName1(`${ws.name}-A`);
    setSplitName2(`${ws.name}-B`);
    setShowSplitDialog(true);
  };

  const confirmSplit = () => {
    if (splitTargetIndex === null) return;
    const ws = localWorkstations[splitTargetIndex];
    const ratio = parseFloat(splitRatio) / 100;
    if (isNaN(ratio) || ratio <= 0 || ratio >= 1) {
      toast.error("比例必須在 1~99 之間");
      return;
    }
    const ct1 = parseFloat((ws.cycleTime * ratio).toFixed(2));
    const ct2 = parseFloat((ws.cycleTime * (1 - ratio)).toFixed(2));
    const mp1 = Math.max(0.5, parseFloat((ws.manpower * ratio).toFixed(1)));
    const mp2 = Math.max(0.5, parseFloat((ws.manpower * (1 - ratio)).toFixed(1)));
    const ws1: SimWorkstation = { id: ws.id, name: splitName1 || `${ws.name}-A`, cycleTime: ct1, manpower: mp1, sequenceOrder: splitTargetIndex };
    const ws2: SimWorkstation = { id: -(Date.now()), name: splitName2 || `${ws.name}-B`, cycleTime: ct2, manpower: mp2, sequenceOrder: splitTargetIndex + 1 };
    setLocalWorkstations(prev => {
      const newArr = [...prev.slice(0, splitTargetIndex), ws1, ws2, ...prev.slice(splitTargetIndex + 1)];
      return newArr.map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true);
    setShowSplitDialog(false);
  };

  const addNewWorkstation = () => {
    const ct = parseFloat(newWsCt);
    const mp = parseFloat(newWsManpower);
    if (!newWsName.trim() || isNaN(ct) || ct <= 0 || isNaN(mp) || mp < 0.5) {
      toast.error("請填寫正確的工站名稱、工序時間（>0）和人力（≥0.5）");
      return;
    }
    const newWs: SimWorkstation = {
      id: -(Date.now()),
      name: newWsName.trim(),
      cycleTime: ct,
      manpower: mp,
      sequenceOrder: 0,
    };
    setLocalWorkstations(prev => {
      let newArr: SimWorkstation[];
      if (newWsInsertAfter === "last") {
        newArr = [...prev, newWs];
      } else {
        const insertAfterIdx = parseInt(newWsInsertAfter);
        newArr = [
          ...prev.slice(0, insertAfterIdx + 1),
          newWs,
          ...prev.slice(insertAfterIdx + 1),
        ];
      }
      return newArr.map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true);
    setNewWsName("");
    setNewWsCt("");
    setNewWsManpower("1");
    setNewWsInsertAfter("last");
    setShowAddWsDialog(false);
  };

  const handleSaveScenario = () => {
    if (!selectedScenarioId) return;
    updateMutation.mutate({
      id: selectedScenarioId,
      workstationsData: localWorkstations,
    });
  };

  // ── KPI ──
  const kpi = useMemo(() => calcKPI(localWorkstations, taktTime), [localWorkstations, taktTime]);
  const selectedScenario = scenarios?.find(s => s.id === selectedScenarioId);

  const handleDownloadChart = useCallback(async () => {
    setIsDownloading(true);
    try {
      await downloadChartAsPng(chartRef, `配置模擬_${selectedScenario?.name ?? "情境"}_${new Date().toLocaleDateString("zh-TW").replace(/\//g, "-")}.png`);
    } finally {
      setIsDownloading(false);
    }
  }, [selectedScenario]);
  const compareScenario = scenarios?.find(s => s.id === compareScenarioId);
  const compareKpi = useMemo(
    () => compareScenario ? calcKPI(compareScenario.workstationsData, taktTime) : null,
    [compareScenario, taktTime]
  );

  // ── 套用至產線的變更清單 ──
  const applyChanges = useMemo(() => {
    if (!localWorkstations.length || !lineWorkstations) return [];
    const changes: Array<{ type: string; name: string; detail: string }> = [];
    for (const simWs of localWorkstations) {
      if (simWs.id > 0) {
        const existing = lineWorkstations.find(w => w.id === simWs.id);
        if (existing) {
          const diffs: string[] = [];
          if (Math.abs(parseFloat(existing.cycleTime.toString()) - simWs.cycleTime) > 0.01) diffs.push(`CT: ${parseFloat(existing.cycleTime.toString()).toFixed(1)}→${simWs.cycleTime.toFixed(1)}s`);
          if (Math.abs(parseFloat(existing.manpower.toString()) - simWs.manpower) > 0.01) diffs.push(`人力: ${parseFloat(existing.manpower.toString())}→${simWs.manpower}人`);
          if (existing.name !== simWs.name) diffs.push(`名稱: ${existing.name}→${simWs.name}`);
          if (existing.sequenceOrder !== simWs.sequenceOrder) diffs.push(`順序: ${existing.sequenceOrder + 1}→${simWs.sequenceOrder + 1}`);
          if (diffs.length > 0) changes.push({ type: "update", name: simWs.name, detail: diffs.join("、") });
        } else {
          changes.push({ type: "add", name: simWs.name, detail: `CT: ${simWs.cycleTime}s，人力: ${simWs.manpower}人` });
        }
      } else {
        changes.push({ type: "add", name: simWs.name, detail: `CT: ${simWs.cycleTime}s，人力: ${simWs.manpower}人` });
      }
    }
    const simIds = new Set(localWorkstations.filter(w => w.id > 0).map(w => w.id));
    for (const ew of lineWorkstations) {
      if (!simIds.has(ew.id)) {
        changes.push({ type: "remove", name: ew.name, detail: "從產線移除" });
      }
    }
    return changes;
  }, [localWorkstations, lineWorkstations]);

  // ── 情境比較圖數據 ──
  const compareChartData = useMemo(() => {
    if (!compareScenario || !localWorkstations.length) return [];
    const simMap = new Map(localWorkstations.map(w => [w.name, w.cycleTime]));
    const cmpMap = new Map(compareScenario.workstationsData.map(w => [w.name, w.cycleTime]));
    const allNames = Array.from(new Set([...Array.from(simMap.keys()), ...Array.from(cmpMap.keys())]));
    return allNames.map(name => {
      const simCt = simMap.get(name) ?? 0;
      const cmpCt = cmpMap.get(name) ?? 0;
      const delta = simCt - cmpCt;
      return {
        name: name.length > 8 ? name.substring(0, 8) + "…" : name,
        fullName: name,
        current: simCt,
        compare: cmpCt,
        delta,
        improved: delta < 0,
      };
    });
  }, [localWorkstations, compareScenario]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/lines")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              生產線配置模擬
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">建立情境、調整工站配置、比較方案效益</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* 產線選擇 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">選擇產線</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedLineId?.toString() ?? ""} onValueChange={v => {
              setSelectedLineId(parseInt(v));
              setSelectedScenarioId(null);
              setLocalWorkstations([]);
              setIsDirty(false);
            }}>
              <SelectTrigger className="w-80">
                <SelectValue placeholder="請選擇產線..." />
              </SelectTrigger>
              <SelectContent>
                {lines?.map(line => (
                  <SelectItem key={line.id} value={line.id.toString()}>{line.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lineDetail && (
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                <span>工站數：<strong className="text-foreground">{lineWorkstations?.length ?? 0}</strong></span>
                {taktTime && <span>Takt Time：<strong className="text-violet-400">{taktTime}s</strong></span>}
                {lineDetail.description && <span>{lineDetail.description}</span>}
              </div>
            )}
          </CardContent>
        </Card>

        {selectedLineId && (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* 左側：情境列表 */}
            <div className="xl:col-span-1 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">情境管理</CardTitle>
                    <Button size="sm" onClick={() => setShowCreateDialog(true)} className="h-7 gap-1">
                      <Plus className="w-3.5 h-3.5" />新建
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!scenarios?.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">尚無情境，點擊「新建」開始</p>
                  )}
                  {scenarios?.map(scenario => (
                    <div key={scenario.id}
                      className={`rounded-lg border p-3 cursor-pointer transition-all ${selectedScenarioId === scenario.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
                      onClick={() => handleSelectScenario(scenario as Scenario)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{scenario.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(scenario.workstationsData as SimWorkstation[]).length} 工站
                          </p>
                        </div>
                        <div className="flex gap-0.5 shrink-0">
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="複製"
                            onClick={e => { e.stopPropagation(); duplicateMutation.mutate({ id: scenario.id, newName: `${scenario.name} (複製)` }); }}>
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400" title="刪除"
                            onClick={e => { e.stopPropagation(); if (confirm(`確定刪除「${scenario.name}」？`)) deleteMutation.mutate({ id: scenario.id }); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* 右側：編輯區 */}
            <div className="xl:col-span-3 space-y-4">
              {!selectedScenarioId ? (
                <Card>
                  <CardContent className="py-16 text-center text-muted-foreground">
                    <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>請從左側選取或建立情境</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* KPI 儀表板 */}
                  {kpi && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {[
                        { label: "平衡率", value: `${kpi.balanceRate.toFixed(1)}%`, color: kpi.balanceRate >= 85 ? "text-emerald-400" : kpi.balanceRate >= 70 ? "text-amber-400" : "text-red-400", icon: BarChart3 },
                        { label: "瓶頸工站", value: kpi.bottleneck?.name ?? "—", sub: kpi.bottleneck ? `${kpi.bottleneck.cycleTime.toFixed(1)}s` : "", color: "text-orange-400", icon: AlertTriangle },
                        { label: "UPPH", value: kpi.upph.toFixed(2), sub: "件/人/時", color: "text-amber-400", icon: Zap },
                        { label: "Takt 達標率", value: kpi.taktStats ? `${kpi.taktStats.passRate.toFixed(0)}%` : "—", sub: kpi.taktStats ? `${kpi.taktStats.passCount}/${localWorkstations.length}` : "未設定", color: kpi.taktStats ? (kpi.taktStats.passRate >= 80 ? "text-emerald-400" : "text-red-400") : "text-muted-foreground", icon: Target },
                        { label: "總人力", value: `${kpi.totalManpower.toFixed(1)} 人`, color: "text-blue-400", icon: Users },
                        { label: "預估產能", value: `${kpi.capacity.toFixed(1)}`, sub: "件/時", color: "text-cyan-400", icon: TrendingUp },
                      ].map(({ label, value, sub, color, icon: Icon }) => (
                        <Card key={label} className="bg-card/60">
                          <CardContent className="p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className={`w-3.5 h-3.5 ${color}`} />
                              <span className="text-xs text-muted-foreground">{label}</span>
                            </div>
                            <p className={`text-lg font-bold ${color} leading-none`}>{value}</p>
                            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* 工站編輯器 */}
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">工站配置編輯器</CardTitle>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setShowAddWsDialog(true)}>
                            <Plus className="w-3.5 h-3.5" />新增工站
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setShowCompareDialog(true)}>
                            <GitCompare className="w-3.5 h-3.5" />比較情境
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-amber-400 border-amber-400/40 hover:bg-amber-400/10"
                            onClick={() => setShowApplyDialog(true)}>
                            <Play className="w-3.5 h-3.5" />套用至產線
                          </Button>
                          {isDirty && (
                            <Button size="sm" className="h-7 gap-1" onClick={handleSaveScenario} disabled={updateMutation.isPending}>
                              {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              儲存情境
                            </Button>
                          )}
                        </div>
                      </div>
                      {isDirty && (
                        <p className="text-xs text-amber-400 mt-1">⚠ 有未儲存的變更</p>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="px-3 py-2 text-center w-8"></th>
                              <th className="px-3 py-2 text-center text-muted-foreground font-medium w-10">#</th>
                              <th className="px-3 py-2 text-left text-muted-foreground font-medium">工站名稱</th>
                              <th className="px-3 py-2 text-center text-muted-foreground font-medium">工序時間</th>
                              <th className="px-3 py-2 text-center text-muted-foreground font-medium">人力</th>
                              <th className="px-3 py-2 text-center text-muted-foreground font-medium w-40">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {localWorkstations
                              .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                              .map((ws, index) => (
                                <WsRow
                                  key={ws.id}
                                  ws={ws}
                                  index={index}
                                  total={localWorkstations.length}
                                  onUpdate={updateWs}
                                  onDelete={deleteWs}
                                  onMoveUp={(i) => moveWs(i, "up")}
                                  onMoveDown={(i) => moveWs(i, "down")}
                                  onMergeWithNext={mergeWithNext}
                                  onSplit={openSplit}
                                  isSelected={selectedWsIds.has(ws.id)}
                                  onToggleSelect={(id) => setSelectedWsIds(prev => {
                                    const next = new Set(prev);
                                    next.has(id) ? next.delete(id) : next.add(id);
                                    return next;
                                  })}
                                />
                              ))}
                          </tbody>
                        </table>
                        {!localWorkstations.length && (
                          <p className="text-center text-muted-foreground py-8">此情境尚無工站，點擊「新增工站」開始</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* 平衡圖 */}
                  {kpi && localWorkstations.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-primary" />
                            工序時間平衡圖
                          </CardTitle>
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={handleDownloadChart} disabled={isDownloading}>
                            {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            下載 PNG
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <BalanceChart
                          workstations={localWorkstations}
                          taktTime={taktTime}
                          avgTime={kpi.avgTime}
                          chartRef={chartRef}
                        />
                        {/* 圖例 */}
                        <div className="flex flex-wrap gap-3 mt-3 justify-center">
                          {taktTime ? (
                            Object.entries(STATUS_META).map(([key, meta]) => (
                              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <div className="w-3 h-3 rounded-sm" style={{ background: meta.color }} />
                                {meta.label}
                              </div>
                            ))
                          ) : (
                            ["bottleneck", "warning", "normal"].map(key => (
                              <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <div className="w-3 h-3 rounded-sm" style={{ background: COLORS[key as BarStatus] }} />
                                {STATUS_META[key as BarStatus].label}
                              </div>
                            ))
                          )}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: COLORS.avgLine }} />
                            平均線
                          </div>
                          {taktTime && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: COLORS.taktLine }} />
                              Takt Time
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Dialog: 建立情境 ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>建立新情境</DialogTitle>
            <DialogDescription>選擇基準數據來源，建立模擬情境</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>情境名稱</Label>
              <Input value={newScenarioName} onChange={e => setNewScenarioName(e.target.value)}
                placeholder="例：優化方案 A" className="mt-1" />
            </div>
            <div>
              <Label>基準數據來源</Label>
              <Select value={newScenarioSource} onValueChange={v => setNewScenarioSource(v as "line" | "snapshot")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">從目前產線工站載入</SelectItem>
                  <SelectItem value="snapshot">從歷史快照載入</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newScenarioSource === "snapshot" && (
              <div>
                <Label>選擇快照</Label>
                <Select value={newScenarioSnapshotId?.toString() ?? ""} onValueChange={v => setNewScenarioSnapshotId(parseInt(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="選擇快照..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lineSnapshots?.map(snap => (
                      <SelectItem key={snap.id} value={snap.id.toString()}>
                        {snap.name} ({new Date(snap.createdAt).toLocaleDateString("zh-TW")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreateScenario} disabled={!newScenarioName.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 新增工站 ── */}
      <Dialog open={showAddWsDialog} onOpenChange={setShowAddWsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新增工站</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>工站名稱</Label>
              <Input value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="例：ST-01" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>工序時間（秒）</Label>
                <Input value={newWsCt} onChange={e => setNewWsCt(e.target.value)} type="number" min="0.1" step="0.1" placeholder="0.0" className="mt-1" />
              </div>
              <div>
                <Label>人力（人）</Label>
                <Input value={newWsManpower} onChange={e => setNewWsManpower(e.target.value)} type="number" min="0.5" step="0.5" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>插入位置</Label>
              <Select value={newWsInsertAfter} onValueChange={setNewWsInsertAfter}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last">加在最後</SelectItem>
                  {localWorkstations
                    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                    .map((ws, i) => (
                      <SelectItem key={ws.id} value={i.toString()}>加在「{ws.name}」之後</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWsDialog(false)}>取消</Button>
            <Button onClick={addNewWorkstation}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 拆分工站 ── */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>拆分工站</DialogTitle>
            <DialogDescription>
              {splitTargetIndex !== null && localWorkstations[splitTargetIndex]
                ? `將「${localWorkstations.sort((a, b) => a.sequenceOrder - b.sequenceOrder)[splitTargetIndex]?.name}」拆分為兩個工站`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>拆分比例（第一站佔 %）</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={splitRatio} onChange={e => setSplitRatio(e.target.value)} type="number" min="1" max="99" step="1" className="w-24" />
                <span className="text-muted-foreground text-sm">: {100 - parseFloat(splitRatio || "50")}%</span>
              </div>
              {splitTargetIndex !== null && localWorkstations.length > splitTargetIndex && (() => {
                const sorted = [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
                const ws = sorted[splitTargetIndex];
                if (!ws) return null;
                const ratio = parseFloat(splitRatio) / 100;
                const ct1 = (ws.cycleTime * ratio).toFixed(2);
                const ct2 = (ws.cycleTime * (1 - ratio)).toFixed(2);
                return (
                  <p className="text-xs text-muted-foreground mt-1">
                    CT：{ct1}s / {ct2}s（原 {ws.cycleTime}s）
                  </p>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>第一站名稱</Label>
                <Input value={splitName1} onChange={e => setSplitName1(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>第二站名稱</Label>
                <Input value={splitName2} onChange={e => setSplitName2(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitDialog(false)}>取消</Button>
            <Button onClick={confirmSplit}>確認拆分</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 套用至產線 ── */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-amber-400" />
              套用至產線
            </DialogTitle>
            <DialogDescription>
              以下變更將寫入實際工站資料，此操作不可撤銷。請確認後繼續。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-2">
            {applyChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">無任何變更</p>
            ) : (
              applyChanges.map((change, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  change.type === "add" ? "bg-emerald-500/10 border border-emerald-500/20" :
                  change.type === "remove" ? "bg-red-500/10 border border-red-500/20" :
                  "bg-blue-500/10 border border-blue-500/20"
                }`}>
                  {change.type === "add" ? <Plus className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> :
                   change.type === "remove" ? <Trash2 className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> :
                   <Edit3 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />}
                  <div>
                    <span className="font-medium">{change.name}</span>
                    <span className="text-muted-foreground ml-2">{change.detail}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>取消</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => selectedScenarioId && applyMutation.mutate({ scenarioId: selectedScenarioId })}
              disabled={applyMutation.isPending || applyChanges.length === 0}>
              {applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              確認套用 ({applyChanges.length} 項變更)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 情境比較 ── */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent style={{ width: "900px", maxWidth: "96vw" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-primary" />
              情境比較
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">目前情境</Label>
                <p className="font-medium">{selectedScenario?.name ?? "—"}</p>
              </div>
              <div className="text-muted-foreground">vs</div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">比較情境</Label>
                <Select value={compareScenarioId?.toString() ?? ""} onValueChange={v => setCompareScenarioId(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇比較情境..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios?.filter(s => s.id !== selectedScenarioId).map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {compareScenario && kpi && compareKpi && (
              <>
                {/* KPI 比較 */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "平衡率", a: compareKpi.balanceRate, b: kpi.balanceRate, unit: "%", higher: true },
                    { label: "瓶頸 CT", a: compareKpi.maxTime, b: kpi.maxTime, unit: "s", higher: false },
                    { label: "UPPH", a: compareKpi.upph, b: kpi.upph, unit: "", higher: true },
                    { label: "總人力", a: compareKpi.totalManpower, b: kpi.totalManpower, unit: "人", higher: false },
                  ].map(({ label, a, b, unit, higher }) => (
                    <Card key={label} className="bg-card/60">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold">{b.toFixed(1)}{unit}</span>
                          <DeltaBadge a={a} b={b} unit={unit} higherIsBetter={higher} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">比較：{a.toFixed(1)}{unit}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* 並排圖 */}
                {compareChartData.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">工序時間對比</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={compareChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2d3748" />
                          <XAxis dataKey="name" tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "#718096", fontSize: 10 }} axisLine={false} tickLine={false} unit="s" />
                          <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(1)}s`, name === "current" ? selectedScenario?.name : compareScenario?.name]} />
                          {taktTime && (
                            <ReferenceLine y={taktTime} stroke={COLORS.taktLine} strokeDasharray="6 3" strokeWidth={2}
                              label={{ value: `Takt ${taktTime}s`, fill: COLORS.taktLine, fontSize: 10, position: "right" }} />
                          )}
                          <Bar dataKey="current" name="current" radius={[3, 3, 0, 0]}>
                            {compareChartData.map((entry, index) => (
                              <Cell key={`cur-${index}`} fill={entry.improved ? "#22d3ee" : entry.delta > 0 ? "#f97316" : "#22d3ee"} />
                            ))}
                          </Bar>
                          <Bar dataKey="compare" name="compare" fill="#a78bfa" opacity={0.6} radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex gap-4 justify-center mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-cyan-400" />{selectedScenario?.name}（目前）</div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-violet-400 opacity-60" />{compareScenario?.name}（比較）</div>
                      <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400" />CT 增加（惡化）</div>
                    </div>
                  </div>
                )}
              </>
            )}
            {!compareScenarioId && (
              <p className="text-sm text-muted-foreground text-center py-4">請選擇比較情境</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
