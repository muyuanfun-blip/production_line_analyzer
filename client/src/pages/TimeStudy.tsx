import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Calculator, CheckCircle2, ClipboardCheck, Clock3, FilePlus2, LockKeyhole, Plus, RefreshCw, Trash2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type StudyForm = {
  workstationId: string;
  name: string;
  productVariant: string;
  defaultPerformanceRating: string;
  allowancePercent: string;
  notes: string;
};

type ObservationForm = {
  observedCycleTime: string;
  performanceRating: string;
  notes: string;
};

const initialObservationForm: ObservationForm = { observedCycleTime: "", performanceRating: "", notes: "" };

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function displaySeconds(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `${parsed.toFixed(2)} s` : "—";
}

function studyStatusMeta(status: string) {
  if (status === "published") return { label: "已發布", className: "status-success" };
  if (status === "archived") return { label: "已封存", className: "status-neutral" };
  return { label: "草稿", className: "status-warning" };
}

export default function TimeStudy() {
  const { id } = useParams<{ id: string }>();
  const lineId = Number(id ?? 0);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { data: access } = trpc.auth.access.useQuery(undefined, { enabled: Boolean(user) });
  const { data: line } = trpc.productionLine.getById.useQuery({ id: lineId }, { enabled: lineId > 0 });
  const { data: workstations = [] } = trpc.workstation.listByLine.useQuery({ productionLineId: lineId }, { enabled: lineId > 0 });
  const { data: studies = [], isLoading: studiesLoading } = trpc.timeStudy.listByLine.useQuery({ productionLineId: lineId }, { enabled: lineId > 0 });
  const { data: publishedStudies = [] } = trpc.timeStudy.publishedByLine.useQuery({ productionLineId: lineId }, { enabled: lineId > 0 });
  const [selectedStudyId, setSelectedStudyId] = useState<number | null>(null);
  const [showStudyDialog, setShowStudyDialog] = useState(false);
  const [studyForm, setStudyForm] = useState<StudyForm>({ workstationId: "", name: "", productVariant: "", defaultPerformanceRating: "1", allowancePercent: "15", notes: "" });
  const [observationForm, setObservationForm] = useState<ObservationForm>(initialObservationForm);

  const selectedStudy = useMemo(() => studies.find((study) => study.id === selectedStudyId) ?? studies[0] ?? null, [studies, selectedStudyId]);
  const activeStudyId = selectedStudy?.id ?? 0;
  const { data: observations = [] } = trpc.timeStudy.listObservations.useQuery({ timeStudyId: activeStudyId }, { enabled: activeStudyId > 0 });
  const canManage = user?.role === "admin" || access?.permissions.includes("time_study.manage") === true;
  const isEditable = canManage && selectedStudy?.status === "draft";

  const invalidateTimeStudy = async () => {
    await Promise.all([
      utils.timeStudy.listByLine.invalidate({ productionLineId: lineId }),
      utils.timeStudy.publishedByLine.invalidate({ productionLineId: lineId }),
      activeStudyId ? utils.timeStudy.listObservations.invalidate({ timeStudyId: activeStudyId }) : Promise.resolve(),
    ]);
  };

  const createStudy = trpc.timeStudy.create.useMutation({
    onSuccess: async ({ study }) => {
      await invalidateTimeStudy();
      if (study) setSelectedStudyId(study.id);
      setShowStudyDialog(false);
      setStudyForm({ workstationId: "", name: "", productVariant: "", defaultPerformanceRating: "1", allowancePercent: "15", notes: "" });
      toast.success("已建立工時研究草稿，請加入觀測樣本");
    },
    onError: (error) => toast.error(error.message || "建立工時研究失敗"),
  });

  const addObservation = trpc.timeStudy.addObservation.useMutation({
    onSuccess: async () => {
      await invalidateTimeStudy();
      setObservationForm(initialObservationForm);
      toast.success("已加入觀測樣本並重新計算標準工時");
    },
    onError: (error) => toast.error(error.message || "新增觀測樣本失敗"),
  });

  const updateObservation = trpc.timeStudy.updateObservation.useMutation({
    onSuccess: invalidateTimeStudy,
    onError: (error) => toast.error(error.message || "更新觀測樣本失敗"),
  });

  const deleteObservation = trpc.timeStudy.deleteObservation.useMutation({
    onSuccess: async () => { await invalidateTimeStudy(); toast.success("觀測樣本已移除並重新計算"); },
    onError: (error) => toast.error(error.message || "刪除觀測樣本失敗"),
  });

  const recalculate = trpc.timeStudy.recalculate.useMutation({
    onSuccess: async () => { await invalidateTimeStudy(); toast.success("已依有效樣本重新計算"); },
    onError: (error) => toast.error(error.message || "重新計算失敗"),
  });

  const publish = trpc.timeStudy.publish.useMutation({
    onSuccess: async () => { await invalidateTimeStudy(); toast.success("標準工時已發布，舊版已自動封存"); },
    onError: (error) => toast.error(error.message || "發布失敗"),
  });

  const deleteStudy = trpc.timeStudy.delete.useMutation({
    onSuccess: async () => { await invalidateTimeStudy(); setSelectedStudyId(null); toast.success("工時研究草稿已刪除"); },
    onError: (error) => toast.error(error.message || "刪除失敗"),
  });

  const openCreate = () => {
    const first = workstations[0];
    setStudyForm({ workstationId: first ? String(first.id) : "", name: first ? `${first.name} 標準工時研究` : "", productVariant: "", defaultPerformanceRating: "1", allowancePercent: "15", notes: "" });
    setShowStudyDialog(true);
  };

  const handleCreateStudy = () => {
    const workstationId = Number(studyForm.workstationId);
    if (!workstationId || !studyForm.name.trim()) { toast.error("請選擇工站並輸入研究名稱"); return; }
    createStudy.mutate({
      productionLineId: lineId,
      workstationId,
      name: studyForm.name.trim(),
      productVariant: studyForm.productVariant.trim() || undefined,
      defaultPerformanceRating: Number(studyForm.defaultPerformanceRating),
      allowancePercent: Number(studyForm.allowancePercent),
      notes: studyForm.notes.trim() || undefined,
    });
  };

  const handleAddObservation = () => {
    if (!activeStudyId) return;
    const observedCycleTime = Number(observationForm.observedCycleTime);
    if (!Number.isFinite(observedCycleTime) || observedCycleTime <= 0) { toast.error("請輸入有效的觀測週期時間（秒）"); return; }
    const rating = observationForm.performanceRating.trim() ? Number(observationForm.performanceRating) : undefined;
    if (rating !== undefined && (!Number.isFinite(rating) || rating < 0.5 || rating > 1.5)) { toast.error("個別評比係數需介於 0.50 至 1.50"); return; }
    addObservation.mutate({ timeStudyId: activeStudyId, observedCycleTime, performanceRating: rating, notes: observationForm.notes.trim() || undefined });
  };

  const publishedByWorkstation = new Map(publishedStudies.map((study) => [study.workstationId, study]));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Button variant="ghost" size="icon" onClick={() => setLocation(`/lines/${lineId}/workstations`)} aria-label="返回工站管理"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">生產線管理／{line?.name ?? "載入中"}</p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight"><ClipboardCheck className="h-6 w-6 text-cyan-400" />數位工時研究與標準工時</h1>
          <p className="mt-1 text-sm text-muted-foreground">以有效觀測樣本、評比係數與寬放率建立可發布、可追溯的工站標準工時。</p>
        </div>
        {canManage && <Button onClick={openCreate} className="glow-primary"><FilePlus2 className="mr-2 h-4 w-4" />新增工時研究</Button>}
      </div>

      <Card className="status-info border">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="font-medium">計算規則</p><p className="status-detail mt-1 text-sm">正常工時 = 有效觀測時間 × 評比係數；標準工時 = 正常工時 ×（1 + 寬放率）。發布至少需 3 筆有效樣本，且新版本發布時會自動封存同工站前一版。</p></div>
          <div className="flex items-center gap-2 text-sm"><CheckCircle2 className="status-icon h-5 w-5" />已發布 {publishedStudies.length}／{workstations.length} 站</div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
        <Card className="border-border bg-card">
          <CardHeader className="pb-3"><CardTitle className="text-base">研究版本</CardTitle><CardDescription>依工站保留草稿、已發布與封存版本。</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {studiesLoading ? <p className="py-8 text-center text-sm text-muted-foreground">載入工時研究中…</p> : studies.length === 0 ? <div className="rounded-lg border border-dashed border-border p-6 text-center"><Clock3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" /><p className="text-sm font-medium">尚無工時研究</p><p className="mt-1 text-xs text-muted-foreground">先建立研究並輸入至少 3 筆觀測樣本。</p></div> : studies.map((study) => {
              const meta = studyStatusMeta(study.status);
              const selected = selectedStudy?.id === study.id;
              return <button key={study.id} onClick={() => setSelectedStudyId(study.id)} className={`w-full rounded-lg border p-3 text-left ${selected ? "border-cyan-400/60 bg-cyan-400/10" : "border-border bg-background/30 hover:bg-muted/50"}`}>
                <div className="flex items-start justify-between gap-2"><span className="font-medium text-foreground">{study.workstationName}</span><Badge className={`${meta.className} border text-[10px]`}>{meta.label}</Badge></div>
                <p className="mt-1 truncate text-xs text-muted-foreground">V{study.versionNumber} · {study.name}</p>
                <div className="mt-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">{study.sampleCount} 筆有效樣本</span><strong className="text-cyan-400">{displaySeconds(study.standardTime)}</strong></div>
              </button>;
            })}
          </CardContent>
        </Card>

        {!selectedStudy ? <Card className="border-dashed border-border"><CardContent className="p-12 text-center"><Calculator className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" /><h2 className="text-lg font-semibold">選擇或建立一份工時研究</h2><p className="mt-2 text-sm text-muted-foreground">完成觀測、評比與寬放設定後，即可發布為該工站目前有效的標準工時。</p></CardContent></Card> : <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0"><div><div className="flex flex-wrap items-center gap-2"><CardTitle>{selectedStudy.name}</CardTitle><Badge className={`${studyStatusMeta(selectedStudy.status).className} border`}>{studyStatusMeta(selectedStudy.status).label}</Badge></div><CardDescription className="mt-2">工站：{selectedStudy.workstationName} · 版本 V{selectedStudy.versionNumber}{selectedStudy.productVariant ? ` · 型號／條件：${selectedStudy.productVariant}` : ""}</CardDescription></div><div className="flex gap-2">{isEditable && <Button variant="outline" size="sm" onClick={() => recalculate.mutate({ timeStudyId: selectedStudy.id })} disabled={recalculate.isPending}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />重算</Button>}{isEditable && <Button size="sm" onClick={() => publish.mutate({ timeStudyId: selectedStudy.id })} disabled={publish.isPending || selectedStudy.sampleCount < 3}><Upload className="mr-1.5 h-3.5 w-3.5" />發布</Button>}</div></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[{ label: "有效樣本", value: `${selectedStudy.sampleCount} 筆`, tone: "text-foreground" }, { label: "觀測平均", value: displaySeconds(selectedStudy.observedAverageTime), tone: "text-foreground" }, { label: "正常工時", value: displaySeconds(selectedStudy.normalTime), tone: "text-cyan-400" }, { label: "寬放率", value: `${asNumber(selectedStudy.allowancePercent).toFixed(1)}%`, tone: "text-amber-400" }, { label: "標準工時", value: displaySeconds(selectedStudy.standardTime), tone: "text-emerald-400" }].map((item) => <div key={item.label} className="rounded-lg border border-border bg-background/30 p-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className={`mt-1 text-lg font-bold ${item.tone}`}>{item.value}</p></div>)}
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3"><p className="rounded-md bg-muted/30 p-3"><span className="text-muted-foreground">預設評比係數：</span><strong>{asNumber(selectedStudy.defaultPerformanceRating).toFixed(3)}</strong></p><p className="rounded-md bg-muted/30 p-3"><span className="text-muted-foreground">目前工站 CT：</span><strong>{displaySeconds(selectedStudy.workstationCycleTime)}</strong></p><p className="rounded-md bg-muted/30 p-3"><span className="text-muted-foreground">與現行 CT 差異：</span><strong className={asNumber(selectedStudy.standardTime) > asNumber(selectedStudy.workstationCycleTime) ? "text-amber-400" : "text-emerald-400"}>{selectedStudy.standardTime ? `${(asNumber(selectedStudy.standardTime) - asNumber(selectedStudy.workstationCycleTime)).toFixed(2)} s` : "—"}</strong></p></div>
              {selectedStudy.notes && <p className="mt-3 rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">{selectedStudy.notes}</p>}
              {selectedStudy.status === "published" && <div className="status-success mt-4 flex items-center gap-2 rounded-lg border p-3 text-sm"><LockKeyhole className="status-icon h-4 w-4" />此版本已發布並鎖定。若需修正，請建立新工時研究版本。</div>}
              {isEditable && <div className="mt-4 flex justify-end"><Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("確定刪除此草稿與全部觀測樣本？")) deleteStudy.mutate({ id: selectedStudy.id }); }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />刪除草稿</Button></div>}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle className="text-base">觀測樣本</CardTitle><CardDescription>可排除異常、試作或中斷樣本；僅有效樣本會進入標準工時計算。</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              {isEditable && <div className="grid gap-3 rounded-lg border border-border bg-background/30 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)_auto]"><div><Label className="text-xs">觀測時間（秒）</Label><Input className="mt-1" type="number" min="0.01" step="0.01" value={observationForm.observedCycleTime} onChange={(event) => setObservationForm((form) => ({ ...form, observedCycleTime: event.target.value }))} placeholder="例：18.50" /></div><div><Label className="text-xs">個別評比（選填）</Label><Input className="mt-1" type="number" min="0.5" max="1.5" step="0.01" value={observationForm.performanceRating} onChange={(event) => setObservationForm((form) => ({ ...form, performanceRating: event.target.value }))} placeholder={`預設 ${asNumber(selectedStudy.defaultPerformanceRating).toFixed(2)}`} /></div><div><Label className="text-xs">備註（選填）</Label><Input className="mt-1" value={observationForm.notes} onChange={(event) => setObservationForm((form) => ({ ...form, notes: event.target.value }))} placeholder="例：正常節拍、熟練作業員" /></div><div className="flex items-end"><Button onClick={handleAddObservation} disabled={addObservation.isPending}><Plus className="mr-1.5 h-4 w-4" />加入</Button></div></div>}
              {observations.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">尚無觀測樣本。請記錄至少 3 筆正常作業觀測。</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-border text-left text-xs text-muted-foreground"><tr><th className="p-2">#</th><th className="p-2">觀測時間</th><th className="p-2">評比係數</th><th className="p-2">納入計算</th><th className="p-2">備註／排除理由</th><th className="p-2">觀測時間戳</th><th className="p-2" /></tr></thead><tbody>{observations.map((item) => <tr key={item.id} className="border-b border-border/60 last:border-0"><td className="p-2 text-muted-foreground">{item.observationNumber}</td><td className="p-2 font-mono text-foreground">{displaySeconds(item.observedCycleTime)}</td><td className="p-2">{item.performanceRating ? asNumber(item.performanceRating).toFixed(3) : `預設 ${asNumber(selectedStudy.defaultPerformanceRating).toFixed(3)}`}</td><td className="p-2">{isEditable ? <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={item.isIncluded === 1} onChange={(event) => updateObservation.mutate({ id: item.id, isIncluded: event.target.checked, exclusionReason: event.target.checked ? undefined : "排除於標準工時計算" })} /><span className={item.isIncluded === 1 ? "text-emerald-400" : "text-muted-foreground"}>{item.isIncluded === 1 ? "有效" : "已排除"}</span></label> : <span className={item.isIncluded === 1 ? "text-emerald-400" : "text-muted-foreground"}>{item.isIncluded === 1 ? "有效" : "已排除"}</span>}</td><td className="max-w-[220px] p-2 text-muted-foreground">{item.isIncluded === 1 ? item.notes || "—" : item.exclusionReason || "已排除"}</td><td className="p-2 text-xs text-muted-foreground">{new Date(item.observedAt).toLocaleString("zh-TW")}</td><td className="p-2 text-right">{isEditable && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteObservation.mutate({ id: item.id })}><Trash2 className="h-3.5 w-3.5" /></Button>}</td></tr>)}</tbody></table></div>}
            </CardContent>
          </Card>
        </div>}
      </div>

      <Card className="border-border bg-card"><CardHeader><CardTitle className="text-base">工站標準工時覆蓋</CardTitle><CardDescription>已發布標準工時僅作為比較基準，不會覆寫工站目前 CT。</CardDescription></CardHeader><CardContent><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{workstations.map((station) => { const published = publishedByWorkstation.get(station.id); return <div key={station.id} className="rounded-lg border border-border bg-background/30 p-3"><div className="flex items-center justify-between"><p className="font-medium">{station.name}</p>{published ? <Badge className="status-success border text-[10px]">已發布</Badge> : <Badge className="status-neutral border text-[10px]">未建立</Badge>}</div><p className="mt-2 text-sm text-muted-foreground">目前 CT：{displaySeconds(station.cycleTime)}</p><p className="mt-1 text-sm">標準工時：<strong className="text-emerald-400">{published ? displaySeconds(published.standardTime) : "—"}</strong></p></div>; })}</div></CardContent></Card>

      <Dialog open={showStudyDialog} onOpenChange={setShowStudyDialog}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>新增工時研究草稿</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div><Label>工站</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={studyForm.workstationId} onChange={(event) => setStudyForm((form) => ({ ...form, workstationId: event.target.value }))}>{workstations.map((station) => <option key={station.id} value={station.id}>{station.sequenceOrder}. {station.name}（目前 CT {displaySeconds(station.cycleTime)}）</option>)}</select></div><div><Label>研究名稱</Label><Input className="mt-1" value={studyForm.name} onChange={(event) => setStudyForm((form) => ({ ...form, name: event.target.value }))} placeholder="例：組裝站標準工時－正常作業" /></div><div className="grid gap-4 sm:grid-cols-3"><div><Label>型號／條件</Label><Input className="mt-1" value={studyForm.productVariant} onChange={(event) => setStudyForm((form) => ({ ...form, productVariant: event.target.value }))} placeholder="選填" /></div><div><Label>預設評比係數</Label><Input className="mt-1" type="number" min="0.5" max="1.5" step="0.01" value={studyForm.defaultPerformanceRating} onChange={(event) => setStudyForm((form) => ({ ...form, defaultPerformanceRating: event.target.value }))} /></div><div><Label>寬放率（%）</Label><Input className="mt-1" type="number" min="0" max="50" step="0.5" value={studyForm.allowancePercent} onChange={(event) => setStudyForm((form) => ({ ...form, allowancePercent: event.target.value }))} /></div></div><div><Label>研究說明</Label><Textarea className="mt-1" rows={3} value={studyForm.notes} onChange={(event) => setStudyForm((form) => ({ ...form, notes: event.target.value }))} placeholder="記錄產品條件、作業方式、量測範圍或注意事項" /></div></div><DialogFooter><Button variant="outline" onClick={() => setShowStudyDialog(false)}>取消</Button><Button onClick={handleCreateStudy} disabled={createStudy.isPending}>{createStudy.isPending ? "建立中…" : "建立草稿"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
