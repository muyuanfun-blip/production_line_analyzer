"use client";

import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, ChevronDown, ChevronUp, Zap, Activity, Clock, Maximize2, Minimize2, RotateCw, ArrowUp, ArrowDown, SlidersHorizontal, Plus, Trash2, BarChart3, Settings } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getChangedWorkstationIds, summarizeProductFlows } from "../../../shared/monitoringRealtime";
import { buildMonitoringBalanceUrl } from "../../../shared/monitoringBalanceContext";
import { buildMonitoringTrackingUrl } from "../../../shared/monitoringTrackingContext";
import { buildMonitoringVsmUrl } from "../../../shared/monitoringVsmContext";
import { buildMonitoringSimulationUrl } from "../../../shared/monitoringSimulationContext";

interface RealtimeWorkstation {
  id: number;
  name: string;
  cycleTime: number;
  targetCycleTime: number;
  manpower: number;
  status: "normal" | "warning" | "critical" | "offline" | "idle";
  efficiency: number;
  utilization: number;
  currentProduct?: string;
  waitingProducts: number;
}

interface RealtimeLineStatus {
  lineId: number;
  lineName: string;
  timestamp: Date;
  workstations: RealtimeWorkstation[];
  balanceRate: number;
  upph: number;
  taktAchievement: number;
  productionTarget: number;
  productionActual: number;
  bottleneckWsId: number;
  anomalies: Array<{
    id: string;
    wsId: number;
    wsName: string;
    level: "info" | "warning" | "critical";
    message: string;
    timestamp: Date;
    suggestedAction?: string;
  }>;
}

interface HistoricalTrend {
  timestamp: Date;
  balanceRate: number;
  upph: number;
  taktAchievement: number;
  productionActual: number;
}

interface MonitoringProductFlowRecord {
  productId: string;
  wsId: number;
  wsName: string;
  startTime: Date;
  endTime?: Date;
  cycleTime: number;
  status: "in_progress" | "completed" | "waiting";
}

type AlertRuleDraft = {
  name: string;
  metric: "efficiency_below" | "waiting_products_at_least" | "status_equals";
  threshold: string;
  statusValue: "normal" | "warning" | "critical" | "offline" | "idle";
  severity: "info" | "warning" | "critical";
  workstationId: string;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "normal":
      return "bg-green-500 shadow-lg shadow-green-500/50";
    case "warning":
      return "bg-yellow-500 shadow-lg shadow-yellow-500/50";
    case "critical":
      return "bg-red-500 shadow-lg shadow-red-500/50";
    case "offline":
      return "bg-gray-500 shadow-lg shadow-gray-500/50";
    case "idle":
      return "bg-blue-500 shadow-lg shadow-blue-500/50";
    default:
      return "bg-gray-400";
  }
};

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    normal: "正常",
    warning: "預警",
    critical: "異常",
    offline: "停機",
    idle: "離線",
  };
  return labels[status] || status;
};

const KPICard = ({ label, value, unit, status, previousValue }: { label: string; value: number | string; unit?: string; status?: "good" | "warning" | "critical"; previousValue?: number }) => {
  const statusColor = {
    good: "text-green-400",
    warning: "text-yellow-400",
    critical: "text-red-400",
  };

  // 確保 value 不是 NaN
  const displayValue = typeof value === 'number' && isNaN(value) ? '0' : value;
  
  // 計算數值變化方向
  const trend = previousValue !== undefined && typeof value === 'number' && typeof previousValue === 'number'
    ? value > previousValue ? 'up' : value < previousValue ? 'down' : 'stable'
    : null;

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/40">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">{label}</p>
      <div className={`mt-2 text-3xl font-bold ${status ? statusColor[status] : "text-cyan-300"} transition-colors duration-300`}>
        {displayValue}
        {unit && <span className="text-lg text-cyan-400">{unit}</span>}
      </div>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          {trend === 'up' && <ArrowUp className="w-3 h-3 text-green-400" />}
          {trend === 'down' && <ArrowDown className="w-3 h-3 text-red-400" />}
          {trend === 'stable' && <span className="text-xs text-gray-400">—</span>}
        </div>
      )}
    </div>
  );
};

function RealtimeProductGantt({ records, onOpenTracking }: { records: MonitoringProductFlowRecord[]; onOpenTracking: () => void }) {
  const now = Date.now();
  const products = Array.from(new Set(records.map((record) => record.productId)));
  const rangeStart = Math.min(...records.map((record) => new Date(record.startTime).getTime()), now);
  const rangeEnd = Math.max(...records.map((record) => record.endTime ? new Date(record.endTime).getTime() : now), rangeStart + 1);
  const rangeMs = Math.max(rangeEnd - rangeStart, 1);
  const flowSummary = summarizeProductFlows(records);

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 p-3 sm:p-4 backdrop-blur">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400">產品流程即時進度</h2>
          <p className="mt-1 text-[11px] text-cyan-400/60">依工站流程呈現最新產品位置；紅色段落代表卡料或等待。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300">完成 {flowSummary.completed}</span>
          <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-cyan-300">加工中 {flowSummary.in_progress}</span>
          <span className={`rounded border px-2 py-1 ${flowSummary.waiting > 0 ? "border-red-500/40 bg-red-500/15 text-red-300" : "border-slate-500/30 bg-slate-500/10 text-slate-300"}`}>卡料 {flowSummary.waiting}</span>
          <button type="button" onClick={onOpenTracking} className="rounded border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-semibold text-violet-200 transition hover:bg-violet-500/20">追蹤歷程</button>
        </div>
      </div>
      {!records.length ? (
        <div className="flex h-28 items-center justify-center text-xs text-slate-400">尚無產品流程資料</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[620px]">
            <div className="mb-1 ml-24 flex justify-between text-[10px] text-slate-500"><span>{new Date(rangeStart).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span><span>現在</span><span>{new Date(rangeEnd).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</span></div>
            <div className="space-y-1.5">
              {products.slice(0, 8).map((productId) => {
                const productRecords = records.filter((record) => record.productId === productId).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
                const progress = productRecords.length ? Math.round((productRecords.filter((record) => record.status === "completed").length / productRecords.length) * 100) : 0;
                return (
                  <div key={productId} className="flex items-center gap-2">
                    <div className="w-[88px] shrink-0 truncate text-[11px] font-mono text-slate-300" title={productId}>{productId}</div>
                    <div className="relative h-8 flex-1 overflow-hidden rounded bg-slate-950/60 ring-1 ring-inset ring-cyan-500/10">
                      {productRecords.map((record, index) => {
                        const start = new Date(record.startTime).getTime();
                        const end = record.endTime ? new Date(record.endTime).getTime() : now;
                        const left = ((start - rangeStart) / rangeMs) * 100;
                        const width = Math.max(((end - start) / rangeMs) * 100, 3.5);
                        const className = record.status === "waiting"
                          ? "bg-red-500/85 text-white ring-1 ring-red-200/70 animate-pulse"
                          : record.status === "in_progress"
                            ? "bg-cyan-500/85 text-white ring-1 ring-cyan-200/70"
                            : "bg-emerald-500/75 text-white";
                        const label = record.status === "waiting" ? `卡料 · ${record.wsName}` : record.wsName;
                        return <div key={`${record.wsId}-${index}`} title={`${label}\nCT ${record.cycleTime.toFixed(1)}s`} className={`absolute top-1 flex h-6 items-center truncate rounded px-1.5 text-[10px] font-medium shadow-sm transition-all duration-500 ${className}`} style={{ left: `${Math.max(left, 0)}%`, width: `${Math.min(width, 100 - Math.max(left, 0))}%` }}>{label}</div>;
                      })}
                    </div>
                    <div className="w-8 text-right text-[10px] text-slate-400">{progress}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MonitoringDashboard() {
  const { lineId } = useParams<{ lineId: string }>();
  const [, setLocation] = useLocation();
  const monitoringLineId = Number.parseInt(lineId || "0", 10);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedWs, setSelectedWs] = useState<number | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(3);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const [previousKPI, setPreviousKPI] = useState<any>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, string>>({});
  const [loadingAI, setLoadingAI] = useState<Record<number, boolean>>({});
  const [changedWsIds, setChangedWsIds] = useState<Set<number>>(new Set());
  const [snapshotNote, setSnapshotNote] = useState("");
  const [showAlertRules, setShowAlertRules] = useState(false);
  const [alertRuleDraft, setAlertRuleDraft] = useState<AlertRuleDraft>({
    name: "",
    metric: "efficiency_below",
    threshold: "80",
    statusValue: "warning",
    severity: "warning",
    workstationId: "",
  });
  const latestStatusRef = useRef<RealtimeLineStatus | null>(null);
  const statusMapRef = useRef<Map<number, RealtimeWorkstation["status"]>>(new Map());
  const refreshInFlightRef = useRef(false);
  const historyRange = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { from, to };
  }, [monitoringLineId]);

  // 實時狀態查詢
  const { data: realtimeStatus, isLoading: statusLoading, refetch: refetchStatus } = trpc.monitoring.getRealTimeStatus.useQuery(
    { productionLineId: monitoringLineId, productionTarget: 100 },
    { enabled: !!lineId }
  );

  // 歷史趨勢查詢
  const { data: historicalTrend, isLoading: trendLoading, refetch: refetchTrend } = trpc.monitoring.getHistoricalTrend.useQuery(
    { productionLineId: monitoringLineId, productionTarget: 100 },
    { enabled: !!lineId }
  );
  const { data: productFlowRecords = [], refetch: refetchProductFlows } = trpc.monitoring.getProductFlowRecords.useQuery(
    { productionLineId: monitoringLineId, productCount: 8 },
    { enabled: !!lineId },
  );
  const { data: persistedSnapshots = [], refetch: refetchPersistedSnapshots } = trpc.monitoring.listSnapshots.useQuery(
    { productionLineId: monitoringLineId, ...historyRange, limit: 100 },
    { enabled: !!lineId },
  );
  const { data: alertRules = [], refetch: refetchAlertRules } = trpc.monitoring.listAlertRules.useQuery(
    { productionLineId: monitoringLineId },
    { enabled: !!lineId },
  );
  const captureSnapshotMutation = trpc.monitoring.captureSnapshot.useMutation({
    onSuccess: () => {
      setSnapshotNote("");
      void refetchPersistedSnapshots();
    },
  });
  const createAlertRuleMutation = trpc.monitoring.createAlertRule.useMutation({
    onSuccess: () => {
      setAlertRuleDraft({ name: "", metric: "efficiency_below", threshold: "80", statusValue: "warning", severity: "warning", workstationId: "" });
      void Promise.all([refetchAlertRules(), refetchStatus()]);
    },
  });
  const updateAlertRuleMutation = trpc.monitoring.updateAlertRule.useMutation({
    onSuccess: () => {
      void Promise.all([refetchAlertRules(), refetchStatus()]);
    },
  });
  const deleteAlertRuleMutation = trpc.monitoring.deleteAlertRule.useMutation({
    onSuccess: () => {
      void Promise.all([refetchAlertRules(), refetchStatus()]);
    },
  });
  const persistedTrendData = useMemo(() => [...persistedSnapshots].reverse().map((snapshot) => ({
    time: new Date(snapshot.capturedAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    balanceRate: snapshot.balanceRate,
    upph: snapshot.upph,
    taktAchievement: snapshot.taktAchievement,
    productionActual: snapshot.productionActual,
  })), [persistedSnapshots]);

  const criticalAnomalies = useMemo(
    () => realtimeStatus?.anomalies.filter((anomaly) => anomaly.level === "critical") ?? [],
    [realtimeStatus?.anomalies],
  );
  const warningAnomalies = useMemo(
    () => realtimeStatus?.anomalies.filter((anomaly) => anomaly.level === "warning") ?? [],
    [realtimeStatus?.anomalies],
  );

  useEffect(() => {
    latestStatusRef.current = realtimeStatus ?? null;
  }, [realtimeStatus]);

  const refreshMonitoring = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    const priorStatus = latestStatusRef.current;
    if (priorStatus) {
      setPreviousKPI({
        balanceRate: priorStatus.balanceRate,
        upph: priorStatus.upph,
        taktAchievement: priorStatus.taktAchievement,
        productionActual: priorStatus.productionActual,
      });
    }
    refreshInFlightRef.current = true;
    try {
      await Promise.all([refetchStatus(), refetchTrend(), refetchProductFlows()]);
      setLastUpdateTime(new Date());
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [refetchStatus, refetchTrend, refetchProductFlows]);

  // 自動刷新：背景頁面不輪詢，重新回到頁面時立即同步一次，避免無效請求。
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refreshMonitoring();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refreshMonitoring]);

  useEffect(() => {
    if (!autoRefresh) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshMonitoring();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [autoRefresh, refreshMonitoring]);

  // 工站狀態變化時短暫標記，讓操作者能看出即時切換而不造成版面跳動。
  useEffect(() => {
    const workstations = realtimeStatus?.workstations ?? [];
    const previousMap = statusMapRef.current;
    const nextMap = new Map(workstations.map((workstation) => [workstation.id, workstation.status]));
    const changed = getChangedWorkstationIds(previousMap, workstations);
    statusMapRef.current = nextMap;
    if (changed.length === 0) return;
    setChangedWsIds(new Set(changed));
    const timeout = window.setTimeout(() => setChangedWsIds(new Set()), 1800);
    return () => window.clearTimeout(timeout);
  }, [realtimeStatus?.workstations]);

  // 全螢幕功能
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.error("全螢幕切換失敗:", err);
    }
  };

  // 監聽全螢幕變化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 計算更新時間字符串
  const updateTimeStr = lastUpdateTime.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  // 加載狀態
  if (statusLoading || trendLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  // 無數據狀態
  if (!realtimeStatus) {
    return <div className="p-6 text-center text-gray-500">無法載入監控資料</div>;
  }

  const trendData = historicalTrend?.map((item: HistoricalTrend) => ({
    time: new Date(item.timestamp).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
    balanceRate: item.balanceRate,
    upph: item.upph,
    taktAchievement: item.taktAchievement,
  })) || [];

  // 生成 AI 改善建議（使用後端 API）
  const fetchAISuggestions = async (wsName: string, wsId: number, status: string) => {
    // 如果已經有建議，不需要重新購取
    if (aiSuggestions[wsId]) {
      return aiSuggestions[wsId];
    }

    setLoadingAI(prev => ({ ...prev, [wsId]: true }));
    try {
      // 訂造後端 API 轉接次數不夠，先使用本地建議
      const localSuggestions: Record<string, Record<string, string>> = {
        critical: {
          default: `立即檢查「${wsName}」工站，可能存在設備故障或工序瓶頸。建議優先排查。`,
        },
        warning: {
          default: `「${wsName}」工站效率下降，建議檢查是否有人員不足或物料延遲。`,
        },
        normal: {
          default: `「${wsName}」工站運行正常，繼續監控。`,
        },
      };
      const suggestion = localSuggestions[status]?.default || `監控「${wsName}」工站狀態。`;
      setAiSuggestions(prev => ({ ...prev, [wsId]: suggestion }));
      return suggestion;
    } finally {
      setLoadingAI(prev => ({ ...prev, [wsId]: false }));
    }
  };

  const getAISuggestions = (wsName: string, status: string, wsId: number) => {
    // 如果已經有建議，直接返回
    if (aiSuggestions[wsId]) {
      return aiSuggestions[wsId];
    }
    // 否則使用預設建議
    const suggestions: Record<string, Record<string, string>> = {
      critical: {
        default: `立即檢查「${wsName}」工站，可能存在設備故障或工序瓶頸。建議優先排查。`,
      },
      warning: {
        default: `「${wsName}」工站效率下降，建議檢查是否有人員不足或物料延遲。`,
      },
      normal: {
        default: `「${wsName}」工站運行正常，繼續監控。`,
      },
    };
    return suggestions[status]?.default || `監控「${wsName}」工站狀態。`;
  };

  return (
    <div
      ref={containerRef}
      className={`bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white ${
        isFullscreen ? "fixed inset-0 overflow-auto" : "min-h-screen p-6"
      }`}
    >
      {/* 頂部控制欄 */}
      <div className={`mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between ${isFullscreen ? "p-6" : ""} border-b border-cyan-500/20 pb-3 sm:pb-4 gap-3 sm:gap-0`}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-cyan-400">產線戰情監控</h1>
          <p className="mt-1 text-xs text-cyan-400/60">最後更新: {updateTimeStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition flex items-center gap-1 sm:gap-2 ${
              autoRefresh
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
            }`}
          >
            <RotateCw size={14} className={`sm:w-4 sm:h-4 ${autoRefresh ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{autoRefresh ? "自動更新" : "手動模式"}</span>
            <span className="sm:hidden">{autoRefresh ? "自動" : "手動"}</span>
          </button>
          <button
            onClick={() => void refreshMonitoring()}
            className="rounded-lg bg-slate-700/70 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-200 transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1 sm:gap-2"
            disabled={refreshInFlightRef.current}
            title="立即更新監控資料"
          >
            <RotateCw size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">立即刷新</span>
            <span className="sm:hidden">刷新</span>
          </button>
          <button
            onClick={() => realtimeStatus && setLocation(buildMonitoringBalanceUrl(monitoringLineId, {
              balanceRate: realtimeStatus.balanceRate,
              upph: realtimeStatus.upph,
              taktAchievement: realtimeStatus.taktAchievement,
              productionActual: realtimeStatus.productionActual,
              productionTarget: realtimeStatus.productionTarget,
              bottleneckWsId: realtimeStatus.bottleneckWsId,
            }))}
            className="rounded-lg bg-violet-500/20 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-violet-200 transition hover:bg-violet-500/30 flex items-center gap-1 sm:gap-2"
            title="帶入即時 KPI 前往平衡診斷"
          >
            <BarChart3 size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden md:inline">平衡診斷</span>
            <span className="md:hidden">診斷</span>
          </button>
          <button
            onClick={() => realtimeStatus && setLocation(buildMonitoringVsmUrl({
              lineId: monitoringLineId,
              bottleneckWsId: realtimeStatus.bottleneckWsId,
              balanceRate: realtimeStatus.balanceRate,
              criticalCount: criticalAnomalies.length,
              warningCount: warningAnomalies.length,
            }))}
            className="rounded-lg bg-amber-500/15 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25 flex items-center gap-1 sm:gap-2"
            title="帶入瓶頸與警示狀態檢視 VSM"
          >
            <Activity size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden lg:inline">VSM 流程</span>
            <span className="lg:hidden">VSM</span>
          </button>
          <button
            onClick={() => realtimeStatus && setLocation(buildMonitoringSimulationUrl({
              lineId: monitoringLineId,
              bottleneckWsId: realtimeStatus.bottleneckWsId,
              balanceRate: realtimeStatus.balanceRate,
              upph: realtimeStatus.upph,
              criticalCount: criticalAnomalies.length,
            }))}
            className="rounded-lg bg-cyan-500/15 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/25 flex items-center gap-1 sm:gap-2"
            title="以即時 KPI 建立或調整配置模擬"
          >
            <Settings size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden xl:inline">配置模擬</span>
            <span className="xl:hidden">模擬</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-lg bg-cyan-500/20 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-cyan-400 transition hover:bg-cyan-500/30 flex items-center gap-1 sm:gap-2"
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">退出全螢幕</span>
                <span className="sm:hidden">退出</span>
              </>
            ) : (
              <>
                <Maximize2 size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">全螢幕</span>
                <span className="sm:hidden">全螢</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 更新間隔設定 */}
      <div className={`mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 ${isFullscreen ? "px-6" : ""}`}>
        <span className="text-xs text-cyan-400/60 whitespace-nowrap">更新間隔:</span>
        <select
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-cyan-400 border border-cyan-500/20 w-full sm:w-auto"
        >
          <option value={3}>3 秒</option>
          <option value={10}>10 秒</option>
          <option value={30}>30 秒</option>
          <option value={60}>1 分鐘</option>
          <option value={120}>2 分鐘</option>
        </select>
      </div>

      {/* 主要監控內容 */}
      <div className={`${isFullscreen ? "px-6" : ""}`}>
        {/* KPI 儀表板 */}
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 md:gap-4">
          <KPICard 
            label="平衡率" 
            value={`${realtimeStatus.balanceRate}%`} 
            status={realtimeStatus.balanceRate >= 80 ? "good" : realtimeStatus.balanceRate >= 60 ? "warning" : "critical"}
            previousValue={previousKPI?.balanceRate}
          />
          <KPICard 
            label="UPPH" 
            value={isNaN(realtimeStatus.upph) ? '0' : realtimeStatus.upph}
            previousValue={previousKPI?.upph}
          />
          <KPICard 
            label="Takt 達標" 
            value={`${realtimeStatus.taktAchievement}%`} 
            status={realtimeStatus.taktAchievement >= 80 ? "good" : "warning"}
            previousValue={previousKPI?.taktAchievement}
          />
          <KPICard 
            label="產能達成" 
            value={`${Math.round((realtimeStatus.productionActual / realtimeStatus.productionTarget) * 100)}%`}
            previousValue={previousKPI?.productionActual}
          />
          <KPICard 
            label="異常工站" 
            value={criticalAnomalies.length} 
            status={criticalAnomalies.length === 0 ? "good" : "critical"} 
          />
        </div>

        {/* 主監控區 - 工站狀態 */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* 左側：工站列表 */}
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur">
            <div className="border-b border-cyan-500/20 p-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">工站狀態</h2>
            </div>
            <div className="space-y-2 p-3 sm:p-4 max-h-64 sm:max-h-96 overflow-y-auto">
              {realtimeStatus.workstations.map((ws: RealtimeWorkstation) => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWs(selectedWs === ws.id ? null : ws.id)}
                  className={`w-full rounded-lg border-2 p-3 text-left transition-all duration-500 ${
                    selectedWs === ws.id
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-cyan-500/20 bg-slate-800/50 hover:border-cyan-500/50"
                  } ${changedWsIds.has(ws.id) ? "ring-2 ring-cyan-300/70 bg-cyan-500/15" : ""}`}
                >
                  <div className={`flex items-center gap-2`}>
                    <div className={`h-2 w-2 rounded-full transition-all duration-500 ${getStatusColor(ws.status)} ${changedWsIds.has(ws.id) ? "scale-150 animate-pulse" : ""}`} />
                    <span className="flex-1 text-xs font-semibold">{ws.name}</span>
                    <span className="rounded border border-white/10 bg-slate-950/30 px-1.5 py-0.5 text-[10px] text-slate-200">{getStatusLabel(ws.status)}</span>
                    {ws.id === realtimeStatus.bottleneckWsId && (
                      <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-xs font-bold text-orange-400">瓶頸</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-cyan-400/60">
                    CT: {isNaN(ws.cycleTime) ? '0' : ws.cycleTime.toFixed(1)}s / {isNaN(ws.targetCycleTime) ? '0' : ws.targetCycleTime}s
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 中央：主監控區 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 工站流程圖 */}
            <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur p-4">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-cyan-400">工站流程</h2>
              <div className="flex flex-wrap gap-2">
                {realtimeStatus.workstations.map((ws: RealtimeWorkstation, idx: number) => (
                  <div key={ws.id} className="flex items-center">
                    <div className={`rounded-full w-12 h-12 flex items-center justify-center font-bold text-xs transition-all duration-500 ${getStatusColor(ws.status)} ${changedWsIds.has(ws.id) ? "ring-2 ring-cyan-200 ring-offset-2 ring-offset-slate-900" : ""}`}>
                      {ws.name}
                    </div>
                    {idx < realtimeStatus.workstations.length - 1 && (
                      <div className="mx-2 text-cyan-400">→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 趨勢圖表 */}
            <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur p-3 sm:p-4">
              <h2 className="mb-3 sm:mb-4 text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-400">24 小時趨勢</h2>
              <div style={{height: '150px'}} className="sm:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(34, 211, 238, 0.1)" />
                  <XAxis dataKey="time" stroke="rgba(34, 211, 238, 0.5)" style={{ fontSize: "12px" }} />
                  <YAxis stroke="rgba(34, 211, 238, 0.5)" style={{ fontSize: "12px" }} />
                  <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.9)", border: "1px solid rgba(34, 211, 238, 0.3)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="balanceRate" stroke="#06b6d4" name="平衡率" />
                  <Line type="monotone" dataKey="taktAchievement" stroke="#10b981" name="Takt達標" />
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-violet-500/25 bg-slate-900/50 p-3 sm:p-4 backdrop-blur">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-violet-300">留存的監控快照</h2>
                  <p className="mt-1 text-[11px] text-violet-200/60">手動保存當前 KPI、工站狀態及警示，供跨班次與跨日期比較。</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <input
                    value={snapshotNote}
                    onChange={(event) => setSnapshotNote(event.target.value)}
                    placeholder="留存備註（選填）"
                    maxLength={1000}
                    className="h-8 min-w-0 rounded border border-violet-500/25 bg-slate-950/70 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-violet-400 sm:w-44"
                  />
                  <button
                    onClick={() => captureSnapshotMutation.mutate({ productionLineId: monitoringLineId, productionTarget: realtimeStatus.productionTarget, note: snapshotNote.trim() || undefined })}
                    disabled={captureSnapshotMutation.isPending}
                    className="h-8 whitespace-nowrap rounded bg-violet-500/20 px-3 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {captureSnapshotMutation.isPending ? "留存中…" : "留存目前狀態"}
                  </button>
                </div>
              </div>
              {captureSnapshotMutation.error && <p className="mt-2 text-xs text-red-300">留存失敗：{captureSnapshotMutation.error.message}</p>}
              {persistedSnapshots.length === 0 ? (
                <div className="mt-4 flex h-28 items-center justify-center rounded border border-dashed border-violet-500/20 bg-violet-500/[0.03] text-center text-xs text-slate-400">尚未留存監控快照。可在交班、異常發生或改善前後保存當前狀態。</div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded bg-slate-950/50 p-2"><p className="text-slate-500">快照數</p><p className="mt-1 font-bold text-violet-200">{persistedSnapshots.length}</p></div>
                    <div className="rounded bg-slate-950/50 p-2"><p className="text-slate-500">最新平衡率</p><p className="mt-1 font-bold text-cyan-300">{persistedSnapshots[0]?.balanceRate.toFixed(1)}%</p></div>
                    <div className="rounded bg-slate-950/50 p-2"><p className="text-slate-500">最新 UPPH</p><p className="mt-1 font-bold text-emerald-300">{persistedSnapshots[0]?.upph.toFixed(2)}</p></div>
                    <div className="rounded bg-slate-950/50 p-2"><p className="text-slate-500">最後留存</p><p className="mt-1 truncate font-medium text-slate-200">{new Date(persistedSnapshots[0]!.capturedAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p></div>
                  </div>
                  <div className="mt-3 h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={persistedTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(167, 139, 250, 0.12)" />
                        <XAxis dataKey="time" stroke="rgba(196, 181, 253, 0.55)" style={{ fontSize: "10px" }} minTickGap={32} />
                        <YAxis stroke="rgba(196, 181, 253, 0.55)" style={{ fontSize: "10px" }} />
                        <Tooltip contentStyle={{ backgroundColor: "rgba(15, 23, 42, 0.95)", border: "1px solid rgba(167, 139, 250, 0.35)" }} />
                        <Legend />
                        <Line type="monotone" dataKey="balanceRate" stroke="#a78bfa" name="平衡率" dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="taktAchievement" stroke="#34d399" name="Takt達標" dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <RealtimeProductGantt
            records={productFlowRecords as MonitoringProductFlowRecord[]}
            onOpenTracking={() => setLocation(buildMonitoringTrackingUrl({
              lineId: monitoringLineId,
              waitingCount: productFlowRecords.filter((record) => record.status === "waiting").length,
              activeCount: productFlowRecords.filter((record) => record.status === "in_progress").length,
              productIds: Array.from(new Set(productFlowRecords.map((record) => record.productId))),
            }))}
          />
        </div>

        {/* 警示面板 */}
        <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur">
          <div className="border-b border-cyan-500/20 p-4 cursor-pointer flex items-center justify-between" onClick={() => setExpandedAlerts(!expandedAlerts)}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">實時警示</h2>
              {(criticalAnomalies.length > 0 || warningAnomalies.length > 0) && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-400">
                  {criticalAnomalies.length + warningAnomalies.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); setShowAlertRules((open) => !open); }}
                className={`rounded px-2 py-1 text-[11px] font-semibold transition ${showAlertRules ? "bg-violet-500/20 text-violet-200" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                title="管理警示規則"
              >
                <span className="flex items-center gap-1"><SlidersHorizontal size={13} /> 規則</span>
              </button>
              {expandedAlerts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          </div>
          {showAlertRules && (
            <div className="border-b border-violet-500/20 bg-violet-500/[0.035] p-3 sm:p-4">
              <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-xs font-bold text-violet-200">自訂警示規則</h3>
                  <p className="mt-1 text-[11px] text-violet-200/60">規則會於下一次監控更新時併入即時警示；可套用全線或指定工站。</p>
                </div>
                <span className="rounded border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200">啟用 {alertRules.filter((rule) => Boolean(rule.isActive)).length} / {alertRules.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
                <input
                  value={alertRuleDraft.name}
                  onChange={(event) => setAlertRuleDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder="規則名稱，例如：測試站效率下限"
                  className="h-9 rounded border border-violet-500/25 bg-slate-950/70 px-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-violet-400 xl:col-span-2"
                />
                <select
                  value={alertRuleDraft.metric}
                  onChange={(event) => setAlertRuleDraft((draft) => ({ ...draft, metric: event.target.value as AlertRuleDraft["metric"] }))}
                  className="h-9 rounded border border-violet-500/25 bg-slate-950/70 px-2 text-xs text-slate-100 outline-none focus:border-violet-400"
                >
                  <option value="efficiency_below">效率低於門檻</option>
                  <option value="waiting_products_at_least">等待量達門檻</option>
                  <option value="status_equals">工站狀態符合</option>
                </select>
                <select
                  value={alertRuleDraft.workstationId}
                  onChange={(event) => setAlertRuleDraft((draft) => ({ ...draft, workstationId: event.target.value }))}
                  className="h-9 rounded border border-violet-500/25 bg-slate-950/70 px-2 text-xs text-slate-100 outline-none focus:border-violet-400"
                >
                  <option value="">全產線</option>
                  {realtimeStatus.workstations.map((workstation) => <option key={workstation.id} value={workstation.id}>{workstation.name}</option>)}
                </select>
                <select
                  value={alertRuleDraft.severity}
                  onChange={(event) => setAlertRuleDraft((draft) => ({ ...draft, severity: event.target.value as AlertRuleDraft["severity"] }))}
                  className="h-9 rounded border border-violet-500/25 bg-slate-950/70 px-2 text-xs text-slate-100 outline-none focus:border-violet-400"
                >
                  <option value="info">提示</option>
                  <option value="warning">預警</option>
                  <option value="critical">緊急</option>
                </select>
                {alertRuleDraft.metric === "status_equals" ? (
                  <select
                    value={alertRuleDraft.statusValue}
                    onChange={(event) => setAlertRuleDraft((draft) => ({ ...draft, statusValue: event.target.value as AlertRuleDraft["statusValue"] }))}
                    className="h-9 rounded border border-violet-500/25 bg-slate-950/70 px-2 text-xs text-slate-100 outline-none focus:border-violet-400"
                  >
                    <option value="normal">正常</option><option value="warning">預警</option><option value="critical">異常</option><option value="offline">停機</option><option value="idle">離線</option>
                  </select>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step={alertRuleDraft.metric === "efficiency_below" ? "0.1" : "1"}
                    value={alertRuleDraft.threshold}
                    onChange={(event) => setAlertRuleDraft((draft) => ({ ...draft, threshold: event.target.value }))}
                    placeholder={alertRuleDraft.metric === "efficiency_below" ? "效率門檻 (%)" : "等待件數門檻"}
                    className="h-9 rounded border border-violet-500/25 bg-slate-950/70 px-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-violet-400"
                  />
                )}
                <button
                  type="button"
                  onClick={() => {
                    const threshold = Number(alertRuleDraft.threshold);
                    if (!alertRuleDraft.name.trim() || (alertRuleDraft.metric !== "status_equals" && !Number.isFinite(threshold))) return;
                    createAlertRuleMutation.mutate({
                      productionLineId: monitoringLineId,
                      workstationId: alertRuleDraft.workstationId ? Number(alertRuleDraft.workstationId) : null,
                      name: alertRuleDraft.name.trim(),
                      metric: alertRuleDraft.metric,
                      threshold: alertRuleDraft.metric === "status_equals" ? null : threshold,
                      statusValue: alertRuleDraft.metric === "status_equals" ? alertRuleDraft.statusValue : null,
                      severity: alertRuleDraft.severity,
                    });
                  }}
                  disabled={createAlertRuleMutation.isPending || !alertRuleDraft.name.trim() || (alertRuleDraft.metric !== "status_equals" && !Number.isFinite(Number(alertRuleDraft.threshold)))}
                  className="flex h-9 items-center justify-center gap-1 rounded bg-violet-500/20 px-3 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                ><Plus size={14} />新增規則</button>
              </div>
              {createAlertRuleMutation.error && <p className="mt-2 text-xs text-red-300">新增失敗：{createAlertRuleMutation.error.message}</p>}
              <div className="mt-3 space-y-1.5">
                {alertRules.length === 0 ? <p className="rounded border border-dashed border-violet-500/20 px-3 py-2 text-xs text-slate-400">尚無自訂規則；系統仍會保留內建的異常判斷。</p> : alertRules.map((rule) => {
                  const metricText = rule.metric === "efficiency_below" ? `效率 < ${rule.threshold}%` : rule.metric === "waiting_products_at_least" ? `等待量 ≥ ${rule.threshold}` : `狀態 = ${getStatusLabel(rule.statusValue || "")}`;
                  const scopeText = rule.workstationId ? realtimeStatus.workstations.find((workstation) => workstation.id === rule.workstationId)?.name || `工站 #${rule.workstationId}` : "全產線";
                  const severityText = rule.severity === "critical" ? "緊急" : rule.severity === "warning" ? "預警" : "提示";
                  const severityColor = rule.severity === "critical" ? "text-red-300 border-red-500/30 bg-red-500/10" : rule.severity === "warning" ? "text-yellow-300 border-yellow-500/30 bg-yellow-500/10" : "text-cyan-300 border-cyan-500/30 bg-cyan-500/10";
                  return <div key={rule.id} className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded border px-2.5 py-2 text-xs ${rule.isActive ? "border-slate-700 bg-slate-950/40" : "border-slate-800 bg-slate-950/20 opacity-60"}`}>
                    <span className="font-semibold text-slate-100">{rule.name}</span><span className="text-slate-500">{scopeText}</span><span className="text-slate-400">{metricText}</span><span className={`rounded border px-1.5 py-0.5 ${severityColor}`}>{severityText}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button type="button" onClick={() => updateAlertRuleMutation.mutate({ id: rule.id, isActive: rule.isActive ? 0 : 1 })} disabled={updateAlertRuleMutation.isPending} className="rounded bg-slate-800 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50">{rule.isActive ? "停用" : "啟用"}</button>
                      <button type="button" onClick={() => deleteAlertRuleMutation.mutate({ id: rule.id })} disabled={deleteAlertRuleMutation.isPending} className="rounded p-1 text-slate-400 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50" title="刪除規則"><Trash2 size={13} /></button>
                    </div>
                  </div>;
                })}
              </div>
              {(updateAlertRuleMutation.error || deleteAlertRuleMutation.error) && <p className="mt-2 text-xs text-red-300">規則更新失敗：{updateAlertRuleMutation.error?.message || deleteAlertRuleMutation.error?.message}</p>}
            </div>
          )}
          {expandedAlerts && (
            <div className="space-y-2 sm:space-y-3 p-3 sm:p-4 max-h-64 sm:max-h-80 overflow-y-auto">
              {criticalAnomalies.length === 0 && warningAnomalies.length === 0 ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                  <p className="text-xs font-bold text-green-400">✓ 系統正常運行</p>
                  <p className="mt-1 text-xs text-green-300">所有工站狀態正常，繼續監控。</p>
                </div>
              ) : (
                <>
                  {criticalAnomalies.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold text-red-400">🚨 緊急警示 ({criticalAnomalies.length})</p>
                      <div className="space-y-2">
                        {criticalAnomalies.map((anomaly: any) => {
                          const selectedWsData = realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === anomaly.wsId);
                          const suggestion = getAISuggestions(anomaly.wsName, "critical", anomaly.wsId);
                          return (
                            <div key={anomaly.id} className="rounded-lg border-l-4 border-red-500 bg-red-500/10 p-3 hover:bg-red-500/20 transition">
                              <p className="text-xs font-bold text-red-400">{anomaly.wsName}: {anomaly.message}</p>
                              {anomaly.suggestedAction && <p className="mt-1 text-xs text-red-300">{anomaly.suggestedAction}</p>}
                              <p className="mt-2 text-xs text-red-300 italic">💡 {suggestion}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {warningAnomalies.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-bold text-yellow-400">⚠️ 預警提示 ({warningAnomalies.length})</p>
                      <div className="space-y-2">
                        {warningAnomalies.map((anomaly: any) => {
                          const suggestion = getAISuggestions(anomaly.wsName, "warning", anomaly.wsId);
                          return (
                            <div key={anomaly.id} className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/10 p-3 hover:bg-yellow-500/20 transition">
                              <p className="text-xs font-bold text-yellow-400">{anomaly.wsName}: {anomaly.message}</p>
                              <p className="mt-2 text-xs text-yellow-300 italic">💡 {suggestion}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 工站詳細分析 */}
        {selectedWs && (
          <div className="mt-4 sm:mt-6 rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur p-3 sm:p-4">
            <h2 className="mb-3 sm:mb-4 text-xs sm:text-sm font-bold uppercase tracking-widest text-cyan-400">
              {realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.name} - 詳細分析
            </h2>
            {realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
                <KPICard label="效率" value={`${isNaN((realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.efficiency) || 0) ? '0' : (realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.efficiency || 0).toFixed(1)}%`} />
                <KPICard label="利用率" value={`${isNaN((realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.utilization) || 0) ? '0' : (realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.utilization || 0).toFixed(1)}%`} />
                <KPICard label="等待產品" value={(realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.waitingProducts) || 0} />
                <KPICard label="狀態" value={getStatusLabel((realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.status) || "")} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
