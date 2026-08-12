import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, ArrowLeft, BarChart3, ClipboardList, FileWarning, Gauge, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type GovernanceEvent = { id: number; productionLineId: number; status: "approved" | "needs_clarification"; agreementScore: number; approvalReason: string | null; completenessScore: number; createdAt: Date | string };
type GovernanceStats = { total: number; unresolvedCount: number; unresolvedRate: number; averageCompleteness: number; commonReasons: Array<{ reason: string; count: number }>; commonDataGaps: Array<{ title: string; count: number }>; monthlyTrend: Array<{ month: string; total: number; unresolved: number; unresolvedRate: number; averageCompleteness: number }>; events: GovernanceEvent[] };
type ProductionLineOption = { id: number; name: string };

export default function AIConsensusGovernanceDashboard() {
  const [, setLocation] = useLocation();
  const [lineFilter, setLineFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "needs_clarification">("all");
  const { data: rawLines } = trpc.productionLine.list.useQuery();
  const statsQuery = trpc.aiGovernance.getStats.useQuery({
    productionLineId: lineFilter === "all" ? undefined : Number(lineFilter),
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const lines = rawLines as ProductionLineOption[] | undefined;
  const stats = statsQuery.data as GovernanceStats | undefined;
  const lineNames = useMemo(() => new Map((lines ?? []).map((line) => [line.id, line.name])), [lines]);

  const reasonData = (stats?.commonReasons ?? []).slice(0, 6).map((item) => ({ name: item.reason.length > 18 ? `${item.reason.slice(0, 18)}…` : item.reason, count: item.count }));
  const trendData = stats?.monthlyTrend ?? [];
  const events = stats?.events ?? [];

  return <div className="space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-start gap-3"><Button variant="ghost" size="icon" onClick={() => setLocation("/")}><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-sm text-muted-foreground">管理員／AI 治理</p><h1 className="text-2xl font-bold">五角色審查治理儀表板</h1><p className="mt-1 text-sm text-muted-foreground">追蹤歷次共識結果、資料完整度與造成未共識的常見阻礙。</p></div></div><div className="flex flex-wrap gap-2"><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={lineFilter} onChange={(event) => setLineFilter(event.target.value)}><option value="all">所有產線</option>{(lines ?? []).map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}</select><select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="all">所有審查結果</option><option value="needs_clarification">未達共識</option><option value="approved">已核准</option></select></div></div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      { label: "審查總數", value: stats?.total ?? 0, hint: "已保存的五角色審查", icon: ClipboardList, color: "text-cyan-300" },
      { label: "未共識率", value: `${(stats?.unresolvedRate ?? 0).toFixed(1)}%`, hint: `${stats?.unresolvedCount ?? 0} 次待釐清`, icon: AlertTriangle, color: "text-orange-300" },
      { label: "平均資訊完整度", value: `${(stats?.averageCompleteness ?? 0).toFixed(0)} / 100`, hint: "資料覆蓋與對齊程度", icon: Gauge, color: "text-emerald-300" },
      { label: "常見資料缺口", value: stats?.commonDataGaps?.[0]?.title ?? "—", hint: stats?.commonDataGaps?.[0] ? `${stats.commonDataGaps[0].count} 次出現` : "尚無歷程", icon: FileWarning, color: "text-amber-300" },
    ].map((item) => <Card key={item.label} className="border-border bg-card"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted-foreground">{item.label}</p><p className={`mt-1 text-xl font-bold ${item.color}`}>{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.hint}</p></div><item.icon className={`h-5 w-5 ${item.color}`} /></div></CardContent></Card>)}</div>

    {statsQuery.isLoading ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">正在載入審查治理歷程…</CardContent></Card> : events.length === 0 ? <Card className="border-dashed"><CardContent className="p-12 text-center"><ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground/40" /><h2 className="mt-3 font-semibold">尚無可分析的審查歷程</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">完成下一次五角色 AI 分析後，系統會自動記錄共識狀態、未共識原因、資料缺口與完整度，並在此累積趨勢。</p></CardContent></Card> : <>
      <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">常見未共識阻礙</CardTitle></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={reasonData} margin={{ left: 0, right: 8, top: 8, bottom: 30 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" height={60} tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" name="出現次數" fill="#f97316" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">審查趨勢與資料完整度</CardTitle></CardHeader><CardContent><div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} /><YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Line yAxisId="left" type="monotone" dataKey="averageCompleteness" name="平均完整度" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} /><Line yAxisId="right" type="monotone" dataKey="unresolved" name="未共識次數" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></CardContent></Card></div>
      <Card><CardHeader><CardTitle className="text-base">近期審查歷程</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b text-left text-xs text-muted-foreground"><tr><th className="pb-2 font-medium">時間</th><th className="pb-2 font-medium">產線</th><th className="pb-2 font-medium">結果</th><th className="pb-2 font-medium">共識分數</th><th className="pb-2 font-medium">完整度</th><th className="pb-2 font-medium">原因</th></tr></thead><tbody>{events.slice(0, 20).map((event) => <tr key={event.id} className="border-b border-border/60"><td className="py-3 text-muted-foreground">{new Date(event.createdAt).toLocaleString("zh-TW")}</td><td className="py-3">{lineNames.get(event.productionLineId) ?? `產線 #${event.productionLineId}`}</td><td className="py-3"><span className={event.status === "approved" ? "rounded-full bg-emerald-400/10 px-2 py-1 text-xs text-emerald-300" : "rounded-full bg-orange-400/10 px-2 py-1 text-xs text-orange-300"}>{event.status === "approved" ? "已核准" : "待釐清"}</span></td><td className="py-3">{event.agreementScore} / 100</td><td className="py-3">{event.completenessScore} / 100</td><td className="max-w-[320px] py-3 text-muted-foreground">{event.approvalReason ?? "—"}</td></tr>)}</tbody></table></CardContent></Card>
    </>}
  </div>;
}
