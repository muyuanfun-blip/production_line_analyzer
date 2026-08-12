export type MonitoringBalanceContext = {
  balanceRate: number;
  upph: number;
  taktAchievement: number;
  productionActual: number;
  productionTarget: number;
  bottleneckWsId: number;
};

function numberFrom(value: string | null, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildMonitoringBalanceUrl(lineId: number, context: MonitoringBalanceContext) {
  const params = new URLSearchParams({
    source: "monitoring",
    balanceRate: String(context.balanceRate),
    upph: String(context.upph),
    taktAchievement: String(context.taktAchievement),
    productionActual: String(context.productionActual),
    productionTarget: String(context.productionTarget),
    bottleneckWsId: String(context.bottleneckWsId),
  });
  return `/lines/${lineId}/balance?${params.toString()}`;
}

export function parseMonitoringBalanceContext(search: string): MonitoringBalanceContext | null {
  const params = new URLSearchParams(search);
  if (params.get("source") !== "monitoring") return null;
  return {
    balanceRate: numberFrom(params.get("balanceRate")),
    upph: numberFrom(params.get("upph")),
    taktAchievement: numberFrom(params.get("taktAchievement")),
    productionActual: numberFrom(params.get("productionActual")),
    productionTarget: numberFrom(params.get("productionTarget")),
    bottleneckWsId: numberFrom(params.get("bottleneckWsId")),
  };
}
