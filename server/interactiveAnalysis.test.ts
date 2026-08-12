import { describe, expect, it } from "vitest";
import { buildInteractiveAnalysisContext, validateInteractiveQuestion } from "../shared/interactiveAnalysis";
import type { ConsensusResult, RoleReview } from "../shared/aiConsensus";

const consensus: ConsensusResult = {
  consensusAchieved: true, agreementScore: 90, managementSummary: "先改善瓶頸站。", agreedFindings: ["瓶頸限制產出"],
  actions: [{ priority: "P1", title: "縮短瓶頸 CT", rationale: "降低週期", ownerRole: "精實與工業工程審查", validationMetric: "瓶頸 CT", targetHorizon: "兩週" }],
  risksAndValidation: [], unresolvedItems: [],
};
const reviews: RoleReview[] = [{ roleId: "lean_ie", roleName: "精實與工業工程審查", findings: ["組裝站最長", "等待偏高"], recommendations: [], risks: [], confidence: "high" }];

describe("互動分析脈絡", () => {
  it("限制空白或過長問題，保留可分析的使用者追問", () => {
    expect(validateInteractiveQuestion(" ")).toBe("請輸入至少 2 個字的問題。");
    expect(validateInteractiveQuestion("A".repeat(801))).toBe("單次問題請勿超過 800 個字。");
    expect(validateInteractiveQuestion("瓶頸工站應如何改善？")).toBeNull();
  });

  it("組裝產線資料、五角色共識與核准行動，避免互動分析脫離已審查脈絡", () => {
    const context = buildInteractiveAnalysisContext({ productionLineName: "示範線", dataScope: ["平衡率：75%"], consensus, reviews, workstationSummary: ["組裝：20 秒"] });
    expect(context).toContain("五角色共識：已達成，分數 90 / 100");
    expect(context).toContain("P1｜縮短瓶頸 CT");
    expect(context).toContain("組裝：20 秒");
  });
});
