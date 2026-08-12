import { describe, expect, it } from "vitest";
import { summarizeAIConsensusGovernanceEvents } from "../shared/aiGovernance";

describe("五角色審查治理統計", () => {
  it("統計未共識率、最常見原因、資料缺口與每月完整度趨勢", () => {
    const stats = summarizeAIConsensusGovernanceEvents([
      { status: "needs_clarification", approvalReason: "共識分數未達 80 分門檻", completenessScore: 45, dataGaps: [{ title: "缺少目標節拍" }], createdAt: "2026-08-01T00:00:00.000Z" },
      { status: "needs_clarification", approvalReason: "共識分數未達 80 分門檻", completenessScore: 55, dataGaps: [{ title: "缺少目標節拍" }, { title: "缺少動作拆解" }], createdAt: "2026-08-02T00:00:00.000Z" },
      { status: "approved", approvalReason: null, completenessScore: 90, dataGaps: [], createdAt: "2026-09-01T00:00:00.000Z" },
    ]);
    expect(stats).toMatchObject({ total: 3, unresolvedCount: 2, unresolvedRate: 66.66666666666666, averageCompleteness: 190 / 3 });
    expect(stats.commonReasons[0]).toEqual({ reason: "共識分數未達 80 分門檻", count: 2 });
    expect(stats.commonDataGaps[0]).toEqual({ title: "缺少目標節拍", count: 2 });
    expect(stats.monthlyTrend).toHaveLength(2);
  });
});
