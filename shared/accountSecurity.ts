export function meetsLocalPasswordPolicy(password: string) {
  return password.length >= 12 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

export function wouldLeaveNoActiveAdministrator(input: { targetRole: "admin" | "user"; targetIsActive: boolean; activeAdministratorCount: number; removingAdministrator: boolean }) {
  return input.removingAdministrator && input.targetRole === "admin" && input.targetIsActive && input.activeAdministratorCount <= 1;
}

export function canResetLocalPassword(input: { hasPasswordHash: boolean; loginMethod: string | null }) {
  return input.hasPasswordHash && input.loginMethod === "local";
}
