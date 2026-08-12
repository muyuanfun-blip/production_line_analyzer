export type MonitoringVsmContext = {
  lineId: number;
  bottleneckWsId: number;
  balanceRate: number;
  criticalCount: number;
  warningCount: number;
};

const safeNumber = (value: string | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function buildMonitoringVsmUrl(context: MonitoringVsmContext) {
  const params = new URLSearchParams({
    source: "monitoring",
    bottleneckWsId: String(context.bottleneckWsId),
    balanceRate: String(context.balanceRate),
    criticalCount: String(context.criticalCount),
    warningCount: String(context.warningCount),
  });
  return `/lines/${context.lineId}/vsm?${params.toString()}`;
}

export function parseMonitoringVsmContext(search: string, lineId: number): MonitoringVsmContext | null {
  const params = new URLSearchParams(search);
  if (params.get("source") !== "monitoring" || lineId <= 0) return null;
  return {
    lineId,
    bottleneckWsId: safeNumber(params.get("bottleneckWsId")),
    balanceRate: safeNumber(params.get("balanceRate")),
    criticalCount: safeNumber(params.get("criticalCount")),
    warningCount: safeNumber(params.get("warningCount")),
  };
}
