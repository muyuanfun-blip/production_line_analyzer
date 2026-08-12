const ignoredAuditFields = new Set(["id", "createdAt", "updatedAt"]);

export interface MasterDataAuditChange {
  field: string;
  beforeValue: unknown;
  afterValue: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** 取得平面主資料快照的實際欄位差異，排除系統產生的 ID 與時間戳。 */
export function getMasterDataAuditChanges(beforeData: unknown, afterData: unknown): MasterDataAuditChange[] {
  const before = asRecord(beforeData);
  const after = asRecord(afterData);
  if (!before || !after) return [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(fields)
    .filter((field) => !ignoredAuditFields.has(field))
    .filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map((field) => ({ field, beforeValue: before[field], afterValue: after[field] }));
}

export function formatMasterDataAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function hasMasterDataAuditChangedField(beforeData: unknown, afterData: unknown, field: string) {
  return getMasterDataAuditChanges(beforeData, afterData).some((change) => change.field === field);
}

export interface MasterDataAuditExportRow {
  entityType: "production_line" | "workstation";
  entityId: number | null;
  productionLineId: number | null;
  action: "create" | "update" | "delete" | "bulk_import";
  beforeData: unknown;
  afterData: unknown;
  operatorName?: string | null;
  operatorUsername?: string | null;
  operatorId: number;
  createdAt: Date | string;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

/** 將目前篩選出的稽核事件轉為一列一欄位差異的 CSV，利於試算表後續分析。 */
export function buildMasterDataAuditCsv(rows: MasterDataAuditExportRow[]): string {
  const header = ["異動時間", "實體類型", "實體 ID", "產線 ID", "操作", "異動欄位", "異動前", "異動後", "操作人"].map(csvCell).join(",");
  const body = rows.flatMap((row) => {
    const changes = getMasterDataAuditChanges(row.beforeData, row.afterData);
    const operator = row.operatorName || row.operatorUsername || `使用者 #${row.operatorId}`;
    const base = [new Date(row.createdAt).toLocaleString(), row.entityType, row.entityId ?? "", row.productionLineId ?? "", row.action];
    const rowChanges: unknown[][] = changes.length > 0
      ? changes.map((change) => [...base, change.field, formatMasterDataAuditValue(change.beforeValue), formatMasterDataAuditValue(change.afterValue), operator])
      : [[...base, row.action === "bulk_import" ? "importCount" : "", "", formatMasterDataAuditValue(row.afterData ?? row.beforeData), operator]];
    return rowChanges.map((cells) => cells.map(csvCell).join(","));
  });
  return [header, ...body].join("\n");
}
