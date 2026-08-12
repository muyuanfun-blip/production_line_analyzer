import { describe, expect, it } from "vitest";
import { buildMasterDataAuditCsv, getMasterDataAuditChanges, hasMasterDataAuditChangedField } from "../shared/masterDataAudit";

describe("master data audit differences", () => {
  it("只回傳使用者資料的實際變更，忽略識別碼與時間戳", () => {
    expect(getMasterDataAuditChanges(
      { id: 7, name: "組裝", cycleTime: "60.00", createdAt: "old", updatedAt: "old" },
      { id: 7, name: "組裝", cycleTime: "55.00", createdAt: "old", updatedAt: "new" },
    )).toEqual([{ field: "cycleTime", beforeValue: "60.00", afterValue: "55.00" }]);
  });

  it("建立或刪除只有單側快照時，不誤判為逐欄更新", () => {
    expect(getMasterDataAuditChanges(null, { name: "新工站" })).toEqual([]);
    expect(getMasterDataAuditChanges({ name: "已刪工站" }, null)).toEqual([]);
  });

  it("可依異動欄位篩選，並以安全 CSV 格式匯出前後資料", () => {
    const before = { name: "工站 A", cycleTime: "60.00" };
    const after = { name: "工站 A", cycleTime: "55.00" };
    expect(hasMasterDataAuditChangedField(before, after, "cycleTime")).toBe(true);
    expect(hasMasterDataAuditChangedField(before, after, "name")).toBe(false);
    const csv = buildMasterDataAuditCsv([{ entityType: "workstation", entityId: 3, productionLineId: 1, action: "update", beforeData: before, afterData: after, operatorName: "王小明", operatorId: 9, createdAt: "2026-08-12T00:00:00Z" }]);
    expect(csv).toContain('"異動欄位"');
    expect(csv).toContain('"cycleTime"');
    expect(csv).toContain('"60.00"');
    expect(csv).toContain('"55.00"');
  });
});
