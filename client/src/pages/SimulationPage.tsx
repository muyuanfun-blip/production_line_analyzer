import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Plus, Copy, Trash2, Play, Save, ChevronLeft, ChevronRight,
  Merge, Scissors, BarChart3, Users,
  CheckCircle, Download, Loader2,
  Settings, TrendingUp, TrendingDown, Minus,
  GripVertical, ArrowRight, PanelLeft, PanelRight, Layers, GitCompare, AlertTriangle,
  Pencil, Check, X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
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

const STATUS_META: Record<BarStatus, { label: string; color: string; bg: string }> = {
  exceed:     { label: "超出節拍", color: COLORS.exceed,     bg: "bg-red-500/15 border-red-500/40" },
  bottleneck: { label: "瓶頸工站", color: COLORS.bottleneck, bg: "bg-orange-500/15 border-orange-500/40" },
  warning:    { label: "接近節拍", color: COLORS.warning,    bg: "bg-yellow-500/15 border-yellow-500/40" },
  normal:     { label: "正常",     color: COLORS.normal,     bg: "bg-cyan-500/10 border-cyan-500/30" },
  efficient:  { label: "高效",     color: COLORS.efficient,  bg: "bg-emerald-500/10 border-emerald-500/30" },
};

// ─── KPI Calculator ───────────────────────────────────────────────────────────
function calcKPI(workstations: SimWorkstation[], taktTime?: number) {
  if (!workstations.length) return null;
  const times = workstations.map(w => w.cycleTime);
  const totalTime = times.reduce((s, t) => s + t, 0);
  const maxTime = Math.max(...times);
  const avgTime = totalTime / times.length;
  const balanceRate = (totalTime / (maxTime * times.length)) * 100;
  const balanceLoss = 100 - balanceRate;
  const totalManpower = workstations.reduce((s, w) => s + w.manpower, 0);
  const upph = totalManpower > 0 && maxTime > 0 ? 3600 / maxTime / totalManpower : 0;
  const taktStats = taktTime ? {
    passRate: (workstations.filter(w => w.cycleTime <= taktTime).length / workstations.length) * 100,
  } : null;
  const capacity = maxTime > 0 ? 3600 / maxTime : 0;
  return { totalTime, maxTime, avgTime, balanceRate, balanceLoss, totalManpower, upph, taktStats, capacity };
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

// ─── Workstation Card ─────────────────────────────────────────────────────────
// ─── Context Menu ─────────────────────────────────────────────────────────────
function WsContextMenu({ x, y, onClose, onMoveLeft, onMoveRight, onMerge, onSplit, onDelete, canMoveLeft, canMoveRight, canMerge }: {
  x: number; y: number; onClose: () => void;
  onMoveLeft: () => void; onMoveRight: () => void;
  onMerge: () => void; onSplit: () => void; onDelete: () => void;
  canMoveLeft: boolean; canMoveRight: boolean; canMerge: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  const item = (label: string, icon: React.ReactNode, action: () => void, disabled = false, danger = false) => (
    <button key={label} disabled={disabled} onClick={() => { action(); onClose(); }}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors text-left
        ${disabled ? "opacity-30 cursor-not-allowed" : danger ? "hover:bg-red-500/20 text-red-400" : "hover:bg-accent text-foreground"}`}>
      {icon}{label}
    </button>
  );
  return (
    <div ref={ref} className="fixed z-[200] bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[140px]"
      style={{ left: x, top: y }}>
      {item("前移", <ChevronLeft className="w-3.5 h-3.5" />, onMoveLeft, !canMoveLeft)}
      {item("後移", <ChevronRight className="w-3.5 h-3.5" />, onMoveRight, !canMoveRight)}
      <div className="my-1 border-t border-border" />
      {item("合併下站", <Merge className="w-3.5 h-3.5 text-amber-400" />, onMerge, !canMerge)}
      {item("拆分工站", <Scissors className="w-3.5 h-3.5 text-cyan-400" />, onSplit)}
      <div className="my-1 border-t border-border" />
      {item("刪除工站", <Trash2 className="w-3.5 h-3.5" />, onDelete, false, true)}
    </div>
  );
}
// ─── Workstation Card ─────────────────────────────────────────────────────────
function WsCard({
  ws, index, total, maxTime, taktTime, isSelected, isDragging, diffType,
  onSelect, onDragStart, onDragOver, onDrop,
  onMoveLeft, onMoveRight, onMerge, onSplit, onDelete, onUpdate,
  onInsertAfter,
}: {
  ws: SimWorkstation; index: number; total: number;
  maxTime: number; taktTime?: number;
  isSelected: boolean; isDragging: boolean;
  diffType?: "add" | "update" | null;
  onSelect: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onMoveLeft: () => void; onMoveRight: () => void;
  onMerge: () => void; onSplit: () => void; onDelete: () => void;
  onUpdate: (field: string, value: string | number) => void;
  onInsertAfter: () => void;
}) {
  const status = getBarStatus(ws.cycleTime, maxTime, taktTime);
  const meta = STATUS_META[status];
  const fillPct = maxTime > 0 ? Math.min((ws.cycleTime / maxTime) * 100, 100) : 0;
  const taktPct = taktTime && maxTime > 0 ? Math.min((taktTime / maxTime) * 100, 100) : null;
  const [editingField, setEditingField] = useState<"name" | "ct" | null>(null);
  const [editVal, setEditVal] = useState("");
  const editRef = useRef<HTMLInputElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const startEdit = (field: "name" | "ct", e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingField(field);
    setEditVal(field === "name" ? ws.name : ws.cycleTime.toString());
    setTimeout(() => editRef.current?.select(), 30);
  };
  const commitEdit = () => {
    if (editingField === "name" && editVal.trim()) onUpdate("name", editVal.trim());
    if (editingField === "ct") { const v = parseFloat(editVal); if (!isNaN(v) && v > 0) onUpdate("cycleTime", v); }
    setEditingField(null);
  };
  const cancelEdit = () => setEditingField(null);

  const diffBadge = diffType === "add"
    ? <span className="absolute -top-2 -right-2 z-20 text-[9px] font-bold px-1 py-0.5 rounded-full bg-emerald-500 text-white">NEW</span>
    : diffType === "update"
    ? <span className="absolute -top-2 -right-2 z-20 text-[9px] font-bold px-1 py-0.5 rounded-full bg-amber-500 text-white">MOD</span>
    : null;

  return (
    <div className="flex items-center shrink-0 group">
      <div
        draggable
        onDragStart={e => onDragStart(e, index)}
        onDragOver={e => onDragOver(e, index)}
        onDrop={e => onDrop(e, index)}
        onClick={onSelect}
        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
        className={`relative w-[148px] rounded-xl border-2 cursor-pointer transition-all select-none
          ${isSelected ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" : "border hover:border-primary/60 hover:shadow-md"}
          ${isDragging ? "opacity-40 scale-95" : ""}`}
        style={{ borderColor: isSelected ? undefined : meta.color + "60" }}
      >
        {diffBadge}
        <div className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground z-10">
          {index + 1}
        </div>
        <div className="absolute top-1.5 right-1.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="p-3 pt-3.5 space-y-2">
          {editingField === "name" ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                className="w-full text-xs font-semibold bg-background border border-primary rounded px-1 py-0.5 outline-none" />
              <button onClick={commitEdit} className="text-emerald-400 shrink-0"><Check className="w-3 h-3" /></button>
              <button onClick={cancelEdit} className="text-muted-foreground shrink-0"><XIcon className="w-3 h-3" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group/name">
              <p className="text-xs font-semibold text-foreground truncate flex-1" title={ws.name}>{ws.name}</p>
              <button onDoubleClick={e => startEdit("name", e)} onClick={e => e.stopPropagation()}
                className="opacity-0 group-hover/name:opacity-60 hover:!opacity-100 text-muted-foreground shrink-0">
                <Pencil className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
          {editingField === "ct" ? (
            <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
              <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)} type="number" min="0.1" step="0.1"
                onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                className="w-16 text-center text-xl font-bold font-mono bg-background border border-primary rounded px-1 py-0.5 outline-none" style={{ color: meta.color }} />
              <div className="flex flex-col gap-0.5">
                <button onClick={commitEdit} className="text-emerald-400"><Check className="w-3 h-3" /></button>
                <button onClick={cancelEdit} className="text-muted-foreground"><XIcon className="w-3 h-3" /></button>
              </div>
            </div>
          ) : (
            <div className="text-center group/ct" onDoubleClick={e => startEdit("ct", e)}>
              <span className="text-2xl font-bold font-mono" style={{ color: meta.color }}>{ws.cycleTime.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground ml-1">s</span>
            </div>
          )}
          <div className="relative h-2 bg-muted/50 rounded-full overflow-visible">
            <div className="h-full rounded-full transition-all" style={{ width: `${fillPct}%`, background: meta.color }} />
            {taktPct !== null && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-violet-400/80 rounded-full" style={{ left: `${taktPct}%` }} />
            )}
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" />{ws.manpower}人</span>
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium"
              style={{ background: meta.color + "20", color: meta.color }}>{meta.label}</span>
          </div>
        </div>
      </div>
      {ctxMenu && (
        <WsContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          onMoveLeft={onMoveLeft} onMoveRight={onMoveRight}
          onMerge={onMerge} onSplit={onSplit} onDelete={onDelete}
          canMoveLeft={index > 0} canMoveRight={index < total - 1} canMerge={index < total - 1} />
      )}
      {index < total - 1 ? (
        <div className="flex items-center mx-1 shrink-0 relative group/arrow">
          <div className="w-4 h-0.5 bg-border" />
          <button onClick={e => { e.stopPropagation(); onInsertAfter(); }}
            className="opacity-0 group-hover/arrow:opacity-100 absolute left-1/2 -translate-x-1/2 -translate-y-1/2 top-1/2 z-10
              w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md transition-opacity">
            <Plus className="w-3 h-3" />
          </button>
          <ArrowRight className="w-3 h-3 text-muted-foreground -ml-1" />
          <div className="w-4 h-0.5 bg-border" />
        </div>
      ) : null}
    </div>
  );
}
// ─── Balance Mini Chart ───────────────────────────────────────────────────────
function BalanceMiniChart({ workstations, taktTime, avgTime, chartRef }: {
  workstations: SimWorkstation[]; taktTime?: number; avgTime: number;
  chartRef: React.RefObject<HTMLDivElement | null>;
}) {
  const maxTime = Math.max(...workstations.map(w => w.cycleTime));
  const data = [...workstations]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map(ws => ({
      name: ws.name.length > 6 ? ws.name.substring(0, 6) + "…" : ws.name,
      cycleTime: ws.cycleTime,
      status: getBarStatus(ws.cycleTime, maxTime, taktTime),
    }));
  return (
    <div ref={chartRef} className="w-full h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} angle={-30} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 9, fill: "#64748b" }} />
          {taktTime && <ReferenceLine y={taktTime} stroke={COLORS.taktLine} strokeDasharray="4 2" strokeWidth={1.5} />}
          <ReferenceLine y={avgTime} stroke={COLORS.avgLine} strokeDasharray="3 3" strokeWidth={1} />
          <Bar dataKey="cycleTime" radius={[3, 3, 0, 0]} maxBarSize={32}>
            {data.map((entry, i) => <Cell key={i} fill={COLORS[entry.status as BarStatus]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SimulationPage() {
  const [, setLocation] = useLocation();

  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const { data: lines } = trpc.productionLine.list.useQuery();
  const { data: lineDetail } = trpc.productionLine.getById.useQuery({ id: selectedLineId! }, { enabled: !!selectedLineId });
  const { data: lineWorkstations } = trpc.workstation.listByLine.useQuery({ productionLineId: selectedLineId! }, { enabled: !!selectedLineId });
  const { data: lineSnapshots } = trpc.snapshot.listByLine.useQuery({ productionLineId: selectedLineId! }, { enabled: !!selectedLineId });
  const taktTime = lineDetail?.targetCycleTime ? parseFloat(lineDetail.targetCycleTime.toString()) : undefined;

  const { data: scenarios, refetch: refetchScenarios } = trpc.simulation.list.useQuery({ productionLineId: selectedLineId! }, { enabled: !!selectedLineId });
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [compareScenarioId, setCompareScenarioId] = useState<number | null>(null);
  const [localWorkstations, setLocalWorkstations] = useState<SimWorkstation[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedWsId, setSelectedWsId] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddWsDialog, setShowAddWsDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [splitTargetIndex, setSplitTargetIndex] = useState<number | null>(null);

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

  const createMutation = trpc.simulation.create.useMutation({
    onSuccess: () => { toast.success("情境已建立"); setShowCreateDialog(false); setNewScenarioName(""); refetchScenarios(); },
    onError: (e) => toast.error(`建立失敗：${e.message}`),
  });
  const updateMutation = trpc.simulation.update.useMutation({
    onSuccess: () => { toast.success("情境已儲存"); setIsDirty(false); refetchScenarios(); },
    onError: (e) => toast.error(`儲存失敗：${e.message}`),
  });
  const deleteMutation = trpc.simulation.delete.useMutation({
    onSuccess: () => { toast.success("情境已刪除"); setSelectedScenarioId(null); setLocalWorkstations([]); refetchScenarios(); },
    onError: (e) => toast.error(`刪除失敗：${e.message}`),
  });
  const duplicateMutation = trpc.simulation.duplicate.useMutation({
    onSuccess: (data) => {
      toast.success("情境已複製"); refetchScenarios();
      if (data.scenario) { setSelectedScenarioId(data.scenario.id); setLocalWorkstations((data.scenario.workstationsData as SimWorkstation[]) ?? []); setIsDirty(false); }
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

  const handleSelectScenario = (scenario: Scenario) => {
    if (isDirty && !confirm("有未儲存的變更，確定要切換情境嗎？")) return;
    setSelectedScenarioId(scenario.id);
    setLocalWorkstations(scenario.workstationsData.map(w => ({ ...w })));
    setIsDirty(false);
    setSelectedWsId(null);
  };

  const handleCreateScenario = () => {
    if (!selectedLineId || !newScenarioName.trim()) return;
    let wsData: SimWorkstation[] = [];
    if (newScenarioSource === "line" && lineWorkstations) {
      wsData = lineWorkstations.map(w => ({ id: w.id, name: w.name, cycleTime: parseFloat(w.cycleTime.toString()), manpower: parseFloat(w.manpower.toString()), sequenceOrder: w.sequenceOrder, description: w.description ?? undefined }));
    } else if (newScenarioSource === "snapshot" && newScenarioSnapshotId && lineSnapshots) {
      const snap = lineSnapshots.find(s => s.id === newScenarioSnapshotId);
      if (snap?.workstationsData) wsData = (snap.workstationsData as SimWorkstation[]).map((w, i) => ({ ...w, sequenceOrder: i }));
    }
    createMutation.mutate({ productionLineId: selectedLineId, name: newScenarioName.trim(), baseSnapshotId: newScenarioSource === "snapshot" ? (newScenarioSnapshotId ?? undefined) : undefined, workstationsData: wsData });
  };

  const updateWs = (id: number, field: keyof SimWorkstation, value: string | number) => {
    setLocalWorkstations(prev => prev.map(w => w.id === id ? { ...w, [field]: value } : w));
    setIsDirty(true);
  };
  const deleteWs = (id: number) => {
    setLocalWorkstations(prev => prev.filter(w => w.id !== id).map((w, i) => ({ ...w, sequenceOrder: i })));
    if (selectedWsId === id) setSelectedWsId(null);
    setIsDirty(true);
  };
  const mergeWithNext = (index: number) => {
    setLocalWorkstations(prev => {
      if (index >= prev.length - 1) return prev;
      const sorted = [...prev].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      const a = sorted[index]; const b = sorted[index + 1];
      const merged: SimWorkstation = { id: a.id, name: `${a.name}+${b.name}`, cycleTime: parseFloat((a.cycleTime + b.cycleTime).toFixed(2)), manpower: parseFloat((a.manpower + b.manpower).toFixed(1)), sequenceOrder: index, description: [a.description, b.description].filter(Boolean).join("; ") || undefined };
      return [...sorted.slice(0, index), merged, ...sorted.slice(index + 2)].map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true);
  };
  const openSplit = (index: number) => {
    const sorted = [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const ws = sorted[index];
    setSplitTargetIndex(index); setSplitRatio("50"); setSplitName1(`${ws.name}-A`); setSplitName2(`${ws.name}-B`); setShowSplitDialog(true);
  };
  const confirmSplit = () => {
    if (splitTargetIndex === null) return;
    const sorted = [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const ws = sorted[splitTargetIndex];
    const ratio = parseFloat(splitRatio) / 100;
    if (isNaN(ratio) || ratio <= 0 || ratio >= 1) { toast.error("比例必須在 1~99 之間"); return; }
    const ct1 = parseFloat((ws.cycleTime * ratio).toFixed(2));
    const ct2 = parseFloat((ws.cycleTime * (1 - ratio)).toFixed(2));
    const ws1: SimWorkstation = { id: ws.id, name: splitName1 || `${ws.name}-A`, cycleTime: ct1, manpower: Math.max(0.5, parseFloat((ws.manpower * ratio).toFixed(1))), sequenceOrder: splitTargetIndex };
    const ws2: SimWorkstation = { id: -(Date.now()), name: splitName2 || `${ws.name}-B`, cycleTime: ct2, manpower: Math.max(0.5, parseFloat((ws.manpower * (1 - ratio)).toFixed(1))), sequenceOrder: splitTargetIndex + 1 };
    setLocalWorkstations(prev => {
      const s = [...prev].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      return [...s.slice(0, splitTargetIndex), ws1, ws2, ...s.slice(splitTargetIndex + 1)].map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true); setShowSplitDialog(false);
  };
  const addNewWorkstation = () => {
    const ct = parseFloat(newWsCt); const mp = parseFloat(newWsManpower);
    if (!newWsName.trim() || isNaN(ct) || ct <= 0 || isNaN(mp) || mp < 0.5) { toast.error("請填寫正確的工站名稱、工序時間（>0）和人力（≥0.5）"); return; }
    const newWs: SimWorkstation = { id: -(Date.now()), name: newWsName.trim(), cycleTime: ct, manpower: mp, sequenceOrder: 0 };
    setLocalWorkstations(prev => {
      const sorted = [...prev].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      const newArr = newWsInsertAfter === "last" ? [...sorted, newWs] : [...sorted.slice(0, parseInt(newWsInsertAfter) + 1), newWs, ...sorted.slice(parseInt(newWsInsertAfter) + 1)];
      return newArr.map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setIsDirty(true); setNewWsName(""); setNewWsCt(""); setNewWsManpower("1"); setNewWsInsertAfter("last"); setShowAddWsDialog(false);
  };
  const handleSaveScenario = () => {
    if (!selectedScenarioId) return;
    updateMutation.mutate({ id: selectedScenarioId, workstationsData: localWorkstations });
  };

  const handleDragStart = (e: React.DragEvent, index: number) => { setDragIndex(index); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e: React.DragEvent, _index: number) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) { setDragIndex(null); return; }
    setLocalWorkstations(prev => {
      const sorted = [...prev].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      const [moved] = sorted.splice(dragIndex, 1);
      sorted.splice(dropIndex, 0, moved);
      return sorted.map((w, i) => ({ ...w, sequenceOrder: i }));
    });
    setDragIndex(null); setIsDirty(true);
  };

  const kpi = useMemo(() => calcKPI(localWorkstations, taktTime), [localWorkstations, taktTime]);
  // diff map: ws.id -> "add"|"update" for badge display
  const wsDiffMap = useMemo(() => {
    const map = new Map<number, "add" | "update">();
    if (!lineWorkstations) return map;
    for (const simWs of localWorkstations) {
      if (simWs.id < 0) { map.set(simWs.id, "add"); continue; }
      const existing = lineWorkstations.find(w => w.id === simWs.id);
      if (!existing) { map.set(simWs.id, "add"); continue; }
      const ctChanged = Math.abs(parseFloat(existing.cycleTime.toString()) - simWs.cycleTime) > 0.01;
      const mpChanged = Math.abs(parseFloat(existing.manpower.toString()) - simWs.manpower) > 0.01;
      const nameChanged = existing.name !== simWs.name;
      if (ctChanged || mpChanged || nameChanged) map.set(simWs.id, "update");
    }
    return map;
  }, [localWorkstations, lineWorkstations]);
  const sortedWs = useMemo(() => [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder), [localWorkstations]);
  const selectedWs = localWorkstations.find(w => w.id === selectedWsId);
  const selectedWsIndex = selectedWs ? sortedWs.findIndex(w => w.id === selectedWsId) : -1;
  const selectedScenario = scenarios?.find(s => s.id === selectedScenarioId);
  const compareScenario = scenarios?.find(s => s.id === compareScenarioId);
  const compareKpi = useMemo(() => compareScenario ? calcKPI(compareScenario.workstationsData as SimWorkstation[], taktTime) : null, [compareScenario, taktTime]);

  const handleDownloadChart = useCallback(async () => {
    setIsDownloading(true);
    try { await downloadChartAsPng(chartRef, `配置模擬_${selectedScenario?.name ?? "情境"}_${new Date().toLocaleDateString("zh-TW").replace(/\//g, "-")}.png`); }
    finally { setIsDownloading(false); }
  }, [selectedScenario]);

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
      if (!simIds.has(ew.id)) changes.push({ type: "remove", name: ew.name, detail: "從情境中移除" });
    }
    return changes;
  }, [localWorkstations, lineWorkstations]);

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-card/60 backdrop-blur px-4 py-2.5 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setLocation("/lines")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-semibold text-foreground">配置模擬</span>
          {selectedScenario && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-primary font-medium">{selectedScenario.name}</span>
              {isDirty && <Badge variant="outline" className="text-amber-400 border-amber-400/50 text-[10px] px-1.5 py-0">未儲存</Badge>}
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={selectedLineId?.toString() ?? ""} onValueChange={v => { setSelectedLineId(parseInt(v)); setSelectedScenarioId(null); setLocalWorkstations([]); setIsDirty(false); }}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="選擇產線..." /></SelectTrigger>
            <SelectContent>{lines?.map(line => <SelectItem key={line.id} value={line.id.toString()}>{line.name}</SelectItem>)}</SelectContent>
          </Select>
          {taktTime && <Badge variant="outline" className="text-violet-400 border-violet-400/50 text-xs">Takt {taktTime}s</Badge>}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setLeftCollapsed(v => !v)}><PanelLeft className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setRightCollapsed(v => !v)}><PanelRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* 三欄主體 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左欄：情境列表 */}
        {!leftCollapsed && (
          <div className="w-56 shrink-0 border-r border-border bg-card/30 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">情境列表</span>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => setShowCreateDialog(true)} disabled={!selectedLineId}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {!selectedLineId && <p className="text-xs text-muted-foreground text-center py-6 px-2">請先在頂部選擇產線</p>}
              {selectedLineId && !scenarios?.length && <p className="text-xs text-muted-foreground text-center py-6 px-2">尚無情境，點擊 + 新建</p>}
              {scenarios?.map(scenario => {
                const wsData = scenario.workstationsData as SimWorkstation[];
                const sKpi = calcKPI(wsData, taktTime);
                const isActive = selectedScenarioId === scenario.id;
                return (
                  <div key={scenario.id}
                    className={`rounded-lg border p-2.5 cursor-pointer transition-all group ${isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/40 hover:bg-muted/20"}`}
                    onClick={() => handleSelectScenario(scenario as Scenario)}>
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{scenario.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{wsData.length} 工站</p>
                      </div>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={e => { e.stopPropagation(); duplicateMutation.mutate({ id: scenario.id, newName: `${scenario.name} (複製)` }); }}><Copy className="w-2.5 h-2.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-red-400" onClick={e => { e.stopPropagation(); if (confirm(`確定刪除「${scenario.name}」？`)) deleteMutation.mutate({ id: scenario.id }); }}><Trash2 className="w-2.5 h-2.5" /></Button>
                      </div>
                    </div>
                    {sKpi && (
                      <div className="mt-1.5 grid grid-cols-2 gap-x-2 text-[10px]">
                        <span className="text-muted-foreground">平衡率</span>
                        <span className={`font-mono font-medium ${sKpi.balanceRate >= 85 ? "text-emerald-400" : sKpi.balanceRate >= 70 ? "text-amber-400" : "text-red-400"}`}>{sKpi.balanceRate.toFixed(1)}%</span>
                        <span className="text-muted-foreground">瓶頸 CT</span>
                        <span className="font-mono font-medium text-orange-400">{sKpi.maxTime.toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 中欄：工站畫布 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedScenarioId && (
            <div className="shrink-0 border-b border-border bg-card/20 px-4 py-2 flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setShowAddWsDialog(true)}><Plus className="w-3.5 h-3.5" />新增工站</Button>
              <div className="h-4 w-px bg-border" />
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setShowCompareDialog(true)}><GitCompare className="w-3.5 h-3.5" />比較情境</Button>
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={handleDownloadChart} disabled={isDownloading || !kpi}>
                {isDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}下載圖表
              </Button>
              <div className="ml-auto flex items-center gap-2">
                {kpi && (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>平衡率 <strong className={kpi!.balanceRate >= 85 ? "text-emerald-400" : kpi!.balanceRate >= 70 ? "text-amber-400" : "text-red-400"}>{kpi!.balanceRate.toFixed(1)}%</strong></span>
                    <span>瓶頸 <strong className="text-orange-400">{kpi!.maxTime.toFixed(1)}s</strong></span>
                    <span>UPPH <strong className="text-cyan-400">{kpi!.upph.toFixed(2)}</strong></span>
                  </div>
                )}
                <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={handleSaveScenario} disabled={!isDirty || updateMutation.isPending}>
                  {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}儲存
                </Button>
                <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs text-emerald-400 border-emerald-400/50 hover:bg-emerald-400/10" onClick={() => setShowApplyDialog(true)} disabled={!localWorkstations.length}>
                  <Play className="w-3.5 h-3.5" />套用至產線
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto p-6">
            {!selectedLineId && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3"><Layers className="w-12 h-12 text-muted-foreground/30 mx-auto" /><p className="text-muted-foreground">請先在頂部選擇產線</p></div>
              </div>
            )}
            {selectedLineId && !selectedScenarioId && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Settings className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-muted-foreground">從左側選擇情境，或點擊 + 新建</p>
                  <Button size="sm" onClick={() => setShowCreateDialog(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />新建情境</Button>
                </div>
              </div>
            )}
            {selectedScenarioId && sortedWs.length === 0 && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center space-y-3">
                  <p className="text-muted-foreground text-sm">此情境尚無工站</p>
                  <Button size="sm" onClick={() => setShowAddWsDialog(true)}><Plus className="w-3.5 h-3.5 mr-1.5" />新增工站</Button>
                </div>
              </div>
            )}
            {selectedScenarioId && sortedWs.length > 0 && (
              <div className="space-y-6">
                {/* 工站流程卡片列 */}
                <div className="flex items-center flex-wrap gap-y-6 pb-2">
                  {sortedWs.map((ws, index) => (
                    <WsCard key={ws.id} ws={ws} index={index} total={sortedWs.length}
                      maxTime={kpi?.maxTime ?? 0} taktTime={taktTime}
                      isSelected={selectedWsId === ws.id} isDragging={dragIndex === index}
                      diffType={wsDiffMap.get(ws.id) ?? null}
                      onSelect={() => setSelectedWsId(prev => prev === ws.id ? null : ws.id)}
                      onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop}
                      onUpdate={(field, value) => { updateWs(ws.id, field as keyof SimWorkstation, value as never); }}
                      onMoveLeft={() => {
                        const sorted = [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
                        if (index > 0) { const newArr = [...sorted]; [newArr[index], newArr[index - 1]] = [newArr[index - 1], newArr[index]]; setLocalWorkstations(newArr.map((w, i) => ({ ...w, sequenceOrder: i }))); setIsDirty(true); }
                      }}
                      onMoveRight={() => {
                        const sorted = [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
                        if (index < sorted.length - 1) { const newArr = [...sorted]; [newArr[index], newArr[index + 1]] = [newArr[index + 1], newArr[index]]; setLocalWorkstations(newArr.map((w, i) => ({ ...w, sequenceOrder: i }))); setIsDirty(true); }
                      }}
                      onMerge={() => mergeWithNext(index)}
                      onSplit={() => openSplit(index)}
                      onDelete={() => deleteWs(ws.id)}
                      onInsertAfter={() => { setNewWsInsertAfter(index.toString()); setShowAddWsDialog(true); }}
                    />
                  ))}
                </div>
                {/* 平衡圖 */}
                {kpi && (
                  <div className="rounded-xl border border-border bg-card/40 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5" />工序時間平衡圖
                      </span>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        {taktTime && <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-violet-400" />Takt {taktTime}s</span>}
                        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-slate-500" />平均 {kpi.avgTime.toFixed(1)}s</span>
                      </div>
                    </div>
                    <BalanceMiniChart workstations={sortedWs} taktTime={taktTime} avgTime={kpi.avgTime} chartRef={chartRef} />
                  </div>
                )}
                {/* 比較情境 */}
                {compareScenario && compareKpi && kpi && (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <GitCompare className="w-3.5 h-3.5 text-violet-400" />
                      <span className="text-xs font-semibold text-violet-400">對比：{compareScenario.name}</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto text-muted-foreground" onClick={() => setCompareScenarioId(null)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs">
                      {[
                        { label: "平衡率", cur: kpi.balanceRate, cmp: compareKpi.balanceRate, unit: "%", hib: true },
                        { label: "瓶頸 CT", cur: kpi.maxTime, cmp: compareKpi.maxTime, unit: "s", hib: false },
                        { label: "UPPH", cur: kpi.upph, cmp: compareKpi.upph, unit: "", hib: true },
                        { label: "總人力", cur: kpi.totalManpower, cmp: compareKpi.totalManpower, unit: "人", hib: false },
                      ].map(({ label, cur, cmp, unit, hib }) => (
                        <div key={label} className="bg-card/50 rounded-lg p-2.5 space-y-1">
                          <p className="text-muted-foreground">{label}</p>
                          <p className="font-mono font-bold text-foreground">{cur.toFixed(1)}{unit}</p>
                          <DeltaBadge a={cmp} b={cur} unit={unit} higherIsBetter={hib} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右欄：屬性面板 */}
        {!rightCollapsed && (
          <div className="w-64 shrink-0 border-l border-border bg-card/30 flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-border">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {selectedWs ? "工站屬性" : "情境 KPI"}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {selectedWs ? (
                <>
                  {kpi && (() => {
                    const status = getBarStatus(selectedWs.cycleTime, kpi.maxTime, taktTime);
                    const meta = STATUS_META[status];
                    return (
                      <div className={`rounded-lg border p-2 text-xs ${meta.bg}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="font-mono font-bold" style={{ color: meta.color }}>{selectedWs.cycleTime.toFixed(1)}s</span>
                        </div>
                        {taktTime && (
                          <div className="mt-1 text-muted-foreground">
                            vs Takt：{(selectedWs.cycleTime - taktTime) > 0
                              ? <span className="text-red-400">+{(selectedWs.cycleTime - taktTime).toFixed(1)}s 超出</span>
                              : <span className="text-emerald-400">{(selectedWs.cycleTime - taktTime).toFixed(1)}s 餘裕</span>}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div>
                    <Label className="text-xs text-muted-foreground">工站名稱</Label>
                    <Input className="h-7 text-sm mt-1" value={selectedWs.name} onChange={e => updateWs(selectedWs.id, "name", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">工序時間（秒）</Label>
                    <Input className="h-7 text-sm mt-1 font-mono" type="number" min="0.1" step="0.1" value={selectedWs.cycleTime}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) updateWs(selectedWs.id, "cycleTime", v); }} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">人力（人）</Label>
                    <Input className="h-7 text-sm mt-1" type="number" min="0.5" step="0.5" value={selectedWs.manpower}
                      onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0.5) updateWs(selectedWs.id, "manpower", v); }} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">備註</Label>
                    <Input className="h-7 text-sm mt-1" value={selectedWs.description ?? ""} placeholder="選填" onChange={e => updateWs(selectedWs.id, "description", e.target.value)} />
                  </div>
                  <div className="border-t border-border pt-3 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">工站操作</Label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-400 border-blue-400/40" disabled={selectedWsIndex <= 0}
                        onClick={() => {
                          const sorted = [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
                          const i = selectedWsIndex;
                          if (i > 0) { const newArr = [...sorted]; [newArr[i], newArr[i - 1]] = [newArr[i - 1], newArr[i]]; setLocalWorkstations(newArr.map((w, idx) => ({ ...w, sequenceOrder: idx }))); setIsDirty(true); }
                        }}>
                        <ChevronLeft className="w-3 h-3" />前移
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-400 border-blue-400/40" disabled={selectedWsIndex >= sortedWs.length - 1}
                        onClick={() => {
                          const sorted = [...localWorkstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
                          const i = selectedWsIndex;
                          if (i < sorted.length - 1) { const newArr = [...sorted]; [newArr[i], newArr[i + 1]] = [newArr[i + 1], newArr[i]]; setLocalWorkstations(newArr.map((w, idx) => ({ ...w, sequenceOrder: idx }))); setIsDirty(true); }
                        }}>
                        後移<ChevronRight className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-amber-400 border-amber-400/40" disabled={selectedWsIndex >= sortedWs.length - 1} onClick={() => mergeWithNext(selectedWsIndex)}>
                        <Merge className="w-3 h-3" />合併下站
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-cyan-400 border-cyan-400/40" onClick={() => openSplit(selectedWsIndex)}>
                        <Scissors className="w-3 h-3" />拆分
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-400 border-red-400/40 col-span-2" onClick={() => deleteWs(selectedWs.id)}>
                        <Trash2 className="w-3 h-3" />刪除工站
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                kpi ? (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-background/50 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">平衡率</span>
                        <span className={`font-bold font-mono ${kpi.balanceRate >= 85 ? "text-emerald-400" : kpi.balanceRate >= 70 ? "text-amber-400" : "text-red-400"}`}>{kpi.balanceRate.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${kpi.balanceRate >= 85 ? "bg-emerald-500" : kpi.balanceRate >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(kpi.balanceRate, 100)}%` }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {[
                        { label: "瓶頸 CT", value: `${kpi.maxTime.toFixed(1)}s`, color: "text-orange-400" },
                        { label: "平均 CT", value: `${kpi.avgTime.toFixed(1)}s`, color: "text-cyan-400" },
                        { label: "UPPH", value: kpi.upph.toFixed(2), color: "text-emerald-400" },
                        { label: "總人力", value: `${kpi.totalManpower}人`, color: "text-blue-400" },
                        { label: "時產能", value: `${kpi.capacity.toFixed(0)}件`, color: "text-violet-400" },
                        { label: "平衡損失", value: `${kpi.balanceLoss.toFixed(1)}%`, color: "text-red-400" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-background/50 rounded-lg p-2 space-y-0.5">
                          <p className="text-muted-foreground">{label}</p>
                          <p className={`font-bold font-mono ${color}`}>{value}</p>
                        </div>
                      ))}
                    </div>
                    {kpi.taktStats && (
                      <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Takt 達成率</span>
                          <span className={`font-bold ${kpi.taktStats.passRate >= 80 ? "text-emerald-400" : "text-red-400"}`}>{kpi.taktStats.passRate.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${kpi.taktStats.passRate >= 80 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${kpi.taktStats.passRate}%` }} />
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center">點擊工站卡片查看屬性</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">選擇情境後顯示 KPI</p>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dialog: 新建情境 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>新建情境</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>情境名稱</Label><Input value={newScenarioName} onChange={e => setNewScenarioName(e.target.value)} placeholder="例：減少人力方案" className="mt-1" autoFocus /></div>
            <div>
              <Label>初始資料來源</Label>
              <Select value={newScenarioSource} onValueChange={v => setNewScenarioSource(v as "line" | "snapshot")}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
                  <SelectTrigger className="mt-1"><SelectValue placeholder="選擇快照..." /></SelectTrigger>
                  <SelectContent>{lineSnapshots?.map(snap => <SelectItem key={snap.id} value={snap.id.toString()}>{snap.name} ({new Date(snap.createdAt).toLocaleDateString("zh-TW")})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreateScenario} disabled={!newScenarioName.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: 新增工站 */}
      <Dialog open={showAddWsDialog} onOpenChange={setShowAddWsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>新增工站</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>工站名稱</Label><Input value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="例：ST-01" className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>工序時間（秒）</Label><Input value={newWsCt} onChange={e => setNewWsCt(e.target.value)} type="number" min="0.1" step="0.1" placeholder="0.0" className="mt-1" /></div>
              <div><Label>人力（人）</Label><Input value={newWsManpower} onChange={e => setNewWsManpower(e.target.value)} type="number" min="0.5" step="0.5" className="mt-1" /></div>
            </div>
            <div>
              <Label>插入位置</Label>
              <Select value={newWsInsertAfter} onValueChange={setNewWsInsertAfter}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="last">加在最後</SelectItem>
                  {sortedWs.map((ws, i) => <SelectItem key={ws.id} value={i.toString()}>加在「{ws.name}」之後</SelectItem>)}
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

      {/* Dialog: 拆分工站 */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>拆分工站</DialogTitle>
            <DialogDescription>{splitTargetIndex !== null ? `將「${sortedWs[splitTargetIndex]?.name}」拆分為兩個工站` : ""}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>拆分比例（第一站佔 %）</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={splitRatio} onChange={e => setSplitRatio(e.target.value)} type="number" min="1" max="99" step="1" className="w-24" />
                <span className="text-muted-foreground text-sm">: {100 - parseFloat(splitRatio || "50")}%</span>
              </div>
              {splitTargetIndex !== null && sortedWs[splitTargetIndex] && (() => {
                const ws = sortedWs[splitTargetIndex]; const ratio = parseFloat(splitRatio) / 100;
                return <p className="text-xs text-muted-foreground mt-1">CT：{(ws.cycleTime * ratio).toFixed(2)}s / {(ws.cycleTime * (1 - ratio)).toFixed(2)}s（原 {ws.cycleTime}s）</p>;
              })()}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>第一站名稱</Label><Input value={splitName1} onChange={e => setSplitName1(e.target.value)} className="mt-1" /></div>
              <div><Label>第二站名稱</Label><Input value={splitName2} onChange={e => setSplitName2(e.target.value)} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSplitDialog(false)}>取消</Button>
            <Button onClick={confirmSplit}>確認拆分</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: 比較情境 */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>選擇比較情境</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {scenarios?.filter(s => s.id !== selectedScenarioId).map(s => (
              <div key={s.id}
                className={`rounded-lg border p-3 cursor-pointer transition-all ${compareScenarioId === s.id ? "border-violet-500 bg-violet-500/10" : "border-border hover:border-violet-500/50"}`}
                onClick={() => { setCompareScenarioId(s.id); setShowCompareDialog(false); }}>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{(s.workstationsData as SimWorkstation[]).length} 工站</p>
              </div>
            ))}
            {!scenarios?.filter(s => s.id !== selectedScenarioId).length && <p className="text-sm text-muted-foreground text-center py-4">無其他情境可比較</p>}
          </div>
          <DialogFooter>
            {compareScenarioId && <Button variant="outline" onClick={() => { setCompareScenarioId(null); setShowCompareDialog(false); }}>清除比較</Button>}
            <Button variant="outline" onClick={() => setShowCompareDialog(false)}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: 套用至產線 */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>套用情境至產線</DialogTitle>
            <DialogDescription>以下變更將直接更新產線工站資料，此操作無法復原。</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {applyChanges.map((c, i) => (
              <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded-lg ${c.type === "add" ? "bg-emerald-500/10" : c.type === "remove" ? "bg-red-500/10" : "bg-amber-500/10"}`}>
                {c.type === "add" ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> :
                 c.type === "remove" ? <Trash2 className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /> :
                 <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
                <div><span className="font-medium">{c.name}</span><span className="text-muted-foreground ml-2 text-xs">{c.detail}</span></div>
              </div>
            ))}
            {!applyChanges.length && <p className="text-sm text-muted-foreground text-center py-4">與目前產線無差異</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>取消</Button>
            <Button
              onClick={() => applyMutation.mutate({ scenarioId: selectedScenarioId! })}
              disabled={!applyChanges.length || applyMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}確認套用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
