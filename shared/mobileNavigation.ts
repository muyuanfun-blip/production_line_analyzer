import type { FeaturePermission } from "./featurePermissions";

export type MobileNavigationItem = {
  key: "home" | "lines" | "tasks";
  label: string;
  path: string;
  permission: FeaturePermission;
};

const MOBILE_NAVIGATION_ITEMS: MobileNavigationItem[] = [
  { key: "home", label: "首頁", path: "/", permission: "dashboard.view" },
  { key: "lines", label: "產線", path: "/lines", permission: "production.view" },
  { key: "tasks", label: "任務", path: "/data-completion-inbox", permission: "tasks.view" },
];

export function getMobileNavigationItems(role: "admin" | "user" | undefined, permissions: FeaturePermission[] = []) {
  if (role === "admin") return MOBILE_NAVIGATION_ITEMS;
  const granted = new Set<string>(permissions);
  return MOBILE_NAVIGATION_ITEMS.filter((item) => granted.has(item.permission));
}

export function isMobileNavigationActive(currentPath: string, itemPath: string) {
  return currentPath === itemPath || (itemPath !== "/" && currentPath.startsWith(`${itemPath}/`));
}
