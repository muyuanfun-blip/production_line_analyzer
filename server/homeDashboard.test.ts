import { describe, expect, it } from "vitest";
import { buildHomeDecisionQueue } from "../shared/homeDashboard";

describe("首頁決策優先順序", () => {
  it("將未裁決治理事項、補件任務與低平衡率產線按業務風險排序", () => {
    const items = buildHomeDecisionQueue({
      unresolvedReviews: 2,
      openCompletionTasks: 3,
      lowBalanceLines: [{ id: 1, name: "A 線", balanceRate: 65 }, { id: 2, name: "B 線", balanceRate: 76 }],
      linesWithoutSnapshot: 1,
    });
    expect(items.map((item) => item.key)).toEqual(["governance", "capacity", "completion", "snapshot"]);
    expect(items[1]).toMatchObject({ priority: "critical", title: "A 線 平衡率 65.0%" });
  });

  it("沒有待處理資料時回傳空白行動清單", () => {
    expect(buildHomeDecisionQueue({ unresolvedReviews: 0, openCompletionTasks: 0, lowBalanceLines: [], linesWithoutSnapshot: 0 })).toEqual([]);
  });
});
