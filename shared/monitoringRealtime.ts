export type MonitoringStatus = "normal" | "warning" | "critical" | "offline" | "idle";

export type StatusSnapshot = { id: number; status: MonitoringStatus };
export type FlowStatus = "in_progress" | "completed" | "waiting";

export function getChangedWorkstationIds(previous: Map<number, MonitoringStatus>, current: StatusSnapshot[]) {
  if (previous.size === 0) return [];
  return current.filter((workstation) => previous.get(workstation.id) !== workstation.status).map((workstation) => workstation.id);
}

export function summarizeProductFlows(records: Array<{ status: FlowStatus }>) {
  return records.reduce(
    (summary, record) => {
      summary[record.status] += 1;
      return summary;
    },
    { completed: 0, in_progress: 0, waiting: 0 },
  );
}

export function buildActionCockpitSummary(workstation: { status: MonitoringStatus; utilization: number; waitingProducts: number }) {
  const hasWaiting = workstation.waitingProducts > 0;
  return {
    hasWaiting,
    severity: workstation.status === "critical" || workstation.status === "offline" ? "critical" : workstation.status === "warning" || hasWaiting ? "warning" : "normal",
    message: hasWaiting
      ? `目前有 ${workstation.waitingProducts} 件等待產品，建議優先確認物料與前後工站節拍。`
      : `暫無等待產品；目前利用率 ${workstation.utilization.toFixed(1)}%。`,
  };
}
