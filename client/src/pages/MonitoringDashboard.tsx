import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, ChevronDown, ChevronUp, Zap, Activity, Clock } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

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

const KPICard = ({ label, value, unit, status }: { label: string; value: number | string; unit?: string; status?: "good" | "warning" | "critical" }) => {
  const statusColor = {
    good: "text-green-400",
    warning: "text-yellow-400",
    critical: "text-red-400",
  };

  // 確保 value 不是 NaN
  const displayValue = typeof value === 'number' && isNaN(value) ? '0' : value;

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-lg shadow-cyan-500/20">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">{label}</p>
      <div className={`mt-2 text-3xl font-bold ${status ? statusColor[status] : "text-cyan-300"}`}>
        {displayValue}
        {unit && <span className="text-lg text-cyan-400">{unit}</span>}
      </div>
    </div>
  );
};

export default function MonitoringDashboard() {
  const { lineId } = useParams<{ lineId: string }>();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedWs, setSelectedWs] = useState<number | null>(null);
  const [expandedAlerts, setExpandedAlerts] = useState(true);

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

  // 自動刷新效果
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      refetchStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, refetchStatus]);

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

  const trendData = historicalTrend?.map((item: HistoricalTrend) => ({
    time: new Date(item.timestamp).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
    balanceRate: item.balanceRate,
    upph: item.upph,
    taktAchievement: item.taktAchievement,
  })) || [];

  const criticalAnomalies = realtimeStatus.anomalies.filter((a: any) => a.level === "critical");
  const warningAnomalies = realtimeStatus.anomalies.filter((a: any) => a.level === "warning");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 text-white">
      {/* 掃描線效果背景 */}
      <div className="pointer-events-none fixed inset-0 opacity-5">
        <div className="h-full w-full" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 255, 255, 0.03) 2px, rgba(0, 255, 255, 0.03) 4px)",
        }} />
      </div>

      {/* 頂部狀態欄 */}
      <div className="relative mb-6 rounded-lg border border-cyan-500/30 bg-gradient-to-r from-slate-900/80 to-slate-800/80 p-4 shadow-lg shadow-cyan-500/10 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-cyan-300">{realtimeStatus.lineName}</h1>
            <p className="mt-1 text-xs text-cyan-400/60">
              ● 系統狀態：{autoRefresh ? "實時監控中" : "暫停"} | 最後更新：{new Date(realtimeStatus.timestamp).toLocaleTimeString("zh-TW")}
            </p>
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`rounded-lg px-4 py-2 font-semibold transition ${
              autoRefresh
                ? "border border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                : "border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20"
            }`}
          >
            {autoRefresh ? "● 實時中" : "⏸ 暫停"}
          </button>
        </div>
      </div>

      {/* KPI 一表板 */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <KPICard
          label="平衡率"
          value={isNaN(realtimeStatus.balanceRate) ? 0 : realtimeStatus.balanceRate}
          unit="%"
          status={realtimeStatus.balanceRate >= 80 ? "good" : realtimeStatus.balanceRate >= 70 ? "warning" : "critical"}
        />
        <KPICard
          label="UPPH"
          value={isNaN(realtimeStatus.upph) ? 0 : realtimeStatus.upph}
          unit="件/h"
          status="good"
        />
        <KPICard
          label="Takt 達標率"
          value={isNaN(realtimeStatus.taktAchievement) ? 0 : realtimeStatus.taktAchievement}
          unit="%"
          status={realtimeStatus.taktAchievement >= 80 ? "good" : "warning"}
        />
        <KPICard
          label="產能達成率"
          value={isNaN(realtimeStatus.productionActual / realtimeStatus.productionTarget) ? 0 : Math.round((realtimeStatus.productionActual / realtimeStatus.productionTarget) * 100)}
          unit="%"
          status={Math.round((realtimeStatus.productionActual / realtimeStatus.productionTarget) * 100) >= 80 ? "good" : "warning"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* 左側：工站狀態列表 */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg shadow-cyan-500/10">
            <div className="border-b border-cyan-500/20 px-4 py-3">
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
                      <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-xs font-bold text-orange-400">璶頸</span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-cyan-400/60">
                    CT: {isNaN(ws.cycleTime) ? '0' : ws.cycleTime.toFixed(1)}s / {isNaN(ws.targetCycleTime) ? '0' : ws.targetCycleTime}s
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 中央：主監控區 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 工站流程圖 */}
          <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg shadow-cyan-500/10">
            <div className="border-b border-cyan-500/20 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">產線流程圖</h2>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-3">
                {realtimeStatus.workstations.map((ws: RealtimeWorkstation, idx: number) => (
                  <div key={ws.id} className="flex items-center gap-3">
                    <div
                      className={`rounded-lg border-2 border-cyan-500/30 px-3 py-2 text-center ${getStatusColor(ws.status)} transition`}
                    >
                      <div className="text-xs font-bold">{ws.name}</div>
                      <div className="text-xs text-white/80">{isNaN(ws.efficiency) ? '0' : ws.efficiency.toFixed(0)}%</div>
                    </div>
                    {idx < realtimeStatus.workstations.length - 1 && (
                      <div className="text-cyan-400">→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 趨勢圖 */}
          <div className="rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg shadow-cyan-500/10">
            <div className="border-b border-cyan-500/20 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">24 小時趨勢</h2>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 255, 0.1)" />
                  <XAxis dataKey="time" stroke="rgba(0, 255, 255, 0.5)" />
                  <YAxis stroke="rgba(0, 255, 255, 0.5)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      border: "1px solid rgba(0, 255, 255, 0.3)",
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="balanceRate" stroke="#10b981" name="平衡率 %" strokeWidth={2} />
                  <Line type="monotone" dataKey="upph" stroke="#f59e0b" name="UPPH" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 右側：警示面板 */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-red-500/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg shadow-red-500/10">
            <button
              onClick={() => setExpandedAlerts(!expandedAlerts)}
              className="w-full border-b border-red-500/20 px-4 py-3 flex items-center justify-between hover:bg-red-500/5 transition"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">
                警示面板 ({criticalAnomalies.length + warningAnomalies.length})
              </h2>
              {expandedAlerts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {expandedAlerts && (
              <div className="space-y-2 p-4 max-h-96 overflow-y-auto">
                {/* 緊急警示 */}
                {criticalAnomalies.map((anomaly: any) => (
                  <div key={anomaly.id} className="rounded-lg border-l-4 border-red-500 bg-red-500/10 p-3">
                    <p className="text-xs font-bold text-red-400">🚨 {anomaly.wsName}</p>
                    <p className="mt-1 text-xs text-red-300">{anomaly.message}</p>
                    {anomaly.suggestedAction && (
                      <p className="mt-1 text-xs text-red-200">💡 {anomaly.suggestedAction}</p>
                    )}
                  </div>
                ))}

                {/* 預警 */}
                {warningAnomalies.map((anomaly: any) => (
                  <div key={anomaly.id} className="rounded-lg border-l-4 border-yellow-500 bg-yellow-500/10 p-3">
                    <p className="text-xs font-bold text-yellow-400">⚠️ {anomaly.wsName}</p>
                    <p className="mt-1 text-xs text-yellow-300">{anomaly.message}</p>
                  </div>
                ))}

                {criticalAnomalies.length === 0 && warningAnomalies.length === 0 && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center">
                    <p className="text-xs text-green-400">✓ 系統正常</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 選中工站詳細分析 */}
      {selectedWs && (
        <div className="mt-6 rounded-lg border border-cyan-500/30 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg shadow-cyan-500/10">
          <div className="border-b border-cyan-500/20 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-cyan-400">
              {realtimeStatus.workstations.find((ws: RealtimeWorkstation) => ws.id === selectedWs)?.name} - 詳細分析
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
            {realtimeStatus.workstations
              .filter((ws: RealtimeWorkstation) => ws.id === selectedWs)
              .map((ws: RealtimeWorkstation) => (
                <div key={ws.id} className="space-y-3">
                  <KPICard label="效率" value={isNaN(ws.efficiency) ? '0' : ws.efficiency.toFixed(1)} unit="%" status={ws.efficiency >= 90 ? "good" : "warning"} />
                  <KPICard label="利用率" value={isNaN(ws.utilization) ? '0' : ws.utilization.toFixed(1)} unit="%" />
                  <KPICard label="人力" value={isNaN(ws.manpower) ? 0 : ws.manpower} />
                  <KPICard label="等待產品" value={isNaN(ws.waitingProducts) ? 0 : ws.waitingProducts} />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
