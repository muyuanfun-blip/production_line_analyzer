import { useMemo, useState } from "react";
import { History, Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMasterDataAuditValue, getMasterDataAuditChanges } from "../../../shared/masterDataAudit";

type EntityFilter = "all" | "production_line" | "workstation";
type ActionFilter = "all" | "create" | "update" | "delete" | "bulk_import";

const actionMeta = {
  create: { label: "新增", icon: Plus, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" },
  update: { label: "修改", icon: Pencil, className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/25" },
  delete: { label: "刪除", icon: Trash2, className: "bg-red-500/10 text-red-400 border-red-500/25" },
  bulk_import: { label: "批次匯入", icon: Upload, className: "bg-violet-500/10 text-violet-400 border-violet-500/25" },
} as const;

const fieldLabel: Record<string, string> = {
  name: "名稱", description: "描述", targetCycleTime: "目標節拍", status: "狀態", sequenceOrder: "順序",
  cycleTime: "工序時間", manpower: "合計人力", morningManpower: "早班人力", eveningManpower: "晚班人力", notes: "備註",
};

export function MasterDataAuditLog({ productionLineId, title = "資料異動歷史" }: { productionLineId?: number; title?: string }) {
  const { user } = useAuth();
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const queryInput = useMemo(() => ({
    productionLineId,
    entityType: entityFilter === "all" ? undefined : entityFilter,
    action: actionFilter === "all" ? undefined : actionFilter,
    limit: 50,
  }), [productionLineId, entityFilter, actionFilter]);
  const { data: logs = [], isLoading } = trpc.masterDataAudit.list.useQuery(queryInput, { enabled: user?.role === "admin" });

  if (user?.role !== "admin") return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-cyan-400" />{title}</CardTitle>
          <div className="flex gap-2">
            <Select value={entityFilter} onValueChange={(value) => setEntityFilter(value as EntityFilter)}>
              <SelectTrigger className="h-8 w-[132px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部資料</SelectItem><SelectItem value="production_line">生產線</SelectItem><SelectItem value="workstation">工站</SelectItem></SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as ActionFilter)}>
              <SelectTrigger className="h-8 w-[132px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部操作</SelectItem><SelectItem value="create">新增</SelectItem><SelectItem value="update">修改</SelectItem><SelectItem value="delete">刪除</SelectItem><SelectItem value="bulk_import">批次匯入</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />載入異動紀錄中…</div> : logs.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">尚無符合篩選條件的異動紀錄</p> : (
          <div className="divide-y divide-border/60 rounded-md border border-border/60">
            {logs.map((log: any) => {
              const meta = actionMeta[log.action as keyof typeof actionMeta];
              const Icon = meta.icon;
              const changes = getMasterDataAuditChanges(log.beforeData, log.afterData);
              const importCount = log.action === "bulk_import" && log.afterData && typeof log.afterData === "object" ? (log.afterData as any).count : null;
              return <div key={log.id} className="p-3">
                <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-2"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="text-sm font-medium">{log.entityType === "production_line" ? "生產線" : "工站"}{log.entityId ? ` #${log.entityId}` : ""} <Badge variant="outline" className={`ml-1.5 text-[10px] ${meta.className}`}>{meta.label}</Badge></p><p className="mt-1 text-xs text-muted-foreground">{log.operatorName || log.operatorUsername || `使用者 #${log.operatorId}`} · {new Date(log.createdAt).toLocaleString()}</p></div></div>{importCount !== null && <span className="text-xs text-violet-400">{importCount} 筆</span>}</div>
                {changes.length > 0 && <div className="mt-2 grid gap-1 text-xs text-muted-foreground">{changes.slice(0, 4).map((change) => <p key={change.field}><span className="text-foreground/80">{fieldLabel[change.field] || change.field}</span>：<span className="text-red-300/80">{formatMasterDataAuditValue(change.beforeValue)}</span> <span className="mx-1">→</span><span className="text-emerald-300/90">{formatMasterDataAuditValue(change.afterValue)}</span></p>)}{changes.length > 4 && <p>另有 {changes.length - 4} 項欄位變更</p>}</div>}
              </div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
