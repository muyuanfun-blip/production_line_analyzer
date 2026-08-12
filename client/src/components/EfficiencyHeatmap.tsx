import { useMemo, useState } from "react";
import { Activity, Clock3, Grid3X3, Loader2, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RangeKey = "24h" | "7d";
type CellStatus = "ahead" | "on_target" | "slight_loss" | "loss";

const STATUS_META: Record<CellStatus, { label: string; tile: string; dot: string }> = {
  ahead: { label: "領先標準 ≥105%", tile: "bg-emerald-500/80 text-white", dot: "bg-emerald-400" },
  on_target: { label: "符合標準 95–104%", tile: "bg-cyan-500/75 text-white", dot: "bg-cyan-400" },
  slight_loss: { label: "輕度損失 85–94%", tile: "bg-amber-500/80 text-slate-950", dot: "bg-amber-400" },
  loss: { label: "效率損失 <85%", tile: "bg-red-500/80 text-white", dot: "bg-red-400" },
};

function formatBucket(date: Date, range: RangeKey) {
  return new Date(date).toLocaleString("zh-TW", range === "24h"
    ? { hour: "2-digit", minute: "2-digit" }
    : { month: "numeric", day: "numeric", hour: "2-digit" });
}

export function EfficiencyHeatmap({ productionLineId }: { productionLineId: number }) {
  const [range, setRange] = useState<RangeKey>("24h");
  const [bucketMinutes, setBucketMinutes] = useState("60");
  const queryInput = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - (range === "24h" ? 24 : 7 * 24) * 60 * 60 * 1000);
    return { productionLineId, from, to, bucketMinutes: Number(bucketMinutes) };
  }, [productionLineId, range, bucketMinutes]);
  const { data, isLoading, isFetching, refetch } = trpc.productTracking.getEfficiencyHeatmap.useQuery(queryInput, {
    enabled: productionLineId > 0,
  });

  const cellMap = useMemo(() => {
    const map = new Map<string, NonNullable<typeof data>["cells"][number]>();
    data?.cells.forEach((cell) => map.set(`${cell.workstationId}:${new Date(cell.bucketStart).toISOString()}`, cell));
    return map;
  }, [data]);
  const averageEfficiency = useMemo(() => {
    if (!data?.cells.length) return null;
    return data.cells.reduce((sum, cell) => sum + cell.efficiency, 0) / data.cells.length;
  }, [data]);

  if (isLoading) {
    return <div className="flex min-h-[360px] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />載入效率矩陣…</div>;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <div className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-foreground">工站效率熱圖</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">以「標準 CT ÷ 平均實際 CT × 100%」衡量各工站於不同時段的加工效率。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={range} onValueChange={(value) => setRange(value as RangeKey)}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">最近 24 小時</SelectItem>
              <SelectItem value="7d">最近 7 天</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bucketMinutes} onValueChange={setBucketMinutes}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 分鐘分桶</SelectItem>
              <SelectItem value="60">1 小時分桶</SelectItem>
              <SelectItem value="120">2 小時分桶</SelectItem>
              <SelectItem value="240">4 小時分桶</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />重新整理
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card/50 p-3"><p className="text-xs text-muted-foreground">納入工站</p><p className="mt-1 text-xl font-bold text-foreground">{data?.workstations.length ?? 0}</p></div>
        <div className="rounded-lg border border-border bg-card/50 p-3"><p className="text-xs text-muted-foreground">有效時段格</p><p className="mt-1 text-xl font-bold text-violet-300">{data?.cells.length ?? 0}</p></div>
        <div className="rounded-lg border border-border bg-card/50 p-3"><p className="text-xs text-muted-foreground">平均效率</p><p className={`mt-1 text-xl font-bold ${averageEfficiency == null ? "text-muted-foreground" : averageEfficiency >= 95 ? "text-emerald-400" : averageEfficiency >= 85 ? "text-amber-400" : "text-red-400"}`}>{averageEfficiency == null ? "—" : `${averageEfficiency.toFixed(1)}%`}</p></div>
        <div className="rounded-lg border border-border bg-card/50 p-3"><p className="text-xs text-muted-foreground">資料說明</p><p className="mt-1 text-xs leading-5 text-foreground/80">無記錄時段不著色；模擬新增工站以查詢區間平均實績為基準。</p></div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-border bg-card/30 px-4 py-3 text-xs text-muted-foreground">
        {Object.values(STATUS_META).map((meta) => <span key={meta.label} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${meta.dot}`} />{meta.label}</span>)}
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-border bg-muted" />無實績</span>
      </div>

      {!data?.cells.length ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/20 text-center text-muted-foreground">
          <Activity className="mb-3 h-10 w-10 opacity-25" />
          <p className="text-sm">選定區間尚無可用的產品流程實績</p>
          <p className="mt-1 max-w-md text-xs leading-5 opacity-70">請建立含「進入時間」與「實際加工時間」的工站流程記錄，或從配置模擬執行批次建立記錄。</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card/30">
          <div className="min-w-max">
            <div className="grid border-b border-border" style={{ gridTemplateColumns: `160px repeat(${data.bucketStarts.length}, minmax(84px, 1fr))` }}>
              <div className="sticky left-0 z-10 border-r border-border bg-card px-3 py-3 text-xs font-medium text-muted-foreground">工站 / 時段</div>
              {data.bucketStarts.map((bucketStart) => <div key={new Date(bucketStart).toISOString()} className="border-r border-border/70 px-2 py-3 text-center text-[11px] text-muted-foreground"><Clock3 className="mx-auto mb-1 h-3 w-3 opacity-70" />{formatBucket(bucketStart, range)}</div>)}
            </div>
            {data.workstations.map((workstation) => (
              <div key={workstation.id} className="grid border-b border-border/70 last:border-b-0" style={{ gridTemplateColumns: `160px repeat(${data.bucketStarts.length}, minmax(84px, 1fr))` }}>
                <div className="sticky left-0 z-10 flex min-h-[76px] items-center border-r border-border bg-card px-3 text-sm font-medium text-foreground">{workstation.name}</div>
                {data.bucketStarts.map((bucketStart) => {
                  const cell = cellMap.get(`${workstation.id}:${new Date(bucketStart).toISOString()}`);
                  if (!cell) return <div key={new Date(bucketStart).toISOString()} className="m-1 rounded-md border border-border/50 bg-muted/20" />;
                  const meta = STATUS_META[cell.status as CellStatus];
                  const title = `${workstation.name}\n${formatBucket(cell.bucketStart, range)}\n效率 ${cell.efficiency.toFixed(1)}%\n平均實際 CT ${cell.avgActualCycleTime.toFixed(1)}s\n標準 CT ${cell.standardCycleTime.toFixed(1)}s\n樣本 ${cell.sampleCount} 筆`;
                  return (
                    <div key={new Date(bucketStart).toISOString()} className={`m-1 flex min-h-[68px] flex-col justify-center rounded-md px-2 text-center shadow-sm ${meta.tile}`} title={title}>
                      <span className="text-sm font-bold tabular-nums">{cell.efficiency.toFixed(0)}%</span>
                      <span className="mt-0.5 text-[10px] opacity-85">CT {cell.avgActualCycleTime.toFixed(1)}s</span>
                      <span className="text-[10px] opacity-75">{cell.sampleCount} 筆</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
