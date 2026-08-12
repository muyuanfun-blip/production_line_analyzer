export type VsmTrackingContext = { lineId: number; workstationId: number; processName: string };

export function buildVsmTrackingUrl(context: VsmTrackingContext) {
  const params = new URLSearchParams({ source: "vsm", lineId: String(context.lineId), workstationId: String(context.workstationId), processName: context.processName });
  return `/product-tracking?${params.toString()}`;
}

export function parseVsmTrackingContext(search: string): VsmTrackingContext | null {
  const params = new URLSearchParams(search);
  const lineId = Number(params.get("lineId"));
  const workstationId = Number(params.get("workstationId"));
  const processName = params.get("processName") || "";
  if (params.get("source") !== "vsm" || !Number.isFinite(lineId) || lineId <= 0 || !Number.isFinite(workstationId) || workstationId <= 0) return null;
  return { lineId, workstationId, processName };
}
