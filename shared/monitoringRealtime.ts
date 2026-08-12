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
