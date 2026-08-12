import { describe, expect, it } from "vitest";
import { canResetLocalPassword, meetsLocalPasswordPolicy, wouldLeaveNoActiveAdministrator } from "../shared/accountSecurity";

describe("帳號安全規則", () => {
  it("只接受符合長度與英數大小寫組合的本機密碼", () => {
    expect(meetsLocalPasswordPolicy("weakpassword")).toBe(false);
    expect(meetsLocalPasswordPolicy("SecurePass2026")).toBe(true);
  });

  it("不可移除系統最後一位有效管理員，但可操作仍有其他管理員的帳號", () => {
    expect(wouldLeaveNoActiveAdministrator({ targetRole: "admin", targetIsActive: true, activeAdministratorCount: 1, removingAdministrator: true })).toBe(true);
    expect(wouldLeaveNoActiveAdministrator({ targetRole: "admin", targetIsActive: true, activeAdministratorCount: 2, removingAdministrator: true })).toBe(false);
  });

  it("只允許重設本機帳密帳號的密碼", () => {
    expect(canResetLocalPassword({ hasPasswordHash: true, loginMethod: "local" })).toBe(true);
    expect(canResetLocalPassword({ hasPasswordHash: false, loginMethod: "google" })).toBe(false);
  });
});
