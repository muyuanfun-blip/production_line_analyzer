export type SidebarRole = "admin" | "user" | null | undefined;

import type { FeaturePermission } from "./featurePermissions";

export interface SidebarNavItem {
  label: string;
  path: string;
  permission: FeaturePermission;
}

export interface SidebarNavGroup {
  key: "decision" | "improvement" | "governance";
  label: string;
  items: SidebarNavItem[];
}

export const sidebarNavigationGroups: SidebarNavGroup[] = [
  { key: "decision", label: "決策中心", items: [{ label: "首頁決策儀表板", path: "/", permission: "dashboard.view" }, { label: "我的補件任務", path: "/data-completion-inbox", permission: "tasks.view" }] },
  { key: "improvement", label: "生產改善", items: [{ label: "生產線管理", path: "/lines", permission: "production.view" }, { label: "VSM 設計", path: "/lines/1/vsm", permission: "vsm.view" }] },
  { key: "governance", label: "管理治理", items: [{ label: "使用者管理", path: "/admin/users", permission: "users.manage" }, { label: "覆核品質儀表板", path: "/admin/action-review-quality", permission: "actions.review" }, { label: "AI 審查治理", path: "/admin/ai-consensus-governance", permission: "governance.view" }] },
];

export function getSidebarGroups(role: SidebarRole, permissions: FeaturePermission[] = []) {
  if (role === "admin") return sidebarNavigationGroups;
  const granted = new Set<string>(permissions);
  return sidebarNavigationGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => granted.has(item.permission)) }))
    .filter((group) => group.items.length > 0);
}

export function shouldCloseNavigationAfterSelect(isMobile: boolean) {
  return isMobile;
}
