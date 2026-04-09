import { useState, useRef, useCallback } from "react";
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
  ChevronDown, ChevronUp, Flame, Activity, BarChart2, Download, Loader2,
  AlertTriangle, CheckCircle, XCircle, Zap,
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

// 補算 UPPH（當快照 upph 欄位為 null 時，用 maxTime 與 totalManpower 計算）
function calcSnapUPPH(snap: Snapshot): { value: number; isCalc: boolean } | null {
  if (snap.upph != null) return { value: Number(snap.upph), isCalc: false };
  if (snap.maxTime > 0 && snap.totalManpower > 0) {
    return { value: 3600 / snap.maxTime / snap.totalManpower, isCalc: true };
  }
  return null;
}

function TrendIcon({ value, prev }: { value: number; prev?: number }) {
  if (prev === undefined) return null;
  const diff = value - prev;
  if (Math.abs(diff) < 0.1) return <Minus className="w-3 h-3 text-muted-foreground inline" />;
  if (diff > 0) return <TrendingUp className="w-3 h-3 text-emerald-400 inline" />;
  return <TrendingDown className="w-3 h-3 text-red-400 inline" />;
}

// ─── 與 BalanceAnalysis 相同的 Color Tokens ────────────────────────────────────
const SNAP_COLORS = {
  exceed:     "#ef4444",
  bottleneck: "#f97316",
  warning:    "#eab308",
  normal:     "#22d3ee",
  efficient:  "#4ade80",
  taktLine:   "#a78bfa",
  avgLine:    "#64748b",
};

type SnapBarStatus = "exceed" | "bottleneck" | "warning" | "normal" | "efficient";

const SNAP_STATUS_META: Record<SnapBarStatus, { label: string; color: string; icon: React.ElementType }> = {
  exceed:     { label: "超出節拍",  color: SNAP_COLORS.exceed,     icon: XCircle },
  bottleneck: { label: "瓶頸工站",  color: SNAP_COLORS.bottleneck, icon: AlertTriangle },
  warning:    { label: "接近節拍",  color: SNAP_COLORS.warning,    icon: AlertTriangle },
  normal:     { label: "正常",      color: SNAP_COLORS.normal,     icon: CheckCircle },
  efficient:  { label: "高效",      color: SNAP_COLORS.efficient,  icon: Zap },
};

function snapGetBarStatus(ct: number, maxTime: number, taktTime?: number): SnapBarStatus {
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

// StatusLabel 圖示標記（與 BalanceAnalysis 完全相同）
function SnapStatusLabel(props: any) {
  const { x, y, width, value, status } = props;
  if (!value) return null;
  const meta = SNAP_STATUS_META[status as SnapBarStatus];
  return (
    <g>
      <foreignObject x={x + width / 2 - 8} y={y - 22} width={16} height={16}>
        <div style={{ color: meta.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
            {status === "exceed"     && <path d="M18 6L6 18M6 6l12 12" />}
            {status === "bottleneck" && <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />}
            {status === "warning"    && <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />}
            {status === "normal"     && <path d="M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3" />}
            {status === "efficient"  && <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
          </svg>
        </div>
      </foreignObject>
    </g>
  );
}

// Tooltip（與 BalanceAnalysis 完全相同）
function SnapCustomTooltip({ active, payload, taktTime }: { active?: boolean; payload?: any[]; taktTime?: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const meta = SNAP_STATUS_META[d.status as SnapBarStatus];
  const taktDiff = taktTime ? (d.cycleTime - taktTime).toFixed(1) : null;
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-2xl text-sm min-w-[180px]">
      <p className="font-semibold text-foreground mb-3 border-b border-border pb-2">{d.fullName}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">工序時間</span>
          <span className="font-mono font-bold" style={{ color: meta.color }}>{d.cycleTime.toFixed(1)}s</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">人員配置</span>
          <span className="text-foreground">{d.manpower} 人</span>
        </div>
        {taktTime && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">vs Takt Time</span>
            <span className={`font-mono font-bold ${parseFloat(taktDiff!) > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {parseFloat(taktDiff!) > 0 ? "+" : ""}{taktDiff}s
            </span>
          </div>
        )}
        <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
          <span className="text-muted-foreground">狀態</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
            {meta.label}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── 工序時間分佈圖 Dialog ── */
function SnapshotChartDialog({ snap, open, onClose }: {
  snap: Snapshot;
  open: boolean;
  onClose: () => void;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = useCallback(() => {
    if (!chartRef.current) return;
    setDownloading(true);
    try {
      // 從 chartRef 內取得 Recharts 產生的 SVG 元素
      const svgEl = chartRef.current.querySelector("svg");
      if (!svgEl) {
        toast.error("找不到圖表元素，請稍後再試");
        return;
      }

      const scale = 2;
      const bbox = svgEl.getBoundingClientRect();
      const width = bbox.width || svgEl.clientWidth || 800;
      const height = bbox.height || svgEl.clientHeight || 350;

      // 克隆 SVG 並設定背景色
      const cloned = svgEl.cloneNode(true) as SVGElement;
      cloned.setAttribute("width", String(width));
      cloned.setAttribute("height", String(height));
      cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      // 插入背景色矩形
      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("width", "100%");
      bg.setAttribute("height", "100%");
      bg.setAttribute("fill", "#0f1117");
      cloned.insertBefore(bg, cloned.firstChild);

      const svgStr = new XMLSerializer().serializeToString(cloned);
      const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(scale, scale);
        ctx.fillStyle = "#0f1117";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);

        const dateStr = new Date(snap.createdAt).toLocaleDateString("zh-TW", {
          year: "numeric", month: "2-digit", day: "2-digit",
        }).replace(/\//g, "-");
        const link = document.createElement("a");
        link.download = `工序時間分佈圖_${snap.name}_${dateStr}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("圖表已下載為 PNG 圖片");
        setDownloading(false);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.error("圖表轉換失敗，請稍後再試");
        setDownloading(false);
      };
      img.src = url;
    } catch {
      toast.error("下載失敗，請稍後再試");
      setDownloading(false);
    }
  }, [snap]);

  const taktTime = snap.taktTime ? Number(snap.taktTime) : undefined;

  const workstations = (snap.workstationsData as WorkstationData[] | null) ?? [];
  const sorted = [...workstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const maxCT = Math.max(...sorted.map(w => w.cycleTime), 0);

  const chartData = sorted.map(ws => {
    const status = snapGetBarStatus(ws.cycleTime, maxCT, taktTime);
    return {
      name: ws.name,
      fullName: ws.name,
      cycleTime: ws.cycleTime,
      status,
      color: SNAP_COLORS[status],
      manpower: ws.manpower,
    };
  });

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("zh-TW", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-[95vw] w-full">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <BarChart2 className="w-5 h-5 text-cyan-400" />
                工序時間分佈圖
                <span className="text-muted-foreground font-normal text-sm ml-1">— {snap.name}</span>
              </DialogTitle>
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                快照時間：{formatDate(snap.createdAt)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={downloading}
              className="gap-1.5 text-xs flex-shrink-0 mt-0.5 border-border/60 hover:border-cyan-500/50 hover:text-cyan-400"
            >
              {downloading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />匯出中...</>
              ) : (
                <><Download className="w-3.5 h-3.5" />下載圖表</>
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* KPI 摘要列 */}
        {(() => {
          const upphResult = calcSnapUPPH(snap);
          const upphDisplay = upphResult
            ? `${upphResult.value.toFixed(2)}${upphResult.isCalc ? " *" : ""}`
            : "—";
          return (
            <div className="grid grid-cols-4 gap-3 py-2">
              {[
                { label: "平衡率", value: `${snap.balanceRate.toFixed(1)}%`, color: snap.balanceRate >= 85 ? "text-emerald-400" : snap.balanceRate >= 70 ? "text-cyan-400" : "text-yellow-400" },
                { label: "瓶頸時間", value: `${snap.maxTime.toFixed(1)}s`, color: "text-orange-400", sub: snap.bottleneckName ?? undefined },
                { label: "Takt Time", value: snap.taktTime ? `${snap.taktTime}s` : "—", color: "text-violet-400" },
                { label: upphResult?.isCalc ? "UPPH *" : "UPPH", value: upphDisplay, color: "text-amber-400", sub: upphResult?.isCalc ? "補算值" : undefined },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="bg-background/40 rounded-lg p-2 text-center border border-border/50">
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  {sub && <div className="text-xs text-amber-400/50 truncate">{sub}</div>}
                </div>
              ))}
            </div>
          );
        })()}

        {/* 柱狀圖（與 BalanceAnalysis 完全一致格式） */}
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">此快照無工站資料</p>
          </div>
        ) : (
          <div ref={chartRef}>
            <div className="h-[480px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 28, right: 24, left: 0, bottom: 20 }}>
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
                  <RechartsTooltip content={<SnapCustomTooltip taktTime={taktTime} />} />

                  {/* Takt Time 參考線 */}
                  {taktTime && (
                    <ReferenceLine
                      y={taktTime}
                      stroke={SNAP_COLORS.taktLine}
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      label={{
                        value: `Takt Time ${taktTime}s`,
                        fill: SNAP_COLORS.taktLine,
                        fontSize: 11,
                        fontWeight: 600,
                        position: "insideTopRight",
                        offset: 8,
                      }}
                    />
                  )}

                  {/* 平均時間參考線 */}
                  <ReferenceLine
                    y={snap.avgTime}
                    stroke={SNAP_COLORS.avgLine}
                    strokeDasharray="4 4"
                    label={{
                      value: `均值 ${snap.avgTime.toFixed(1)}s`,
                      fill: SNAP_COLORS.avgLine,
                      fontSize: 10,
                      position: "insideTopLeft",
                      offset: 8,
                    }}
                  />

                  <Bar dataKey="cycleTime" radius={[5, 5, 0, 0]} maxBarSize={64}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                    <LabelList
                      dataKey="cycleTime"
                      content={(props: any) => (
                        <SnapStatusLabel
                          {...props}
                          status={chartData[props.index]?.status}
                          taktTime={taktTime}
                        />
                      )}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 圖例（與 BalanceAnalysis 完全一致） */}
            <div className="flex flex-wrap gap-3 mt-4 justify-center text-xs">
              {taktTime ? (
                <>
                  {[
                    { color: SNAP_COLORS.exceed,     label: "超出 Takt Time" },
                    { color: SNAP_COLORS.bottleneck, label: "瓶頸工站（最大值）" },
                    { color: SNAP_COLORS.warning,    label: "接近 Takt Time (>80%)" },
                    { color: SNAP_COLORS.normal,     label: "正常達標" },
                    { color: SNAP_COLORS.efficient,  label: "高效（≤70% Takt Time）" },
                    { color: SNAP_COLORS.taktLine,   label: "Takt Time 基準線", dashed: true },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      {l.dashed
                        ? <div className="h-0 w-5 border-t-2 border-dashed" style={{ borderColor: l.color }} />
                        : <div className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                      }
                      <span className="text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {[
                    { color: SNAP_COLORS.bottleneck, label: "瓶頸工站 (≥95% 最大值)" },
                    { color: SNAP_COLORS.warning,    label: "警示工站 (80~95%)" },
                    { color: SNAP_COLORS.normal,     label: "正常工站" },
                    { color: SNAP_COLORS.efficient,  label: "高效工站" },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />
                      <span className="text-muted-foreground">{l.label}</span>
                    </div>
                  ))}
                </>
              )}
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

                      {/* UPPH（含補算） */}
                      {(() => {
                        const upphResult = calcSnapUPPH(snap);
                        if (!upphResult) return null;
                        const { value: upphVal, isCalc } = upphResult;
                        const prevUpphResult = prevSnap ? calcSnapUPPH(prevSnap) : null;
                        const prevUpphVal = prevUpphResult?.value;
                        return (
                          <div className="text-center min-w-[70px]">
                            <FormulaTooltip formulaKey="upph" liveValues={{
                              "UPPH": `${upphVal.toFixed(2)} 件/人/時`,
                              ...(isCalc ? { "說明": "由瓶頸時間與人員數補算" } : {}),
                            }}>
                              <div className="text-xl font-bold text-amber-400 flex items-center gap-1 justify-center">
                                {upphVal.toFixed(2)}
                                {isCalc && <span className="text-xs text-amber-400/60 font-normal">*</span>}
                                <TrendIcon value={upphVal} prev={prevUpphVal} />
                              </div>
                            </FormulaTooltip>
                            <div className="text-xs text-amber-400/80 font-medium">
                              UPPH{isCalc && <span className="text-amber-400/50"> *</span>}
                            </div>
                            {prevUpphVal !== undefined && (
                              <div className={`text-xs ${
                                upphVal > prevUpphVal ? "text-emerald-400"
                                : upphVal < prevUpphVal ? "text-red-400"
                                : "text-muted-foreground"
                              }`}>
                                {upphVal > prevUpphVal ? "+" : ""}
                                {(upphVal - prevUpphVal).toFixed(2)}
                              </div>
                            )}
                          </div>
                        );
                      })()}

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
