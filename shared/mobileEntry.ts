export const MOBILE_ENTRY_PATH = "/mobile";

export type MobileLineFlow = "overview" | "balance" | "time-study" | "ai";

export function getMobileLineFlowPath(lineId: number, flow: MobileLineFlow = "overview") {
  const base = `${MOBILE_ENTRY_PATH}/lines/${lineId}`;
  return flow === "overview" ? base : `${base}/${flow}`;
}

export function isMobileEntryPath(path: string) {
  return path === MOBILE_ENTRY_PATH || path.startsWith(`${MOBILE_ENTRY_PATH}/`);
}
