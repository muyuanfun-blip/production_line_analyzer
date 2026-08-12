export type VsmImprovementActionStatus = "open" | "in_progress" | "completed" | "cancelled";

export interface VsmImprovementActionForSummary {
  status: VsmImprovementActionStatus;
  dueDate?: Date | string | null;
}

/** 匯總 VSM 改善行動的閉環進度；已取消事項不計入逾期。 */
export function summarizeVsmImprovementActions(
  actions: VsmImprovementActionForSummary[],
  now: Date = new Date(),
) {
  const active = actions.filter((action) => action.status === "open" || action.status === "in_progress");
  const completed = actions.filter((action) => action.status === "completed");
  const overdue = active.filter((action) => {
    if (!action.dueDate) return false;
    return new Date(action.dueDate).getTime() < now.getTime();
  });
  return {
    total: actions.length,
    activeCount: active.length,
    completedCount: completed.length,
    overdueCount: overdue.length,
    closureRate: actions.length === 0 ? 0 : (completed.length / actions.length) * 100,
  };
}
