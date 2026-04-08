import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine, Cell, LabelList,
} from "recharts";
import { toast } from "sonner";
import {
  Camera, Trash2, GitCompare, ArrowLeft, Clock,
  TrendingUp, TrendingDown, Minus, BarChart3, Target, Users,
  ChevronDown, ChevronUp, Flame, Activity, BarChart2,
} from "lucide-react";

type WorkstationData = {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  sequenceOrder: number;
  description?: string;
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

function TrendIcon({ value, prev }: { value: number; prev?: number }) {
  if (prev === undefined) return null;
  const diff = value - prev;
  if (Math.abs(diff) < 0.1) return <Minus className="w-3 h-3 text-muted-foreground inline" />;
  if (diff > 0) return <TrendingUp className="w-3 h-3 text-emerald-400 inline" />;
  return <TrendingDown className="w-3 h-3 text-red-400 inline" />;
}

/* ── 工序時間分佈圖 Dialog ── */
function SnapshotChartDialog({ snap, open, onClose }: {
  snap: Snapshot;
  open: boolean;
  onClose: () => void;
}) {
  const workstations = (snap.workstationsData as WorkstationData[] | null) ?? [];
  const sorted = [...workstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const maxCT = Math.max(...sorted.map(w => w.cycleTime), 0);

  const chartData = sorted.map(ws => ({
    name: ws.name.length > 8 ? ws.name.slice(0, 7) + "…" : ws.name,
    fullName: ws.name,
    cycleTime: ws.cycleTime,
    isBottleneck: ws.cycleTime === maxCT && maxCT > 0,
    manpower: ws.manpower,
    valueAddedRate: ws.valueAddedRate ?? null,
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]!.payload;
    return (
      <div className="bg-card border border-border rounded-lg p-3 text-sm shadow-xl">
        <div className="font-semibold text-foreground mb-1">{d.fullName}</div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">週期時間：</span>
          <span className={`font-mono font-bold ${d.isBottleneck ? "text-orange-400" : "text-cyan-400"}`}>
            {d.cycleTime.toFixed(1)}s
          </span>
          {d.isBottleneck && <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">瓶頸</Badge>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-muted-foreground">人員數：</span>
          <span className="text-foreground">{d.manpower} 人</span>
        </div>
        {d.valueAddedRate != null && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">增值率：</span>
            <span className={`font-medium ${d.valueAddedRate >= 70 ? "text-emerald-400" : d.valueAddedRate >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {d.valueAddedRate.toFixed(1)}%
            </span>
          </div>
        )}
        {snap.taktTime && (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground">vs Takt Time：</span>
            <span className={d.cycleTime <= snap.taktTime ? "text-emerald-400" : "text-red-400"}>
              {d.cycleTime <= snap.taktTime ? "✓ 達標" : `超出 ${(d.cycleTime - snap.taktTime).toFixed(1)}s`}
            </span>
          </div>
        )}
      </div>
    );
  };

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("zh-TW", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-3xl w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <BarChart2 className="w-5 h-5 text-cyan-400" />
            工序時間分佈圖
            <span className="text-muted-foreground font-normal text-sm ml-1">— {snap.name}</span>
          </DialogTitle>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            快照時間：{formatDate(snap.createdAt)}
          </div>
        </DialogHeader>

        {/* KPI 摘要列 */}
        <div className="grid grid-cols-4 gap-3 py-2">
          {[
            { label: "平衡率", value: `${snap.balanceRate.toFixed(1)}%`, color: snap.balanceRate >= 85 ? "text-emerald-400" : snap.balanceRate >= 70 ? "text-cyan-400" : "text-yellow-400" },
            { label: "瓶頸時間", value: `${snap.maxTime.toFixed(1)}s`, color: "text-orange-400", sub: snap.bottleneckName ?? undefined },
            { label: "Takt Time", value: snap.taktTime ? `${snap.taktTime}s` : "—", color: "text-violet-400" },
            { label: "UPPH", value: snap.upph != null ? `${Number(snap.upph).toFixed(2)}` : "—", color: "text-amber-400" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="bg-background/40 rounded-lg p-2 text-center border border-border/50">
              <div className={`text-lg font-bold ${color}`}>{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
              {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
            </div>
          ))}
        </div>

        {/* 柱狀圖 */}
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">此快照無工站資料</p>
          </div>
        ) : (
          <div className="mt-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  height={55}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  tickFormatter={v => `${v}s`}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />

                {/* Takt Time 參考線 */}
                {snap.taktTime && (
                  <ReferenceLine
                    y={snap.taktTime}
                    stroke="#a78bfa"
                    strokeDasharray="6 3"
                    strokeWidth={2}
                    label={{
                      value: `TT ${snap.taktTime}s`,
                      position: "insideTopRight",
                      fill: "#a78bfa",
                      fontSize: 11,
                    }}
                  />
                )}

                {/* 平均時間參考線 */}
                <ReferenceLine
                  y={snap.avgTime}
                  stroke="rgba(100,200,255,0.4)"
                  strokeDasharray="4 4"
                  label={{
                    value: `均 ${snap.avgTime.toFixed(1)}s`,
                    position: "insideTopLeft",
                    fill: "rgba(100,200,255,0.7)",
                    fontSize: 10,
                  }}
                />

                <Bar dataKey="cycleTime" radius={[4, 4, 0, 0]} maxBarSize={60}>
                  {/* 柱頂：週期時間秒數 */}
                  <LabelList
                    dataKey="cycleTime"
                    position="top"
                    formatter={(v: number) => `${v.toFixed(1)}s`}
                    style={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  />
                  {/* 柱內：人員數量 */}
                  <LabelList
                    dataKey="manpower"
                    position="insideBottom"
                    offset={6}
                    formatter={(v: number) => v > 0 ? `${v}人` : ""}
                    style={{ fill: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 600 }}
                  />
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isBottleneck ? "#f97316" : "#22d3ee"}
                      fillOpacity={entry.isBottleneck ? 1 : 0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* 圖例說明 */}
            <div className="flex items-center gap-4 justify-center mt-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-cyan-400 opacity-80" />
                <span>一般工站</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-orange-500" />
                <span>瓶頸工站</span>
              </div>
              {snap.taktTime && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-0.5 bg-violet-400" style={{ borderTop: "2px dashed #a78bfa" }} />
                  <span>Takt Time</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-0.5" style={{ borderTop: "2px dashed rgba(100,200,255,0.5)" }} />
                <span>平均時間</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/70 font-semibold text-[11px] bg-cyan-500/30 rounded px-1">N人</span>
                <span>柱內人員數</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── 工站明細展開表格 ── */
function WorkstationDetail({ snap }: { snap: Snapshot }) {
  const workstations = (snap.workstationsData as WorkstationData[] | null) ?? [];
  const sorted = [...workstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const maxCT = Math.max(...sorted.map(w => w.cycleTime), 0);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        此快照無工站資料
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">順序</th>
            <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">工站名稱</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">週期時間</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">人員數</th>
            <th className="text-right py-2 px-3 text-muted-foreground font-medium text-xs">增值率</th>
            <th className="text-left py-2 px-3 text-muted-foreground font-medium text-xs">時間佔比</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ws) => {
            const isBottleneck = ws.cycleTime === maxCT && maxCT > 0;
            const barWidth = maxCT > 0 ? (ws.cycleTime / maxCT) * 100 : 0;
            const isTaktOk = snap.taktTime ? ws.cycleTime <= snap.taktTime : null;

            return (
              <tr
                key={ws.id}
                className={`border-b border-border/30 ${isBottleneck ? "bg-orange-500/5" : "hover:bg-white/[0.02]"}`}
              >
                <td className="py-2 px-3 text-muted-foreground text-xs">{ws.sequenceOrder}</td>
                <td className="py-2 px-3">
                  <div className="flex items-center gap-1.5">
                    {isBottleneck && <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                    <span className={`font-medium ${isBottleneck ? "text-orange-300" : "text-foreground"}`}>
                      {ws.name}
                    </span>
                    {isBottleneck && (
                      <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1 py-0">瓶頸</Badge>
                    )}
                    {isTaktOk === false && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px] px-1 py-0">超 TT</Badge>
                    )}
                  </div>
                  {ws.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{ws.description}</div>
                  )}
                </td>
                <td className="py-2 px-3 text-right">
                  <span className={`font-mono font-semibold ${isBottleneck ? "text-orange-400" : "text-foreground"}`}>
                    {ws.cycleTime.toFixed(1)}s
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  <span className="text-muted-foreground flex items-center justify-end gap-1">
                    <Users className="w-3 h-3" />{ws.manpower}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  {ws.valueAddedRate != null ? (
                    <span className={`font-medium flex items-center justify-end gap-1 ${
                      ws.valueAddedRate >= 70 ? "text-emerald-400" : ws.valueAddedRate >= 50 ? "text-yellow-400" : "text-red-400"
                    }`}>
                      <Activity className="w-3 h-3" />{ws.valueAddedRate.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="py-2 px-3 min-w-[100px]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-border/40 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isBottleneck ? "bg-orange-400" : "bg-cyan-500"}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{barWidth.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.some(w => w.valueAddedRate != null) && (
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3 h-3" />
          <span>增值率：快照儲存時已記錄各工站動作拆解資料</span>
        </div>
      )}
    </div>
  );
}

/* ── 主頁面 ── */
export default function SnapshotHistory() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, navigate] = useLocation();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [chartSnap, setChartSnap] = useState<Snapshot | null>(null);

  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: snapshots = [], refetch } = trpc.snapshot.listByLine.useQuery(
    { productionLineId: lineId },
    { enabled: lineId > 0 }
  );

  const deleteMutation = trpc.snapshot.delete.useMutation({
    onSuccess: () => { toast.success("快照已刪除"); refetch(); },
    onError: () => toast.error("刪除失敗，請稍後再試"),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(x => x !== id)
        : prev.length < 2 ? [...prev, id] : [prev[1]!, id]
    );
  };

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCompare = () => {
    if (selectedIds.length === 2) {
      navigate(`/lines/${lineId}/snapshots/compare?a=${selectedIds[0]}&b=${selectedIds[1]}`);
    }
  };

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("zh-TW", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

  const getBalanceColor = (rate: number) => {
    if (rate >= 90) return "text-emerald-400";
    if (rate >= 75) return "text-cyan-400";
    if (rate >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getTaktBadge = (rate: number | null) => {
    if (rate === null) return null;
    if (rate >= 90) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">達標 {rate.toFixed(0)}%</Badge>;
    if (rate >= 70) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">待改善 {rate.toFixed(0)}%</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">超標 {rate.toFixed(0)}%</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* 工序時間分佈圖 Dialog */}
      {chartSnap && (
        <SnapshotChartDialog
          snap={chartSnap}
          open={!!chartSnap}
          onClose={() => setChartSnap(null)}
        />
      )}

      {/* 頁首 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/lines/${lineId}/balance`)}
            className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              生產線管理 › {line?.name} › 歷史快照
            </div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Camera className="w-6 h-6 text-violet-400" />
              歷史快照記錄
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              追蹤產線改善成效，選取 2 個快照進行比較
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length === 2 && (
            <Button onClick={handleCompare} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <GitCompare className="w-4 h-4" />
              比較選取的 2 個快照
            </Button>
          )}
          {selectedIds.length === 1 && (
            <div className="text-sm text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
              已選 1/2，再選 1 個即可比較
            </div>
          )}
        </div>
      </div>

      {/* 空狀態 */}
      {snapshots.length === 0 && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
            <h3 className="text-lg font-semibold text-foreground mb-2">尚無快照記錄</h3>
            <p className="text-muted-foreground text-sm max-w-sm">
              在「產線平衡分析」頁面點擊「儲存快照」按鈕，即可記錄當前分析結果以供日後比較。
            </p>
            <Button className="mt-4 gap-2" onClick={() => navigate(`/lines/${lineId}/balance`)}>
              <BarChart3 className="w-4 h-4" />
              前往平衡分析
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 快照列表 */}
      {snapshots.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            共 {snapshots.length} 個快照 · 點選最多 2 個進行比較
          </p>
          {(snapshots as Snapshot[]).map((snap, idx) => {
            const prevSnap = snapshots[idx + 1] as Snapshot | undefined;
            const isSelected = selectedIds.includes(snap.id);
            const selOrder = selectedIds.indexOf(snap.id);
            const isExpanded = expandedIds.has(snap.id);
            const wsCount = Array.isArray(snap.workstationsData) ? snap.workstationsData.length : 0;

            return (
              <Card
                key={snap.id}
                onClick={() => toggleSelect(snap.id)}
                className={`cursor-pointer transition-all duration-200 border ${
                  isSelected
                    ? "border-violet-500 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.5)]"
                    : "border-border bg-card hover:border-violet-500/40"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    {/* 左側 */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                        isSelected ? "border-violet-500 bg-violet-500" : "border-border"
                      }`}>
                        {isSelected && <span className="text-white text-xs font-bold">{selOrder + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{snap.name}</h3>
                          {idx === 0 && <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">最新</Badge>}
                          {getTaktBadge(snap.taktPassRate)}
                        </div>
                        {snap.note && <p className="text-sm text-muted-foreground mt-0.5 truncate">{snap.note}</p>}
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDate(snap.createdAt)}
                          </div>
                          {/* 查看分佈圖連結 */}
                          {wsCount > 0 && (
                            <button
                              className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                              onClick={e => { e.stopPropagation(); setChartSnap(snap); }}
                            >
                              <BarChart2 className="w-3 h-3" />
                              查看工序時間分佈圖
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 右側 KPI */}
                    <div className="flex items-center gap-5 flex-shrink-0 flex-wrap">
                      {/* 平衡率 */}
                      <div className="text-center min-w-[60px]">
                        <FormulaTooltip formulaKey="balanceRate" liveValues={{ "平衡率": `${snap.balanceRate.toFixed(1)}%` }}>
                          <div className={`text-xl font-bold ${getBalanceColor(snap.balanceRate)} flex items-center gap-1 justify-center`}>
                            {snap.balanceRate.toFixed(1)}%
                            <TrendIcon value={snap.balanceRate} prev={prevSnap?.balanceRate} />
                          </div>
                        </FormulaTooltip>
                        <div className="text-xs text-muted-foreground">平衡率</div>
                        {prevSnap && (
                          <div className={`text-xs ${snap.balanceRate > prevSnap.balanceRate ? "text-emerald-400" : snap.balanceRate < prevSnap.balanceRate ? "text-red-400" : "text-muted-foreground"}`}>
                            {snap.balanceRate > prevSnap.balanceRate ? "+" : ""}{(snap.balanceRate - prevSnap.balanceRate).toFixed(1)}%
                          </div>
                        )}
                      </div>

                      {/* 瓶頸時間 */}
                      <div className="text-center min-w-[60px]">
                        <FormulaTooltip formulaKey="bottleneckTime" liveValues={{ "瓶頸時間": `${snap.maxTime.toFixed(1)}s` }}>
                          <div className="text-xl font-bold text-orange-400 flex items-center gap-1 justify-center">
                            {snap.maxTime.toFixed(1)}s
                            <TrendIcon value={-snap.maxTime} prev={prevSnap ? -prevSnap.maxTime : undefined} />
                          </div>
                        </FormulaTooltip>
                        <div className="text-xs text-muted-foreground">瓶頸時間</div>
                        {snap.bottleneckName && (
                          <div className="text-xs text-muted-foreground truncate max-w-[80px]">{snap.bottleneckName}</div>
                        )}
                      </div>

                      {/* 工站數 */}
                      <div className="text-center min-w-[50px]">
                        <div className="text-xl font-bold text-foreground flex items-center gap-1 justify-center">
                          <BarChart3 className="w-4 h-4 text-blue-400" />
                          {snap.workstationCount}
                        </div>
                        <div className="text-xs text-muted-foreground">工站數</div>
                        <div className="flex items-center gap-1 justify-center text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />{snap.totalManpower}人
                        </div>
                      </div>

                      {/* Takt Time */}
                      {snap.taktTime && (
                        <div className="text-center min-w-[60px]">
                          <FormulaTooltip formulaKey="taktPassRate" liveValues={{ "Takt Time": `${snap.taktTime}s` }}>
                            <div className="text-xl font-bold text-violet-400 flex items-center gap-1 justify-center">
                              <Target className="w-4 h-4" />{snap.taktTime}s
                            </div>
                          </FormulaTooltip>
                          <div className="text-xs text-muted-foreground">Takt Time</div>
                          {snap.taktPassCount !== null && (
                            <div className="text-xs text-muted-foreground">{snap.taktPassCount}/{snap.workstationCount} 達標</div>
                          )}
                        </div>
                      )}

                      {/* UPPH */}
                      {snap.upph != null && (
                        <div className="text-center min-w-[70px]">
                          <FormulaTooltip formulaKey="upph" liveValues={{ "UPPH": `${Number(snap.upph).toFixed(2)} 件/人/時` }}>
                            <div className="text-xl font-bold text-amber-400 flex items-center gap-1 justify-center">
                              {Number(snap.upph).toFixed(2)}
                              <TrendIcon value={Number(snap.upph)} prev={prevSnap?.upph != null ? Number(prevSnap.upph) : undefined} />
                            </div>
                          </FormulaTooltip>
                          <div className="text-xs text-amber-400/80 font-medium">UPPH</div>
                          {prevSnap?.upph != null && (
                            <div className={`text-xs ${
                              Number(snap.upph) > Number(prevSnap.upph) ? "text-emerald-400"
                              : Number(snap.upph) < Number(prevSnap.upph) ? "text-red-400"
                              : "text-muted-foreground"
                            }`}>
                              {Number(snap.upph) > Number(prevSnap.upph) ? "+" : ""}
                              {(Number(snap.upph) - Number(prevSnap.upph)).toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 展開工站按鈕 */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground hover:bg-white/5 gap-1.5 text-xs"
                        onClick={(e) => toggleExpand(snap.id, e)}
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-3.5 h-3.5" />收起</>
                        ) : (
                          <><ChevronDown className="w-3.5 h-3.5" />{wsCount > 0 ? `展開 ${wsCount} 站` : "展開工站"}</>
                        )}
                      </Button>

                      {/* 刪除 */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon"
                            className="text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                            onClick={e => e.stopPropagation()}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border">
                          <AlertDialogHeader>
                            <AlertDialogTitle>確認刪除快照</AlertDialogTitle>
                            <AlertDialogDescription>
                              確定要刪除快照「{snap.name}」嗎？此操作無法復原。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => deleteMutation.mutate({ id: snap.id })}>
                              確認刪除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {/* 展開工站明細 */}
                  {isExpanded && (
                    <div
                      className="mt-4 pt-4 border-t border-border/50"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-semibold text-foreground">快照工站明細</span>
                        <span className="text-xs text-muted-foreground">（記錄快照當下的站別資料）</span>
                      </div>
                      <WorkstationDetail snap={snap} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
