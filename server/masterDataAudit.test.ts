import { describe, expect, it } from "vitest";
import { getMasterDataAuditChanges } from "../shared/masterDataAudit";

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
});
