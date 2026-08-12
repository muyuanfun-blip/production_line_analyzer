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
