export type ActionReviewStatus = "unreviewed" | "pending" | "approved" | "rejected";
export type ActionClassification = "value_added" | "non_value_added" | "necessary_waste";

export interface ActionReviewQualityRow {
  productionLineId: number;
  workstationId: number;
  workstationName: string;
  duration: number | string;
  actionType: ActionClassification;
  reviewStatus: ActionReviewStatus;
}

const classificationOrder: ActionClassification[] = ["value_added", "non_value_added", "necessary_waste"];
const reviewStatusOrder: ActionReviewStatus[] = ["unreviewed", "pending", "approved", "rejected"];

export function summarizeActionReviewQuality(rows: ActionReviewQualityRow[]) {
  const total = rows.length;
  const totalDuration = rows.reduce((sum, row) => sum + (Number(row.duration) || 0), 0);
  const statusCounts = reviewStatusOrder.map((status) => ({ status, count: rows.filter((row) => row.reviewStatus === status).length }));
  const statusMap = Object.fromEntries(statusCounts.map((item) => [item.status, item.count])) as Record<ActionReviewStatus, number>;
  const resolvedCount = statusMap.approved + statusMap.rejected;
  const decisionCount = resolvedCount;
  const classification = classificationOrder.map((type) => {
    const items = rows.filter((row) => row.actionType === type);
    const duration = items.reduce((sum, row) => sum + (Number(row.duration) || 0), 0);
    return { type, count: items.length, duration, durationShare: totalDuration > 0 ? (duration / totalDuration) * 100 : 0 };
  });
  const workstationMap = new Map<number, { productionLineId: number; workstationId: number; workstationName: string; total: number; resolved: number; pending: number; unreviewed: number }>();
  rows.forEach((row) => {
    const entry = workstationMap.get(row.workstationId) ?? { productionLineId: row.productionLineId, workstationId: row.workstationId, workstationName: row.workstationName, total: 0, resolved: 0, pending: 0, unreviewed: 0 };
    entry.total += 1;
    if (row.reviewStatus === "approved" || row.reviewStatus === "rejected") entry.resolved += 1;
    if (row.reviewStatus === "pending") entry.pending += 1;
    if (row.reviewStatus === "unreviewed") entry.unreviewed += 1;
    workstationMap.set(row.workstationId, entry);
  });
  const workstationCoverage = Array.from(workstationMap.values()).map((entry) => ({ ...entry, completionRate: entry.total > 0 ? (entry.resolved / entry.total) * 100 : 0 })).sort((a, b) => a.completionRate - b.completionRate || b.total - a.total);
  return {
    total,
    totalDuration,
    reviewedCount: statusMap.pending + resolvedCount,
    resolvedCount,
    pendingCount: statusMap.pending,
    unreviewedCount: statusMap.unreviewed,
    approvedCount: statusMap.approved,
    rejectedCount: statusMap.rejected,
    completionRate: total > 0 ? (resolvedCount / total) * 100 : 0,
    reviewCoverageRate: total > 0 ? ((statusMap.pending + resolvedCount) / total) * 100 : 0,
    approvalRate: decisionCount > 0 ? (statusMap.approved / decisionCount) * 100 : 0,
    statusCounts,
    classification,
    workstationCoverage,
  };
}
