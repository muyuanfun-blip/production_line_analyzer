import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, ChevronRight, BarChart3, TrendingUp, AlertTriangle,
  CheckCircle, Clock, Users, Target, Download, Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, Legend
} from "recharts";
import { toast } from "sonner";

const COLORS = {
  bottleneck: "#f97316",
  warning: "#eab308",
  normal: "#22d3ee",
  efficient: "#4ade80",
  target: "#a78bfa",
};

function getBarColor(cycleTime: number, maxTime: number, targetTime?: number) {
  const ratio = cycleTime / maxTime;
  if (ratio >= 0.95) return COLORS.bottleneck;
  if (ratio >= 0.80) return COLORS.warning;
  if (targetTime && cycleTime <= targetTime * 0.7) return COLORS.efficient;
  return COLORS.normal;
}

export default function BalanceAnalysis() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: workstations, isLoading } = trpc.workstation.listByLine.useQuery({ productionLineId: lineId });

  const analysis = useMemo(() => {
    if (!workstations || workstations.length === 0) return null;
    const times = workstations.map(w => parseFloat(w.cycleTime.toString()));
    const totalTime = times.reduce((s, t) => s + t, 0);
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    const avgTime = totalTime / times.length;
    const bottleneck = workstations.find(w => parseFloat(w.cycleTime.toString()) === maxTime);
    const targetCycleTime = line?.targetCycleTime ? parseFloat(line.targetCycleTime.toString()) : undefined;

    // Balance Rate = Sum of all CT / (Max CT × Number of stations) × 100%
    const balanceRate = (totalTime / (maxTime * workstations.length)) * 100;
    // Balance Loss = 1 - Balance Rate
    const balanceLoss = 100 - balanceRate;
    // Efficiency vs target
    const targetEfficiency = targetCycleTime
      ? Math.min((targetCycleTime / maxTime) * 100, 100)
      : null;

    const chartData = workstations.map(w => ({
      name: w.name.length > 8 ? w.name.substring(0, 8) + "…" : w.name,
      fullName: w.name,
      cycleTime: parseFloat(w.cycleTime.toString()),
      manpower: w.manpower,
      color: getBarColor(parseFloat(w.cycleTime.toString()), maxTime, targetCycleTime),
      isBottleneck: parseFloat(w.cycleTime.toString()) === maxTime,
    }));

    return {
      totalTime, maxTime, minTime, avgTime, balanceRate, balanceLoss,
      bottleneck, targetCycleTime, targetEfficiency, chartData,
      workstationCount: workstations.length,
      totalManpower: workstations.reduce((s, w) => s + w.manpower, 0),
    };
  }, [workstations, line]);

  const handleExportReport = () => {
    if (!analysis || !workstations) { toast.error("沒有資料可導出"); return; }
    const header = "產線平衡分析報告\n";
    const summary = [
      `生產線：${line?.name}`,
      `分析時間：${new Date().toLocaleString("zh-TW")}`,
      ``,
      `=== 平衡指標 ===`,
      `工站數量：${analysis.workstationCount}`,
      `總工序時間：${analysis.totalTime.toFixed(1)}s`,
      `最大工序時間（瓶頸）：${analysis.maxTime.toFixed(1)}s`,
      `最小工序時間：${analysis.minTime.toFixed(1)}s`,
      `平均工序時間：${analysis.avgTime.toFixed(1)}s`,
      `產線平衡率：${analysis.balanceRate.toFixed(1)}%`,
      `平衡損失率：${analysis.balanceLoss.toFixed(1)}%`,
      `瓶頸工站：${analysis.bottleneck?.name}`,
      ``,
      `=== 工站明細 ===`,
      `工站名稱,工序時間(s),人員配置,與瓶頸差異`,
      ...workstations.map(w => {
        const ct = parseFloat(w.cycleTime.toString());
        const diff = ((ct - analysis.maxTime) / analysis.maxTime * 100).toFixed(1);
        return `${w.name},${ct.toFixed(1)},${w.manpower},${diff}%`;
      }),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + header + summary], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${line?.name ?? "balance"}_平衡分析報告.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("報告已下載");
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-xl text-sm">
          <p className="font-semibold text-foreground mb-2">{d.fullName}</p>
          <p className="text-cyan-400">工序時間：{d.cycleTime.toFixed(1)}s</p>
          <p className="text-muted-foreground">人員配置：{d.manpower} 人</p>
          {d.isBottleneck && <p className="text-orange-400 font-medium mt-1">⚠ 瓶頸工站</p>}
          {analysis?.targetCycleTime && (
            <p className={d.cycleTime > analysis.targetCycleTime ? "text-orange-400" : "text-emerald-400"}>
              目標節拍：{analysis.targetCycleTime}s {d.cycleTime > analysis.targetCycleTime ? "（超出）" : "（達標）"}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/lines")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>生產線管理</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium truncate">{line?.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">產線平衡分析</h1>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportReport}>
          <Download className="h-4 w-4 mr-2" />
          導出報告
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-card animate-pulse border border-border" />
          ))}
        </div>
      ) : !analysis ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-12 text-center">
            <BarChart3 className="h-16 w-16 text-primary/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">尚無工站資料</h3>
            <p className="text-muted-foreground text-sm mb-6">請先在工站管理頁面新增工站資料</p>
            <Button onClick={() => setLocation(`/lines/${lineId}/workstations`)}>
              前往工站管理
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "產線平衡率",
                value: `${analysis.balanceRate.toFixed(1)}%`,
                sub: analysis.balanceRate >= 85 ? "優秀" : analysis.balanceRate >= 70 ? "良好" : "需改善",
                icon: TrendingUp,
                color: analysis.balanceRate >= 85 ? "text-emerald-400" : analysis.balanceRate >= 70 ? "text-amber-400" : "text-orange-400",
                bg: analysis.balanceRate >= 85 ? "bg-emerald-400/10" : analysis.balanceRate >= 70 ? "bg-amber-400/10" : "bg-orange-400/10",
              },
              {
                label: "瓶頸工站時間",
                value: `${analysis.maxTime.toFixed(1)}s`,
                sub: analysis.bottleneck?.name ?? "",
                icon: AlertTriangle,
                color: "text-orange-400",
                bg: "bg-orange-400/10",
              },
              {
                label: "平均工序時間",
                value: `${analysis.avgTime.toFixed(1)}s`,
                sub: `共 ${analysis.workstationCount} 個工站`,
                icon: Clock,
                color: "text-cyan-400",
                bg: "bg-cyan-400/10",
              },
              {
                label: "平衡損失率",
                value: `${analysis.balanceLoss.toFixed(1)}%`,
                sub: "可改善空間",
                icon: Target,
                color: "text-violet-400",
                bg: "bg-violet-400/10",
              },
            ].map(kpi => (
              <Card key={kpi.label} className="border-border bg-card">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <div className={`h-8 w-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Balance Rate Progress */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                平衡率評估
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">產線平衡率</span>
                  <span className={`font-bold ${analysis.balanceRate >= 85 ? "text-emerald-400" : analysis.balanceRate >= 70 ? "text-amber-400" : "text-orange-400"}`}>
                    {analysis.balanceRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${analysis.balanceRate}%`,
                      background: analysis.balanceRate >= 85
                        ? "linear-gradient(90deg, #4ade80, #22d3ee)"
                        : analysis.balanceRate >= 70
                        ? "linear-gradient(90deg, #eab308, #f97316)"
                        : "linear-gradient(90deg, #f97316, #ef4444)",
                    }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-center">
                  <div className="p-2 rounded-lg bg-orange-400/10 border border-orange-400/20">
                    <p className="text-orange-400 font-medium">需改善</p>
                    <p className="text-muted-foreground">{"< 70%"}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/20">
                    <p className="text-amber-400 font-medium">良好</p>
                    <p className="text-muted-foreground">70% ~ 85%</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
                    <p className="text-emerald-400 font-medium">優秀</p>
                    <p className="text-muted-foreground">{"> 85%"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                工站工序時間分佈
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.chartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.015 240)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "oklch(0.60 0.01 240)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "oklch(0.60 0.01 240)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      unit="s"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {analysis.targetCycleTime && (
                      <ReferenceLine
                        y={analysis.targetCycleTime}
                        stroke={COLORS.target}
                        strokeDasharray="6 3"
                        label={{ value: `目標 ${analysis.targetCycleTime}s`, fill: COLORS.target, fontSize: 11, position: "right" }}
                      />
                    )}
                    <ReferenceLine
                      y={analysis.avgTime}
                      stroke="oklch(0.60 0.01 240)"
                      strokeDasharray="3 3"
                      label={{ value: `均值 ${analysis.avgTime.toFixed(1)}s`, fill: "oklch(0.60 0.01 240)", fontSize: 10, position: "right" }}
                    />
                    <Bar dataKey="cycleTime" radius={[4, 4, 0, 0]} maxBarSize={60}>
                      {analysis.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-3 justify-center text-xs">
                {[
                  { color: COLORS.bottleneck, label: "瓶頸工站 (≥95% 最大值)" },
                  { color: COLORS.warning, label: "警示工站 (80~95%)" },
                  { color: COLORS.normal, label: "正常工站" },
                  { color: COLORS.efficient, label: "高效工站" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                    <span className="text-muted-foreground">{l.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Workstation Detail Table */}
          <Card className="border-border bg-card overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                工站詳細分析
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">工站名稱</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">工序時間</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">人員</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">佔比</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">與瓶頸差</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {workstations?.map((ws) => {
                    const ct = parseFloat(ws.cycleTime.toString());
                    const pct = (ct / analysis.totalTime * 100).toFixed(1);
                    const diff = ((ct - analysis.maxTime) / analysis.maxTime * 100).toFixed(1);
                    const isBottleneck = ct === analysis.maxTime;
                    const isWarning = ct / analysis.maxTime >= 0.8 && !isBottleneck;
                    return (
                      <tr key={ws.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isBottleneck && <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />}
                            <span className="text-sm font-medium">{ws.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-mono font-bold ${isBottleneck ? "text-orange-400" : isWarning ? "text-amber-400" : "text-cyan-400"}`}>
                            {ct.toFixed(1)}s
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground">{ws.manpower}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm text-muted-foreground">{pct}%</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-sm font-mono ${isBottleneck ? "text-muted-foreground" : "text-emerald-400"}`}>
                            {isBottleneck ? "—" : `${diff}%`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isBottleneck ? "badge-bottleneck" : isWarning ? "badge-normal" : "badge-efficient"}`}>
                            {isBottleneck ? "瓶頸" : isWarning ? "警示" : "正常"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
