import { trpc } from "@/lib/trpc";
import { FormulaTooltip } from "@/components/FormulaTooltip";
import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, ChevronRight, Brain, Sparkles, Download, RefreshCw,
  BarChart3, AlertTriangle, TrendingUp, Clock, Users, FileText, MessageSquare, Send, ShieldCheck, Gauge
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { buildAIProfessionalReport, buildAIProfessionalReportHtml } from "../../../shared/aiProfessionalReport";
import type { ConsensusResult, RoleReview } from "../../../shared/aiConsensus";
import { INTERACTIVE_QUICK_QUESTIONS } from "../../../shared/interactiveAnalysis";
import { assessAnalysisDataReadiness, getReadinessLevel } from "../../../shared/analysisDataReadiness";
import { deriveInteractiveActionDraft, type InteractiveActionDraft } from "../../../shared/interactiveActionPlan";
import type { ReportCompleteness } from "../../../shared/reportCompleteness";
import { getFriendlyAIAnalysisError } from "../../../shared/aiAnalysisReliability";
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
  const { data: vsmDiagrams } = trpc.vsm.listDiagrams.useQuery({ productionLineId: lineId }, { enabled: lineId > 0 });

  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "approved" | "needs_clarification">("idle");
  const [approvalReason, setApprovalReason] = useState<string | null>(null);
  const [analysisCompleteness, setAnalysisCompleteness] = useState<ReportCompleteness | null>(null);
  const [analysisMetadata, setAnalysisMetadata] = useState<{ executorName: string; executedAt: Date } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [roleReviews, setRoleReviews] = useState<RoleReview[]>([]);
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null);
  const [interactiveQuestion, setInteractiveQuestion] = useState("");
  const [interactiveMessages, setInteractiveMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [actionPlanOpen, setActionPlanOpen] = useState(false);
  const [actionDraft, setActionDraft] = useState<InteractiveActionDraft | null>(null);
  const [selectedDiagramId, setSelectedDiagramId] = useState<number | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [actionDueDate, setActionDueDate] = useState("");
  const { data: vsmProcesses } = trpc.vsm.listProcesses.useQuery({ vsmDiagramId: selectedDiagramId ?? 0 }, { enabled: selectedDiagramId !== null });

  const aiMutation = trpc.analysis.aiSuggest.useMutation({
    onSuccess: (data) => {
      const content = typeof data.suggestion === 'string' ? data.suggestion : JSON.stringify(data.suggestion);
      setSuggestion(content);
      setRoleReviews(data.reviews);
      setConsensus(data.consensus);
      setAnalysisStatus(data.status);
      setApprovalReason(data.approvalReason);
      setAnalysisCompleteness(data.completeness);
      setAnalysisMetadata(data.analysisMetadata);
      setHasAnalyzed(true);
      if (data.status === "approved") toast.success("五角色審查已達成共識，正式報告已就緒");
      else toast.warning("五角色審查尚未達成共識，請先補充資料或釐清分歧");
    },
    onError: (error) => toast.error(getFriendlyAIAnalysisError(error)),
  });

  const interactiveMutation = trpc.analysis.interactiveAnalyze.useMutation({
    onSuccess: (data) => setInteractiveMessages((messages) => [...messages, { role: "assistant", content: data.answer }]),
    onError: (error) => {
      setInteractiveMessages((messages) => messages.slice(0, -1));
      toast.error(error.message || "互動分析失敗，請稍後再試");
    },
  });

  const createImprovementAction = trpc.vsm.createImprovementAction.useMutation({
    onSuccess: () => {
      toast.success("已建立 VSM 改善行動計畫");
      setActionPlanOpen(false);
      setActionDraft(null);
    },
    onError: (error) => toast.error(error.message || "建立改善行動失敗"),
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

  const readinessPreview = useMemo(() => {
    const gaps = assessAnalysisDataReadiness({
      targetCycleTime: line?.targetCycleTime ? Number(line.targetCycleTime) : null,
      workstations: (workstations ?? []).map((station) => {
        const stationActions = (allActionSteps ?? []).filter((step: any) => step.workstationId === station.id);
        return {
          name: station.name,
          cycleTime: Number(station.cycleTime),
          manpower: Number(station.manpower),
          actionStatistics: stationActions.length > 0 ? { totalSteps: stationActions.length, totalDuration: stationActions.reduce((sum: number, step: any) => sum + Number(step.duration || 0), 0) } : undefined,
        };
      }),
    });
    return { gaps, level: getReadinessLevel(gaps) };
  }, [line?.targetCycleTime, workstations, allActionSteps]);

  const professionalReport = useMemo(() => {
    if (!suggestion || analysisStatus === "idle" || !workstations?.length) return null;
    return buildAIProfessionalReport({
      productionLineName: line?.name ?? "未命名產線",
      generatedAt: new Date(),
      analysisMetadata: analysisMetadata ?? undefined,
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
      reportMode: analysisStatus === "approved" ? "formal" : "conditional",
      governance: analysisStatus === "needs_clarification" ? {
        approvalReason,
        agreementScore: consensus?.agreementScore ?? null,
        unresolvedItems: consensus?.unresolvedItems ?? [],
        dataGaps: readinessPreview.gaps,
      } : undefined,
    });
  }, [suggestion, analysisStatus, approvalReason, consensus?.agreementScore, consensus?.unresolvedItems, readinessPreview.gaps, workstations, allActionSteps, line?.name, line?.targetCycleTime, analysisMetadata]);

  const professionalReportHtml = useMemo(
    () => professionalReport ? buildAIProfessionalReportHtml(professionalReport) : "",
    [professionalReport],
  );

  const handleAnalyze = () => {
    if (!workstations?.length) { toast.error("請先新增工站資料"); return; }
    setSuggestion(null);
    setRoleReviews([]);
    setConsensus(null);
    setAnalysisStatus("idle");
    setApprovalReason(null);
    setAnalysisCompleteness(null);
    setAnalysisMetadata(null);
    setInteractiveMessages([]);
    setInteractiveQuestion("");
    
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

  const handleInteractiveAnalyze = (question = interactiveQuestion) => {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) { toast.error("請輸入想進一步分析的問題"); return; }
    if (!consensus || roleReviews.length !== 5 || !analysis || !workstations?.length) {
      toast.error("請先完成五角色共識分析後再進行互動追問");
      return;
    }
    const history = interactiveMessages.slice(-6);
    setInteractiveMessages((messages) => [...messages, { role: "user", content: normalizedQuestion }]);
    setInteractiveQuestion("");
    interactiveMutation.mutate({
      productionLineName: line?.name ?? "未命名產線",
      question: normalizedQuestion,
      dataScope: [
        `工站數量：${workstations.length} 個`,
        `平衡率：${analysis.balanceRate.toFixed(1)}%`,
        `瓶頸工站：${analysis.bottleneck?.name ?? "無"}（${analysis.maxTime.toFixed(1)} 秒）`,
        `平均工序時間：${analysis.avgTime.toFixed(1)} 秒`,
        line?.targetCycleTime ? `目標節拍：${line.targetCycleTime} 秒` : "目標節拍：未設定",
      ],
      workstationSummary: workstations.slice(0, 80).map((station) => `${station.name}：CT ${station.cycleTime} 秒，人力 ${station.manpower}`),
      reviews: roleReviews,
      consensus,
      history,
    });
  };

  const handleConvertInteractiveAnswer = (answerIndex: number) => {
    const answer = interactiveMessages[answerIndex];
    const question = interactiveMessages.slice(0, answerIndex).reverse().find((message) => message.role === "user");
    if (!answer || answer.role !== "assistant" || !question || !consensus) return;
    if (!vsmDiagrams?.length) {
      toast.error("請先建立 VSM 圖表與工序，才能將建議納入改善閉環");
      return;
    }
    setActionDraft(deriveInteractiveActionDraft(question.content, answer.content, consensus));
    setSelectedDiagramId(vsmDiagrams[0]?.id ?? null);
    setSelectedProcessId(null);
    setActionDueDate("");
    setActionPlanOpen(true);
  };

  const handleCreateImprovementAction = () => {
    if (!actionDraft || !selectedDiagramId || !selectedProcessId) {
      toast.error("請選擇承載此行動的 VSM 圖表與工序");
      return;
    }
    if (!actionDraft.title.trim() || !actionDraft.ownerName.trim()) {
      toast.error("請填寫行動標題與責任角色");
      return;
    }
    createImprovementAction.mutate({
      vsmDiagramId: selectedDiagramId,
      vsmProcessId: selectedProcessId,
      title: actionDraft.title.trim(),
      description: `${actionDraft.description}\n\n【驗證指標】${actionDraft.validationMetric}\n【目標時程】${actionDraft.targetHorizon}`,
      ownerName: actionDraft.ownerName.trim(),
      dueDate: actionDueDate ? new Date(`${actionDueDate}T00:00:00`) : null,
      status: "open",
    });
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
      analysisMetadata: analysisMetadata ? { executorName: analysisMetadata.executorName, executedAt: analysisMetadata.executedAt.toISOString() } : null,
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
    <div className="space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
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
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <Button variant="outline" size="sm" className="min-h-11" onClick={handleExportJSON}>
            <Download className="h-4 w-4 mr-2" />JSON
          </Button>
          <Button variant={professionalReport ? "default" : "outline"} size="sm" className="min-h-11" onClick={() => professionalReport ? setReportOpen(true) : toast.info("請先完成 AI 分析後，再開啟專業報告") }>
            <FileText className="h-4 w-4 mr-2" />專業報告
          </Button>
        </div>
      </div>

      {/* Current Status Summary */}
      {analysis && workstations && workstations.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
              <CardContent className="flex items-center gap-3 p-3 sm:p-4">
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

      {workstations && workstations.length > 0 && readinessPreview.gaps.length > 0 && (
        <Card className={readinessPreview.level === "blocked" ? "status-risk" : "status-warning"}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="flex items-center gap-2 font-medium"><AlertTriangle className="status-icon h-4 w-4" />AI 分析前的資料缺口</p><p className="status-detail mt-1 text-xs">目前資料就緒度為「{readinessPreview.level === "blocked" ? "不足" : "受限"}」。補充下列資料後，可提高五角色結論與改善方案的準確度。</p></div><span className="rounded-full border border-current/20 px-2 py-1 text-xs opacity-80">{readinessPreview.gaps.length} 項待補充</span></div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">{readinessPreview.gaps.map((gap) => <div key={gap.key} className="rounded-lg border border-border/70 bg-background/30 p-3"><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-foreground">{gap.title}</p><span className={gap.severity === "critical" ? "text-[10px] text-orange-300" : "text-[10px] text-amber-300"}>{gap.severity === "critical" ? "影響較高" : "建議補充"}</span></div><p className="mt-1 text-xs text-muted-foreground">影響：{gap.impact}</p><p className="mt-1 text-xs text-muted-foreground">請提供：{gap.requestedData}</p><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">建議提供者：{gap.recommendedProvider}</span><Button variant="outline" size="sm" onClick={() => setLocation(gap.collectionLocation === "production_line" ? "/lines" : gap.collectionLocation === "workstation" ? `/lines/${lineId}/workstations` : `/lines/${lineId}/actions`)}>前往補充</Button></div></div>)}</div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Panel */}
      <Card className="border-border bg-card overflow-hidden">
        <CardHeader className="pb-4 border-b border-border">
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <CardTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-400/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-amber-400" />
              </div>
              AI 產線平衡優化分析
            </CardTitle>
            <Button
              onClick={handleAnalyze}
              disabled={aiMutation.isPending || !workstations?.length}
              className="glow-primary min-h-11 w-full sm:w-auto"
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
        <CardContent className="p-4 sm:p-6">
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
          ) : aiMutation.isError ? (
            <div className="status-risk py-8 text-center">
              <AlertTriangle className="status-icon mx-auto mb-3 h-8 w-8" />
              <h3 className="font-semibold">AI 分析暫時無法完成</h3>
              <p className="status-detail mx-auto mt-2 max-w-xl text-sm">{getFriendlyAIAnalysisError(aiMutation.error)}</p>
              <Button variant="outline" className="mt-4" onClick={handleAnalyze}>
                <RefreshCw className="mr-2 h-4 w-4" />重新嘗試分析
              </Button>
            </div>
          ) : suggestion ? (
            <div className="prose prose-invert max-w-none space-y-4">
              {consensus && analysisStatus === "approved" && (
                <div className="status-success not-prose rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">五角色審查已達成共識</p><p className="status-detail mt-1 text-xs">精實與工業工程、製造營運、品質與可靠度、製程與設備、風險與治理皆已完成審查。</p></div><div className="rounded-lg bg-black/10 px-3 py-2 text-center"><p className="text-[10px] opacity-70">共識分數</p><p className="text-lg font-bold">{consensus.agreementScore.toFixed(0)} / 100</p></div></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{roleReviews.map((review) => <div key={review.roleId} className="rounded-lg border border-border/70 bg-background/30 p-2"><p className="text-xs font-medium text-foreground">{review.roleName}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{review.findings[0] ?? "已完成審查"}</p></div>)}</div>
                </div>
              )}
              {consensus && analysisStatus === "needs_clarification" && (
                <div className="status-warning not-prose rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">五角色審查尚未形成正式共識</p><p className="status-detail mt-1 text-xs">原因：{approvalReason ?? "尚待補充資料或釐清角色分歧"}。本次內容僅作補充資料與現場確認用途，尚不可建立改善行動或匯出正式報告。</p></div><div className="rounded-lg bg-black/10 px-3 py-2 text-center"><p className="text-[10px] opacity-70">目前共識分數</p><p className="text-lg font-bold">{consensus.agreementScore.toFixed(0)} / 100</p></div></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{roleReviews.map((review) => <div key={review.roleId} className="rounded-lg border border-border/70 bg-background/30 p-2"><p className="text-xs font-medium text-foreground">{review.roleName}</p><p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{review.risks[0] ?? review.findings[0] ?? "請現場確認審查前提"}</p></div>)}</div>
                </div>
              )}
              {analysisCompleteness && (
                <div className="status-info not-prose rounded-xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">資訊完整度：{analysisCompleteness.score} / 100</p><p className="status-detail mt-1 text-xs">{analysisCompleteness.label}。評分衡量節拍、CT、人力、動作拆解與資料對齊的覆蓋程度，不代表改善效益或正式核准結論。</p></div><Gauge className="status-icon h-7 w-7" /></div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{analysisCompleteness.components.map((component) => <div key={component.key} className="rounded-lg border border-border/70 bg-background/30 p-2"><p className="text-[11px] text-muted-foreground">{component.label}</p><p className="mt-1 text-sm font-semibold text-cyan-100">{component.score} / {component.maxScore}</p><p className="mt-1 text-[10px] text-muted-foreground">{component.detail}</p></div>)}</div>
                </div>
              )}
              {analysisMetadata && (
                <div className="not-prose flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-cyan-400" />分析執行者：<strong className="text-foreground">{analysisMetadata.executorName}</strong></span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-cyan-400" />分析時間：<strong className="text-foreground">{analysisMetadata.executedAt.toLocaleString("zh-TW")}</strong></span>
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
              {consensus && analysisStatus === "approved" && (
                <div className="not-prose rounded-xl border border-violet-400/25 bg-violet-400/5 p-4">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div><p className="flex items-center gap-2 font-medium text-violet-200"><MessageSquare className="h-4 w-4" />互動分析</p><p className="mt-1 text-xs text-muted-foreground">針對目前五角色共識、工站資料、優先行動與風險提出追問；回答不會修改已核准的正式報告。</p></div>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" />受共識脈絡約束</div>
                  </div>
                  {interactiveMessages.length > 0 && <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">{interactiveMessages.map((message, index) => <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-6 rounded-lg bg-violet-400/10 p-3" : "mr-6 rounded-lg border border-border bg-background/50 p-3"}><p className="mb-1 text-[10px] font-medium text-muted-foreground">{message.role === "user" ? "你的問題" : "AI 互動分析"}</p><div className="prose prose-invert max-w-none text-xs"><ReactMarkdown>{message.content}</ReactMarkdown></div>{message.role === "assistant" && <Button variant="outline" size="sm" className="mt-3" onClick={() => handleConvertInteractiveAnswer(index)}><FileText className="mr-2 h-3.5 w-3.5" />轉為改善行動</Button>}</div>)}{interactiveMutation.isPending && <div className="mr-6 rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground"><RefreshCw className="mr-2 inline h-3.5 w-3.5 animate-spin" />正在依五角色共識分析…</div>}</div>}
                  <div className="mt-4 flex flex-wrap gap-2">{INTERACTIVE_QUICK_QUESTIONS.map((question) => <Button key={question} variant="outline" size="sm" className="h-auto whitespace-normal py-1.5 text-left text-xs" disabled={interactiveMutation.isPending} onClick={() => handleInteractiveAnalyze(question)}>{question}</Button>)}</div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Textarea value={interactiveQuestion} onChange={(event) => setInteractiveQuestion(event.target.value)} placeholder="例如：若瓶頸工站增加 0.5 人，先要驗證哪些條件？" className="min-h-20 text-sm" maxLength={800} disabled={interactiveMutation.isPending} /><Button className="self-end sm:self-stretch" disabled={interactiveMutation.isPending || !interactiveQuestion.trim()} onClick={() => handleInteractiveAnalyze()}><Send className="mr-2 h-4 w-4" />追問</Button></div>
                </div>
              )}
              {analysisStatus === "approved" ? <div className="not-prose flex flex-col gap-3 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-foreground">AI 專業圖文分析報告已就緒</p><p className="mt-1 text-xs text-muted-foreground">報告整合目前 KPI、動作分類圖、工站負荷與本次 AI 建議，可預覽、下載或列印為 PDF。</p></div><Button className="shrink-0" onClick={() => setReportOpen(true)}><FileText className="mr-2 h-4 w-4" />匯出專業報告</Button></div> : <div className="not-prose flex flex-col gap-3 rounded-xl border border-orange-400/35 bg-orange-400/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium text-orange-100">可匯出待驗證改善建議報告</p><p className="mt-1 text-xs text-muted-foreground">本報告依現有資料提供改善假設，會標示未共識原因、資料缺口、角色分歧與驗證條件；不構成正式核准，亦不會開放互動追問或自動建立改善行動。</p></div><div className="flex shrink-0 gap-2"><Button variant="outline" onClick={handleAnalyze}><RefreshCw className="mr-2 h-4 w-4" />重新分析</Button><Button className="bg-orange-600 hover:bg-orange-500" onClick={() => setReportOpen(true)}><FileText className="mr-2 h-4 w-4" />匯出待驗證報告</Button></div></div>}
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

      <Dialog open={actionPlanOpen} onOpenChange={setActionPlanOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>確認改善行動計畫</DialogTitle><p className="text-xs text-muted-foreground">此草稿由互動分析回覆與五角色共識生成；請確認責任角色、承載工序與時程後再建立。</p></DialogHeader>
          {actionDraft && <div className="space-y-4">
            <label className="block space-y-1"><span className="text-sm font-medium">行動標題</span><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={actionDraft.title} onChange={(event) => setActionDraft({ ...actionDraft, title: event.target.value })} /></label>
            <label className="block space-y-1"><span className="text-sm font-medium">責任角色／人員</span><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={actionDraft.ownerName} onChange={(event) => setActionDraft({ ...actionDraft, ownerName: event.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1"><span className="text-sm font-medium">VSM 圖表</span><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedDiagramId ?? ""} onChange={(event) => { setSelectedDiagramId(Number(event.target.value)); setSelectedProcessId(null); }}><option value="" disabled>選擇 VSM 圖表</option>{vsmDiagrams?.map((diagram) => <option key={diagram.id} value={diagram.id}>{diagram.name}</option>)}</select></label><label className="block space-y-1"><span className="text-sm font-medium">承載工序</span><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedProcessId ?? ""} disabled={!selectedDiagramId} onChange={(event) => setSelectedProcessId(Number(event.target.value))}><option value="" disabled>選擇 VSM 工序</option>{vsmProcesses?.filter((process) => process.type === "process").map((process) => <option key={process.id} value={process.id}>{process.name}</option>)}</select></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1"><span className="text-sm font-medium">驗證指標</span><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={actionDraft.validationMetric} onChange={(event) => setActionDraft({ ...actionDraft, validationMetric: event.target.value })} /></label><label className="block space-y-1"><span className="text-sm font-medium">完成期限</span><input type="date" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={actionDueDate} onChange={(event) => setActionDueDate(event.target.value)} /></label></div>
            <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">建議目標時程：{actionDraft.targetHorizon}</p>
            <label className="block space-y-1"><span className="text-sm font-medium">行動內容</span><Textarea value={actionDraft.description} onChange={(event) => setActionDraft({ ...actionDraft, description: event.target.value })} className="min-h-48" /></label>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setActionPlanOpen(false)}>取消</Button><Button disabled={createImprovementAction.isPending} onClick={handleCreateImprovementAction}>{createImprovementAction.isPending ? "建立中…" : "確認建立改善行動"}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
