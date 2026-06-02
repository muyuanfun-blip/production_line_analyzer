import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, TrendingUp, Users, Zap, Activity } from "lucide-react";
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
      return "bg-green-500";
    case "warning":
      return "bg-yellow-500";
    case "critical":
      return "bg-red-500";
    case "offline":
      return "bg-gray-500";
    case "idle":
      return "bg-blue-500";
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

export default function MonitoringDashboard() {
  const { lineId } = useParams<{ lineId: string }>();
  const [autoRefresh, setAutoRefresh] = useState(true);

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

  // 產品流程查詢
  const { data: productFlowRecords, isLoading: flowLoading } = trpc.monitoring.getProductFlowRecords.useQuery(
    { productionLineId: parseInt(lineId || "0"), productCount: 10 },
    { enabled: !!lineId }
  );

  // 自動刷新效果
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refetchStatus();
    }, 3000); // 3 秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, refetchStatus]);

  if (statusLoading || trendLoading || flowLoading) {
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
    productionActual: item.productionActual,
  })) || [];

  const wsData = realtimeStatus.workstations.map((ws: RealtimeWorkstation) => ({
    name: ws.name,
    ct: ws.cycleTime,
    target: ws.targetCycleTime,
    efficiency: ws.efficiency,
    utilization: ws.utilization,
  }));

  const criticalAnomalies = realtimeStatus.anomalies.filter((a: any) => a.level === "critical");
  const warningAnomalies = realtimeStatus.anomalies.filter((a: any) => a.level === "warning");

  return (
    <div className="space-y-6 p-6">
      {/* 頂部標題與刷新控制 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{realtimeStatus.lineName} - 戰情監控</h1>
          <p className="text-sm text-gray-500">
            最後更新：{new Date(realtimeStatus.timestamp).toLocaleTimeString("zh-TW")}
          </p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            autoRefresh
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-gray-300 text-gray-700 hover:bg-gray-400"
          }`}
        >
          {autoRefresh ? "✓ 自動刷新中" : "暫停刷新"}
        </button>
      </div>

      {/* 警示區域 */}
      {criticalAnomalies.length > 0 && (
        <Card className="border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              緊急警示 ({criticalAnomalies.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {criticalAnomalies.map((anomaly: any) => (
              <div key={anomaly.id} className="rounded bg-red-100 p-3">
                <p className="font-semibold text-red-700">{anomaly.wsName}: {anomaly.message}</p>
                {anomaly.suggestedAction && (
                  <p className="mt-1 text-sm text-red-600">💡 {anomaly.suggestedAction}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPI 儀表板 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">平衡率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{realtimeStatus.balanceRate}%</div>
            <p className="text-xs text-gray-500">
              {realtimeStatus.balanceRate >= 80 ? "✓ 優秀" : realtimeStatus.balanceRate >= 70 ? "△ 良好" : "✗ 需改善"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">UPPH</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{realtimeStatus.upph}</div>
            <p className="text-xs text-gray-500">件/小時</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Takt 達標率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{realtimeStatus.taktAchievement}%</div>
            <p className="text-xs text-gray-500">
              {realtimeStatus.taktAchievement >= 80 ? "✓ 達標" : "✗ 未達標"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">產能達成率</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Math.round((realtimeStatus.productionActual / realtimeStatus.productionTarget) * 100)}%
            </div>
            <p className="text-xs text-gray-500">
              {realtimeStatus.productionActual} / {realtimeStatus.productionTarget}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 工站狀態面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            工站狀態監控
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {realtimeStatus.workstations.map((ws: RealtimeWorkstation) => (
              <div
                key={ws.id}
                className={`rounded-lg border-2 p-4 ${
                  ws.id === realtimeStatus.bottleneckWsId ? "border-orange-500 bg-orange-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${getStatusColor(ws.status)}`} />
                      <h3 className="font-semibold">{ws.name}</h3>
                      {ws.id === realtimeStatus.bottleneckWsId && (
                        <span className="ml-2 rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white">
                          瓶頸
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      狀態：{getStatusLabel(ws.status)} | CT：{ws.cycleTime.toFixed(1)}s / {ws.targetCycleTime}s | 人力：{ws.manpower}人
                    </p>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-lg font-bold">{ws.efficiency.toFixed(0)}%</div>
                    <p className="text-xs text-gray-500">效率</p>
                  </div>
                </div>

                {/* 進度條 */}
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full transition-all ${
                      ws.efficiency >= 90
                        ? "bg-green-500"
                        : ws.efficiency >= 75
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(ws.efficiency, 100)}%` }}
                  />
                </div>

                {ws.currentProduct && (
                  <p className="mt-2 text-xs text-gray-500">
                    當前加工：{ws.currentProduct} | 等待產品：{ws.waitingProducts}
                  </p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 工站時間分佈圖 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            工站時間分佈
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={wsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="ct" fill="#ef4444" name="實際 CT" />
              <Bar dataKey="target" fill="#3b82f6" name="目標 CT" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 歷史趨勢圖 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            24 小時趨勢
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="balanceRate" stroke="#10b981" name="平衡率 %" />
              <Line yAxisId="right" type="monotone" dataKey="upph" stroke="#f59e0b" name="UPPH" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 預警列表 */}
      {warningAnomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" />
              預警提示 ({warningAnomalies.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warningAnomalies.map((anomaly: any) => (
              <div key={anomaly.id} className="rounded bg-yellow-50 p-3">
                <p className="font-semibold text-yellow-700">{anomaly.wsName}: {anomaly.message}</p>
                {anomaly.suggestedAction && (
                  <p className="mt-1 text-sm text-yellow-600">💡 {anomaly.suggestedAction}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
