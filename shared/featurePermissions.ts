export const FEATURE_PERMISSION_CATALOG = [
  { key: "dashboard.view", group: "決策中心", label: "檢視決策儀表板" },
  { key: "tasks.view", group: "決策中心", label: "檢視補件任務與通知" },
  { key: "tasks.update_own", group: "決策中心", label: "更新自己受指派的補件任務" },
  { key: "production.view", group: "生產資料", label: "檢視產線與工站資料" },
  { key: "production.manage", group: "生產資料", label: "管理產品型號與產品追蹤資料" },
  { key: "master_data.manage", group: "生產資料", label: "管理產線與工站主資料" },
  { key: "actions.view", group: "動作分析", label: "檢視動作拆解" },
  { key: "actions.manage", group: "動作分析", label: "建立與修改動作拆解" },
  { key: "actions.review", group: "動作分析", label: "覆核動作分類" },
  { key: "analysis.view", group: "分析與快照", label: "檢視平衡分析與快照" },
  { key: "snapshots.manage", group: "分析與快照", label: "建立與管理分析快照" },
  { key: "simulation.manage", group: "分析與快照", label: "管理配置模擬" },
  { key: "vsm.view", group: "VSM 與改善", label: "檢視 VSM 與改善行動" },
  { key: "vsm.manage", group: "VSM 與改善", label: "編輯 VSM 流程與改善行動" },
  { key: "ai.analyze", group: "AI 分析", label: "執行 AI 五角色分析與互動追問" },
  { key: "reports.export", group: "AI 分析", label: "匯出分析、快照與建議報告" },
  { key: "governance.view", group: "管理治理", label: "檢視 AI 審查治理與覆核品質" },
  { key: "governance.resolve", group: "管理治理", label: "裁決 AI 審查與管理補件任務" },
  { key: "users.manage", group: "管理治理", label: "管理使用者、角色與權限" },
] as const;

export type FeaturePermission = (typeof FEATURE_PERMISSION_CATALOG)[number]["key"];

export const ACCESS_PROFILES = [
  { key: "viewer", label: "檢視者", description: "可檢視分析與報告，不可修改資料。" },
  { key: "operator", label: "現場資料員", description: "可輸入動作資料並處理自己受指派的補件。" },
  { key: "engineer", label: "改善工程師", description: "可管理生產資料、分析、快照、VSM 與改善行動。" },
  { key: "manager", label: "改善主管", description: "可檢視治理並裁決審查、管理補件任務。" },
] as const;

export type AccessProfile = (typeof ACCESS_PROFILES)[number]["key"];

const PROFILE_PERMISSIONS: Record<AccessProfile, FeaturePermission[]> = {
  viewer: ["dashboard.view", "production.view", "actions.view", "analysis.view", "vsm.view", "reports.export"],
  operator: ["dashboard.view", "tasks.view", "tasks.update_own", "production.view", "actions.view", "actions.manage", "analysis.view", "vsm.view"],
  engineer: ["dashboard.view", "tasks.view", "tasks.update_own", "production.view", "production.manage", "master_data.manage", "actions.view", "actions.manage", "analysis.view", "snapshots.manage", "simulation.manage", "vsm.view", "vsm.manage", "ai.analyze", "reports.export"],
  manager: ["dashboard.view", "tasks.view", "tasks.update_own", "production.view", "production.manage", "master_data.manage", "actions.view", "actions.manage", "actions.review", "analysis.view", "snapshots.manage", "simulation.manage", "vsm.view", "vsm.manage", "ai.analyze", "reports.export", "governance.view", "governance.resolve"],
};

export function getValidPermissionOverrides(value: unknown): FeaturePermission[] {
  if (!Array.isArray(value)) return [];
  const validKeys = new Set<string>(FEATURE_PERMISSION_CATALOG.map((permission) => permission.key));
  return Array.from(new Set(value.filter((item): item is FeaturePermission => typeof item === "string" && validKeys.has(item))));
}

export function getEffectivePermissions(input: { role: "admin" | "user"; accessProfile?: string | null; permissionOverrides?: unknown }): FeaturePermission[] {
  if (input.role === "admin") return FEATURE_PERMISSION_CATALOG.map((permission) => permission.key);
  const profile = ACCESS_PROFILES.some((item) => item.key === input.accessProfile) ? input.accessProfile as AccessProfile : "operator";
  return Array.from(new Set([...PROFILE_PERMISSIONS[profile], ...getValidPermissionOverrides(input.permissionOverrides)]));
}

export function hasFeaturePermission(input: { role: "admin" | "user"; accessProfile?: string | null; permissionOverrides?: unknown }, permission: FeaturePermission) {
  return getEffectivePermissions(input).includes(permission);
}

export function getAccessProfileLabel(profile?: string | null) {
  return ACCESS_PROFILES.find((item) => item.key === profile)?.label ?? "現場資料員";
}
