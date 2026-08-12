export interface HomeDecisionInput {
  lowBalanceLines: Array<{ id: number; name: string; balanceRate: number }>;
  unresolvedReviews: number;
  openCompletionTasks: number;
  linesWithoutSnapshot: number;
}

export interface HomeDecisionItem {
  key: "governance" | "completion" | "capacity" | "snapshot";
  priority: "critical" | "high" | "normal";
  title: string;
  detail: string;
}

export function buildHomeDecisionQueue(input: HomeDecisionInput): HomeDecisionItem[] {
  const items: HomeDecisionItem[] = [];
  if (input.unresolvedReviews > 0) items.push({ key: "governance", priority: "critical", title: `${input.unresolvedReviews} 筆五角色審查待裁決`, detail: "請確認分歧、資料缺口或人工裁決，避免未核准建議被誤用。" });
  if (input.openCompletionTasks > 0) items.push({ key: "completion", priority: "high", title: `${input.openCompletionTasks} 項補件任務待處理`, detail: "高頻資料缺口已轉為可指派任務，補齊後可提升 AI 分析可信度。" });
  const worst = [...input.lowBalanceLines].sort((a, b) => a.balanceRate - b.balanceRate)[0];
  if (worst) items.push({ key: "capacity", priority: worst.balanceRate < 70 ? "critical" : "high", title: `${worst.name} 平衡率 ${worst.balanceRate.toFixed(1)}%`, detail: "請先檢視瓶頸工站、週期時間與人力配置。" });
  if (input.linesWithoutSnapshot > 0) items.push({ key: "snapshot", priority: "normal", title: `${input.linesWithoutSnapshot} 條產線尚無最新快照`, detail: "建立快照後才能進行跨產線比較與趨勢追蹤。" });
  const rank = { critical: 0, high: 1, normal: 2 } as const;
  return items.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
