"use client";

import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, ChevronDown, ChevronUp, Zap, Activity, Clock, Maximize2, Minimize2, RotateCw, ArrowUp, ArrowDown } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useRef, useMemo } from "react";

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

export default function MonitoringDashboard() {
  const { lineId } = useParams<{ lineId: string }>();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedWs, setSelectedWs] = useState<number | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // 30 秒
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const [previousKPI, setPreviousKPI] = useState<any>(null);

  // 實時狀態查詢
  const { data: realtimeStatus, isLoading: statusLoading, refetch: refetchStatus } = trpc.monitoring.getRealTimeStatus.useQuery(
    { productionLineId: parseInt(lineId || "0"), productionTarget: 100 },
    { enabled: !!lineId }
  );

  // 歷史趨勢查詢
  const { data: historicalTrend, isLoading: trendLoading } = trpc.monitoring.getHistoricalTrend.useQuery(
    { productionLineId: parseInt(lineId || "0"), productionTarget: 100 },
    { enabled: !!lineId }
  );

  // 自動刷新效果（30 秒）
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      // 保存前一次的 KPI 數據
      if (realtimeStatus) {
        setPreviousKPI({
          balanceRate: realtimeStatus.balanceRate,
          upph: realtimeStatus.upph,
          taktAchievement: realtimeStatus.taktAchievement,
          productionActual: realtimeStatus.productionActual,
        });
      }
      refetchStatus();
      setLastUpdateTime(new Date());
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetchStatus, refreshInterval, realtimeStatus]);

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

  if (statusLoading || trendLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (!realtimeStatus) {
    return <div className="p-6 text-center text-gray-500">無法載入監控資料</div>;
  }

  const updateTimeStr = lastUpdateTime.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const trendData = historicalTrend?.map((item: HistoricalTrend) => ({
    time: new Date(item.timestamp).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
    balanceRate: item.balanceRate,
    upph: item.upph,
    taktAchievement: item.taktAchievement,
  })) || [];

  const criticalAnomalies = useMemo(() => realtimeStatus.anomalies.filter((a: any) => a.level === "critical"), [realtimeStatus.anomalies]);
  const warningAnomalies = useMemo(() => realtimeStatus.anomalies.filter((a: any) => a.level === "warning"), [realtimeStatus.anomalies]);
  
  // 生成 AI 改善建議
  const getAISuggestions = (wsName: string, status: string) => {
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
      <div className={`mb-6 flex items-center justify-between ${isFullscreen ? "p-6" : ""} border-b border-cyan-500/20 pb-4`}>
        <div>
          <h1 className="text-3xl font-bold text-cyan-400">產線戰情監控</h1>
          <p className="mt-1 text-xs text-cyan-400/60">最後更新: {updateTimeStr}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`rounded-lg px-4 py-2 font-semibold transition flex items-center gap-2 ${
              autoRefresh
                ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                : "bg-gray-500/20 text-gray-400 hover:bg-gray-500/30"
            }`}
          >
            <RotateCw size={16} />
            {autoRefresh ? "自動更新" : "手動模式"}
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-lg bg-cyan-500/20 px-4 py-2 font-semibold text-cyan-400 transition hover:bg-cyan-500/30 flex items-center gap-2"
          >
            {isFullscreen ? (
              <>
                <Minimize2 size={16} />
                退出全螢幕
              </>
            ) : (
              <>
                <Maximize2 size={16} />
                全螢幕
              </>
            )}
          </button>
        </div>
      </div>

      {/* 更新間隔設定 */}
      <div className={`mb-4 flex items-center gap-2 ${isFullscreen ? "px-6" : ""}`}>
        <span className="text-xs text-cyan-400/60">更新間隔:</span>
        <select
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
          className="rounded bg-slate-800 px-2 py-1 text-xs text-cyan-400 border border-cyan-500/20"
        >
          <option value={10}>10 秒</option>
          <option value={30}>30 秒</option>
          <option value={60}>1 分鐘</option>
          <option value={120}>2 分鐘</option>
        </select>
      </div>

      {/* 主要監控內容 */}
      <div className={`${isFullscreen ? "px-6" : ""}`}>
        {/* KPI 儀表板 */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
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
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* 左側：工站列表 */}
          <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur">
            <div className="border-b border-cyan-500/20 p-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">工站狀態</h2>
            </div>
            <div className="space-y-2 p-4 max-h-96 overflow-y-auto">
              {realtimeStatus.workstations.map((ws: RealtimeWorkstation) => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWs(selectedWs === ws.id ? null : ws.id)}
                  className={`w-full rounded-lg border-2 p-3 text-left transition ${
                    selectedWs === ws.id
                      ? "border-cyan-400 bg-cyan-500/10"
                      : "border-cyan-500/20 bg-slate-800/50 hover:border-cyan-500/50"
                  }`}
                >
                  <div className={`flex items-center gap-2`}>
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(ws.status)}`} />
                    <span className="flex-1 text-xs font-semibold">{ws.name}</span>
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
                    <div className={`rounded-full w-12 h-12 flex items-center justify-center font-bold text-xs ${getStatusColor(ws.status)}`}>
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
            <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur p-4">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-cyan-400">24 小時趨勢</h2>
              <ResponsiveContainer width="100%" height={200}>
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
        </div>

        {/* 警示面板 */}
        <div className="rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur">
          <div className="border-b border-cyan-500/20 p-4 cursor-pointer flex items-center justify-between" onClick={() => setExpandedAlerts(!expandedAlerts)}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">實時警示</h2>
            {expandedAlerts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
          {expandedAlerts && (
            <div className="space-y-2 p-4 max-h-64 overflow-y-auto">
              {criticalAnomalies.length === 0 && warningAnomalies.length === 0 ? (
                <p className="text-xs text-green-400">✓ 系統正常運行</p>
              ) : (
                <>
                  {criticalAnomalies.map((anomaly: any) => (
                    <div key={anomaly.id} className="rounded-lg border-l-4 border-red-500 bg-red-500/10 p-3">
                      <p className="text-xs font-bold text-red-400">🚨 {anomaly.wsName}: {anomaly.message}</p>
                      {anomaly.suggestedAction && <p className="mt-1 text-xs text-red-300">{anomaly.suggestedAction}</p>}
                    </div>
                  ))}
                  {warningAnomalies.map((anomaly: any) => (
                    <div key={anomaly.id} className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/10 p-3">
                      <p className="text-xs font-bold text-yellow-400">⚠️ {anomaly.wsName}: {anomaly.message}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* 工站詳細分析 */}
        {selectedWs && (
          <div className="mt-6 rounded-lg border border-cyan-500/20 bg-slate-900/50 backdrop-blur p-4">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-cyan-400">
              {realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.name} - 詳細分析
            </h2>
            {realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs) && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
