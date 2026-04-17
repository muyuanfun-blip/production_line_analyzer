import {
  useState, useRef, useEffect, useCallback, useMemo, useReducer,
} from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Plus, Save, Play, Pause, Trash2, Settings2, ZoomIn, ZoomOut,
  Maximize2, Download, Upload, GitCompare, Loader2, Link2, Link2Off,
  LayoutGrid, ChevronRight, X, Check, Users, Cpu, Clock, BarChart3,
  Target, Zap, AlertTriangle, TrendingUp, RotateCcw, FlaskConical,
  MoveHorizontal, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

// ─── Types ────────────────────────────────────────────────────────────────────
export type FloorWs = {
  id: number;           // 正數=已存在工站, 負數=新增
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  operatorTime: number; // 人員作業時間（秒）
  machineTime: number;  // 設備作業時間（秒）
  manpower: number;
  operatorCount: number; // 人員數量（配置人數）
  machineCount: number;  // 設備數量（0=純人工）
  sequenceOrder: number;
  description?: string;
};

export type ConveyorType = 'manual' | 'conveyor' | 'agv';
export const CONVEYOR_META: Record<ConveyorType, { label: string; speed: number; color: string; dash: string; markerSuffix: string }> = {
  manual:   { label: '人工搬運', speed: 30,  color: '#64748b', dash: '5 4',  markerSuffix: 'gray' },
  conveyor: { label: '輸送帶',   speed: 20,  color: '#38bdf8', dash: 'none', markerSuffix: 'cyan' },
  agv:      { label: 'AGV',      speed: 60,  color: '#fb923c', dash: '8 2',  markerSuffix: 'amber' },
};
export type FloorConnection = {
  id: string;
  fromId: number;
  toId: number;
  conveyorType: ConveyorType;  // 輸送帶類型
  speed: number;               // 搬運速度（公尺/分鐘）
  distance?: number;           // 搬運距離（公尺，由座標自動計算）
  transportTime?: number;      // 搬運時間（秒）
  label?: string;
  conveyorRef?: string;        // 使用的輸送帶物件 id
};

export type ConveyorObject = {
  id: string;
  x1: number; y1: number;  // 起點
  x2: number; y2: number;  // 終點
  speed: number;           // 公尺/分鐘
  name: string;
  color: string;           // 輸送帶顏色
  snapFrom?: number;       // 吸附的起點工站 id
  snapTo?: number;         // 吸附的終點工站 id
};

export type FloorLayout = {
  workstations: FloorWs[];
  connections: FloorConnection[];
  conveyors?: ConveyorObject[];
};

/// ─── Constants ───────────────────────────────────────────────────────────
const WS_W = 140;
const WS_H = 80;
const GRID = 20;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;
const DEFAULT_SCALE_PX_PER_M = 40; // 預設比例尺：40 px = 1 公尺（每格 20px = 0.5m）

// ─── Color Helpers ────────────────────────────────────────────────────────────
function getWsColor(ws: FloorWs, maxCt: number, taktTime?: number): {
  bg: string; border: string; text: string; badge: string; badgeText: string;
} {
  const ct = Math.max(ws.operatorTime, ws.machineTime);
  if (taktTime && ct > taktTime) return { bg: "#3f1212", border: "#ef4444", text: "#fca5a5", badge: "#ef4444", badgeText: "#fff" };
  if (ct === maxCt && maxCt > 0) return { bg: "#3f2a0a", border: "#f97316", text: "#fdba74", badge: "#f97316", badgeText: "#fff" };
  if (taktTime && ct / taktTime >= 0.8) return { bg: "#3f3a0a", border: "#eab308", text: "#fde047", badge: "#eab308", badgeText: "#000" };
  return { bg: "#0a2a3f", border: "#22d3ee", text: "#a5f3fc", badge: "#22d3ee", badgeText: "#000" };
}

// ─── Snap to Grid ─────────────────────────────────────────────────────────────
function snap(v: number): number { return Math.round(v / GRID) * GRID; }

// ─── Bezier Path between two nodes ───────────────────────────────────────────
function makePath(from: FloorWs, to: FloorWs): string {
  const fx = from.x + from.width / 2;
  const fy = from.y + from.height / 2;
  const tx = to.x + to.width / 2;
  const ty = to.y + to.height / 2;
  const dx = tx - fx;
  const dy = ty - fy;
  const cx1 = fx + dx * 0.4;
  const cy1 = fy;
  const cx2 = tx - dx * 0.4;
  const cy2 = ty;
  return `M ${fx} ${fy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;
}

// ─── Arrow Marker ─────────────────────────────────────────────────────────────────────────────────
function ArrowDefs() { return (
    <defs>
      <marker id="arrow-cyan" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#22d3ee" />
      </marker>
      <marker id="arrow-amber" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b" />
      </marker>
      <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#64748b" />
      </marker>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      {/* 輸送帶滾輪動畫 */}
      <style>{`
        @keyframes conveyor-roll {
          from { stroke-dashoffset: 0; }
          to   { stroke-dashoffset: -24; }
        }
        .conveyor-roll-fast  { animation: conveyor-roll 0.4s linear infinite; }
        .conveyor-roll-med   { animation: conveyor-roll 0.8s linear infinite; }
        .conveyor-roll-slow  { animation: conveyor-roll 1.6s linear infinite; }
      `}</style>
    </defs>
  );
}

// ─── Conveyor Belt Visual ──────────────────────────────────────────────────────────────────────────────
function ConveyorBelt({ pathD, speed, isSelected }: { pathD: string; speed: number; isSelected: boolean }) {
  // 依速度選擇滾輪動畫速度類別
  const rollClass = speed >= 15 ? 'conveyor-roll-fast' : speed >= 8 ? 'conveyor-roll-med' : 'conveyor-roll-slow';
  return (
    <g>
      {/* 選取光暈 */}
      {isSelected && (
        <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="18" opacity="0.25" />
      )}
      {/* 輸送帶底帶（深色本體） */}
      <path d={pathD} fill="none" stroke="#0f2a3a" strokeWidth="14" strokeLinecap="butt" />
      {/* 輸送帶邊框（上邊） */}
      <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="14"
        strokeDasharray="1 13" strokeLinecap="butt" opacity="0.4" />
      {/* 滾輪紋路（流動動畫） */}
      <path d={pathD} fill="none" stroke="#1e6a8a" strokeWidth="10"
        strokeDasharray="4 8" strokeLinecap="butt"
        className={rollClass} />
      {/* 輸送帶中心方向線 */}
      <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="1.5"
        opacity="0.9"
        markerEnd="url(#arrow-cyan)" />
      {/* 點擊區域（透明，擴大點擊範圍） */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth="18" className="cursor-pointer" />
    </g>
  );
}

// ─── Bounding-box edge distance ───────────────────────────────────────────────────────────────────────────────
function pixelDist(a: FloorWs, b: FloorWs): number {
  // 計算兩工站 bounding box 在 X 軸與 Y 軸方向的間隔（相鄰或重疊 = 0）
  const aRight = a.x + a.width;  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;  const bBottom = b.y + b.height;
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(aRight, bRight));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(aBottom, bBottom));
  return Math.sqrt(gapX * gapX + gapY * gapY);
}
// ─── Compute connection distance & transport time from layout ────────────────────────
function computeConnMetrics(
  conn: FloorConnection,
  workstations: FloorWs[],
  scalePxPerM: number
): { distance: number; transportTime: number } {
  const from = workstations.find(w => w.id === conn.fromId);
  const to   = workstations.find(w => w.id === conn.toId);
  if (!from || !to || scalePxPerM <= 0) return { distance: 0, transportTime: 0 };
  const dist = pixelDist(from, to) / scalePxPerM;  // 公尺
  const time = conn.speed > 0 ? (dist / conn.speed) * 60 : 0; // 秒
  return { distance: parseFloat(dist.toFixed(2)), transportTime: parseFloat(time.toFixed(2)) };
}
// ─── KPI Calculator ───────────────────────────────────────────────────────────
function calcKPI(workstations: FloorWs[], connections: FloorConnection[], scalePxPerM: number, taktTime?: number) {
  if (!workstations.length) return null;
  const cts = workstations.map(w => Math.max(w.operatorTime, w.machineTime));
  const totalCt = cts.reduce((s, t) => s + t, 0);
  const maxCt = Math.max(...cts);
  const avgCt = totalCt / cts.length;
  const bottleneck = workstations.find(w => Math.max(w.operatorTime, w.machineTime) === maxCt);
  const balanceRate = (totalCt / (maxCt * cts.length)) * 100;
  const totalManpower = workstations.reduce((s, w) => s + w.manpower, 0);
  const totalOperators = workstations.reduce((s, w) => s + (w.operatorCount ?? 1), 0);
  const totalMachines = workstations.reduce((s, w) => s + (w.machineCount ?? 1), 0);
  const upph = totalManpower > 0 && maxCt > 0 ? 3600 / maxCt / totalManpower : 0;
  const upphPerOperator = totalOperators > 0 && maxCt > 0 ? 3600 / maxCt / totalOperators : 0;
  const capacity = maxCt > 0 ? 3600 / maxCt : 0;
  // 設備利用率：各工站 machineTime / (operatorTime * machineCount) 的加權平均
  const machineUtilWs = workstations.filter(w => (w.machineCount ?? 1) > 0 && w.machineTime > 0 && w.operatorTime > 0);
  const avgMachineUtil = machineUtilWs.length > 0
    ? machineUtilWs.reduce((s, w) => s + Math.min(1, w.machineTime / (w.operatorTime * (w.machineCount ?? 1))), 0) / machineUtilWs.length * 100
    : 0;
  const taktStats = taktTime ? {
    passRate: (cts.filter(ct => ct <= taktTime).length / cts.length) * 100,
    passCount: cts.filter(ct => ct <= taktTime).length,
    exceedCount: cts.filter(ct => ct > taktTime).length,
  } : null;
  // 搬運時間統計
  const transportTimes = connections.map(c => computeConnMetrics(c, workstations, scalePxPerM).transportTime).filter(t => t > 0);
  const totalTransportTime = transportTimes.reduce((s, t) => s + t, 0);
  const avgTransportTime = transportTimes.length > 0 ? totalTransportTime / transportTimes.length : 0;
  const logisticsWaitRatio = (totalCt + totalTransportTime) > 0
    ? (totalTransportTime / (totalCt + totalTransportTime)) * 100 : 0;
  return { totalCt, maxCt, avgCt, bottleneck, balanceRate, totalManpower, totalOperators, totalMachines, upph, upphPerOperator, capacity, avgMachineUtil, taktStats, avgTransportTime, logisticsWaitRatio };
}

// ─── Animation Dot ────────────────────────────────────────────────────────────
function AnimDot({ path, duration, color }: { path: string; duration: number; color: string }) {
  return (
    <circle r="5" fill={color} opacity="0.9" filter="url(#glow)">
      <animateMotion dur={`${duration}s`} repeatCount="indefinite" path={path} />
    </circle>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FloorPlanSimulator() {
  const [, setLocation] = useLocation();

  // ── 產線選擇 ──
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const { data: lines } = trpc.productionLine.list.useQuery();
  const { data: lineDetail } = trpc.productionLine.getById.useQuery(
    { id: selectedLineId! }, { enabled: !!selectedLineId }
  );
  const { data: lineWorkstations } = trpc.workstation.listByLine.useQuery(
    { productionLineId: selectedLineId! }, { enabled: !!selectedLineId }
  );
  const { data: scenarios, refetch: refetchScenarios } = trpc.simulation.list.useQuery(
    { productionLineId: selectedLineId! }, { enabled: !!selectedLineId }
  );

  const taktTime = lineDetail?.targetCycleTime
    ? parseFloat(lineDetail.targetCycleTime.toString()) : undefined;

  // ── 情境管理 ──
  const [selectedScenarioId, setSelectedScenarioId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // ── 佈局狀態 ──
  const [layout, setLayout] = useState<FloorLayout>({ workstations: [], connections: [] });
  const [selectedWsId, setSelectedWsId] = useState<number | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFrom, setConnectFrom] = useState<number | null>(null);
  const [animating, setAnimating] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // ── 畫布視圖狀態 ──
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // ── 拖曳狀態 ──
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // ── 輸送帶獨立物件狀態 ──
  const [selectedConveyorId, setSelectedConveyorId] = useState<string | null>(null);
  const [draggingConveyor, setDraggingConveyor] = useState<{ id: string; handle: 'body' | 'p1' | 'p2' } | null>(null);
  const conveyorDragStart = useRef({ mx: 0, my: 0, x1: 0, y1: 0, x2: 0, y2: 0 });
  const [showConveyorDialog, setShowConveyorDialog] = useState(false);
  const [editingConveyor, setEditingConveyor] = useState<ConveyorObject | null>(null);

  // ── Dialogs ──
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddWsDialog, setShowAddWsDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showConnDialog, setShowConnDialog] = useState(false);
  const [editingConn, setEditingConn] = useState<FloorConnection | null>(null);
  const [newScenarioName, setNewScenarioName] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [newWsOpTime, setNewWsOpTime] = useState("30");
  const [newWsMcTime, setNewWsMcTime] = useState("0");
  const [newWsManpower, setNewWsManpower] = useState("1");

  // ── 右側面板寬度調整 ──
  const [rightPanelWidth, setRightPanelWidth] = useState(288); // 預設 288px (w-72)
  const [kpiCollapsed, setKpiCollapsed] = useState(false);
  const [balanceCollapsed, setBalanceCollapsed] = useState(false);
  const isResizingPanel = useRef(false);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const handlePanelResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingPanel.current = true;
    resizeStartX.current = e.clientX;
    resizeStartW.current = rightPanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizingPanel.current) return;
      const delta = resizeStartX.current - ev.clientX; // 從右往左拖就變寬
      const newW = Math.min(480, Math.max(200, resizeStartW.current + delta));
      setRightPanelWidth(newW);
    };
    const onUp = () => {
      isResizingPanel.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rightPanelWidth]);

  // ── Mutations ──
  const createMutation = trpc.simulation.create.useMutation({
    onSuccess: (data) => {
      toast.success("情境已建立");
      setShowCreateDialog(false);
      refetchScenarios();
      if (data.scenario) {
        setSelectedScenarioId(data.scenario.id);
        const saved = data.scenario.workstationsData as any;
        if (saved?.workstations) {
          setLayout(saved as FloorLayout);
        } else {
          setLayout({ workstations: [], connections: [] });
        }
        setIsDirty(false);
      }
    },
    onError: (e) => toast.error(`建立失敗：${e.message}`),
  });

  const updateMutation = trpc.simulation.update.useMutation({
    onSuccess: () => {
      toast.success("佈局已儲存");
      setIsDirty(false);
      refetchScenarios();
    },
    onError: (e) => toast.error(`儲存失敗：${e.message}`),
  });

  const applyMutation = trpc.simulation.applyToLine.useMutation({
    onSuccess: (data) => {
      toast.success(`已套用！更新 ${data.updated} 站、新增 ${data.added} 站、移除 ${data.removed} 站`);
      setShowApplyDialog(false);
    },
    onError: (e) => toast.error(`套用失敗：${e.message}`),
  });

  // ── 選取情境 ──
  const handleSelectScenario = useCallback((id: number) => {
    if (isDirty && !confirm("有未儲存的變更，確定要切換情境嗎？")) return;
    const scenario = scenarios?.find(s => s.id === id);
    if (!scenario) return;
    setSelectedScenarioId(id);
    const saved = scenario.workstationsData as any;
    if (saved?.workstations) {
      setLayout(saved as FloorLayout);
    } else {
      // 舊格式：轉換為平面圖格式
      const wsArr = Array.isArray(saved) ? saved : [];
      const converted: FloorWs[] = wsArr.map((w: any, i: number) => ({
        id: w.id,
        name: w.name,
        x: snap(80 + (i % 5) * (WS_W + 60)),
        y: snap(80 + Math.floor(i / 5) * (WS_H + 80)),
        width: WS_W,
        height: (w.machineCount ?? 1) > 0 ? 96 : 80,
        operatorTime: w.cycleTime ?? w.operatorTime ?? 30,
        machineTime: w.machineTime ?? 0,
        manpower: w.manpower ?? 1,
        operatorCount: w.operatorCount ?? Math.max(1, Math.round(w.manpower ?? 1)),
        machineCount: w.machineCount ?? 1,
        sequenceOrder: w.sequenceOrder ?? i,
        description: w.description,
      }));
      const conns: FloorConnection[] = converted.slice(0, -1).map((w, i) => ({
        id: `conn-${w.id}-${converted[i + 1].id}`,
        fromId: w.id,
        toId: converted[i + 1].id,
        conveyorType: 'manual' as ConveyorType,
        speed: CONVEYOR_META.manual.speed,
      }));
      setLayout({ workstations: converted, connections: conns });
    }
    setIsDirty(false);
    setSelectedWsId(null);
  }, [isDirty, scenarios]);

  // ── 從產線載入 ──
  const handleLoadFromLine = useCallback(() => {
    if (!lineWorkstations?.length) { toast.error("此產線尚無工站"); return; }
    if (isDirty && !confirm("有未儲存的變更，確定要重新載入？")) return;
    const wsArr: FloorWs[] = lineWorkstations.map((w, i) => ({
      id: w.id,
      name: w.name,
      x: snap(80 + (i % 5) * (WS_W + 60)),
      y: snap(80 + Math.floor(i / 5) * (WS_H + 80)),
      width: WS_W,
      height: 96, // 預設有 1 台設備
      operatorTime: parseFloat(w.cycleTime.toString()),
      machineTime: 0,
      manpower: parseFloat(w.manpower.toString()),
      operatorCount: Math.max(1, Math.round(parseFloat(w.manpower.toString()))),
      machineCount: 1,
      sequenceOrder: w.sequenceOrder,
      description: w.description ?? undefined,
    }));
    const conns: FloorConnection[] = wsArr.slice(0, -1).map((w, i) => ({
      id: `conn-${w.id}-${wsArr[i + 1].id}`,
      fromId: w.id,
      toId: wsArr[i + 1].id,
      conveyorType: 'manual' as ConveyorType,
      speed: CONVEYOR_META.manual.speed,
    }));
    setLayout({ workstations: wsArr, connections: conns });
    setIsDirty(true);
    toast.success(`已載入 ${wsArr.length} 個工站`);
  }, [lineWorkstations, isDirty]);

  // ── 建立新情境 ──
  const handleCreateScenario = () => {
    if (!selectedLineId || !newScenarioName.trim()) return;
    createMutation.mutate({
      productionLineId: selectedLineId,
      name: newScenarioName.trim(),
      workstationsData: layout as any,
    });
  };

  // ── 儲存佈局 ──
  const handleSave = () => {
    if (!selectedScenarioId) return;
    updateMutation.mutate({
      id: selectedScenarioId,
      workstationsData: layout as any,
    });
  };

  // ── 新增工站 ──
  const handleAddWorkstation = () => {
    const opTime = parseFloat(newWsOpTime);
    const mcTime = parseFloat(newWsMcTime);
    const mp = parseFloat(newWsManpower);
    if (!newWsName.trim() || isNaN(opTime) || opTime < 0) {
      toast.error("請填寫正確的工站名稱與作業時間");
      return;
    }
    const newId = -(Date.now());
    const newWs: FloorWs = {
      id: newId,
      name: newWsName.trim(),
      x: snap(80 + (layout.workstations.length % 5) * (WS_W + 60)),
      y: snap(80 + Math.floor(layout.workstations.length / 5) * (WS_H + 80)),
      width: WS_W,
      height: 96, // 預設有 1 台設備
      operatorTime: opTime,
      machineTime: isNaN(mcTime) ? 0 : mcTime,
      manpower: isNaN(mp) || mp < 0.5 ? 1 : mp,
      operatorCount: 1,
      machineCount: 1,
      sequenceOrder: layout.workstations.length,
    };
    setLayout(prev => ({ ...prev, workstations: [...prev.workstations, newWs] }));
    setIsDirty(true);
    setNewWsName(""); setNewWsOpTime("30"); setNewWsMcTime("0"); setNewWsManpower("1");
    setShowAddWsDialog(false);
    toast.success(`已新增工站「${newWs.name}」`);
  };

  // ── 刪除工站 ──
  const handleDeleteWs = (id: number) => {
    setLayout(prev => ({
      workstations: prev.workstations.filter(w => w.id !== id),
      connections: prev.connections.filter(c => c.fromId !== id && c.toId !== id),
    }));
    if (selectedWsId === id) setSelectedWsId(null);
    setIsDirty(true);
  };

  // ── 計算工站節點高度（依 machineCount 動態調整）──
  const calcWsHeight = (mcCnt: number) => mcCnt > 0 ? 96 : 80;

  // ── 更新工站屬性 ──
  const updateWsProp = (id: number, field: keyof FloorWs, value: number | string) => {
    setLayout(prev => ({
      ...prev,
      workstations: prev.workstations.map(w => {
        if (w.id !== id) return w;
        const updated = { ...w, [field]: value };
        // 當 machineCount 變更時，同步調整節點高度
        if (field === 'machineCount') {
          updated.height = calcWsHeight(typeof value === 'number' ? value : parseInt(value as string) || 0);
        }
        return updated;
      }),
    }));
    setIsDirty(true);
  };

  // ── 連線操作 ──
  const handleConnectClick = (wsId: number) => {
    if (!connectMode) return;
    if (connectFrom === null) {
      setConnectFrom(wsId);
      toast.info("請點擊目標工站完成連線");
    } else if (connectFrom !== wsId) {
      const connId = `conn-${connectFrom}-${wsId}-${Date.now()}`;
      const exists = layout.connections.some(c => c.fromId === connectFrom && c.toId === wsId);
      if (exists) { toast.warning("此連線已存在"); setConnectFrom(null); return; }
      setLayout(prev => ({
        ...prev,
        connections: [...prev.connections, {
          id: connId,
          fromId: connectFrom,
          toId: wsId,
          conveyorType: 'manual' as ConveyorType,
          speed: CONVEYOR_META.manual.speed,
        }],
      }));
      setIsDirty(true);
      setConnectFrom(null);
      toast.success("連線已建立");
    } else {
      setConnectFrom(null);
    }
  };

  const handleDeleteConn = (connId: string) => {
    setLayout(prev => ({ ...prev, connections: prev.connections.filter(c => c.id !== connId) }));
    setIsDirty(true);
  };

  const handleUpdateConn = (connId: string, field: keyof FloorConnection, value: any) => {
    setLayout(prev => {
      let extraUpdates: Partial<FloorConnection> = {};
      // 當切換為輸送帶類型時，自動採用最近輸送帶物件的速度
      if (field === 'conveyorType' && value === 'conveyor' && (prev.conveyors ?? []).length > 0) {
        const conn = prev.connections.find(c => c.id === connId);
        if (conn) {
          const fromWs = prev.workstations.find(w => w.id === conn.fromId);
          const toWs = prev.workstations.find(w => w.id === conn.toId);
          if (fromWs && toWs) {
            const midX = (fromWs.x + fromWs.width / 2 + toWs.x + toWs.width / 2) / 2;
            const midY = (fromWs.y + fromWs.height / 2 + toWs.y + toWs.height / 2) / 2;
            // 找最近的輸送帶物件
            let minDist = Infinity;
            let nearestSpeed = CONVEYOR_META.conveyor.speed;
            for (const cv of prev.conveyors ?? []) {
              const cvMidX = (cv.x1 + cv.x2) / 2;
              const cvMidY = (cv.y1 + cv.y2) / 2;
              const d = Math.hypot(midX - cvMidX, midY - cvMidY);
              if (d < minDist) { minDist = d; nearestSpeed = cv.speed; }
            }
            extraUpdates = { speed: nearestSpeed };
          }
        }
      }
      return {
        ...prev,
        connections: prev.connections.map(c => c.id === connId ? { ...c, [field]: value, ...extraUpdates } : c),
      };
    });
    setIsDirty(true);
  };

  // ── SVG 座標轉換 ──
  const svgPoint = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ── 拖曳 ──
  const handleWsMouseDown = useCallback((e: React.MouseEvent, wsId: number) => {
    if (connectMode) { handleConnectClick(wsId); return; }
    e.stopPropagation();
    setSelectedWsId(wsId);
    const ws = layout.workstations.find(w => w.id === wsId);
    if (!ws) return;
    const pt = svgPoint(e);
    dragOffset.current = { x: pt.x - ws.x, y: pt.y - ws.y };
    setDraggingId(wsId);
  }, [connectMode, layout.workstations, svgPoint]);

  useEffect(() => {
    if (draggingId === null) return;
    const onMove = (e: MouseEvent) => {
      const pt = svgPoint(e);
      const nx = snap(pt.x - dragOffset.current.x);
      const ny = snap(pt.y - dragOffset.current.y);
      setLayout(prev => ({
        ...prev,
        workstations: prev.workstations.map(w =>
          w.id === draggingId ? { ...w, x: Math.max(0, nx), y: Math.max(0, ny) } : w
        ),
      }));
    };
    const onUp = () => {
      setDraggingId(null);
      setIsDirty(true);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [draggingId, svgPoint]);

  // ── 輸送帶物件操作 ──
  const handleAddConveyor = useCallback(() => {
    const cx = snap(pan.x > 0 ? 200 : 200);
    const cy = snap(200);
    const newConveyor: ConveyorObject = {
      id: `cv-${Date.now()}`,
      x1: snap(100), y1: snap(200),
      x2: snap(340), y2: snap(200),
      speed: 20,
      name: `輸送帶 ${(layout.conveyors?.length ?? 0) + 1}`,
      color: '#38bdf8',
    };
    setLayout(prev => ({ ...prev, conveyors: [...(prev.conveyors ?? []), newConveyor] }));
    setSelectedConveyorId(newConveyor.id);
    setSelectedWsId(null);
    setIsDirty(true);
  }, [layout.conveyors, pan]);

  const handleConveyorMouseDown = useCallback((e: React.MouseEvent, cvId: string, handle: 'body' | 'p1' | 'p2') => {
    e.stopPropagation();
    setSelectedConveyorId(cvId);
    setSelectedWsId(null);
    const cv = (layout.conveyors ?? []).find(c => c.id === cvId);
    if (!cv) return;
    const pt = svgPoint(e);
    conveyorDragStart.current = { mx: pt.x, my: pt.y, x1: cv.x1, y1: cv.y1, x2: cv.x2, y2: cv.y2 };
    setDraggingConveyor({ id: cvId, handle });
  }, [layout.conveyors, svgPoint]);

  // 輸送帶端點吸附工站的距離閾値（px）
  const CV_SNAP_DIST = 30;

  useEffect(() => {
    if (!draggingConveyor) return;
    const onMove = (e: MouseEvent) => {
      const pt = svgPoint(e);
      const dx = pt.x - conveyorDragStart.current.mx;
      const dy = pt.y - conveyorDragStart.current.my;
      setLayout(prev => ({
        ...prev,
        conveyors: (prev.conveyors ?? []).map(cv => {
          if (cv.id !== draggingConveyor.id) return cv;
          if (draggingConveyor.handle === 'body') {
            return { ...cv,
              x1: snap(conveyorDragStart.current.x1 + dx),
              y1: snap(conveyorDragStart.current.y1 + dy),
              x2: snap(conveyorDragStart.current.x2 + dx),
              y2: snap(conveyorDragStart.current.y2 + dy),
              snapFrom: undefined,
              snapTo: undefined,
            };
          } else if (draggingConveyor.handle === 'p1') {
            // 評估吸附工站
            let nx = snap(conveyorDragStart.current.x1 + dx);
            let ny = snap(conveyorDragStart.current.y1 + dy);
            let snapFrom: number | undefined = undefined;
            for (const ws of prev.workstations) {
              const cx = ws.x + ws.width / 2;
              const cy = ws.y + ws.height / 2;
              if (Math.hypot(nx - cx, ny - cy) < CV_SNAP_DIST) {
                nx = cx; ny = cy; snapFrom = ws.id; break;
              }
            }
            return { ...cv, x1: nx, y1: ny, snapFrom };
          } else {
            // 評估吸附工站
            let nx = snap(conveyorDragStart.current.x2 + dx);
            let ny = snap(conveyorDragStart.current.y2 + dy);
            let snapTo: number | undefined = undefined;
            for (const ws of prev.workstations) {
              const cx = ws.x + ws.width / 2;
              const cy = ws.y + ws.height / 2;
              if (Math.hypot(nx - cx, ny - cy) < CV_SNAP_DIST) {
                nx = cx; ny = cy; snapTo = ws.id; break;
              }
            }
            return { ...cv, x2: nx, y2: ny, snapTo };
          }
        }),
      }));
    };
    const onUp = () => { setDraggingConveyor(null); setIsDirty(true); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [draggingConveyor, svgPoint]);

  const handleDeleteConveyor = useCallback((cvId: string) => {
    setLayout(prev => ({ ...prev, conveyors: (prev.conveyors ?? []).filter(c => c.id !== cvId) }));
    setSelectedConveyorId(null);
    setIsDirty(true);
  }, []);

  // ── 畫布平移 ──
  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== svgRef.current && (e.target as Element).tagName !== "rect") return;
    // 點擊空白處清除輸送帶選取
    setSelectedConveyorId(null);
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  }, [pan]);

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      setPan({
        x: panStart.current.px + (e.clientX - panStart.current.x),
        y: panStart.current.py + (e.clientY - panStart.current.y),
      });
    };
    const onUp = () => setIsPanning(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [isPanning]);

  // ── 滾輪縮放 ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta)));
  }, []);

  // ── 比例尺（px/m）
  const [scalePxPerM, setScalePxPerM] = useState(DEFAULT_SCALE_PX_PER_M);
  // ── KPI ──
  const kpi = useMemo(
    () => calcKPI(layout.workstations, layout.connections, scalePxPerM, taktTime),
    [layout.workstations, layout.connections, scalePxPerM, taktTime]
  );
  const maxCt = kpi?.maxCt ?? 0;

  const selectedWs = layout.workstations.find(w => w.id === selectedWsId);

  // ── 套用至產線的變更清單 ──
  const applyChanges = useMemo(() => {
    if (!layout.workstations.length || !lineWorkstations) return [];
    const changes: Array<{ type: string; name: string; detail: string }> = [];
    for (const simWs of layout.workstations) {
      const ct = Math.max(simWs.operatorTime, simWs.machineTime);
      if (simWs.id > 0) {
        const existing = lineWorkstations.find(w => w.id === simWs.id);
        if (existing) {
          const diffs: string[] = [];
          if (Math.abs(parseFloat(existing.cycleTime.toString()) - ct) > 0.01) diffs.push(`CT: ${parseFloat(existing.cycleTime.toString()).toFixed(1)}→${ct.toFixed(1)}s`);
          if (Math.abs(parseFloat(existing.manpower.toString()) - simWs.manpower) > 0.01) diffs.push(`人力: ${parseFloat(existing.manpower.toString())}→${simWs.manpower}人`);
          if (existing.name !== simWs.name) diffs.push(`名稱: ${existing.name}→${simWs.name}`);
          if (diffs.length > 0) changes.push({ type: "update", name: simWs.name, detail: diffs.join("、") });
        } else {
          changes.push({ type: "add", name: simWs.name, detail: `CT: ${ct}s，人力: ${simWs.manpower}人` });
        }
      } else {
        changes.push({ type: "add", name: simWs.name, detail: `CT: ${ct}s，人力: ${simWs.manpower}人` });
      }
    }
    const simIds = new Set(layout.workstations.filter(w => w.id > 0).map(w => w.id));
    for (const ew of lineWorkstations) {
      if (!simIds.has(ew.id)) changes.push({ type: "remove", name: ew.name, detail: "從產線移除" });
    }
    return changes;
  }, [layout.workstations, lineWorkstations]);

  // ── 自動排列 ──
  const handleAutoLayout = () => {
    const sorted = [...layout.workstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const cols = Math.ceil(Math.sqrt(sorted.length));
    const updated = sorted.map((w, i) => ({
      ...w,
      x: snap(80 + (i % cols) * (WS_W + 60)),
      y: snap(80 + Math.floor(i / cols) * (WS_H + 80)),
    }));
    setLayout(prev => ({ ...prev, workstations: updated }));
    setIsDirty(true);
    toast.success("已自動排列工站");
  };

  // ── 重置視圖 ──
  const handleResetView = () => { setZoom(1); setPan({ x: 40, y: 40 }); };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Header ── */}
      <div className="border-b border-border bg-card/80 backdrop-blur px-4 py-2.5 flex items-center gap-3 shrink-0 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/lines")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <FlaskConical className="w-5 h-5 text-primary" />
        <span className="font-bold text-foreground">產線平面圖模擬器</span>
        {isDirty && <Badge variant="outline" className="text-amber-400 border-amber-400/40 text-xs">未儲存</Badge>}

        <div className="flex-1" />

        {/* 產線選擇 */}
        <Select value={selectedLineId?.toString() ?? ""} onValueChange={v => {
          setSelectedLineId(parseInt(v));
          setSelectedScenarioId(null);
          setLayout({ workstations: [], connections: [] });
          setIsDirty(false);
        }}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="選擇產線..." />
          </SelectTrigger>
          <SelectContent>
            {lines?.map(l => <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* 情境選擇 */}
        {selectedLineId && (
          <Select value={selectedScenarioId?.toString() ?? ""} onValueChange={v => handleSelectScenario(parseInt(v))}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="選擇情境..." />
            </SelectTrigger>
            <SelectContent>
              {scenarios?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {selectedLineId && (
          <>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={handleLoadFromLine}>
              <Upload className="w-3.5 h-3.5" />套用產線參數
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-3.5 h-3.5" />新建情境
            </Button>
          </>
        )}
        {isDirty && selectedScenarioId && (
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            儲存
          </Button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── 左側工具列 ── */}
        <div className="w-12 border-r border-border bg-card/50 flex flex-col items-center py-3 gap-2 shrink-0">
          <Button size="icon" variant={connectMode ? "default" : "ghost"} className="h-9 w-9"
            title={connectMode ? "退出連線模式" : "連線模式"}
            onClick={() => { setConnectMode(v => !v); setConnectFrom(null); }}>
            {connectMode ? <Link2Off className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9" title="新增工站"
            onClick={() => setShowAddWsDialog(true)}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9" title="新增輸送帶"
            onClick={handleAddConveyor}>
            <MoveHorizontal className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9" title="自動排列"
            onClick={handleAutoLayout}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <div className="flex-1" />
          <Button size="icon" variant="ghost" className="h-9 w-9" title="縮小"
            onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * 0.8))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9" title="放大"
            onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.25))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9" title="重置視圖"
            onClick={handleResetView}>
            <Maximize2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant={animating ? "default" : "ghost"} className="h-9 w-9"
            title={animating ? "暫停動畫" : "播放動畫"}
            onClick={() => setAnimating(v => !v)}>
            {animating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant={showGrid ? "default" : "ghost"} className="h-9 w-9"
            title="格線" onClick={() => setShowGrid(v => !v)}>
            <LayoutGrid className="w-3.5 h-3.5 opacity-60" />
          </Button>
        </div>

        {/* ── 主畫布 ── */}
        <div className="flex-1 relative overflow-hidden bg-[#0d1117]"
          style={{ cursor: connectMode ? "crosshair" : isPanning ? "grabbing" : draggingId ? "grabbing" : "grab" }}>

          {/* 連線模式提示 */}
          {connectMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-lg">
              {connectFrom === null ? "點擊起始工站" : "點擊目標工站完成連線（再次點擊起始站取消）"}
            </div>
          )}

          {/* 縮放比例 */}
          <div className="absolute bottom-3 left-3 z-10 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded">
            {Math.round(zoom * 100)}%
          </div>

          <svg
            ref={svgRef}
            className="w-full h-full select-none"
            onMouseDown={handleSvgMouseDown}
            onWheel={handleWheel}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* 格線 */}
              {showGrid && (
                <g opacity="0.15">
                  {Array.from({ length: 80 }, (_, i) => (
                    <line key={`v${i}`} x1={i * GRID} y1={0} x2={i * GRID} y2={3000} stroke="#334155" strokeWidth="0.5" />
                  ))}
                  {Array.from({ length: 80 }, (_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * GRID} x2={3000} y2={i * GRID} stroke="#334155" strokeWidth="0.5" />
                  ))}
                </g>
              )}

              <ArrowDefs />

              {/* 物流動線 */}
              {layout.connections.map(conn => {
                const fromWs = layout.workstations.find(w => w.id === conn.fromId);
                const toWs = layout.workstations.find(w => w.id === conn.toId);
                if (!fromWs || !toWs) return null;
                const pathD = makePath(fromWs, toWs);
                const fromCt = Math.max(fromWs.operatorTime, fromWs.machineTime);
                // 輸送帶類型樣式
                const ctype = conn.conveyorType ?? 'manual';
                const cmeta = CONVEYOR_META[ctype];
                const animDur = Math.max(0.3, fromCt / (conn.speed > 0 ? conn.speed : 10));
                const midX = (fromWs.x + fromWs.width / 2 + toWs.x + toWs.width / 2) / 2;
                const midY = (fromWs.y + fromWs.height / 2 + toWs.y + toWs.height / 2) / 2;
                // 即時計算距離與搬運時間
                const metrics = computeConnMetrics(conn, layout.workstations, scalePxPerM);
                const isSelected = editingConn?.id === conn.id;
                return (
                  <g key={conn.id} onClick={() => { setEditingConn(conn); setShowConnDialog(true); }}>
                    {/* 底部寬路徑（點擊區域） */}
                    <path d={pathD} fill="none" stroke="transparent" strokeWidth="14" className="cursor-pointer" />
                    {/* 選取光暈 */}
                    {isSelected && (
                      <path d={pathD} fill="none" stroke={cmeta.color} strokeWidth="5" opacity="0.3" />
                    )}
                    {/* 可見路徑 */}
                    <path d={pathD} fill="none"
                      stroke={cmeta.color}
                      strokeWidth={1.5}
                      strokeDasharray={cmeta.dash}
                      opacity="0.75"
                      markerEnd={`url(#arrow-${cmeta.markerSuffix})`} />
                  </g>
                );
              })}

              {/* 連線標籤層（在路徑上方、動畫下方） */}
              {layout.connections.map(conn => {
                const fromWs = layout.workstations.find(w => w.id === conn.fromId);
                const toWs = layout.workstations.find(w => w.id === conn.toId);
                if (!fromWs || !toWs) return null;
                const ctype = conn.conveyorType ?? 'manual';
                const cmeta = CONVEYOR_META[ctype];
                const midX = (fromWs.x + fromWs.width / 2 + toWs.x + toWs.width / 2) / 2;
                const midY = (fromWs.y + fromWs.height / 2 + toWs.y + toWs.height / 2) / 2;
                const metrics = computeConnMetrics(conn, layout.workstations, scalePxPerM);
                if (metrics.distance <= 0) return null;
                 // 查找指定的輸送帶物件
                 const refCv = conn.conveyorRef
                   ? (layout.conveyors ?? []).find(c => c.id === conn.conveyorRef)
                   : undefined;
                 const labelH = refCv ? 42 : 30;
                 return (
                   <g key={`label-${conn.id}`} style={{ pointerEvents: 'none' }}>
                     <rect x={midX - 32} y={midY - 23} width={64} height={labelH} rx={5}
                       fill="#0d1117" stroke={cmeta.color} strokeWidth="0.8" opacity="0.92" />
                     <text x={midX} y={midY - 11} textAnchor="middle" fill={cmeta.color} fontSize="9" fontWeight="700">
                       {cmeta.label}
                     </text>
                     <text x={midX} y={midY + 2} textAnchor="middle" fill="#cbd5e1" fontSize="9">
                       {metrics.distance.toFixed(1)}m / {metrics.transportTime.toFixed(1)}s
                     </text>
                     {refCv && (
                       <text x={midX} y={midY + 13} textAnchor="middle" fontSize="8" fontWeight="600"
                         fill={refCv.color}>
                         ≡ {refCv.name}
                       </text>
                     )}
                   </g>
                 );
              })}

              {/* 動畫小點層（在標籤上方、工站節點下方） */}
              {animating && layout.connections.map(conn => {
                const fromWs = layout.workstations.find(w => w.id === conn.fromId);
                const toWs = layout.workstations.find(w => w.id === conn.toId);
                if (!fromWs || !toWs) return null;
                const pathD = makePath(fromWs, toWs);
                const fromCt = Math.max(fromWs.operatorTime, fromWs.machineTime);
                const ctype = conn.conveyorType ?? 'manual';
                const cmeta = CONVEYOR_META[ctype];
                // 輸送帶已有滾輪動畫，不需要額外的動畫小點
                if (ctype === 'conveyor') return null;
                const animDur = Math.max(0.3, fromCt / (conn.speed > 0 ? conn.speed : 10));
                return <AnimDot key={`anim-${conn.id}`} path={pathD} duration={animDur} color={cmeta.color} />;
              })}

              {/* 工站節點 */}
              {/* ── 輸送帶獨立物件層 ── */}
              {(layout.conveyors ?? []).map(cv => {
                const isSelCV = selectedConveyorId === cv.id;
                const len = Math.hypot(cv.x2 - cv.x1, cv.y2 - cv.y1);
                const angle = Math.atan2(cv.y2 - cv.y1, cv.x2 - cv.x1) * 180 / Math.PI;
                const cx = (cv.x1 + cv.x2) / 2;
                const cy = (cv.y1 + cv.y2) / 2;
                const animSpeed = cv.speed >= 30 ? '0.4' : cv.speed >= 12 ? '0.8' : '1.6';
                return (
                  <g key={cv.id}
                    onMouseDown={e => handleConveyorMouseDown(e, cv.id, 'body')}
                    onClick={e => { e.stopPropagation(); setSelectedConveyorId(cv.id); setSelectedWsId(null); }}
                    style={{ cursor: draggingConveyor?.id === cv.id ? 'grabbing' : 'grab' }}>
                    {/* 選取光暈 */}
                    {isSelCV && (
                      <line x1={cv.x1} y1={cv.y1} x2={cv.x2} y2={cv.y2}
                        stroke={cv.color} strokeWidth="22" opacity="0.2" strokeLinecap="round" />
                    )}
                    {/* 輸送帶底帶（深色本體） */}
                    <line x1={cv.x1} y1={cv.y1} x2={cv.x2} y2={cv.y2}
                      stroke="#0f2a3a" strokeWidth="16" strokeLinecap="round" />
                    {/* 滾輪紋路動畫 */}
                    <line x1={cv.x1} y1={cv.y1} x2={cv.x2} y2={cv.y2}
                      stroke={cv.color} strokeWidth="12" strokeLinecap="round"
                      strokeDasharray="4 8" opacity="0.7"
                      style={{ animation: `conveyor-roll ${animSpeed}s linear infinite` }} />
                    {/* 上邊框 */}
                    <line x1={cv.x1} y1={cv.y1} x2={cv.x2} y2={cv.y2}
                      stroke={cv.color} strokeWidth="1.5" strokeLinecap="round" opacity="0.9"
                      transform={`translate(${Math.sin(angle * Math.PI / 180) * -7},${-Math.cos(angle * Math.PI / 180) * -7})`} />
                    {/* 下邊框 */}
                    <line x1={cv.x1} y1={cv.y1} x2={cv.x2} y2={cv.y2}
                      stroke={cv.color} strokeWidth="1.5" strokeLinecap="round" opacity="0.9"
                      transform={`translate(${Math.sin(angle * Math.PI / 180) * 7},${Math.cos(angle * Math.PI / 180) * -7})`} />
                    {/* 方向筭頭 */}
                    <line x1={cv.x1} y1={cv.y1} x2={cv.x2} y2={cv.y2}
                      stroke={cv.color} strokeWidth="1.5" strokeLinecap="round" opacity="0.9"
                      markerEnd={`url(#arrow-cyan)`} />
                    {/* 名稱標籤 */}
                    <text x={cx} y={cy - 12} textAnchor="middle"
                      fill={cv.color} fontSize="10" fontWeight="700"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      {cv.name}
                    </text>
                    <text x={cx} y={cy + 22} textAnchor="middle"
                      fill="#94a3b8" fontSize="9"
                      style={{ userSelect: 'none', pointerEvents: 'none' }}>
                      {cv.speed} m/min · {(len / scalePxPerM).toFixed(1)} m
                    </text>
                    {/* 端點把手已移至最上層（cv-handles 層），此處不重複渲染 */}
                  </g>
                );
              })}

              {layout.workstations.map(ws => {
                const ct = Math.max(ws.operatorTime, ws.machineTime);
                const colors = getWsColor(ws, maxCt, taktTime);
                const isSelected = selectedWsId === ws.id;
                const isConnFrom = connectFrom === ws.id;
                const ctRatio = maxCt > 0 ? ct / maxCt : 0;
                const barW = (ws.width - 16) * ctRatio;

                return (
                  <g key={ws.id}
                    transform={`translate(${ws.x},${ws.y})`}
                    onMouseDown={e => handleWsMouseDown(e, ws.id)}
                    style={{ cursor: connectMode ? "pointer" : draggingId === ws.id ? "grabbing" : "grab" }}>
                    {/* 選取光暈 */}
                    {(isSelected || isConnFrom) && (
                      <rect x={-4} y={-4} width={ws.width + 8} height={ws.height + 8}
                        rx={12} fill="none"
                        stroke={isConnFrom ? "#a78bfa" : "#38bdf8"}
                        strokeWidth="2" strokeDasharray={isConnFrom ? "6 3" : "none"}
                        opacity="0.8" />
                    )}
                    {/* 主體 */}
                    <rect x={0} y={0} width={ws.width} height={ws.height}
                      rx={8} fill={colors.bg} stroke={colors.border} strokeWidth="1.5" />
                    {/* CT 進度條 */}
                    <rect x={8} y={ws.height - 12} width={ws.width - 16} height={6} rx={3} fill="#1e293b" />
                    <rect x={8} y={ws.height - 12} width={barW} height={6} rx={3} fill={colors.border} opacity="0.8" />
                    {/* 工站名稱 */}
                    <text x={ws.width / 2} y={22} textAnchor="middle"
                      fill={colors.text} fontSize="12" fontWeight="600"
                      style={{ userSelect: "none" }}>
                      {ws.name.length > 14 ? ws.name.substring(0, 14) + "…" : ws.name}
                    </text>
                    {/* CT 值 */}
                    <text x={ws.width / 2} y={40} textAnchor="middle"
                      fill={colors.border} fontSize="13" fontWeight="700"
                      style={{ userSelect: "none" }}>
                      {ct.toFixed(1)}s
                    </text>
                    {/* 人員與設備圖示列 */}
                    {(() => {
                      const opCnt = ws.operatorCount ?? 1;
                      const mcCnt = ws.machineCount ?? 1;
                      const perOpCt = opCnt > 0 ? ws.operatorTime / opCnt : ws.operatorTime;
                      const opOverload = (taktTime ?? 0) > 0 && perOpCt > (taktTime ?? 0);
                      const opColor = opOverload ? '#f87171' : '#34d399';
                      const machUtil = mcCnt > 0 && ws.operatorTime > 0 ? ws.machineTime / (ws.operatorTime * mcCnt) : 0;
                      const mcColor = machUtil > 0.9 ? '#f87171' : machUtil > 0.7 ? '#fbbf24' : '#60a5fa';
                      const maxShow = 5;
                      const showOp = Math.min(opCnt, maxShow);
                      const extraOp = opCnt > maxShow ? opCnt - maxShow : 0;
                      const maxShowMc = 3;
                      const showMc = Math.min(mcCnt, maxShowMc);
                      const extraMc = mcCnt > maxShowMc ? mcCnt - maxShowMc : 0;
                      // 人員圖示列起始 Y：在名稱+CT 之後，進度條之前
                      const opIconY = 50;
                      const mcIconY = opIconY + 16; // 設備圖示列在人員圖示列下方
                      return (
                        <g>
                          {/* 人員圖示列 */}
                          {Array.from({ length: showOp }).map((_, idx) => (
                            <circle key={`op-${idx}`}
                              cx={10 + idx * 13} cy={opIconY} r={5}
                              fill={opColor} opacity={0.85} />
                          ))}
                          {extraOp > 0 && (
                            <text x={10 + showOp * 13} y={opIconY + 4} fill={opColor} fontSize="8" fontWeight="600">
                              +{extraOp}
                            </text>
                          )}
                          <text x={10 + showOp * 13 + (extraOp > 0 ? 14 : 4)} y={opIconY + 4}
                            fill="#94a3b8" fontSize="8">
                            {opCnt}人
                          </text>
                          {/* 設備圖示列 */}
                          {mcCnt > 0 && (
                            <g>
                              {Array.from({ length: showMc }).map((_, idx) => (
                                <rect key={`mc-${idx}`}
                                  x={10 + idx * 13} y={mcIconY - 6} width={10} height={8}
                                  rx={2} fill={mcColor} opacity={0.85} />
                              ))}
                              {extraMc > 0 && (
                                <text x={10 + showMc * 13} y={mcIconY + 2} fill={mcColor} fontSize="8" fontWeight="600">
                                  +{extraMc}
                                </text>
                              )}
                              <text x={10 + showMc * 13 + (extraMc > 0 ? 14 : 4)} y={mcIconY + 2}
                                fill="#94a3b8" fontSize="8">
                                {mcCnt}台
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })()}
                    {/* 序號徽章 */}
                    <rect x={ws.width - 22} y={4} width={18} height={16} rx={4} fill={colors.badge} />
                    <text x={ws.width - 13} y={15} textAnchor="middle"
                      fill={colors.badgeText} fontSize="9" fontWeight="700"
                      style={{ userSelect: "none" }}>
                      {ws.sequenceOrder + 1}
                    </text>
                  </g>
                );
              })}

              {/* ── 輸送帶端點把手層（最上層，避免被工站遮住）── */}
              {(layout.conveyors ?? []).map(cv => {
                const isSelCV = selectedConveyorId === cv.id;
                const snapFromWs = cv.snapFrom != null ? layout.workstations.find(w => w.id === cv.snapFrom) : null;
                const snapToWs = cv.snapTo != null ? layout.workstations.find(w => w.id === cv.snapTo) : null;
                return (
                  <g key={`cv-handles-${cv.id}`}>
                    {snapFromWs && (
                      <circle cx={snapFromWs.x + snapFromWs.width / 2} cy={snapFromWs.y + snapFromWs.height / 2}
                        r={28} fill="none" stroke={cv.color} strokeWidth="2" strokeDasharray="4 3" opacity="0.8"
                        style={{ pointerEvents: 'none' }} />
                    )}
                    {snapToWs && (
                      <circle cx={snapToWs.x + snapToWs.width / 2} cy={snapToWs.y + snapToWs.height / 2}
                        r={28} fill="none" stroke={cv.color} strokeWidth="2" strokeDasharray="4 3" opacity="0.8"
                        style={{ pointerEvents: 'none' }} />
                    )}
                    <circle cx={cv.x1} cy={cv.y1} r={cv.snapFrom != null ? 9 : 7}
                      fill={cv.snapFrom != null ? cv.color : (isSelCV ? cv.color : '#1e293b')}
                      stroke={cv.color} strokeWidth="2"
                      style={{ cursor: 'nwse-resize' }}
                      onMouseDown={e => handleConveyorMouseDown(e, cv.id, 'p1')} />
                    <circle cx={cv.x2} cy={cv.y2} r={cv.snapTo != null ? 9 : 7}
                      fill={cv.snapTo != null ? cv.color : (isSelCV ? cv.color : '#1e293b')}
                      stroke={cv.color} strokeWidth="2"
                      style={{ cursor: 'nwse-resize' }}
                      onMouseDown={e => handleConveyorMouseDown(e, cv.id, 'p2')} />
                  </g>
                );
              })}

            </g>
          </svg>
          {/* 空畫布提示 */}
          {!layout.workstations.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <FlaskConical className="w-16 h-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground/50 text-sm">請選擇產線並點擊「套用產線參數」，或手動新增工站</p>
            </div>
          )}
        </div>

        {/* ── 右側面板 ── */}
        <div className="relative border-l border-border bg-card/50 flex flex-col overflow-hidden shrink-0"
          style={{ width: rightPanelWidth }}>
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-cyan-400/40 active:bg-cyan-400/60 transition-colors z-20"
            onMouseDown={handlePanelResizeStart}
            title="拖曳調整寬度"
          />
          {/* KPI 儀表板 */}
          {kpi && (
            <div className="border-b border-border">
              {/* KPI 標題列 */}
              <div className="flex items-center justify-between px-3 py-2 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                onClick={() => setKpiCollapsed(v => !v)}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">即時 KPI</p>
                <span className={`text-muted-foreground transition-transform duration-200 ${kpiCollapsed ? '' : 'rotate-180'}`}
                  style={{ fontSize: 10 }}>&#9650;</span>
              </div>
              {!kpiCollapsed && (
              <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: BarChart3, label: "平衡率", value: `${kpi.balanceRate.toFixed(1)}%`, color: kpi.balanceRate >= 85 ? "text-emerald-400" : kpi.balanceRate >= 70 ? "text-amber-400" : "text-red-400" },
                  { icon: AlertTriangle, label: "瓶頸 CT", value: `${kpi.maxCt.toFixed(1)}s`, color: "text-orange-400" },
                  { icon: Zap, label: "UPPH", value: kpi.upph.toFixed(2), color: "text-amber-400" },
                  { icon: TrendingUp, label: "產能", value: `${kpi.capacity.toFixed(0)}/h`, color: "text-cyan-400" },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="bg-background/50 rounded-lg p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Icon className={`w-3 h-3 ${color}`} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <p className={`text-base font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              {kpi.taktStats && (
                <div className="bg-background/50 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Target className="w-3 h-3 text-violet-400" />Takt 達標率
                    </span>
                    <span className={`text-sm font-bold ${kpi.taktStats.passRate >= 80 ? "text-emerald-400" : "text-red-400"}`}>
                      {kpi.taktStats.passRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${kpi.taktStats.passRate >= 80 ? "bg-emerald-400" : "bg-red-400"}`}
                      style={{ width: `${kpi.taktStats.passRate}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {kpi.taktStats.passCount} 站達標 / {kpi.taktStats.exceedCount} 站超出
                    {taktTime && ` (Takt: ${taktTime}s)`}
                  </p>
                </div>
              )}
              {kpi.bottleneck && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                  <p className="text-xs text-orange-400 font-medium">⚠ 瓶頃：{kpi.bottleneck.name}</p>
                  <p className="text-xs text-muted-foreground">CT {kpi.maxCt.toFixed(1)}s（均値 {kpi.avgCt.toFixed(1)}s）</p>
                </div>
              )}
              {/* 搜運指標 */}
              {kpi.avgTransportTime > 0 && (
                <div className="bg-background/50 rounded-lg p-2 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">物流搜運</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">平均搜運時間</p>
                      <p className="text-sm font-bold text-sky-400">{kpi.avgTransportTime.toFixed(1)}s</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">物流等待佔比</p>
                      <p className={`text-sm font-bold ${kpi.logisticsWaitRatio > 20 ? 'text-red-400' : kpi.logisticsWaitRatio > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {kpi.logisticsWaitRatio.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-sky-400" style={{ width: `${Math.min(kpi.logisticsWaitRatio, 100)}%` }} />
                  </div>
                </div>
              )}
              {/* 人力與設備統計 */}
              <div className="bg-background/50 rounded-lg p-2 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">人力與設備</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">總人員數</p>
                    <p className="text-sm font-bold text-emerald-400">{kpi.totalOperators}人</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">總設備數</p>
                    <p className="text-sm font-bold text-blue-400">{kpi.totalMachines}台</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">人均 UPPH</p>
                    <p className="text-sm font-bold text-amber-400">{kpi.upphPerOperator.toFixed(2)}</p>
                  </div>
                  {kpi.avgMachineUtil > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground">平均設備利用率</p>
                      <p className={`text-sm font-bold ${
                        kpi.avgMachineUtil > 90 ? 'text-red-400' :
                        kpi.avgMachineUtil > 70 ? 'text-amber-400' : 'text-emerald-400'
                      }`}>{kpi.avgMachineUtil.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
                {kpi.avgMachineUtil > 0 && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      kpi.avgMachineUtil > 90 ? 'bg-red-400' :
                      kpi.avgMachineUtil > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} style={{ width: `${Math.min(kpi.avgMachineUtil, 100)}%` }} />
                  </div>
                )}
              </div>
              {/* 平衡圖（堆疊柱狀圖） */}
              {layout.workstations.length > 0 && (() => {
                const sorted = [...layout.workstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
                const barData = sorted.map(ws => {
                  const ct = Math.max(ws.operatorTime, ws.machineTime);
                  const incomingConns = layout.connections.filter(c => c.toId === ws.id);
                  const transportT = incomingConns.reduce((s, c) => {
                    const m = computeConnMetrics(c, layout.workstations, scalePxPerM);
                    return s + m.transportTime;
                  }, 0);
                  return { name: ws.name, ct, transportT, total: ct + transportT };
                });
                const maxTotal = Math.max(...barData.map(d => d.total), taktTime ?? 0, 1);
                const chartW = 220;
                const chartH = 100;
                const barW = Math.max(6, Math.floor((chartW - 16) / barData.length) - 2);
                const gap = Math.max(2, Math.floor((chartW - 16 - barW * barData.length) / Math.max(barData.length - 1, 1)));
                const hasTransport = barData.some(d => d.transportT > 0);
                return (
                  <div className="bg-background/50 rounded-lg overflow-hidden">
                    {/* 平衡圖標題列 */}
                    <div className="flex items-center justify-between px-2 py-1.5 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                      onClick={() => setBalanceCollapsed(v => !v)}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">平衡圖</p>
                      <span className={`text-muted-foreground transition-transform duration-200 ${balanceCollapsed ? '' : 'rotate-180'}`}
                        style={{ fontSize: 10 }}>&#9650;</span>
                    </div>
                    {!balanceCollapsed && (
                    <div className="px-2 pb-2">
                    <svg width={chartW} height={chartH + 20} className="w-full">
                      {/* Takt Time 參考線 */}
                      {taktTime && taktTime > 0 && (
                        <line
                          x1={8} y1={chartH - (taktTime / maxTotal) * (chartH - 8)}
                          x2={chartW - 8} y2={chartH - (taktTime / maxTotal) * (chartH - 8)}
                          stroke="#a78bfa" strokeWidth="1" strokeDasharray="4 2" opacity="0.8" />
                      )}
                      {/* 柱狀圖 */}
                      {barData.map((d, i) => {
                        const x = 8 + i * (barW + gap);
                        const ctH = (d.ct / maxTotal) * (chartH - 8);
                        const tH = (d.transportT / maxTotal) * (chartH - 8);
                        const totalH = ctH + tH;
                        const isBottleneck = d.ct === kpi.maxCt;
                        const ctColor = isBottleneck ? '#fb923c' : d.ct > (taktTime ?? Infinity) ? '#f87171' : '#38bdf8';
                        return (
                          <g key={i}>
                            {/* CT 區塊 */}
                            <rect x={x} y={chartH - totalH} width={barW} height={ctH}
                              fill={ctColor} opacity={0.8} rx={isBottleneck ? 2 : 1} />
                            {/* 搜運時間區塊 */}
                            {tH > 0 && (
                              <rect x={x} y={chartH - tH} width={barW} height={tH}
                                fill="#f59e0b" opacity={0.6} rx={1} />
                            )}
                            {/* 工站名稱 */}
                            <text x={x + barW / 2} y={chartH + 14}
                              textAnchor="middle" fill="#64748b" fontSize="7"
                              style={{ userSelect: 'none' }}>
                              {d.name.length > 4 ? d.name.substring(0, 4) + '…' : d.name}
                            </text>
                          </g>
                        );
                      })}
                      {/* Y 軸最大値 */}
                      <text x={6} y={10} fill="#64748b" fontSize="7" textAnchor="middle">{maxTotal.toFixed(0)}s</text>
                    </svg>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                      <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-sky-400/80"></span>CT</span>
                      {hasTransport && <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400/60"></span>搜運時間</span>}
                      {taktTime && <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-violet-400/60"></span>Takt</span>}
                    </div>
                    </div>
                    )}
                  </div>
                );
              })()}

              {/* 比例尺設定 */}
              <div className="bg-background/50 rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">畫布比例尺</p>
                  <div className="flex items-center gap-1">
                    <Input type="number" min="1" max="100" step="1"
                      value={scalePxPerM}
                      className="h-6 w-14 text-xs px-1"
                      onChange={e => setScalePxPerM(Math.max(1, parseInt(e.target.value) || 10))} />
                    <span className="text-xs text-muted-foreground">px/m</span>
                  </div>
                </div>
              </div>
              </div>
              )}
            </div>
          )}

          {/* 工站屬性面板 */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* 輸送帶屬性面板 */}
            {selectedConveyorId && !selectedWsId && (() => {
              const cv = (layout.conveyors ?? []).find(c => c.id === selectedConveyorId);
              if (!cv) return null;
              const len = Math.hypot(cv.x2 - cv.x1, cv.y2 - cv.y1);
              const updateCv = (field: keyof ConveyorObject, value: any) => {
                setLayout(prev => {
                  const updatedConveyors = (prev.conveyors ?? []).map(c => c.id === cv.id ? { ...c, [field]: value } : c);
                  // 當速度更新時，同步更新所有綁定此輸送帶的連線速度
                  const updatedConnections = field === 'speed'
                    ? prev.connections.map(conn =>
                        conn.conveyorRef === cv.id ? { ...conn, speed: value as number } : conn
                      )
                    : prev.connections;
                  return { ...prev, conveyors: updatedConveyors, connections: updatedConnections };
                });
                setIsDirty(true);
              };
              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: cv.color }}>輸送帶屬性</p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400"
                        onClick={() => { if (confirm(`確定刪除「${cv.name}」？`)) handleDeleteConveyor(cv.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setSelectedConveyorId(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  {/* 名稱 */}
                  <div>
                    <Label className="text-xs text-muted-foreground">輸送帶名稱</Label>
                    <Input value={cv.name} className="mt-1 h-8 text-sm"
                      onChange={e => updateCv('name', e.target.value)} />
                  </div>
                  {/* 速度 */}
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">輸送速度（m/min）</Label>
                      <div className="flex items-center gap-1.5">
                        <Input type="number" min="1" max="120" step="1"
                          value={cv.speed}
                          className="h-7 text-sm w-20 text-right"
                          onChange={e => updateCv('speed', Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))} />
                      </div>
                    </div>
                    <Slider
                      min={1} max={120} step={1}
                      value={[cv.speed]}
                      onValueChange={([v]) => updateCv('speed', v)}
                      className="mt-2" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>1 m/min (慢)</span>
                      <span>60 m/min (一般)</span>
                      <span>120 m/min (高速)</span>
                    </div>
                  </div>
                  {/* 顏色選擇 */}
                  <div>
                    <Label className="text-xs text-muted-foreground">輸送帶顏色</Label>
                    <div className="flex gap-2 mt-1">
                      {['#38bdf8', '#4ade80', '#fb923c', '#a78bfa', '#f472b6'].map(c => (
                        <button key={c} className="w-7 h-7 rounded-full border-2 transition-transform"
                          style={{ background: c, borderColor: cv.color === c ? '#fff' : 'transparent',
                            transform: cv.color === c ? 'scale(1.2)' : 'scale(1)' }}
                          onClick={() => updateCv('color', c)} />
                      ))}
                    </div>
                  </div>
                  {/* 資訊卡片 */}
                  <div className="bg-background/50 rounded-lg p-3 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">長度</p>
                      <p className="text-base font-bold" style={{ color: cv.color }}>
                        {(len / scalePxPerM).toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-0.5">m</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">過境時間</p>
                      <p className="text-base font-bold" style={{ color: cv.color }}>
                        {((len / scalePxPerM) / cv.speed * 60).toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-0.5">s</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">角度</p>
                      <p className="text-base font-bold" style={{ color: cv.color }}>
                        {Math.round(Math.atan2(cv.y2 - cv.y1, cv.x2 - cv.x1) * 180 / Math.PI)}<span className="text-xs font-normal text-muted-foreground ml-0.5">°</span>
                      </p>
                    </div>
                  </div>
                  {/* 輸送帶預覽 SVG */}
                  <div className="rounded-lg overflow-hidden border border-border/40">
                    <svg width="100%" height="28" viewBox="0 0 200 28">
                      <rect x="0" y="4" width="200" height="20" fill="#0f2a3a" />
                      <rect x="0" y="4" width="200" height="20" fill={cv.color}
                        strokeDasharray="4 8"
                        style={{ stroke: cv.color, strokeWidth: 10, strokeDashoffset: 0,
                          animation: `conveyor-roll ${
                            cv.speed >= 30 ? '0.4' : cv.speed >= 12 ? '0.8' : '1.6'
                          }s linear infinite` }} />
                      <line x1="0" y1="14" x2="200" y2="14" stroke={cv.color} strokeWidth="1.5" opacity="0.9" />
                      <text x="100" y="18" textAnchor="middle" fill={cv.color} fontSize="8" fontWeight="600">
                        {cv.speed} m/min →
                      </text>
                    </svg>
                  </div>
                </div>
              );
            })()}

            {selectedWs ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">工站屬性</p>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400"
                      onClick={() => { if (confirm(`確定刪除「${selectedWs.name}」？`)) handleDeleteWs(selectedWs.id); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6"
                      onClick={() => setSelectedWsId(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* 名稱 */}
                <div>
                  <Label className="text-xs text-muted-foreground">工站名稱</Label>
                  <Input value={selectedWs.name} className="mt-1 h-8 text-sm"
                    onChange={e => updateWsProp(selectedWs.id, "name", e.target.value)} />
                </div>

                {/* 人員作業時間 */}
                <div className="bg-background/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <Label className="text-xs font-medium text-blue-400">人員作業時間</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" step="0.1"
                      value={selectedWs.operatorTime}
                      className="h-7 text-sm w-20"
                      onChange={e => updateWsProp(selectedWs.id, "operatorTime", parseFloat(e.target.value) || 0)} />
                    <span className="text-xs text-muted-foreground">秒</span>
                  </div>
                  <Slider
                    value={[selectedWs.operatorTime]}
                    min={0} max={Math.max(300, selectedWs.operatorTime * 1.5)} step={0.5}
                    onValueChange={([v]) => updateWsProp(selectedWs.id, "operatorTime", v)}
                    className="mt-1" />
                </div>

                {/* 設備作業時間 */}
                <div className="bg-background/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-violet-400" />
                    <Label className="text-xs font-medium text-violet-400">設備作業時間</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" step="0.1"
                      value={selectedWs.machineTime}
                      className="h-7 text-sm w-20"
                      onChange={e => updateWsProp(selectedWs.id, "machineTime", parseFloat(e.target.value) || 0)} />
                    <span className="text-xs text-muted-foreground">秒</span>
                  </div>
                  <Slider
                    value={[selectedWs.machineTime]}
                    min={0} max={Math.max(300, selectedWs.machineTime * 1.5)} step={0.5}
                    onValueChange={([v]) => updateWsProp(selectedWs.id, "machineTime", v)}
                    className="mt-1" />
                  <p className="text-xs text-muted-foreground">
                    工序時間 = max(人員, 設備) = <strong className="text-foreground">{Math.max(selectedWs.operatorTime, selectedWs.machineTime).toFixed(1)}s</strong>
                  </p>
                </div>

                {/* 人力 */}
                <div className="bg-background/50 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <Label className="text-xs font-medium text-emerald-400">人力與設備配置</Label>
                  </div>
                  {/* 人員數量 */}
                  <div>
                    <Label className="text-xs text-muted-foreground">人員數量（位）</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="1" step="1"
                        value={selectedWs.operatorCount ?? 1}
                        className="h-7 text-sm w-20"
                        onChange={e => updateWsProp(selectedWs.id, "operatorCount", Math.max(1, parseInt(e.target.value) || 1))} />
                      <span className="text-xs text-muted-foreground">人</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        人均工序: <strong className="text-foreground">{((selectedWs.operatorTime || 0) / (selectedWs.operatorCount || 1)).toFixed(1)}s</strong>
                      </span>
                    </div>
                  </div>
                  {/* 設備數量 */}
                  <div>
                    <Label className="text-xs text-muted-foreground">設備數量（台）</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="0" step="1"
                        value={selectedWs.machineCount ?? 1}
                        className="h-7 text-sm w-20"
                        onChange={e => updateWsProp(selectedWs.id, "machineCount", Math.max(0, parseInt(e.target.value) || 0))} />
                      <span className="text-xs text-muted-foreground">台</span>
                      {(selectedWs.machineCount ?? 1) > 0 && selectedWs.machineTime > 0 && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          利用率: <strong className={`${
                            (selectedWs.machineTime / (selectedWs.operatorTime * (selectedWs.machineCount ?? 1))) > 0.9
                              ? "text-red-400" : (selectedWs.machineTime / (selectedWs.operatorTime * (selectedWs.machineCount ?? 1))) > 0.7
                              ? "text-amber-400" : "text-emerald-400"
                          }`}>{Math.min(100, (selectedWs.machineTime / (selectedWs.operatorTime * (selectedWs.machineCount ?? 1))) * 100).toFixed(0)}%</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 人力配置（小數点） */}
                  <div>
                    <Label className="text-xs text-muted-foreground">人力配置（小數點分配）</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="number" min="0.5" step="0.5"
                        value={selectedWs.manpower}
                        className="h-7 text-sm w-20"
                        onChange={e => updateWsProp(selectedWs.id, "manpower", parseFloat(e.target.value) || 1)} />
                      <span className="text-xs text-muted-foreground">人</span>
                    </div>
                  </div>
                </div>

                {/* 排序 */}
                <div>
                  <Label className="text-xs text-muted-foreground">工站序號</Label>
                  <Input type="number" min="0" step="1"
                    value={selectedWs.sequenceOrder + 1}
                    className="h-7 text-sm mt-1 w-20"
                    onChange={e => updateWsProp(selectedWs.id, "sequenceOrder", (parseInt(e.target.value) || 1) - 1)} />
                </div>

                {/* 座標 */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">X 座標</Label>
                    <Input type="number" value={selectedWs.x} className="h-7 text-sm mt-1"
                      onChange={e => updateWsProp(selectedWs.id, "x", snap(parseInt(e.target.value) || 0))} />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Y 座標</Label>
                    <Input type="number" value={selectedWs.y} className="h-7 text-sm mt-1"
                      onChange={e => updateWsProp(selectedWs.id, "y", snap(parseInt(e.target.value) || 0))} />
                  </div>
                </div>

                {/* 相關連線 */}
                {layout.connections.filter(c => c.fromId === selectedWs.id || c.toId === selectedWs.id).length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground">物流連線</Label>
                    <div className="space-y-1 mt-1">
                      {layout.connections
                        .filter(c => c.fromId === selectedWs.id || c.toId === selectedWs.id)
                        .map(conn => {
                          const other = layout.workstations.find(w =>
                            w.id === (conn.fromId === selectedWs.id ? conn.toId : conn.fromId)
                          );
                          const isIncoming = conn.toId === selectedWs.id;
                          const metrics = computeConnMetrics(conn, layout.workstations, scalePxPerM);
                          const ctype = conn.conveyorType ?? 'manual';
                          const meta = CONVEYOR_META[ctype];
                          return (
                            <div key={conn.id} className="bg-background/50 rounded p-1.5 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <span style={{ color: meta.color }}>{isIncoming ? "←" : "→"}</span>
                                  <span className="font-medium text-foreground">{other?.name ?? "?"}</span>
                                  <span className="text-muted-foreground/60">({meta.label})</span>
                                </span>
                                <Button size="icon" variant="ghost" className="h-5 w-5 text-red-400"
                                  onClick={() => handleDeleteConn(conn.id)}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                              {metrics.distance > 0 && (
                                <div className="mt-0.5 flex items-center gap-2">
                                  <span className="text-muted-foreground/80">{metrics.distance.toFixed(1)}m</span>
                                  <span className="text-muted-foreground/40">/</span>
                                  <span className={`font-medium ${isIncoming ? 'text-amber-400' : 'text-muted-foreground/80'}`}>
                                    {metrics.transportTime.toFixed(1)}s
                                  </span>
                                  {isIncoming && (
                                    <span className="text-amber-400/60 text-[10px]">↑上游搜運</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    {/* 上游搜運時間小計 */}
                    {(() => {
                      const incomingConns = layout.connections.filter(c => c.toId === selectedWs.id);
                      if (incomingConns.length === 0) return null;
                      const totalIncoming = incomingConns.reduce((s, c) => {
                        const m = computeConnMetrics(c, layout.workstations, scalePxPerM);
                        return s + m.transportTime;
                      }, 0);
                      const ct = Math.max(selectedWs.operatorTime, selectedWs.machineTime);
                      const totalWithTransport = ct + totalIncoming;
                      return (
                        <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded p-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-amber-400 font-medium">上游搜運時間</span>
                            <span className="text-amber-400 font-bold">{totalIncoming.toFixed(1)}s</span>
                          </div>
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-muted-foreground/70">CT + 搜運合計</span>
                            <span className="text-foreground font-medium">{totalWithTransport.toFixed(1)}s</span>
                          </div>
                          <div className="mt-1.5 h-1.5 bg-background rounded-full overflow-hidden">
                            <div className="h-full flex">
                              <div className="h-full bg-sky-500/70 rounded-l-full" style={{ width: `${ct / totalWithTransport * 100}%` }} />
                              <div className="h-full bg-amber-500/70 rounded-r-full" style={{ width: `${totalIncoming / totalWithTransport * 100}%` }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/60">
                            <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-sky-500/70"></span>CT {(ct / totalWithTransport * 100).toFixed(0)}%</span>
                            <span className="flex items-center gap-0.5"><span className="inline-block w-2 h-2 rounded-sm bg-amber-500/70"></span>搜運 {(totalIncoming / totalWithTransport * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 套用至產線 */}
                <Button size="sm" variant="outline" className="w-full h-8 gap-1 text-amber-400 border-amber-400/40 hover:bg-amber-400/10 text-xs mt-2"
                  onClick={() => setShowApplyDialog(true)}>
                  <Play className="w-3.5 h-3.5" />套用至實際產線
                </Button>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <Settings2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">點擊工站查看屬性</p>
                <p className="text-xs mt-1 opacity-60">拖曳工站調整位置</p>
                <p className="text-xs mt-1 opacity-60">點擊工具列「連線」建立物流動線</p>
              </div>
            )}
          </div>

          {/* 工站列表 */}
          {layout.workstations.length > 0 && (
            <div className="border-t border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                工站列表 ({layout.workstations.length})
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {[...layout.workstations]
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map(ws => {
                    const ct = Math.max(ws.operatorTime, ws.machineTime);
                    const colors = getWsColor(ws, maxCt, taktTime);
                    return (
                      <div key={ws.id}
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer transition-colors text-xs ${selectedWsId === ws.id ? "bg-primary/20 border border-primary/40" : "hover:bg-muted/30"}`}
                        onClick={() => setSelectedWsId(ws.id)}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: colors.border }} />
                        <span className="flex-1 truncate font-medium">{ws.name}</span>
                        <span className="font-mono shrink-0" style={{ color: colors.border }}>{ct.toFixed(1)}s</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialog: 建立情境 ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>儲存為新情境</DialogTitle>
            <DialogDescription>將目前的平面圖佈局儲存為新的模擬情境</DialogDescription>
          </DialogHeader>
          <div>
            <Label>情境名稱</Label>
            <Input value={newScenarioName} onChange={e => setNewScenarioName(e.target.value)}
              placeholder="例：優化方案 A" className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
            <Button onClick={handleCreateScenario} disabled={!newScenarioName.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 新增工站 ── */}
      <Dialog open={showAddWsDialog} onOpenChange={setShowAddWsDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>新增工站</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>工站名稱</Label>
              <Input value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="例：ST-01" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="flex items-center gap-1"><Users className="w-3 h-3 text-blue-400" />人員作業時間（秒）</Label>
                <Input type="number" min="0" step="0.1" value={newWsOpTime} onChange={e => setNewWsOpTime(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Cpu className="w-3 h-3 text-violet-400" />設備作業時間（秒）</Label>
                <Input type="number" min="0" step="0.1" value={newWsMcTime} onChange={e => setNewWsMcTime(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>人力（人）</Label>
              <Input type="number" min="0.5" step="0.5" value={newWsManpower} onChange={e => setNewWsManpower(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddWsDialog(false)}>取消</Button>
            <Button onClick={handleAddWorkstation}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 連線屬性 ── */}
      <Dialog open={showConnDialog} onOpenChange={setShowConnDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>物流連線屬性</DialogTitle>
            {editingConn && (
              <DialogDescription>
                {layout.workstations.find(w => w.id === editingConn.fromId)?.name} →{" "}
                {layout.workstations.find(w => w.id === editingConn.toId)?.name}
              </DialogDescription>
            )}
          </DialogHeader>
          {editingConn && (() => {
            const metrics = computeConnMetrics(editingConn, layout.workstations, scalePxPerM);
            return (
            <div className="space-y-4">
              {/* 輸送帶類型 */}
              <div>
                <Label className="text-sm font-medium">輸送帶類型</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {(Object.entries(CONVEYOR_META) as [ConveyorType, typeof CONVEYOR_META[ConveyorType]][]).map(([key, meta]) => (
                    <button key={key}
                      className={`rounded-lg border p-2 text-xs font-medium transition-all ${
                        (editingConn.conveyorType ?? 'manual') === key
                          ? 'border-2 bg-background/80'
                          : 'border-border/40 bg-background/30 opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        borderColor: (editingConn.conveyorType ?? 'manual') === key ? meta.color : undefined,
                        color: meta.color,
                      }}
                      onClick={() => setEditingConn(prev => prev ? {
                        ...prev,
                        conveyorType: key,
                        speed: meta.speed,
                      } : null)}>
                      {meta.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 速度設定 */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">搬運速度（m/min）</Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min="1" max="120" step="1"
                      value={editingConn.speed ?? CONVEYOR_META[editingConn.conveyorType ?? 'manual'].speed}
                      className="h-7 text-sm w-20 text-right"
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setEditingConn(prev => prev ? { ...prev, speed: isNaN(v) ? 30 : Math.max(1, Math.min(120, v)) } : null);
                      }} />
                    <span className="text-xs text-muted-foreground">m/min</span>
                  </div>
                </div>
                <Slider
                  min={1} max={120} step={1}
                  value={[editingConn.speed ?? CONVEYOR_META[editingConn.conveyorType ?? 'manual'].speed]}
                  onValueChange={([v]) => setEditingConn(prev => prev ? { ...prev, speed: v } : null)}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>1 m/min (慢)</span>
                  <span>60 m/min (一般)</span>
                  <span>120 m/min (高速)</span>
                </div>
                {/* 輸送帶視覺預覽 + 即時搬運時間 */}
                {(editingConn.conveyorType ?? 'manual') === 'conveyor' && (
                  <div className="mt-3 space-y-2">
                    <div className="rounded-lg overflow-hidden border border-border/40">
                      <svg width="100%" height="28" viewBox="0 0 200 28">
                        <rect x="0" y="4" width="200" height="20" fill="#0f2a3a" />
                        <rect x="0" y="4" width="200" height="20" fill="#1e6a8a"
                          strokeDasharray="4 8"
                          style={{ stroke: '#1e6a8a', strokeWidth: 10, strokeDashoffset: 0,
                            animation: `conveyor-roll ${
                              (editingConn.speed ?? 30) >= 15 ? '0.4' :
                              (editingConn.speed ?? 30) >= 8  ? '0.8' : '1.6'
                            }s linear infinite` }} />
                        <line x1="0" y1="14" x2="200" y2="14" stroke="#38bdf8" strokeWidth="1.5" opacity="0.9" />
                        <text x="100" y="18" textAnchor="middle" fill="#38bdf8" fontSize="8" fontWeight="600">
                          {editingConn.speed ?? 30} m/min →
                        </text>
                      </svg>
                    </div>
                    {/* 使用輸送帶下拉選單 */}
                    {(layout.conveyors ?? []).length > 0 ? (
                      <div>
                        <Label className="text-xs text-muted-foreground">使用輸送帶</Label>
                        <select
                          className="mt-1 w-full h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                          value={editingConn.conveyorRef ?? ''}
                          onChange={e => {
                            const cvId = e.target.value;
                            const cv = (layout.conveyors ?? []).find(c => c.id === cvId);
                            setEditingConn(prev => prev ? {
                              ...prev,
                              conveyorRef: cvId || undefined,
                              speed: cv ? cv.speed : (prev.speed ?? 30),
                            } : null);
                          }}>
                          <option value="">— 不指定（手動設定速度）</option>
                          {(layout.conveyors ?? []).map(cv => (
                            <option key={cv.id} value={cv.id}>
                              {cv.name}（{cv.speed} m/min）
                            </option>
                          ))}
                        </select>
                        {editingConn.conveyorRef && (() => {
                          const cv = (layout.conveyors ?? []).find(c => c.id === editingConn.conveyorRef);
                          return cv ? (
                            <div className="mt-1.5 flex items-center gap-2 text-xs">
                              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: cv.color }} />
                              <span className="text-muted-foreground">正在使用：</span>
                              <span className="font-semibold" style={{ color: cv.color }}>{cv.name}</span>
                              <span className="text-muted-foreground">· {cv.speed} m/min</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">提示：畫布上尚無輸送帶物件，可從工具列新增。</p>
                    )}
                  </div>
                )}
                {/* 即時搬運時間預覽 */}
                {metrics.distance > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{metrics.distance.toFixed(1)} m ÷ {editingConn.speed ?? 30} m/min</span>
                    <span className="font-bold" style={{ color: '#38bdf8' }}>
                      ≈ {metrics.transportTime.toFixed(1)} s 搬運時間
                    </span>
                  </div>
                )}
              </div>
              {/* 距離與搬運時間（唯讀，由座標自動計算） */}
              <div className="bg-background/50 rounded-lg p-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">距離（自動計算）</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {metrics.distance.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-1">m</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">搬運時間</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {metrics.transportTime.toFixed(1)}<span className="text-xs font-normal text-muted-foreground ml-1">s</span>
                  </p>
                </div>
                <p className="col-span-2 text-xs text-muted-foreground">
                  距離依畫布座標自動計算，拖曳工站即時更新。比例尺: {scalePxPerM} px/m
                </p>
              </div>
              {/* 標籤 */}
              <div>
                <Label className="text-sm font-medium">標籤（選填）</Label>
                <Input value={editingConn.label ?? ""} placeholder="例：主線輸送" className="mt-1 h-8 text-sm"
                  onChange={e => setEditingConn(prev => prev ? { ...prev, label: e.target.value } : null)} />
              </div>
            </div>
            );
          })()}
          <DialogFooter>
            <Button variant="destructive" size="sm" onClick={() => {
              if (editingConn) { handleDeleteConn(editingConn.id); setShowConnDialog(false); }
            }}>
              <Trash2 className="w-3.5 h-3.5 mr-1" />刪除連線
            </Button>
            <Button variant="outline" onClick={() => setShowConnDialog(false)}>取消</Button>
            <Button onClick={() => {
              if (editingConn) {
                handleUpdateConn(editingConn.id, 'conveyorType', editingConn.conveyorType ?? 'manual');
                handleUpdateConn(editingConn.id, 'speed', editingConn.speed ?? CONVEYOR_META[editingConn.conveyorType ?? 'manual'].speed);
                handleUpdateConn(editingConn.id, 'label', editingConn.label);
                handleUpdateConn(editingConn.id, 'conveyorRef', editingConn.conveyorRef);
                setShowConnDialog(false);
                toast.success("連線屬性已更新");
              }
            }}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: 套用至產線 ── */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-amber-400" />套用至實際產線
            </DialogTitle>
            <DialogDescription>以下變更將寫入實際工站資料，此操作不可撤銷。</DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {applyChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">無任何變更</p>
            ) : applyChanges.map((c, i) => (
              <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${c.type === "add" ? "bg-emerald-500/10 border border-emerald-500/20" : c.type === "remove" ? "bg-red-500/10 border border-red-500/20" : "bg-blue-500/10 border border-blue-500/20"}`}>
                {c.type === "add" ? <Plus className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> :
                  c.type === "remove" ? <Trash2 className="w-4 h-4 text-red-400 mt-0.5 shrink-0" /> :
                    <Settings2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />}
                <div><span className="font-medium">{c.name}</span><span className="text-muted-foreground ml-2">{c.detail}</span></div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>取消</Button>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => selectedScenarioId && applyMutation.mutate({ scenarioId: selectedScenarioId })}
              disabled={applyMutation.isPending || applyChanges.length === 0}>
              {applyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              確認套用（{applyChanges.length} 項）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
