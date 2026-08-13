import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, ClipboardCheck, Clock3, Loader2, ScanSearch, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const classificationMeta = {
  value_added: { label: "增值", color: "#22c55e" },
  non_value_added: { label: "非增值", color: "#f97316" },
  necessary_waste: { label: "必要浪費", color: "#a78bfa" },
} as const;

const statusMeta = {
  unreviewed: { label: "未送審", color: "#64748b" },
  pending: { label: "待覆核", color: "#f59e0b" },
  approved: { label: "已接受", color: "#22c55e" },
  rejected: { label: "已駁回", color: "#ef4444" },
} as const;

export default function ActionReviewDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [lineFilter, setLineFilter] = useState("all");
  const { data: lines = [] } = trpc.productionLine.list.useQuery();
  const statsInput = useMemo(() => lineFilter === "all" ? undefined : { productionLineId: Number(lineFilter) }, [lineFilter]);
  const { data: stats, isLoading } = trpc.actionStep.getReviewQualityStats.useQuery(statsInput, { enabled: user?.role === "admin" });

  if (user?.role !== "admin") {
    return <div className="p-6 text-sm text-muted-foreground">此頁面僅限管理者使用。</div>;
  }

  const classificationData = (stats?.classification || []).map((item: any) => ({
    name: classificationMeta[item.type as keyof typeof classificationMeta].label,
    value: item.duration,
    count: item.count,
    share: item.durationShare,
    color: classificationMeta[item.type as keyof typeof classificationMeta].color,
  }));
  const statusData = (stats?.statusCounts || []).map((item: any) => ({
    name: statusMeta[item.status as keyof typeof statusMeta].label,
    count: item.count,
    color: statusMeta[item.status as keyof typeof statusMeta].color,
  }));
  const wasteDuration = classificationData.filter((item) => item.name !== "增值").reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400"><ScanSearch className="h-4 w-4" />管理品質中心</div>
          <h1 className="text-2xl font-bold tracking-tight">動作覆核品質儀表板</h1>
          <p className="mt-1 text-sm text-muted-foreground">以實際動作拆解資料追蹤覆核完成度、分類時間結構與待處理工站。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={lineFilter} onValueChange={setLineFilter}>
            <SelectTrigger className="w-[210px]"><SelectValue placeholder="篩選產線" /></SelectTrigger>
            <SelectContent><SelectItem value="all">全部產線</SelectItem>{lines.map((line) => <SelectItem key={line.id} value={String(line.id)}>{line.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" disabled={lineFilter === "all"} onClick={() => setLocation(`/lines/${lineFilter}/actions`)}><ClipboardCheck className="mr-2 h-4 w-4" />開啟覆核管理</Button>
        </div>
      </div>

      {isLoading ? <div className="flex h-56 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />載入品質統計中…</div> : !stats || stats.total === 0 ? <Card className="border-dashed"><CardContent className="py-16 text-center"><BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/40" /><p className="mt-4 font-medium">尚無可分析的動作拆解資料</p><p className="mt-1 text-sm text-muted-foreground">建立動作步驟後，系統將自動呈現覆核與分類品質統計。</p></CardContent></Card> : <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CheckCircle2} label="覆核完成率" value={`${stats.completionRate.toFixed(1)}%`} hint={`${stats.resolvedCount} / ${stats.total} 筆已完成決策`} tone="status-success" />
          <MetricCard icon={Clock3} label="待覆核動作" value={String(stats.pendingCount)} hint={`${stats.unreviewedCount} 筆尚未送審`} tone="status-warning" />
          <MetricCard icon={ClipboardCheck} label="覆核涵蓋率" value={`${stats.reviewCoverageRate.toFixed(1)}%`} hint="已送審或已完成決策的動作占比" tone="status-info" />
          <MetricCard icon={ShieldAlert} label="建議接受率" value={`${stats.approvalRate.toFixed(1)}%`} hint={`${stats.approvedCount} 接受／${stats.rejectedCount} 駁回`} tone="status-neutral" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">分類品質：作業時間結構</CardTitle><p className="text-xs text-muted-foreground">總動作時間 {stats.totalDuration.toFixed(1)} 秒；非增值與必要浪費合計 {wasteDuration.toFixed(1)} 秒。</p></CardHeader>
            <CardContent><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={classificationData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>{classificationData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number, _name: string, item: any) => [`${Number(value).toFixed(1)} 秒（${item.payload.share.toFixed(1)}%）`, item.payload.name]} /><text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-xl font-bold">{stats.total}</text><text x="50%" y="57%" textAnchor="middle" className="fill-muted-foreground text-xs">動作筆數</text></PieChart></ResponsiveContainer></div><div className="grid grid-cols-3 gap-2">{classificationData.map((item) => <div key={item.name} className="rounded bg-muted/30 p-2 text-center"><p className="text-xs text-muted-foreground">{item.name}</p><p className="mt-1 font-semibold" style={{ color: item.color }}>{item.share.toFixed(1)}%</p><p className="text-[11px] text-muted-foreground">{item.count} 筆</p></div>)}</div></CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardHeader className="pb-2"><CardTitle className="text-base">覆核決策狀態</CardTitle><p className="text-xs text-muted-foreground">以覆核流程狀態辨識待處理量與分類決策產出。</p></CardHeader>
            <CardContent><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ top: 10, right: 8, left: -24, bottom: 4 }}><XAxis dataKey="name" tick={{ fontSize: 12, fill: "currentColor" }} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "currentColor" }} /><Tooltip formatter={(value: number) => [`${value} 筆`, "動作數"]} cursor={{ fill: "rgba(148, 163, 184, .08)" }} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{statusData.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div><div className="grid grid-cols-4 gap-2">{statusData.map((item) => <div key={item.name} className="rounded bg-muted/30 p-2 text-center"><p className="text-[11px] text-muted-foreground">{item.name}</p><p className="mt-1 font-semibold" style={{ color: item.color }}>{item.count}</p></div>)}</div></CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card"><CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">工站覆核缺口</CardTitle><p className="mt-1 text-xs text-muted-foreground">依完成率由低至高排序，優先處理尚未送審與待覆核工站。</p></div><Button size="sm" variant="outline" disabled={lineFilter === "all"} onClick={() => setLocation(`/lines/${lineFilter}/actions`)}>查看該產線待覆核動作</Button></div></CardHeader><CardContent className="pt-0"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="px-3 py-2">工站</th><th className="px-3 py-2 text-right">完成率</th><th className="px-3 py-2 text-right">未送審</th><th className="px-3 py-2 text-right">待覆核</th><th className="px-3 py-2 text-right">已決策</th><th className="px-3 py-2 text-right">操作</th></tr></thead><tbody>{stats.workstationCoverage.slice(0, 10).map((station: any) => <tr key={station.workstationId} className="border-b border-border/60 last:border-0"><td className="px-3 py-3 font-medium">{station.workstationName}</td><td className="px-3 py-3 text-right"><span className={station.completionRate >= 90 ? "status-text-success" : station.completionRate >= 50 ? "status-text-warning" : "status-text-risk"}>{station.completionRate.toFixed(1)}%</span></td><td className="px-3 py-3 text-right text-muted-foreground">{station.unreviewed}</td><td className="status-text-warning px-3 py-3 text-right">{station.pending}</td><td className="status-text-success px-3 py-3 text-right">{station.resolved} / {station.total}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setLocation(`/lines/${station.productionLineId}/actions`)}>處理覆核</Button></td></tr>)}</tbody></table></div></CardContent></Card>
      </>}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, tone }: { icon: typeof CheckCircle2; label: string; value: string; hint: string; tone: string }) {
  return <Card className={`${tone} border`}><CardContent className="flex items-start gap-3 p-4"><div className="rounded-md bg-black/10 p-2"><Icon className="status-icon h-4 w-4" /></div><div><p className="status-detail text-xs">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p><p className="status-detail mt-1 text-[11px]">{hint}</p></div></CardContent></Card>;
}
