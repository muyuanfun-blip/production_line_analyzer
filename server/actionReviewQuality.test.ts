import { describe, expect, it } from "vitest";
import { summarizeActionReviewQuality } from "../shared/actionReviewQuality";

describe("動作覆核品質摘要", () => {
  it("依覆核狀態與分類時間計算完成率、接受率和工站缺口", () => {
    const result = summarizeActionReviewQuality([
      { productionLineId: 1, workstationId: 1, workstationName: "組裝", duration: "10.0", actionType: "value_added", reviewStatus: "approved" },
      { productionLineId: 1, workstationId: 1, workstationName: "組裝", duration: "5.0", actionType: "non_value_added", reviewStatus: "rejected" },
      { productionLineId: 1, workstationId: 2, workstationName: "測試", duration: "15.0", actionType: "necessary_waste", reviewStatus: "pending" },
      { productionLineId: 1, workstationId: 2, workstationName: "測試", duration: "10.0", actionType: "non_value_added", reviewStatus: "unreviewed" },
    ]);
    expect(result.completionRate).toBe(50);
    expect(result.reviewCoverageRate).toBe(75);
    expect(result.approvalRate).toBe(50);
    expect(result.classification).toEqual([
      { type: "value_added", count: 1, duration: 10, durationShare: 25 },
      { type: "non_value_added", count: 2, duration: 15, durationShare: 37.5 },
      { type: "necessary_waste", count: 1, duration: 15, durationShare: 37.5 },
    ]);
    expect(result.workstationCoverage[0]).toMatchObject({ workstationId: 2, completionRate: 0, pending: 1, unreviewed: 1 });
  });
});
