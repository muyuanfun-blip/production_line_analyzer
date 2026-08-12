import { describe, expect, it } from "vitest";
import { deriveInteractiveActionDraft } from "../shared/interactiveActionPlan";
import type { ConsensusResult } from "../shared/aiConsensus";

const consensus: ConsensusResult = {
  consensusAchieved: true, agreementScore: 90, managementSummary: "摘要", agreedFindings: [],
  actions: [{ priority: "P1", title: "縮短瓶頸 CT", rationale: "降低週期", ownerRole: "精實與工業工程審查", validationMetric: "瓶頸 CT", targetHorizon: "兩週" }],
  risksAndValidation: [], unresolvedItems: [],
};

describe("互動分析轉改善行動草稿", () => {
  it("保留追問來源與回覆，並帶入既有共識行動的責任與驗證設定", () => {
    const draft = deriveInteractiveActionDraft("瓶頸站要先驗證什麼？", "先量測換線等待時間。", consensus);
    expect(draft).toMatchObject({ title: "瓶頸站要先驗證什麼", ownerName: "精實與工業工程審查", validationMetric: "瓶頸 CT", targetHorizon: "兩週" });
    expect(draft.description).toContain("先量測換線等待時間。");
    expect(draft.description).toContain("縮短瓶頸 CT");
  });
});
