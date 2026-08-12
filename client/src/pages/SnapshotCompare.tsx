import { useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { rankCycleTimeDifferences } from "@shared/snapshotComparison";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, ReferenceLine, Cell, LabelList
} from "recharts";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  BarChart3, Camera, AlertTriangle, CheckCircle2, Zap
} from "lucide-react";
import { Brain, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useState } from "react";

type WorkstationData = {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  morningManpower?: number | null;
  eveningManpower?: number | null;
  sequenceOrder: number;
  description?: string;
  // 動作拆解摘要（新快照才有）
  actionStepCount?: number;
  totalStepSec?: number;
  valueAddedSec?: number;
  nonValueAddedSec?: number;
  necessaryWasteSec?: number;
  valueAddedRate?: number | null;
};

type Snapshot = {
  id: number;
  name: string;
  note: string | null;
  balanceRate: number;
  balanceLoss: number;
  totalTime: number;
  maxTime: number;
  minTime: number;
  avgTime: number;
  workstationCount: number;
  totalManpower: number;
  taktTime: number | null;
  taktPassRate: number | null;
  taktPassCount: number | null;
  bottleneckName: string | null;
  upph: number | null;
  workstationsData: unknown;
  createdAt: Date;
};

function DeltaBadge({ a, b, unit = "", higherIsBetter = true }: {
  a: number; b: number; unit?: string; higherIsBetter?: boolean;
}) {
  const delta = b - a;
  const improved = higherIsBetter ? delta > 0 : delta < 0;
  const neutral = Math.abs(delta) < 0.05;
  if (neutral) return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
      <Minus className="w-3 h-3" />無變化
    </span>
  );
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${improved ? "text-emerald-400" : "text-red-400"}`}>
      {improved ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {delta > 0 ? "+" : ""}{delta.toFixed(1)}{unit}
    </span>
  );
}

const C = { a: "#22d3ee", b: "#a78bfa", va: "#34d399", nva: "#f87171", nw: "#fbbf24" };

// 風險等級配色（與 BalanceAnalysis 一致）
const RISK_COLORS = {
  exceed:     "#ef4444",
  bottleneck: "#f97316",
  warning:    "#eab308",
  normal:     "#22d3ee",
  efficient:  "#4ade80",
} as const;

type BarStatus = keyof typeof RISK_COLORS;

const RISK_LABEL: Record<BarStatus, string> = {
  exceed:     "超出節拍",
  bottleneck: "甁頃工站",
  warning:    "接近節拍",
  normal:     "正常",
  efficient:  "高效",
};

function getRiskStatus(ct: number, maxTime: number, taktTime?: number): BarStatus {
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

function SnapshotBarChart({ ws, taktTime, label, labelColor }: {
  ws: WorkstationData[];
  taktTime?: number;
  label: string;
  labelColor: string;
}) {
  const maxCT = Math.max(...ws.map(w => w.cycleTime), 0);
  const data = ws.map(w => {
    const status = getRiskStatus(w.cycleTime, maxCT, taktTime);
    return {
      name: w.name.length > 7 ? w.name.slice(0, 6) + "…" : w.name,
      fullName: w.name,
      cycleTime: w.cycleTime,
      manpower: w.manpower,
      status,
      barColor: RISK_COLORS[status],
    };
  });

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof data[0] }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]!.payload;
    return (
      <div className="bg-card border border-border rounded-lg p-2.5 text-xs shadow-xl">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="font-semibold text-foreground">{d.fullName}</span>
          <span className="px-1 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: `${d.barColor}25`, color: d.barColor, border: `1px solid ${d.barColor}40` }}>
            {RISK_LABEL[d.status]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">週期時間：</span>
          <span className="font-mono font-bold" style={{ color: d.barColor }}>{d.cycleTime.toFixed(1)}s</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-muted-foreground">人員數：</span>
          <span className="text-foreground">{parseFloat(d.manpower.toString()).toFixed(2)}人</span>
        </div>
        {taktTime && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-muted-foreground">vs TT：</span>
            <span className={d.cycleTime <= taktTime ? "text-emerald-400" : "text-red-400"}>
              {d.cycleTime <= taktTime ? "✓ 達標" : `+${(d.cycleTime - taktTime).toFixed(1)}s`}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: labelColor }} />
        <span className="text-sm font-semibold" style={{ color: labelColor }}>{label}</span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 20, right: 8, left: 0, bottom: 45 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} angle={-35} textAnchor="end" interval={0} height={50} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} tickFormatter={v => `${v}s`}
            domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.18)]} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          {taktTime && (
            <ReferenceLine y={taktTime} stroke="#a78bfa" strokeDasharray="6 3" strokeWidth={1.5}
              label={{ value: `TT ${taktTime}s`, position: "insideTopRight", fill: "#a78bfa", fontSize: 10 }} />
          )}
          <Bar dataKey="cycleTime" radius={[3, 3, 0, 0]} maxBarSize={50}>
            <LabelList dataKey="cycleTime" position="top"
              formatter={(v: number) => `${v.toFixed(1)}s`}
              style={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
            <LabelList dataKey="manpower" position="insideBottom" offset={5}
              formatter={(v: number) => v > 0 ? `${v}人` : ""}
              style={{ fill: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight: 600 }} />
            {data.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={entry.barColor} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* 圖例 */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-[10px] text-muted-foreground mt-1">
        {(Object.entries(RISK_COLORS) as [BarStatus, string][]).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
            <span>{RISK_LABEL[key]}</span>
          </div>
        ))}
        {taktTime && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-0" style={{ borderTop: "2px dashed #a78bfa" }} />
            <span>Takt Time</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SnapshotCompare() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const search = useSearch();
  const sp = new URLSearchParams(search);
  const idA = parseInt(sp.get("a") ?? "0");
  const idB = parseInt(sp.get("b") ?? "0");

  const { data: snapA } = trpc.snapshot.getById.useQuery({ id: idA }, { enabled: idA > 0 });
  const { data: snapB } = trpc.snapshot.getById.useQuery({ id: idB }, { enabled: idB > 0 });
  const { data: allSnaps = [] } = trpc.snapshot.listByLine.useQuery(
    { productionLineId: lineId }, { enabled: lineId > 0 }
  );

  // AI 比較分析狀態
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const compareSnapshotsMutation = trpc.analysis.compareSnapshots.useMutation({
    onSuccess: (data) => { setAiReport(data.report); setAiError(null); },
    onError: (err) => { setAiError(err.message); },
  });

  const wsA = useMemo(() => {
    if (!snapA) return [] as WorkstationData[];
    return (snapA.workstationsData as WorkstationData[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [snapA]);

  const wsB = useMemo(() => {
    if (!snapB) return [] as WorkstationData[];
    return (snapB.workstationsData as WorkstationData[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [snapB]);

  // 工站差異比較資料（含增值率）
  const stationDiff = useMemo(() => {
    const allNames = Array.from(new Set([...wsA.map(w => w.name), ...wsB.map(w => w.name)]));
    return allNames.map(name => {
      const a = wsA.find(w => w.name === name);
      const b = wsB.find(w => w.name === name);
      const delta = (b?.cycleTime ?? 0) - (a?.cycleTime ?? 0);
      const vaA = a?.valueAddedRate ?? null;
      const vaB = b?.valueAddedRate ?? null;
      const vaDelta = vaA != null && vaB != null ? vaB - vaA : null;
      return {
        name,
        stationA: a,
        stationB: b,
        "A 週期時間": a?.cycleTime ?? null,
        "B 週期時間": b?.cycleTime ?? null,
        delta,
        improved: delta < -0.1,
        worsened: delta > 0.1,
        onlyA: !b,
        onlyB: !a,
        vaA,
        vaB,
        vaDelta,
        vaImproved: vaDelta != null ? vaDelta > 0.5 : null,
        vaWorsened: vaDelta != null ? vaDelta < -0.5 : null,
      };
    });
  }, [wsA, wsB]);

  // 依週期時間的絕對變化排序，保留前三個差異最大的工站。
  // 只有一側快照有資料的新增／移除工站，也會列入比較以利追溯流程變動。
  const topStationDifferences = useMemo(() => {
    return rankCycleTimeDifferences(stationDiff);
  }, [stationDiff]);

  // 增值率對比圖表資料（只取兩快照都有 valueAddedRate 的工站）
  const vaChartData = useMemo(() => {
    return stationDiff
      .filter(r => r.vaA != null || r.vaB != null)
      .map(r => ({
        name: r.name.length > 8 ? r.name.slice(0, 8) + "…" : r.name,
        "A 增值率": r.vaA,
        "B 增值率": r.vaB,
      }));
  }, [stationDiff]);

  // 整體增值率摘要（快照層級）
  const overallVA = useMemo(() => {
    const calcAvg = (ws: WorkstationData[]) => {
      const withData = ws.filter(w => w.valueAddedRate != null);
      if (withData.length === 0) return null;
      return withData.reduce((s, w) => s + (w.valueAddedRate ?? 0), 0) / withData.length;
    };
    return { a: calcAvg(wsA), b: calcAvg(wsB) };
  }, [wsA, wsB]);

  // 趨勢圖（所有快照按時間正序）
  const trendData = useMemo(() => {
    return [...(allSnaps as Snapshot[])].reverse().map(s => ({
      name: s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name,
      平衡率: s.balanceRate,
      達標率: s.taktPassRate ?? undefined,
      UPPH: s.upph != null ? parseFloat(Number(s.upph).toFixed(4)) : undefined,
    }));
  }, [allSnaps]);

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  if (!snapA || !snapB) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Camera className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>載入快照資料中...</p>
        </div>
      </div>
    );
  }

  const A = snapA as Snapshot;
  const B = snapB as Snapshot;

  const kpis = [
    { label: "產線平衡率", a: A.balanceRate, b: B.balanceRate, unit: "%", higherIsBetter: true, color: "#22d3ee" },
    { label: "瓶頸工站時間", a: A.maxTime, b: B.maxTime, unit: "s", higherIsBetter: false, color: "#f87171" },
    { label: "平均工序時間", a: A.avgTime, b: B.avgTime, unit: "s", higherIsBetter: false, color: "#fbbf24" },
    {
      label: "Takt Time 達標率",
      a: A.taktPassRate ?? 0, b: B.taktPassRate ?? 0,
      unit: "%", higherIsBetter: true,
      noData: !A.taktPassRate && !B.taktPassRate,
      color: "#a78bfa",
    },
  ];
  const hasUpphData = A.upph != null || B.upph != null;

  const improvedCount = stationDiff.filter(r => r.improved).length;
  const worsenedCount = stationDiff.filter(r => r.worsened).length;
  const neutralCount = stationDiff.filter(r => !r.improved && !r.worsened && !r.onlyA && !r.onlyB).length;
  const hasVAData = vaChartData.length > 0;

  // 雷達圖數據（標準化到 0-100）
  const radarData = [
    {
      metric: "平衡率",
      A: A.balanceRate,
      B: B.balanceRate,
      fullMark: 100,
    },
    {
      metric: "Takt 達標率",
      A: A.taktPassRate ?? 0,
      B: B.taktPassRate ?? 0,
      fullMark: 100,
    },
    {
      metric: "UPPH 效率",
      A: A.upph != null ? Math.min((A.upph / 20) * 100, 100) : 0,
      B: B.upph != null ? Math.min((B.upph / 20) * 100, 100) : 0,
      fullMark: 100,
    },
    {
      metric: "增值率",
      A: overallVA.a ?? 0,
      B: overallVA.b ?? 0,
      fullMark: 100,
    },
    {
      metric: "工站改善率",
      A: stationDiff.length > 0 ? Math.round((improvedCount / stationDiff.length) * 100) : 0,
      B: stationDiff.length > 0 ? Math.round((improvedCount / stationDiff.length) * 100) : 0,
      fullMark: 100,
    },
  ];

  // AI 比較分析
  const handleAIAnalyze = () => {
    setAiReport(null);
    setAiError(null);
    compareSnapshotsMutation.mutate({
      productionLineId: lineId,
      productionLineName: A.name.split(" ")[0] ?? "產線",
      snapshot1Name: A.name,
      snapshot2Name: B.name,
      snapshot1Data: A,
      snapshot2Data: B,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* 頁首 */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon"
          onClick={() => navigate(`/lines/${lineId}/snapshots`)}
          className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <div className="text-sm text-muted-foreground mb-1">歷史快照 › 快照比較</div>
          <h1 className="text-2xl font-bold text-foreground">快照比較分析</h1>
          <p className="text-sm text-muted-foreground mt-1">對比兩個時間點的產線平衡狀態與增值率，追蹤改善成效</p>
        </div>
      </div>

      {/* 快照標籤 */}
      <div className="grid grid-cols-2 gap-4">
        {[{ snap: A, color: C.a, label: "快照 A（基準）" }, { snap: B, color: C.b, label: "快照 B（比較）" }].map(({ snap, color, label }) => (
          <Card key={snap.id} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <div className="font-semibold text-foreground">{snap.name}</div>
              {snap.note && <div className="text-xs text-muted-foreground mt-0.5">{snap.note}</div>}
              <div className="text-xs text-muted-foreground mt-1">{formatDate(snap.createdAt)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* KPI 比較（含整體增值率）*/}
      {/* KPI 比較（視覺化版本）*/}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 左側：KPI 指標卡片 */}
        <div className="space-y-3">
          {kpis.map(({ label, a, b, unit, higherIsBetter, noData, color }) => {
            const delta = b - a;
            const improved = higherIsBetter ? delta > 0 : delta < 0;
            const neutral = Math.abs(delta) < 0.05;
            const maxVal = unit === "%" ? 100 : Math.max(a, b) * 1.2;
            return (
              <Card key={label} className="bg-card border-border overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    {!noData && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        neutral ? "bg-gray-500/20 text-gray-400" :
                        improved ? "bg-emerald-500/20 text-emerald-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>
                        {neutral ? "持平" : improved ? `▲ +${Math.abs(delta).toFixed(1)}${unit}` : `▼ -${Math.abs(delta).toFixed(1)}${unit}`}
                      </span>
                    )}
                  </div>
                  {noData ? (
                    <div className="text-muted-foreground text-sm">未設定</div>
                  ) : (
                    <div className="space-y-2">
                      {/* 快照 A 進度條 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-cyan-400 w-12 shrink-0">快照 A</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((a / maxVal) * 100, 100)}%`, backgroundColor: C.a }} />
                        </div>
                        <span className="text-xs font-mono text-cyan-400 w-14 text-right shrink-0">{a.toFixed(1)}{unit}</span>
                      </div>
                      {/* 快照 B 進度條 */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-violet-400 w-12 shrink-0">快照 B</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((b / maxVal) * 100, 100)}%`, backgroundColor: C.b }} />
                        </div>
                        <span className="text-xs font-mono text-violet-400 w-14 text-right shrink-0">{b.toFixed(1)}{unit}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {/* UPPH 卡片 */}
          <Card className="bg-card border-amber-500/25 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-amber-400 flex items-center gap-1">★ UPPH（件/人/時）</span>
                {A.upph != null && B.upph != null && (() => {
                  const delta = Number(B.upph) - Number(A.upph);
                  const improved = delta > 0;
                  const neutral = Math.abs(delta) < 0.01;
                  return (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      neutral ? "bg-gray-500/20 text-gray-400" :
                      improved ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {neutral ? "持平" : improved ? `▲ +${Math.abs(delta).toFixed(2)}` : `▼ -${Math.abs(delta).toFixed(2)}`}
                    </span>
                  );
                })()}
              </div>
              {!hasUpphData ? (
                <div className="text-muted-foreground text-sm">快照尚無 UPPH</div>
              ) : (
                <div className="space-y-2">
                  {[{ label: "快照 A", val: A.upph, color: C.a }, { label: "快照 B", val: B.upph, color: C.b }].map(({ label, val, color }) => {
                    const maxUpph = Math.max(Number(A.upph ?? 0), Number(B.upph ?? 0)) * 1.2;
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-xs w-12 shrink-0" style={{ color }}>{label}</span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: val != null ? `${Math.min((Number(val) / maxUpph) * 100, 100)}%` : "0%", backgroundColor: color }} />
                        </div>
                        <span className="text-xs font-mono w-16 text-right shrink-0" style={{ color }}>
                          {val != null ? Number(val).toFixed(2) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* 右側：雷達圖 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-400" />
              多維指標雷達圖
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 9 }} />
                <Radar name="快照 A" dataKey="A" stroke={C.a} fill={C.a} fillOpacity={0.2} strokeWidth={2} />
                <Radar name="快照 B" dataKey="B" stroke={C.b} fill={C.b} fillOpacity={0.2} strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)}`, name]}
                />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-1">UPPH 效率以 20 件/人/時為滿分基準</p>
          </CardContent>
        </Card>
        {/* 整體平均增値率 KPI */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              平均增値率
            </div>
            {overallVA.a == null && overallVA.b == null ? (
              <div className="text-muted-foreground text-sm">無動作拆解資料</div>
            ) : (
              <>
                <div className="flex items-end gap-3 mb-2">
                  <div>
                    <div className="text-lg font-bold text-cyan-400">
                      {overallVA.a != null ? `${overallVA.a.toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">快照 A</div>
                  </div>
                  <div className="text-muted-foreground mb-1 text-sm">→</div>
                  <div>
                    <div className="text-lg font-bold text-violet-400">
                      {overallVA.b != null ? `${overallVA.b.toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">快照 B</div>
                  </div>
                </div>
                {overallVA.a != null && overallVA.b != null && (
                  <DeltaBadge a={overallVA.a} b={overallVA.b} unit="%" higherIsBetter={true} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 雙快照並排工序時間分佈圖 */}
      {wsA.length > 0 && wsB.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              工序時間分佈圖對比
              <span className="text-xs text-muted-foreground font-normal ml-1">風險等級配色 · 柱內顯示人員數</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SnapshotBarChart
                ws={wsA}
                taktTime={A.taktTime ? Number(A.taktTime) : undefined}
                label={`快照 A：${A.name}`}
                labelColor={C.a}
              />
              <SnapshotBarChart
                ws={wsB}
                taktTime={B.taktTime ? Number(B.taktTime) : undefined}
                label={`快照 B：${B.name}`}
                labelColor={C.b}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 工站週期時間對比柱狀圖 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            工站週期時間對比
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stationDiff} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="s" />
              <Tooltip
                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                labelStyle={{ color: "#f1f5f9" }}
                formatter={(v: number, name: string) => [v != null ? `${v.toFixed(1)}s` : "—", name]}
              />
              <Legend wrapperStyle={{ paddingTop: "16px" }} />
              {A.taktTime && (
                <ReferenceLine y={A.taktTime} stroke="#a78bfa" strokeDasharray="6 3"
                  label={{ value: `Takt ${A.taktTime}s`, fill: "#a78bfa", fontSize: 11 }} />
              )}
              <Bar dataKey="A 週期時間" fill={C.a} radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Bar dataKey="B 週期時間" fill={C.b} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 增值率對比柱狀圖（有資料才顯示） */}
      {hasVAData && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              各工站增值率對比
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs ml-1">動作拆解</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={vaChartData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  formatter={(v: number, name: string) => [v != null ? `${v.toFixed(1)}%` : "—", name]}
                />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <ReferenceLine y={80} stroke="#34d399" strokeDasharray="5 3"
                  label={{ value: "目標 80%", fill: "#34d399", fontSize: 10 }} />
                <Bar dataKey="A 增值率" fill={C.a} radius={[3, 3, 0, 0]} maxBarSize={40} />
                <Bar dataKey="B 增值率" fill={C.b} radius={[3, 3, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2">
              增值率 = 增值動作秒數 ÷ 動作拆解合計秒數 × 100%。僅顯示有動作拆解資料的工站。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 平衡率趨勢折線圖 */}
      {trendData.length > 1 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              平衡率歷史趨勢
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  formatter={(v: number, name: string) => [`${v?.toFixed(1)}%`, name]}
                />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <Line type="monotone" dataKey="平衡率" stroke={C.a} strokeWidth={2}
                  dot={{ fill: C.a, r: 4 }} activeDot={{ r: 6 }} />
                {trendData.some(d => d.達標率 !== undefined) && (
                  <Line type="monotone" dataKey="達標率" stroke={C.b} strokeWidth={2}
                    strokeDasharray="5 3" dot={{ fill: C.b, r: 4 }} activeDot={{ r: 6 }} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* UPPH 趨勢折線圖 */}
      {trendData.length > 1 && trendData.some(d => d.UPPH !== undefined) && (
        <Card className="bg-card border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              UPPH 歷史趨勢（件/人/時）
              <span className="text-xs text-muted-foreground font-normal ml-2">IE 績效指標趨勢</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendData} margin={{ top: 10, right: 20, left: 0, bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} angle={-25} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  labelStyle={{ color: "#f1f5f9" }}
                  formatter={(v: number) => [`${Number(v).toFixed(2)} 件/人/時`, "UPPH"]}
                />
                <Legend wrapperStyle={{ paddingTop: "16px" }} />
                <Line
                  type="monotone" dataKey="UPPH" stroke="#f59e0b" strokeWidth={2.5}
                  dot={{ fill: "#f59e0b", r: 4 }} activeDot={{ r: 6 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-1">
              UPPH = 3600 ÷ 瓶頸工站時間 ÷ 總人數，數值越高表示 IE 改善效果越好
            </p>
          </CardContent>
        </Card>
      )}

      {/* 工站差異明細表（含增値率欄位） */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            工站差異明細
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">工站名稱</th>
                  <th className="text-right py-2 px-3 text-cyan-400 font-medium">A 週期</th>
                  <th className="text-right py-2 px-3 text-violet-400 font-medium">B 週期</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">週期變化</th>
                  <th className="text-right py-2 px-3 text-cyan-400/70 font-medium">A 增值率</th>
                  <th className="text-right py-2 px-3 text-violet-400/70 font-medium">B 增值率</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">增值率變化</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {stationDiff.map((row) => (
                  <tr key={row.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-foreground font-medium">{row.name}</td>
                    <td className="py-2 px-3 text-right text-cyan-400">
                      {row["A 週期時間"] != null ? `${row["A 週期時間"].toFixed(1)}s` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-violet-400">
                      {row["B 週期時間"] != null ? `${row["B 週期時間"].toFixed(1)}s` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {!row.onlyA && !row.onlyB ? (
                        <span className={row.improved ? "text-emerald-400" : row.worsened ? "text-red-400" : "text-muted-foreground"}>
                          {row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}s
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    {/* 增值率欄位 */}
                    <td className="py-2 px-3 text-right text-cyan-400/80">
                      {row.vaA != null ? `${row.vaA.toFixed(1)}%` : <span className="text-muted-foreground text-xs">無資料</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-violet-400/80">
                      {row.vaB != null ? `${row.vaB.toFixed(1)}%` : <span className="text-muted-foreground text-xs">無資料</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {row.vaDelta != null ? (
                        <span className={`inline-flex items-center justify-end gap-1 ${row.vaImproved ? "text-emerald-400" : row.vaWorsened ? "text-red-400" : "text-muted-foreground"}`}>
                          {row.vaImproved ? <TrendingUp className="w-3 h-3" /> : row.vaWorsened ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {row.vaDelta > 0 ? "+" : ""}{row.vaDelta.toFixed(1)}%
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {row.onlyB ? (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">新增</Badge>
                      ) : row.onlyA ? (
                        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">移除</Badge>
                      ) : row.improved ? (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1 inline" />改善
                        </Badge>
                      ) : row.worsened ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1 inline" />退步
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">持平</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 改善摘要 */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "改善工站", count: improvedCount, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
              { label: "退步工站", count: worsenedCount, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
              { label: "持平工站", count: neutralCount, color: "text-muted-foreground", bg: "bg-card border-border" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={`rounded-lg border p-3 text-center ${bg}`}>
                <div className={`text-2xl font-bold ${color}`}>{count}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* 增值率改善提示 */}
          {hasVAData && (() => {
            const vaImproved = stationDiff.filter(r => r.vaImproved).length;
            const vaWorsened = stationDiff.filter(r => r.vaWorsened).length;
            if (vaImproved === 0 && vaWorsened === 0) return null;
            return (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-medium">增值率變化摘要：</span>
                  <span className="text-muted-foreground">
                    {vaImproved > 0 && `${vaImproved} 個工站增值率提升`}
                    {vaImproved > 0 && vaWorsened > 0 && "，"}
                    {vaWorsened > 0 && `${vaWorsened} 個工站增值率下降`}
                  </span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* AI 比較分析報告 */}
      <Card className="bg-card border-violet-500/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              AI 比較分析報告
              <Badge className="bg-violet-500/15 text-violet-400 border-violet-500/30 text-xs ml-1">Ollama</Badge>
            </CardTitle>
            <Button
              onClick={handleAIAnalyze}
              disabled={compareSnapshotsMutation.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-2 h-8"
            >
              {compareSnapshotsMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />分析中...</>
              ) : (
                <><FileText className="w-3.5 h-3.5 mr-1.5" />生成比較報告</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!aiReport && !aiError && !compareSnapshotsMutation.isPending && (
            <div className="text-center py-10 text-muted-foreground">
              <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">點擊「生成比較報告」，AI 將分析兩個快照的差異並提供改善建議</p>
              <p className="text-xs mt-1 opacity-60">分析內容包含：平衡率變化、工站改善評估、下一步行動建議</p>
            </div>
          )}
          {compareSnapshotsMutation.isPending && (
            <div className="text-center py-10 text-muted-foreground">
              <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-violet-400" />
              <p className="text-sm">AI 正在分析快照差異，請稍候...</p>
            </div>
          )}
          {aiError && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            </div>
          )}
          {aiReport && (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  h2: ({ children }) => <h2 className="text-base font-bold text-violet-300 mt-5 mb-2 border-b border-violet-500/20 pb-1">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold text-cyan-300 mt-3 mb-1">{children}</h3>,
                  p: ({ children }) => <p className="text-sm text-foreground/90 mb-2 leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-sm text-foreground/85">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-sm text-foreground/85">{children}</ol>,
                  li: ({ children }) => <li className="text-sm text-foreground/85">{children}</li>,
                  strong: ({ children }) => <strong className="text-emerald-400 font-semibold">{children}</strong>,
                  code: ({ children }) => <code className="bg-gray-800 text-amber-300 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                }}
              >
                {aiReport}
              </ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 可折疊的前三大工站差異明細 */}
      <Card className="bg-card border-amber-500/25">
        <CardContent className="p-0">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 hover:bg-amber-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-300">3</div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground">差異最大的前三個工站</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">依兩個快照的週期時間絕對變化排序；展開可查看完整比較數據</p>
                </div>
              </div>
              <span className="shrink-0 text-lg text-amber-300 transition-transform duration-200 group-open:rotate-180" aria-hidden="true">⌄</span>
            </summary>

            <div className="border-t border-amber-500/15 px-5 py-4">
              {topStationDifferences.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">兩個快照沒有可供比較的工站資料。</div>
              ) : (
                <div className="space-y-4">
                  {topStationDifferences.map((station, index) => {
                    const a = station.stationA;
                    const b = station.stationB;
                    const isImproved = station.improved;
                    const isWorsened = station.worsened;
                    const statusLabel = station.onlyB ? "新增工站" : station.onlyA ? "移除工站" : isImproved ? "週期縮短" : isWorsened ? "週期增加" : "週期持平";
                    const statusClass = station.onlyB
                      ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                      : station.onlyA
                        ? "bg-slate-500/15 text-slate-300 border-slate-500/30"
                        : isImproved
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          : isWorsened
                            ? "bg-red-500/15 text-red-300 border-red-500/30"
                            : "bg-slate-500/15 text-slate-300 border-slate-500/30";

                    return (
                      <div key={station.name} className="rounded-lg border border-border bg-background/30 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-xs font-bold text-amber-300">{index + 1}</span>
                            <h3 className="truncate text-sm font-semibold text-foreground">{station.name}</h3>
                            <Badge className={`border text-xs ${statusClass}`}>{statusLabel}</Badge>
                          </div>
                          <div className={`font-mono text-sm font-bold ${isImproved ? "text-emerald-400" : isWorsened ? "text-red-400" : "text-muted-foreground"}`}>
                            {station.onlyB || station.onlyA
                              ? `Δ 週期 ${station.absoluteCycleTimeDelta.toFixed(1)}s`
                              : `${station.delta > 0 ? "+" : ""}${station.delta.toFixed(1)}s`}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                          <div className="rounded-md bg-cyan-500/[0.06] p-3">
                            <div className="text-[11px] text-cyan-300/80">週期時間 A → B</div>
                            <div className="mt-1 font-mono text-sm text-foreground">
                              {a ? `${a.cycleTime.toFixed(1)}s` : "—"}
                              <span className="px-1.5 text-muted-foreground">→</span>
                              {b ? `${b.cycleTime.toFixed(1)}s` : "—"}
                            </div>
                          </div>
                          <div className="rounded-md bg-violet-500/[0.06] p-3">
                            <div className="text-[11px] text-violet-300/80">配置人力 A → B</div>
                            <div className="mt-1 font-mono text-sm text-foreground">
                              {a ? `${a.manpower.toFixed(2)} 人` : "—"}
                              <span className="px-1.5 text-muted-foreground">→</span>
                              {b ? `${b.manpower.toFixed(2)} 人` : "—"}
                            </div>
                          </div>
                          <div className="rounded-md bg-emerald-500/[0.06] p-3">
                            <div className="text-[11px] text-emerald-300/80">增值率 A → B</div>
                            <div className="mt-1 font-mono text-sm text-foreground">
                              {a?.valueAddedRate != null ? `${a.valueAddedRate.toFixed(1)}%` : "—"}
                              <span className="px-1.5 text-muted-foreground">→</span>
                              {b?.valueAddedRate != null ? `${b.valueAddedRate.toFixed(1)}%` : "—"}
                            </div>
                          </div>
                          <div className="rounded-md bg-amber-500/[0.06] p-3">
                            <div className="text-[11px] text-amber-300/80">動作步驟 A → B</div>
                            <div className="mt-1 font-mono text-sm text-foreground">
                              {a?.actionStepCount != null ? `${a.actionStepCount} 步` : "—"}
                              <span className="px-1.5 text-muted-foreground">→</span>
                              {b?.actionStepCount != null ? `${b.actionStepCount} 步` : "—"}
                            </div>
                          </div>
                        </div>

                        {(a?.description || b?.description || a?.totalStepSec != null || b?.totalStepSec != null) && (
                          <div className="mt-3 grid gap-2 border-t border-border/70 pt-3 text-xs text-muted-foreground md:grid-cols-2">
                            <div>
                              <span className="text-foreground/80">動作拆解總秒數：</span>
                              A {a?.totalStepSec != null ? `${a.totalStepSec.toFixed(1)}s` : "—"} / B {b?.totalStepSec != null ? `${b.totalStepSec.toFixed(1)}s` : "—"}
                            </div>
                            <div className="truncate" title={b?.description ?? a?.description}>
                              <span className="text-foreground/80">工站說明：</span>{b?.description ?? a?.description ?? "—"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
