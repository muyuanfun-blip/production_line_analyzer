import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Activity, AlertTriangle, ArrowRight, BarChart3, Brain, CheckCircle2, ClipboardCheck, Factory, FileWarning, Gauge, GitBranch, LineChart as LineChartIcon, ShieldCheck, Sparkles, Target, TrendingUp, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { buildHomeDecisionQueue } from "../../../shared/homeDashboard";

type Workspace = "capacity" | "quality" | "governance" | "improvement";
const workspaceMeta: Record<Workspace, { label: string; description: string; icon: typeof Gauge }> = {
  capacity: { label: "產能", description: "平衡率、瓶頸與節拍焦點", icon: Gauge },
  quality: { label: "品質與資料", description: "資料就緒度與覆核品質", icon: CheckCircle2 },
  governance: { label: "治理", description: "五角色裁決與補件閉環", icon: ShieldCheck },
  improvement: { label: "改善", description: "從診斷走向 VSM 改善行動", icon: Sparkles },
};

function balanceColor(rate: number) { return rate >= 90 ? "#34d399" : rate >= 80 ? "#22d3ee" : rate >= 70 ? "#f59e0b" : "#f87171"; }
export function getBalanceColor(rate: number) { return rate >= 90 ? { bar: "#34d399", text: "text-emerald-400", badge: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" } : rate >= 80 ? { bar: "#22d3ee", text: "text-cyan-400", badge: "bg-cyan-400/15 text-cyan-400 border-cyan-400/30" } : rate >= 70 ? { bar: "#f59e0b", text: "text-amber-400", badge: "bg-amber-400/15 text-amber-400 border-amber-400/30" } : { bar: "#f87171", text: "text-red-400", badge: "bg-red-400/15 text-red-400 border-red-400/30" }; }
export function getBalanceLabel(rate: number) { return rate >= 90 ? "優秀" : rate >= 80 ? "良好" : rate >= 70 ? "普通" : "待改善"; }
function priorityStyle(priority: "critical" | "high" | "normal") { return priority === "critical" ? "decision-priority-critical" : priority === "high" ? "decision-priority-high" : "decision-priority-normal"; }

function useAnimatedMetric(value: number, duration = 520) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setDisplay(value); return; }
    const start = display; const startedAt = performance.now(); let frame = 0;
    const tick = (now: number) => { const progress = Math.min(1, (now - startedAt) / duration); setDisplay(start + (value - start) * (1 - Math.pow(1 - progress, 3))); if (progress < 1) frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [value]);
  return display;
}

function MetricCard({ label, value, suffix, detail, icon: Icon, accent }: { label: string; value: number; suffix: string; detail: string; icon: typeof Factory; accent: string }) {
  const shown = useAnimatedMetric(value);
  return <Card className="decision-metric-card border-border/70 bg-card/70"><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight" style={{ color: accent }}>{Number.isInteger(value) ? Math.round(shown) : shown.toFixed(1)}<span className="ml-1 text-xs font-medium text-muted-foreground">{suffix}</span></p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className="rounded-lg p-2" style={{ background: `${accent}1a` }}><Icon className="h-4 w-4" style={{ color: accent }} /></div></div></CardContent></Card>;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [workspace, setWorkspace] = useState<Workspace>("capacity");
  const { data: lines = [] } = trpc.productionLine.list.useQuery();
  const { data: allLatest, isLoading: snapshotsLoading } = trpc.snapshot.getAllLinesLatestByDate.useQuery();
  const governanceQuery = trpc.aiGovernance.getStats.useQuery(undefined, { enabled: isAdmin });
  const tasksQuery = trpc.aiGovernance.listDataCompletionTasks.useQuery(undefined, { enabled: isAdmin });

  const chartData = useMemo(() => (allLatest ?? []).filter((item: any) => item.snapshot).map((item: any) => ({ lineId: item.lineId, lineName: item.lineName, balanceRate: Number(item.snapshot.balanceRate), taktPassRate: item.snapshot.taktPassRate == null ? null : Number(item.snapshot.taktPassRate), bottleneckName: item.snapshot.bottleneckName ?? "未識別", upph: item.snapshot.upph == null ? null : Number(item.snapshot.upph), snapshotId: item.snapshot.id })), [allLatest]);
  const activeLines = lines.filter((line: any) => line.status === "active").length;
  const averageBalance = chartData.length ? chartData.reduce((sum: number, item: any) => sum + item.balanceRate, 0) / chartData.length : 0;
  const lowBalanceLines = chartData.filter((item: any) => item.balanceRate < 80);
  const withoutSnapshot = Math.max(0, lines.length - chartData.length);
  const governance = governanceQuery.data as any;
  const tasks = (tasksQuery.data as any[] | undefined) ?? [];
  const openTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress").length;
  const decisions = useMemo(() => buildHomeDecisionQueue({ lowBalanceLines: lowBalanceLines.map((line: any) => ({ id: line.lineId, name: line.lineName, balanceRate: line.balanceRate })), unresolvedReviews: governance?.unresolvedCount ?? 0, openCompletionTasks: openTasks, linesWithoutSnapshot: withoutSnapshot }), [lowBalanceLines, governance?.unresolvedCount, openTasks, withoutSnapshot]);
  const navigateDecision = (key: string) => setLocation(key === "capacity" ? "/lines" : key === "governance" ? "/admin/ai-consensus-governance" : key === "completion" ? "/data-completion-inbox" : "/lines");
  const topLines = [...chartData].sort((a, b) => a.balanceRate - b.balanceRate).slice(0, 6);

  const renderWorkspace = () => {
    if (workspace === "capacity") return <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]"><Card className="border-border bg-card/70"><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><div><p className="text-sm font-semibold">平衡率優先檢視</p><p className="text-xs text-muted-foreground">以最新有效快照排序；點選產線可進入平衡分析。</p></div><Button variant="outline" size="sm" onClick={() => setLocation("/lines")}>管理產線<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></div>{topLines.length ? <div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={topLines} layout="vertical" margin={{ left: 8, right: 42, top: 4, bottom: 4 }}><CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.18} /><XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="lineName" width={96} tick={{ fontSize: 12 }} /><Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, "平衡率"]} /><Bar dataKey="balanceRate" radius={[0, 5, 5, 0]} onClick={(item: any) => setLocation(`/lines/${item.lineId}/balance`)}>{topLines.map((item) => <Cell key={item.lineId} fill={balanceColor(item.balanceRate)} />)}</Bar></BarChart></ResponsiveContainer></div> : <EmptyDecision icon={LineChartIcon} title="尚無有效快照" detail="建立產線快照後，首頁會依真實平衡率排序與提醒。" action="前往產線管理" onClick={() => setLocation("/lines")} />}</CardContent></Card><Card className="border-border bg-card/70"><CardContent className="p-5"><p className="text-sm font-semibold">瓶頸與節拍焦點</p><p className="mt-1 text-xs text-muted-foreground">以最新快照的瓶頸工站與節拍資料建立快速入口。</p><div className="mt-4 space-y-2">{topLines.slice(0, 4).map((line) => <button key={line.lineId} className="decision-list-row w-full text-left" onClick={() => setLocation(`/lines/${line.lineId}/balance`)}><span><b>{line.lineName}</b><small>瓶頸：{line.bottleneckName}</small></span><span className="text-right"><b style={{ color: balanceColor(line.balanceRate) }}>{line.balanceRate.toFixed(1)}%</b><small>{line.taktPassRate == null ? "未設定 Takt" : `Takt ${line.taktPassRate.toFixed(0)}%`}</small></span></button>)}{!topLines.length && <p className="py-12 text-center text-sm text-muted-foreground">待建立快照後顯示。</p>}</div></CardContent></Card></div>;
    if (workspace === "quality") return <div className="grid gap-4 md:grid-cols-2"><WorkspaceAction icon={ClipboardCheck} title="動作覆核品質" description="檢查待覆核分類、覆核完成率與增值／浪費時間分布，確保 AI 判讀有可靠基礎。" button="開啟覆核品質儀表板" onClick={() => setLocation("/admin/action-review-quality")} restricted={!isAdmin} /><WorkspaceAction icon={FileWarning} title="資料完整度與補件" description={isAdmin ? `${openTasks} 項未結補件任務正在影響分析可信度。` : "依工站 CT、人力、節拍與動作拆解資料確認分析範圍。"} button={isAdmin ? "管理補件任務" : "查看我的補件任務"} onClick={() => setLocation(isAdmin ? "/admin/ai-consensus-governance" : "/data-completion-inbox")} /></div>;
    if (workspace === "governance") return <div className="grid gap-4 md:grid-cols-2"><WorkspaceAction icon={ShieldCheck} title="五角色審查治理" description={isAdmin ? `${governance?.unresolvedCount ?? 0} 筆未共識審查待釐清或人工裁決；完整度與常見阻礙可在治理儀表板追蹤。` : "五角色審查結果、治理條件與資料缺口會限制正式改善閉環。"} button={isAdmin ? "開啟 AI 審查治理" : "前往 AI 分析"} onClick={() => setLocation(isAdmin ? "/admin/ai-consensus-governance" : "/lines")} restricted={!isAdmin} /><WorkspaceAction icon={ClipboardCheck} title="我的補件與通知" description="高頻資料缺口會自動轉為補件任務；受指派後可在此追蹤資料補齊進度。" button="查看補件任務" onClick={() => setLocation("/data-completion-inbox")} /></div>;
    return <div className="grid gap-4 md:grid-cols-2"><WorkspaceAction icon={Brain} title="AI 分析與條件式建議" description="五角色達成共識後可產出正式報告；未共識時仍可產出待驗證建議報告，並揭露資料限制。" button="開始 AI 分析" onClick={() => setLocation(chartData[0] ? `/lines/${chartData[0].lineId}/ai` : "/lines")} /><WorkspaceAction icon={GitBranch} title="VSM 改善閉環" description="將已核准的改善假設轉為責任人、期限、狀態與驗證指標都可追蹤的改善行動。" button="開啟 VSM 設計" onClick={() => setLocation(chartData[0] ? `/lines/${chartData[0].lineId}/vsm` : "/lines")} /></div>;
  };

  return <div className="decision-home min-h-full space-y-5 p-4 sm:p-6">
    <section className="decision-hero home-reveal relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,.12),transparent_34%),linear-gradient(135deg,rgba(15,23,42,.95),rgba(10,33,46,.92))] p-5 sm:p-7"><div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-2xl"><div className="decision-hero-eyebrow flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><Activity className="h-4 w-4" />決策中樞</div><h1 className="decision-hero-title mt-3 text-2xl font-bold tracking-tight sm:text-3xl">產線改善決策儀表板</h1><p className="decision-hero-copy mt-2 text-sm leading-6 text-muted-foreground">先掌握跨產線營運訊號，再進入產能、品質與資料、治理、改善四個工作區處理下一步。</p></div><div className="flex flex-wrap gap-2"><Button onClick={() => setLocation("/lines")}><Factory className="mr-2 h-4 w-4" />檢視產線</Button>{isAdmin && <Button className="decision-hero-secondary-action" variant="outline" onClick={() => setLocation("/admin/ai-consensus-governance")}><ShieldCheck className="mr-2 h-4 w-4" />處理治理事項</Button>}</div></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 home-reveal home-reveal-delay-1"><MetricCard label="運行中產線" value={activeLines} suffix="條" detail={`共 ${lines.length} 條已建檔產線`} icon={Factory} accent="#22d3ee" /><MetricCard label="平均平衡率" value={averageBalance} suffix="%" detail={chartData.length ? "依最新快照計算" : "尚無快照資料"} icon={Gauge} accent="#34d399" /><MetricCard label="治理待決" value={isAdmin ? governance?.unresolvedCount ?? 0 : 0} suffix="筆" detail={isAdmin ? "五角色未共識審查" : "僅管理者可檢視"} icon={ShieldCheck} accent="#f59e0b" /><MetricCard label="補件任務" value={isAdmin ? openTasks : 0} suffix="項" detail={isAdmin ? "高頻資料缺口待處理" : "查看個人任務"} icon={ClipboardCheck} accent="#a78bfa" /></section>
    <section className="home-reveal home-reveal-delay-2"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold">優先處理事項</p><p className="text-xs text-muted-foreground">依治理風險、資料缺口、產能與快照完整度排序。</p></div><span className="text-xs text-muted-foreground">{snapshotsLoading ? "更新中…" : "使用目前系統資料"}</span></div>{decisions.length ? <div className="grid gap-3 lg:grid-cols-2">{decisions.slice(0, 4).map((item) => <button key={item.key} onClick={() => navigateDecision(item.key)} className={`decision-priority-card text-left ${priorityStyle(item.priority)}`}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/10">{item.key === "governance" ? <ShieldCheck className="h-4 w-4" /> : item.key === "completion" ? <ClipboardCheck className="h-4 w-4" /> : item.key === "capacity" ? <TrendingUp className="h-4 w-4" /> : <FileWarning className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><b className="block text-sm">{item.title}</b><small className="mt-1 block text-xs text-muted-foreground">{item.detail}</small></span><ArrowRight className="h-4 w-4 shrink-0 opacity-70" /></button>)}</div> : <Card className="border-dashed"><CardContent className="flex flex-col items-center p-8 text-center"><CheckCircle2 className="h-8 w-8 text-emerald-400" /><p className="mt-2 font-medium">目前沒有需要立即處理的跨產線事項</p><p className="mt-1 text-xs text-muted-foreground">建立快照、完成 AI 審查或出現資料缺口後，系統會在此建立決策優先順序。</p></CardContent></Card>}</section>
    <section className="home-reveal home-reveal-delay-3"><div className="workspace-tabs" role="tablist" aria-label="決策工作區">{(Object.keys(workspaceMeta) as Workspace[]).map((key) => { const meta = workspaceMeta[key]; const Icon = meta.icon; return <button key={key} role="tab" aria-selected={workspace === key} className={`workspace-tab ${workspace === key ? "workspace-tab-active" : ""}`} onClick={() => setWorkspace(key)}><Icon className="h-4 w-4" /><span><b>{meta.label}</b><small>{meta.description}</small></span></button>; })}</div><div className="home-workspace-panel mt-4" key={workspace}>{renderWorkspace()}</div></section>
  </div>;
}

function WorkspaceAction({ icon: Icon, title, description, button, onClick, restricted = false }: { icon: typeof Brain; title: string; description: string; button: string; onClick: () => void; restricted?: boolean }) { return <Card className="decision-workspace-card"><CardContent className="p-5"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-2"><Icon className="h-5 w-5 text-primary" /></div><div><p className="font-semibold">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div></div><div className="mt-5 flex items-center justify-between"><span className="text-xs text-muted-foreground">{restricted ? "管理者權限" : "可直接處理"}</span><Button variant="outline" size="sm" onClick={onClick}>{button}<ArrowRight className="ml-2 h-3.5 w-3.5" /></Button></div></CardContent></Card>; }
function EmptyDecision({ icon: Icon, title, detail, action, onClick }: { icon: typeof LineChartIcon; title: string; detail: string; action: string; onClick: () => void }) { return <div className="flex min-h-[280px] flex-col items-center justify-center text-center"><Icon className="h-9 w-9 text-muted-foreground/40" /><p className="mt-3 font-medium">{title}</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p><Button variant="outline" size="sm" className="mt-4" onClick={onClick}>{action}</Button></div>; }
