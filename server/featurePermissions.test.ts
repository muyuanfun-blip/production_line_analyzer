import { describe, expect, it } from "vitest";
import { getEffectivePermissions, getValidPermissionOverrides, hasFeaturePermission } from "../shared/featurePermissions";
import { getSidebarGroups } from "../shared/sidebarNavigation";

describe("功能導向 RBAC 權限矩陣", () => {
  it("一般使用者可執行 AI 分析與匯出，但無治理或帳號管理權限", () => {
    const permissions = getEffectivePermissions({ role: "user", accessProfile: "viewer", permissionOverrides: [] });
    expect(permissions).toContain("production.view");
    expect(permissions).toContain("ai.analyze");
    expect(permissions).toContain("reports.export");
    expect(permissions).not.toContain("master_data.manage");
    expect(permissions).not.toContain("governance.resolve");
    expect(permissions).not.toContain("users.manage");
  });

  it("預設現場資料員也可執行 AI 分析與匯出報告", () => {
    const permissions = getEffectivePermissions({ role: "user", accessProfile: "operator", permissionOverrides: [] });
    expect(permissions).toContain("ai.analyze");
    expect(permissions).toContain("reports.export");
    expect(permissions).not.toContain("governance.view");
    expect(permissions).not.toContain("users.manage");
  });

  it("個別覆寫只接受已知權限並可額外開放功能", () => {
    const overrides = getValidPermissionOverrides(["ai.analyze", "unknown.permission", "ai.analyze"]);
    expect(overrides).toEqual(["ai.analyze"]);
    expect(hasFeaturePermission({ role: "user", accessProfile: "operator", permissionOverrides: overrides }, "ai.analyze")).toBe(true);
  });

  it("系統管理員保有完整功能權限", () => {
    expect(hasFeaturePermission({ role: "admin", accessProfile: "viewer", permissionOverrides: [] }, "users.manage")).toBe(true);
    expect(hasFeaturePermission({ role: "admin", accessProfile: "viewer", permissionOverrides: [] }, "vsm.manage")).toBe(true);
  });

  it("側欄只顯示帳號已獲授權的功能入口", () => {
    const viewerPermissions = getEffectivePermissions({ role: "user", accessProfile: "viewer", permissionOverrides: [] });
    const groups = getSidebarGroups("user", viewerPermissions);
    const paths = groups.flatMap((group) => group.items.map((item) => item.path));
    expect(paths).toContain("/");
    expect(paths).toContain("/lines");
    expect(paths).not.toContain("/data-completion-inbox");
    expect(paths).not.toContain("/admin/users");
  });
});
