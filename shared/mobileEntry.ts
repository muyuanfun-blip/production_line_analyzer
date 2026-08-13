export const MOBILE_ENTRY_PATH = "/mobile";
export const DESKTOP_ENTRY_PATH = "/";

export type MobileLineFlow = "overview" | "balance" | "time-study" | "ai";

export function getMobileLineFlowPath(lineId: number, flow: MobileLineFlow = "overview") {
  const base = `${MOBILE_ENTRY_PATH}/lines/${lineId}`;
  return flow === "overview" ? base : `${base}/${flow}`;
}

export function isMobileEntryPath(path: string) {
  return path === MOBILE_ENTRY_PATH || path.startsWith(`${MOBILE_ENTRY_PATH}/`);
}

export function getEntrySwitchPath(currentPath: string) {
  return isMobileEntryPath(currentPath) ? DESKTOP_ENTRY_PATH : MOBILE_ENTRY_PATH;
}
