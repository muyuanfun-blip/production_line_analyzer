import { describe, expect, it } from "vitest";
import { canPermanentlyDeleteAccount, canResetLocalPassword, meetsLocalPasswordPolicy, wouldLeaveNoActiveAdministrator } from "../shared/accountSecurity";

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

  it("僅允許非目前使用者、非最後管理員且無業務紀錄的帳號永久刪除", () => {
    expect(canPermanentlyDeleteAccount({ isCurrentUser: false, wouldLeaveNoActiveAdministrator: false, businessRecordCount: 0 })).toBe(true);
    expect(canPermanentlyDeleteAccount({ isCurrentUser: true, wouldLeaveNoActiveAdministrator: false, businessRecordCount: 0 })).toBe(false);
    expect(canPermanentlyDeleteAccount({ isCurrentUser: false, wouldLeaveNoActiveAdministrator: true, businessRecordCount: 0 })).toBe(false);
    expect(canPermanentlyDeleteAccount({ isCurrentUser: false, wouldLeaveNoActiveAdministrator: false, businessRecordCount: 1 })).toBe(false);
  });
});
