import { useMemo, useState } from "react";
import { Download, History, Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildMasterDataAuditCsv, formatMasterDataAuditValue, getMasterDataAuditChanges } from "../../../shared/masterDataAudit";

type EntityFilter = "all" | "production_line" | "workstation";
type ActionFilter = "all" | "create" | "update" | "delete" | "bulk_import";
type ChangedFieldFilter = "all" | "name" | "description" | "targetCycleTime" | "status" | "sequenceOrder" | "cycleTime" | "manpower" | "morningManpower" | "eveningManpower" | "notes";

const actionMeta = {
  create: { label: "新增", icon: Plus, className: "status-success", iconClassName: "status-text-success" },
  update: { label: "修改", icon: Pencil, className: "status-info", iconClassName: "status-text-info" },
  delete: { label: "刪除", icon: Trash2, className: "status-risk", iconClassName: "status-text-risk" },
  bulk_import: { label: "批次匯入", icon: Upload, className: "status-neutral", iconClassName: "status-text-neutral" },
} as const;

const fieldLabel: Record<string, string> = {
  name: "名稱", description: "描述", targetCycleTime: "目標節拍", status: "狀態", sequenceOrder: "順序",
  cycleTime: "工序時間", manpower: "合計人力", morningManpower: "早班人力", eveningManpower: "晚班人力", notes: "備註",
};

export function MasterDataAuditLog({ productionLineId, title = "資料異動歷史" }: { productionLineId?: number; title?: string }) {
  const { user } = useAuth();
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [changedFieldFilter, setChangedFieldFilter] = useState<ChangedFieldFilter>("all");
  const [operatorFilter, setOperatorFilter] = useState("all");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const { data: users = [] } = trpc.admin.listUsers.useQuery(undefined, { enabled: user?.role === "admin" });
  const queryInput = useMemo(() => ({
    productionLineId,
    entityType: entityFilter === "all" ? undefined : entityFilter,
    action: actionFilter === "all" ? undefined : actionFilter,
    entityId: entityIdFilter ? Number(entityIdFilter) : undefined,
    operatorId: operatorFilter === "all" ? undefined : Number(operatorFilter),
    changedField: changedFieldFilter === "all" ? undefined : changedFieldFilter,
    from: fromDate ? new Date(`${fromDate}T00:00:00`) : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59.999`) : undefined,
    limit: 500,
  }), [productionLineId, entityFilter, actionFilter, entityIdFilter, operatorFilter, changedFieldFilter, fromDate, toDate]);
  const { data: logs = [], isLoading } = trpc.masterDataAudit.list.useQuery(queryInput, { enabled: user?.role === "admin" });

  const handleExportCsv = () => {
    const csv = buildMasterDataAuditCsv(logs as any);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `master-data-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (user?.role !== "admin") return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-base"><History className="status-text-info h-4 w-4" />{title}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={entityFilter} onValueChange={(value) => setEntityFilter(value as EntityFilter)}>
              <SelectTrigger className="h-8 w-[132px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部資料</SelectItem><SelectItem value="production_line">生產線</SelectItem><SelectItem value="workstation">工站</SelectItem></SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(value) => setActionFilter(value as ActionFilter)}>
              <SelectTrigger className="h-8 w-[132px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部操作</SelectItem><SelectItem value="create">新增</SelectItem><SelectItem value="update">修改</SelectItem><SelectItem value="delete">刪除</SelectItem><SelectItem value="bulk_import">批次匯入</SelectItem></SelectContent>
            </Select>
            <Select value={changedFieldFilter} onValueChange={(value) => setChangedFieldFilter(value as ChangedFieldFilter)}>
              <SelectTrigger className="h-8 w-[132px] text-xs"><SelectValue placeholder="異動欄位" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部欄位</SelectItem>{Object.entries(fieldLabel).map(([field, label]) => <SelectItem key={field} value={field}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={operatorFilter} onValueChange={setOperatorFilter}>
              <SelectTrigger className="h-8 w-[132px] text-xs"><SelectValue placeholder="操作人" /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部操作人</SelectItem>{users.map((operator: any) => <SelectItem key={operator.id} value={String(operator.id)}>{operator.name || operator.username || `使用者 #${operator.id}`}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleExportCsv} disabled={logs.length === 0}><Download className="mr-1.5 h-3.5 w-3.5" />匯出 CSV</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
          <Input value={entityIdFilter} onChange={(event) => setEntityIdFilter(event.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="實體 ID，例如 1001" className="h-8 text-xs" />
          <Input value={fromDate} onChange={(event) => setFromDate(event.target.value)} type="date" aria-label="異動起始日期" className="h-8 text-xs" />
          <Input value={toDate} onChange={(event) => setToDate(event.target.value)} type="date" aria-label="異動結束日期" className="h-8 text-xs" />
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.iconClassName}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {log.entityType === "production_line" ? "生產線" : "工站"}{log.entityId ? ` #${log.entityId}` : ""}
                        <Badge variant="outline" className={`ml-1.5 border text-[10px] ${meta.className}`}>{meta.label}</Badge>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{log.operatorName || log.operatorUsername || `使用者 #${log.operatorId}`} · {new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {importCount !== null && <span className="status-text-neutral text-xs">{importCount} 筆</span>}
                </div>
                {changes.length > 0 && <div className="mt-2 grid gap-1 text-xs text-muted-foreground">{changes.slice(0, 4).map((change) => <p key={change.field}><span className="text-foreground/80">{fieldLabel[change.field] || change.field}</span>：<span className="status-text-risk">{formatMasterDataAuditValue(change.beforeValue)}</span> <span className="mx-1">→</span><span className="status-text-success">{formatMasterDataAuditValue(change.afterValue)}</span></p>)}{changes.length > 4 && <p>另有 {changes.length - 4} 項欄位變更</p>}</div>}
              </div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
