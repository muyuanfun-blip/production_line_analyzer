import { useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  BarChart3, Target, Users, Camera, AlertTriangle, CheckCircle2
} from "lucide-react";

type WorkstationData = {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  sequenceOrder: number;
  description?: string;
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

const C = { a: "#22d3ee", b: "#a78bfa" };

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

  const wsA = useMemo(() => {
    if (!snapA) return [] as WorkstationData[];
    return (snapA.workstationsData as WorkstationData[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [snapA]);

  const wsB = useMemo(() => {
    if (!snapB) return [] as WorkstationData[];
    return (snapB.workstationsData as WorkstationData[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [snapB]);

  // 工站差異比較資料
  const stationDiff = useMemo(() => {
    const allNames = Array.from(new Set([...wsA.map(w => w.name), ...wsB.map(w => w.name)]));
    return allNames.map(name => {
      const a = wsA.find(w => w.name === name);
      const b = wsB.find(w => w.name === name);
      const delta = (b?.cycleTime ?? 0) - (a?.cycleTime ?? 0);
      return {
        name,
        "A 快照": a?.cycleTime ?? null,
        "B 快照": b?.cycleTime ?? null,
        delta,
        improved: delta < -0.1,
        worsened: delta > 0.1,
        onlyA: !b,
        onlyB: !a,
      };
    });
  }, [wsA, wsB]);

  // 趨勢圖（所有快照按時間正序）
  const trendData = useMemo(() => {
    return [...(allSnaps as Snapshot[])].reverse().map(s => ({
      name: s.name.length > 8 ? s.name.slice(0, 8) + "…" : s.name,
      平衡率: s.balanceRate,
      達標率: s.taktPassRate ?? undefined,
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
    { label: "產線平衡率", a: A.balanceRate, b: B.balanceRate, unit: "%", higherIsBetter: true },
    { label: "瓶頸工站時間", a: A.maxTime, b: B.maxTime, unit: "s", higherIsBetter: false },
    { label: "平均工序時間", a: A.avgTime, b: B.avgTime, unit: "s", higherIsBetter: false },
    {
      label: "Takt Time 達標率",
      a: A.taktPassRate ?? 0, b: B.taktPassRate ?? 0,
      unit: "%", higherIsBetter: true,
      noData: !A.taktPassRate && !B.taktPassRate,
    },
  ];

  const improvedCount = stationDiff.filter(r => r.improved).length;
  const worsenedCount = stationDiff.filter(r => r.worsened).length;
  const neutralCount = stationDiff.filter(r => !r.improved && !r.worsened && !r.onlyA && !r.onlyB).length;

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
          <p className="text-sm text-muted-foreground mt-1">對比兩個時間點的產線平衡狀態，追蹤改善成效</p>
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

      {/* KPI 比較 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, a, b, unit, higherIsBetter, noData }) => (
          <Card key={label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-3">{label}</div>
              {noData ? (
                <div className="text-muted-foreground text-sm">未設定</div>
              ) : (
                <>
                  <div className="flex items-end gap-3 mb-2">
                    <div>
                      <div className="text-lg font-bold text-cyan-400">{a.toFixed(1)}{unit}</div>
                      <div className="text-xs text-muted-foreground">快照 A</div>
                    </div>
                    <div className="text-muted-foreground mb-1 text-sm">→</div>
                    <div>
                      <div className="text-lg font-bold text-violet-400">{b.toFixed(1)}{unit}</div>
                      <div className="text-xs text-muted-foreground">快照 B</div>
                    </div>
                  </div>
                  <DeltaBadge a={a} b={b} unit={unit} higherIsBetter={higherIsBetter} />
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 工站時間對比柱狀圖 */}
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
              <Bar dataKey="A 快照" fill={C.a} radius={[3, 3, 0, 0]} maxBarSize={40} />
              <Bar dataKey="B 快照" fill={C.b} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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

      {/* 工站差異明細表 */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            工站時間差異明細
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">工站名稱</th>
                  <th className="text-right py-2 px-3 text-cyan-400 font-medium">快照 A</th>
                  <th className="text-right py-2 px-3 text-violet-400 font-medium">快照 B</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">變化量</th>
                  <th className="text-center py-2 px-3 text-muted-foreground font-medium">狀態</th>
                </tr>
              </thead>
              <tbody>
                {stationDiff.map((row) => (
                  <tr key={row.name} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-foreground font-medium">{row.name}</td>
                    <td className="py-2 px-3 text-right text-cyan-400">
                      {row["A 快照"] != null ? `${row["A 快照"].toFixed(1)}s` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-violet-400">
                      {row["B 快照"] != null ? `${row["B 快照"].toFixed(1)}s` : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {!row.onlyA && !row.onlyB ? (
                        <span className={row.improved ? "text-emerald-400" : row.worsened ? "text-red-400" : "text-muted-foreground"}>
                          {row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}s
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
        </CardContent>
      </Card>
    </div>
  );
}
