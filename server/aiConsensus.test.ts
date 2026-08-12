import { describe, expect, it } from "vitest";
import { AI_REVIEW_ROLES, buildConsensusClarificationSummary, buildStructuredConsensusReport, evaluateConsensus, type ConsensusResult, type RoleReview } from "../shared/aiConsensus";

const reviews: RoleReview[] = AI_REVIEW_ROLES.map((role) => ({
  roleId: role.id,
  roleName: role.name,
  findings: ["瓶頸工站週期時間偏長"],
  recommendations: ["先驗證瓶頸工站標準作業"],
  risks: ["改善後須監控品質"],
  confidence: "high",
}));

const consensus: ConsensusResult = {
  consensusAchieved: true,
  agreementScore: 88,
  managementSummary: "優先處理瓶頸工站，並以品質與產能指標驗證成效。",
  agreedFindings: ["瓶頸限制產線產出"],
  actions: [{ priority: "P1", title: "縮短瓶頸 CT", rationale: "降低最長週期時間", ownerRole: "精實與工業工程審查", validationMetric: "瓶頸 CT", targetHorizon: "兩週" }],
  risksAndValidation: ["每日檢查品質不良率與瓶頸 CT"],
  unresolvedItems: [],
};

describe("五角色 AI 共識流程", () => {
  it("只有五角色皆完成、共識分數達門檻且行動完整時才核准出報告", () => {
    expect(evaluateConsensus(consensus, 5)).toEqual({ approved: true });
    expect(evaluateConsensus({ ...consensus, agreementScore: 79 }, 5)).toMatchObject({ approved: false, reason: "共識分數未達 80 分門檻" });
    expect(evaluateConsensus({ ...consensus, consensusAchieved: false }, 5)).toMatchObject({ approved: false, reason: "五角色審查尚未達成共識" });
    expect(evaluateConsensus(consensus, 4)).toMatchObject({ approved: false, reason: "五個審查角色未全部完成審查" });
  });

  it("以固定章節輸出五角色共識改善報告", () => {
    const report = buildStructuredConsensusReport({ productionLineName: "示範線", dataScope: ["2 個工站", "平衡率 75%"], reviews, consensus });
    expect(report).toContain("## 1. 管理摘要");
    expect(report).toContain("## 3. 五角色審查共識");
    expect(report).toContain("## 5. 優先改善行動");
    expect(report).toContain("## 8. 共識結論");
    expect(report).toContain("已達成共識（88 / 100）");
  });

  it("未達共識時輸出補充資料摘要，而非偽裝為正式核准報告", () => {
    const report = buildConsensusClarificationSummary({ productionLineName: "示範線", dataScope: ["資料就緒度：不足"], reviews, consensus: { ...consensus, consensusAchieved: false } }, "五角色審查尚未達成共識");
    expect(report).toContain("**尚未核准。**");
    expect(report).toContain("補充資料缺口並重新執行五角色審查");
  });
});
