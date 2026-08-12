export interface GovernanceEventInput {
  status: "approved" | "needs_clarification";
  approvalReason: string | null;
  completenessScore: number;
  dataGaps: unknown;
  createdAt: Date | string;
}

export function summarizeAIConsensusGovernanceEvents(events: GovernanceEventInput[]) {
  const unresolved = events.filter((event) => event.status === "needs_clarification");
  const reasonCounts = new Map<string, number>();
  const gapCounts = new Map<string, number>();
  const monthly = new Map<string, { total: number; unresolved: number; scoreTotal: number }>();
  for (const event of events) {
    if (event.status === "needs_clarification") {
      const reason = event.approvalReason || "未指定原因";
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
    const gaps = Array.isArray(event.dataGaps) ? event.dataGaps as Array<{ title?: string }> : [];
    for (const gap of gaps) {
      const title = gap.title || "未命名資料缺口";
      gapCounts.set(title, (gapCounts.get(title) ?? 0) + 1);
    }
    const month = new Date(event.createdAt).toISOString().slice(0, 7);
    const aggregate = monthly.get(month) ?? { total: 0, unresolved: 0, scoreTotal: 0 };
    aggregate.total += 1;
    aggregate.unresolved += event.status === "needs_clarification" ? 1 : 0;
    aggregate.scoreTotal += event.completenessScore;
    monthly.set(month, aggregate);
  }
  const total = events.length;
  return {
    total,
    unresolvedCount: unresolved.length,
    unresolvedRate: total > 0 ? (unresolved.length / total) * 100 : 0,
    averageCompleteness: total > 0 ? events.reduce((sum, event) => sum + event.completenessScore, 0) / total : 0,
    commonReasons: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    commonDataGaps: Array.from(gapCounts.entries()).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count),
    monthlyTrend: Array.from(monthly.entries()).map(([month, aggregate]) => ({ month, total: aggregate.total, unresolved: aggregate.unresolved, unresolvedRate: aggregate.total > 0 ? (aggregate.unresolved / aggregate.total) * 100 : 0, averageCompleteness: aggregate.total > 0 ? aggregate.scoreTotal / aggregate.total : 0 })).sort((a, b) => a.month.localeCompare(b.month)),
  };
}
