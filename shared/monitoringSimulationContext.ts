export type MonitoringSimulationContext = {
  lineId: number;
  bottleneckWsId: number;
  balanceRate: number;
  upph: number;
  criticalCount: number;
};

const safeNumber = (value: string | null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function buildMonitoringSimulationUrl(context: MonitoringSimulationContext) {
  const params = new URLSearchParams({
    source: "monitoring",
    lineId: String(context.lineId),
    bottleneckWsId: String(context.bottleneckWsId),
    balanceRate: String(context.balanceRate),
    upph: String(context.upph),
    criticalCount: String(context.criticalCount),
  });
  return `/simulator?${params.toString()}`;
}

export function parseMonitoringSimulationContext(search: string): MonitoringSimulationContext | null {
  const params = new URLSearchParams(search);
  if (params.get("source") !== "monitoring") return null;
  const lineId = safeNumber(params.get("lineId"));
  if (!lineId) return null;
  return {
    lineId,
    bottleneckWsId: safeNumber(params.get("bottleneckWsId")),
    balanceRate: safeNumber(params.get("balanceRate")),
    upph: safeNumber(params.get("upph")),
    criticalCount: safeNumber(params.get("criticalCount")),
  };
}
