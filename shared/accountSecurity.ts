export function getLocalPasswordPolicyIssues(password: string) {
  const issues: string[] = [];
  if (password.length < 12) issues.push("至少 12 個字元");
  if (password.length > 128) issues.push("不可超過 128 個字元");
  if (!/[a-z]/.test(password)) issues.push("至少一個小寫英文");
  if (!/[A-Z]/.test(password)) issues.push("至少一個大寫英文");
  if (!/[0-9]/.test(password)) issues.push("至少一個數字");
  return issues;
}

export function meetsLocalPasswordPolicy(password: string) {
  return getLocalPasswordPolicyIssues(password).length === 0;
}

export function wouldLeaveNoActiveAdministrator(input: { targetRole: "admin" | "user"; targetIsActive: boolean; activeAdministratorCount: number; removingAdministrator: boolean }) {
  return input.removingAdministrator && input.targetRole === "admin" && input.targetIsActive && input.activeAdministratorCount <= 1;
}

export function canResetLocalPassword(input: { hasPasswordHash: boolean; loginMethod: string | null }) {
  return input.hasPasswordHash && input.loginMethod === "local";
}

export function canPermanentlyDeleteAccount(input: { isCurrentUser: boolean; wouldLeaveNoActiveAdministrator: boolean; businessRecordCount: number }) {
  return !input.isCurrentUser && !input.wouldLeaveNoActiveAdministrator && input.businessRecordCount === 0;
}
