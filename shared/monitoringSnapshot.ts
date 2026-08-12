export type MonitoringStatusPayload = {
  balanceRate: number;
  upph: number;
  taktAchievement: number;
  productionTarget: number;
  productionActual: number;
  bottleneckWsId: number;
  workstations: unknown[];
  anomalies: unknown[];
};

export function buildMonitoringSnapshotPayload(status: MonitoringStatusPayload, note?: string) {
  return {
    balanceRate: Number.isFinite(status.balanceRate) ? status.balanceRate.toFixed(2) : "0.00",
    upph: Number.isFinite(status.upph) ? status.upph.toFixed(4) : "0.0000",
    taktAchievement: Number.isFinite(status.taktAchievement) ? status.taktAchievement.toFixed(2) : "0.00",
    productionTarget: Math.max(0, Math.round(status.productionTarget || 0)),
    productionActual: Math.max(0, Math.round(status.productionActual || 0)),
    bottleneckWsId: status.bottleneckWsId || null,
    workstationsData: status.workstations,
    anomaliesData: status.anomalies,
    note: note?.trim() || null,
  };
}
