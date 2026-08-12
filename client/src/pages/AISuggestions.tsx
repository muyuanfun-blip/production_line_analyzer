import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, ChevronRight, Brain, Sparkles, Download, RefreshCw,
  BarChart3, AlertTriangle, TrendingUp, Clock, Users, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildAIProfessionalReport, buildAIProfessionalReportHtml } from "../../../shared/aiProfessionalReport";
import type { ConsensusResult, RoleReview } from "../../../shared/aiConsensus";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function AISuggestions() {
  const params = useParams<{ id: string }>();
  const lineId = parseInt(params.id ?? "0");
  const [, setLocation] = useLocation();

  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId });
  const { data: workstations } = trpc.workstation.listByLine.useQuery({ productionLineId: lineId });
  
  // 查詢所有工站的動作拆解資料
  const workstationIds = workstations?.map(w => w.id) ?? [];
  const { data: allActionSteps } = trpc.actionStep.listByWorkstations.useQuery(
    { workstationIds },
    { enabled: workstationIds.length > 0 }
  );

  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [roleReviews, setRoleReviews] = useState<RoleReview[]>([]);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);

  const aiMutation = trpc.analysis.aiSuggest.useMutation({
    onSuccess: (data) => {
      const content = typeof data.suggestion === 'string' ? data.suggestion : JSON.stringify(data.suggestion);
      setSuggestion(content);
      setRoleReviews(data.reviews);
      setConsensus(data.consensus);
      setHasAnalyzed(true);
      toast.success("五角色審查已達成共識，正式報告已就緒");
    },
    onError: () => toast.error("AI 分析失敗，請稍後再試"),
  });

  const analysis = useMemo(() => {
    if (!workstations || workstations.length === 0) return null;
    const times = workstations.map(w => parseFloat(w.cycleTime.toString()));
    const totalTime = times.reduce((s, t) => s + t, 0);
    const maxTime = Math.max(...times);
    const avgTime = totalTime / times.length;
    const balanceRate = (totalTime / (maxTime * workstations.length)) * 100;
    const bottleneck = workstations.find(w => parseFloat(w.cycleTime.toString()) === maxTime);
    // 計算總人力：優先使用早晚班加總，若無則使用 manpower 欄位（相容舊資料）
    const totalManpower = workstations.reduce((s, w) => {
      const morning = parseFloat(w.morningManpower?.toString() ?? "0") || 0;
      const evening = parseFloat(w.eveningManpower?.toString() ?? "0") || 0;
      const combined = morning + evening;
      return s + (combined > 0 ? combined : parseFloat(w.manpower.toString()));
    }, 0);
    const upph = maxTime > 0 && totalManpower > 0 ? 3600 / maxTime / totalManpower : null;
    return { totalTime, maxTime, avgTime, balanceRate, bottleneck, totalManpower, upph };
  }, [workstations]);

  const professionalReport = useMemo(() => {
    if (!suggestion || !workstations?.length) return null;
    return buildAIProfessionalReport({
      productionLineName: line?.name ?? "未命名產線",
      generatedAt: new Date(),
      targetCycleTime: line?.targetCycleTime,
      workstations: workstations.map((station) => ({
        id: station.id,
        name: station.name,
        sequenceOrder: station.sequenceOrder,
        cycleTime: station.cycleTime,
        manpower: station.manpower,
        morningManpower: station.morningManpower,
        eveningManpower: station.eveningManpower,
      })),
      actionSteps: (allActionSteps ?? []).map((step: any) => ({
        workstationId: step.workstationId,
        duration: step.duration,
        actionType: step.actionType,
      })),
      aiSuggestion: suggestion,
    });
  }, [suggestion, workstations, allActionSteps, line?.name, line?.targetCycleTime]);

  const professionalReportHtml = useMemo(
    () => professionalReport ? buildAIProfessionalReportHtml(professionalReport) : "",
    [professionalReport],
  );

  const handleAnalyze = () => {
    if (!workstations?.length) { toast.error("請先新增工站資料"); return; }
    setSuggestion(null);
    setRoleReviews([]);
    setConsensus(null);
    
    // 為每個工站附加動作拆解資料
    const workstationsWithActions = workstations.map(w => {
      const wsActionSteps = allActionSteps?.filter((a: any) => a.workstationId === w.id) ?? [];
      const totalActionDuration = wsActionSteps.reduce((sum: number, a: any) => sum + parseFloat(a.duration.toString()), 0);
      const valueAddedCount = wsActionSteps.filter((a: any) => a.actionType === 'value_added').length;
      const nonValueAddedCount = wsActionSteps.filter((a: any) => a.actionType === 'non_value_added').length;
      const necessaryWasteCount = wsActionSteps.filter((a: any) => a.actionType === 'necessary_waste').length;
      
      return {
        name: w.name,
        cycleTime: parseFloat(w.cycleTime.toString()),
        manpower: parseFloat(w.manpower.toString()),
        sequenceOrder: w.sequenceOrder,
        actionSteps: wsActionSteps.map((a: any) => ({
          stepName: a.stepName,
          duration: parseFloat(a.duration.toString()),
          actionType: a.actionType,
          description: a.description,
        })),
        actionStatistics: {
          totalSteps: wsActionSteps.length,
          totalDuration: totalActionDuration,
          valueAddedCount,
          nonValueAddedCount,
          necessaryWasteCount,
          valueAddedRate: wsActionSteps.length > 0 ? ((valueAddedCount / wsActionSteps.length) * 100).toFixed(1) : '0',
        },
      };
    });
    
    aiMutation.mutate({
      productionLineId: lineId,
      productionLineName: line?.name ?? "未命名產線",
      targetCycleTime: line?.targetCycleTime ? parseFloat(line.targetCycleTime.toString()) : undefined,
      workstations: workstationsWithActions,
    });
  };

  const handleDownloadProfessionalReport = () => {
    if (!professionalReportHtml) { toast.error("請先執行 AI 分析"); return; }
    const blob = new Blob([professionalReportHtml], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${line?.name ?? "ai"}_AI專業分析報告.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("專業報告 HTML 已下載");
  };

  const handlePrintProfessionalReport = () => {
    if (!professionalReportHtml) { toast.error("請先執行 AI 分析"); return; }
    const reportWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!reportWindow) { toast.error("瀏覽器封鎖了報告視窗，請允許彈出視窗後再試"); return; }
    reportWindow.document.open();
    reportWindow.document.write(professionalReportHtml);
    reportWindow.document.close();
    reportWindow.focus();
    window.setTimeout(() => reportWindow.print(), 250);
  };

  const handleExportJSON = () => {
    if (!workstations?.length) { toast.error("沒有工站資料可導出"); return; }
    const data = {
      productionLine: {
        id: lineId,
        name: line?.name,
        targetCycleTime: line?.targetCycleTime,
        status: line?.status,
      },
      analysis: analysis ? {
        workstationCount: workstations.length,
        totalCycleTime: analysis.totalTime.toFixed(2),
        maxCycleTime: analysis.maxTime.toFixed(2),
        avgCycleTime: analysis.avgTime.toFixed(2),
        balanceRate: analysis.balanceRate.toFixed(2) + "%",
        upph: analysis.upph != null ? parseFloat(analysis.upph.toFixed(4)) : null,
        upphUnit: "件/人/時",
        bottleneckStation: analysis.bottleneck?.name,
      } : null,
      workstations: workstations.map(w => ({
        id: w.id,
        name: w.name,
        sequenceOrder: w.sequenceOrder,
        cycleTime: w.cycleTime,
        manpower: w.manpower,
        description: w.description,
      })),
      aiSuggestion: suggestion,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${line?.name ?? "data"}_完整分析.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON 已下載");
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
          <h1 className="text-2xl font-bold tracking-tight">AI 優化建議</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download className="h-4 w-4 mr-2" />JSON
          </Button>
          <Button variant={professionalReport ? "default" : "outline"} size="sm" onClick={() => professionalReport ? setReportOpen(true) : toast.info("請先完成 AI 分析後，再開啟專業報告") }>
            <FileText className="h-4 w-4 mr-2" />專業報告
          </Button>
        </div>
      </div>

      {/* Current Status Summary */}
      {analysis && workstations && workstations.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              label: "工站數量", value: workstations.length, unit: "個",
              icon: BarChart3, color: "text-cyan-400", bg: "bg-cyan-400/10"
            },
            {
              label: "產線平衡率", value: analysis.balanceRate.toFixed(1), unit: "%",
              icon: TrendingUp,
              color: analysis.balanceRate >= 85 ? "text-emerald-400" : analysis.balanceRate >= 70 ? "text-amber-400" : "text-orange-400",
              bg: analysis.balanceRate >= 85 ? "bg-emerald-400/10" : analysis.balanceRate >= 70 ? "bg-amber-400/10" : "bg-orange-400/10",
            },
            {
              label: "瓶頸時間", value: analysis.maxTime.toFixed(1), unit: "s",
              icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-400/10"
            },
            {
              label: "總人員", value: analysis.totalManpower, unit: "人",
              icon: Users, color: "text-violet-400", bg: "bg-violet-400/10"
            },
            {
              label: "UPPH",
              value: analysis.upph != null ? analysis.upph.toFixed(2) : "—",
              unit: analysis.upph != null ? " 件/人/時" : "",
              icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-400/10"
            },
          ].map(kpi => (
            <Card key={kpi.label} className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <FormulaTooltip
                    formulaKey={kpi.label === "產線平衡率" ? "balanceRate" : kpi.label === "瓶頸時間" ? "bottleneckTime" : kpi.label === "UPPH" ? "upph" : kpi.label === "總人員" ? "totalManpower" : "workstationCount"}
                    liveValues={kpi.label === "UPPH" ? { "瓶頸時間": `${analysis.maxTime.toFixed(1)}s`, "合計人力": `${analysis.totalManpower}人`, "UPPH": `${kpi.value}${kpi.unit}` } : { [kpi.label]: `${kpi.value}${kpi.unit}` }}
                  >
                    <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}<span className="text-sm font-normal ml-0.5">{kpi.unit}</span></p>
                  </FormulaTooltip>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* AI Analysis Panel */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-amber-400" />
              </div>
              AI 產線平衡優化分析
            </CardTitle>
            <Button
              onClick={handleAnalyze}
              disabled={aiMutation.isPending || !workstations?.length}
              className="glow-primary"
            >
              {aiMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {hasAnalyzed ? "重新分析" : "開始 AI 分析"}
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {!workstations?.length ? (
            <div className="py-12 text-center">
              <Brain className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-base font-semibold mb-2">尚無工站資料</h3>
              <p className="text-muted-foreground text-sm mb-4">請先在工站管理頁面新增工站資料，再進行 AI 分析</p>
              <Button variant="outline" onClick={() => setLocation(`/lines/${lineId}/workstations`)}>
                前往工站管理
              </Button>
            </div>
          ) : aiMutation.isPending ? (
            <div className="py-12 text-center">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-amber-400/20" />
                <div className="absolute inset-0 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                <Brain className="absolute inset-0 m-auto h-7 w-7 text-amber-400" />
              </div>
              <p className="text-base font-medium mb-1">AI 正在分析產線數據...</p>
              <p className="text-sm text-muted-foreground">正在執行五角色審查與共識整合，請稍候</p>
            </div>
          ) : suggestion ? (
            <div className="prose prose-invert max-w-none space-y-4">
              {consensus && (
                <div className="not-prose rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-emerald-300">五角色審查已達成共識</p><p className="mt-1 text-xs text-muted-foreground">精實與工業工程、製造營運、品質與可靠度、製程與設備、風險與治理皆已完成審查。</p></div><div className="rounded-lg bg-emerald-400/10 px-3 py-2 text-center"><p className="text-[10px] text-muted-foreground">共識分數</p><p className="text-lg font-bold text-emerald-300">{consensus.agreementScore.toFixed(0)} / 100</p></div></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{roleReviews.map((review) => <div key={review.roleId} className="rounded-lg border border-border/70 bg-background/30 p-2"><p className="text-xs font-medium text-foreground">{review.roleName}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{review.findings[0] ?? "已完成審查"}</p></div>)}</div>
                </div>
              )}
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-5">
                <div className="text-sm leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      h2: ({ children }) => <h2 className="text-base font-semibold text-amber-400 mt-4 mb-2">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-medium text-foreground mt-3 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="text-muted-foreground leading-relaxed mb-2">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc list-inside text-muted-foreground mb-2">{children}</ul>,
                      li: ({ children }) => <li className="mb-1 ml-2">{children}</li>,
                      strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                    }}
                  >
                    {suggestion}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="not-prose flex flex-col gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="font-medium text-foreground">AI 專業圖文分析報告已就緒</p><p className="mt-1 text-xs text-muted-foreground">報告整合目前 KPI、動作分類圖、工站負荷與本次 AI 建議，可預覽、下載或列印為 PDF。</p></div>
                <Button className="shrink-0" onClick={() => setReportOpen(true)}><FileText className="mr-2 h-4 w-4" />匯出專業報告</Button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-amber-400/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold mb-2">準備好進行 AI 分析</h3>
              <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
                AI 將以五個專業角色獨立審查相同產線資料；只有達成共識後，才會產出可匯出的正式改善報告。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-6 text-xs">
                {[
                  { icon: BarChart3, text: "五角色獨立審查" },
                  { icon: TrendingUp, text: "共識門檻確認" },
                  { icon: Brain, text: "結構化改善報告" },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                    <item.icon className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-muted-foreground">{item.text}</span>
                  </div>
                ))}
              </div>
              <p className="mb-3 text-xs text-muted-foreground">完成分析後，頁面頂端與分析結果下方都會出現「專業報告」匯出入口。</p>
              <Button onClick={handleAnalyze} size="lg" className="glow-primary">
                <Sparkles className="h-4 w-4 mr-2" />
                開始 AI 分析
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="w-[96vw] max-w-6xl p-0">
          <DialogHeader className="border-b border-border px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
              <div><DialogTitle>AI 專業圖文分析報告</DialogTitle><p className="mt-1 text-xs text-muted-foreground">內容使用目前產線資料、本次 AI 分析結果與動作拆解統計產出。</p></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={handleDownloadProfessionalReport}><Download className="mr-2 h-4 w-4" />下載 HTML</Button><Button size="sm" onClick={handlePrintProfessionalReport}><FileText className="mr-2 h-4 w-4" />列印／另存 PDF</Button></div>
            </div>
          </DialogHeader>
          {professionalReportHtml && <iframe title="AI 專業圖文分析報告預覽" srcDoc={professionalReportHtml} className="h-[72vh] w-full bg-white" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
