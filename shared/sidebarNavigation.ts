export type SidebarRole = "admin" | "user" | null | undefined;

export interface SidebarNavItem {
  label: string;
  path: string;
}

export interface SidebarNavGroup {
  key: "decision" | "improvement" | "governance";
  label: string;
  items: SidebarNavItem[];
  adminOnly?: boolean;
}

export const sidebarNavigationGroups: SidebarNavGroup[] = [
  { key: "decision", label: "決策中心", items: [{ label: "首頁決策儀表板", path: "/" }, { label: "我的補件任務", path: "/data-completion-inbox" }] },
  { key: "improvement", label: "生產改善", items: [{ label: "生產線管理", path: "/lines" }, { label: "VSM 設計", path: "/lines/1/vsm" }] },
  { key: "governance", label: "管理治理", adminOnly: true, items: [{ label: "覆核品質儀表板", path: "/admin/action-review-quality" }, { label: "AI 審查治理", path: "/admin/ai-consensus-governance" }] },
];

export function getSidebarGroups(role: SidebarRole) {
  return sidebarNavigationGroups.filter((group) => !group.adminOnly || role === "admin");
}

export function shouldCloseNavigationAfterSelect(isMobile: boolean) {
  return isMobile;
}
