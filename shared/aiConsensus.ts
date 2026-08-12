export const AI_REVIEW_ROLES = [
  { id: "lean_ie", name: "精實與工業工程審查", focus: "工序平衡、浪費消除、標準作業與人力配置" },
  { id: "operations", name: "製造營運審查", focus: "可執行性、產能、排程、現場導入與責任分工" },
  { id: "quality", name: "品質與可靠度審查", focus: "品質風險、失效預防、檢驗點與驗證條件" },
  { id: "process_equipment", name: "製程與設備審查", focus: "設備能力、治具、自動化、製程參數與維護風險" },
  { id: "risk_governance", name: "風險與治理審查", focus: "安全、變更風險、投資合理性、資料限制與治理條件" },
] as const;

export type AIReviewRoleId = typeof AI_REVIEW_ROLES[number]["id"];
export type ReviewConfidence = "high" | "medium" | "low";

export interface RoleReview {
  roleId: AIReviewRoleId;
  roleName: string;
  findings: string[];
  recommendations: string[];
  risks: string[];
  confidence: ReviewConfidence;
}

export interface ConsensusAction {
  priority: "P1" | "P2" | "P3";
  title: string;
  rationale: string;
  ownerRole: string;
  validationMetric: string;
  targetHorizon: string;
}

export interface ConsensusResult {
  consensusAchieved: boolean;
  agreementScore: number;
  managementSummary: string;
  agreedFindings: string[];
  actions: ConsensusAction[];
  risksAndValidation: string[];
  unresolvedItems: string[];
}

export interface ConsensusDecision {
  approved: boolean;
  reason?: string;
}

export function evaluateConsensus(result: ConsensusResult, reviewCount: number): ConsensusDecision {
  if (reviewCount !== AI_REVIEW_ROLES.length) return { approved: false, reason: "五個審查角色未全部完成審查" };
  if (!result.consensusAchieved) return { approved: false, reason: "五角色審查尚未達成共識" };
  if (!Number.isFinite(result.agreementScore) || result.agreementScore < 80) return { approved: false, reason: "共識分數未達 80 分門檻" };
  if (!result.managementSummary.trim() || result.actions.length === 0) return { approved: false, reason: "共識結論或優先改善行動不完整" };
  return { approved: true };
}

export interface StructuredConsensusReportInput {
  productionLineName: string;
  dataScope: string[];
  reviews: RoleReview[];
  consensus: ConsensusResult;
}

export function buildStructuredConsensusReport(input: StructuredConsensusReportInput): string {
  const roleSections = input.reviews.map((review) => {
    const findings = review.findings.map((item) => `- ${item}`).join("\n") || "- 未提出具體發現";
    const recommendations = review.recommendations.map((item) => `- ${item}`).join("\n") || "- 無額外建議";
    const risks = review.risks.map((item) => `- ${item}`).join("\n") || "- 無新增風險";
    return `### ${review.roleName}\n**審查信心：** ${review.confidence}\n\n**重點發現**\n${findings}\n\n**建議重點**\n${recommendations}\n\n**風險提醒**\n${risks}`;
  }).join("\n\n");
  const actions = input.consensus.actions.map((action) => `### ${action.priority}｜${action.title}\n- **改善理由：** ${action.rationale}\n- **責任角色：** ${action.ownerRole}\n- **驗證指標：** ${action.validationMetric}\n- **目標時程：** ${action.targetHorizon}`).join("\n\n");
  const findings = input.consensus.agreedFindings.map((item) => `- ${item}`).join("\n") || "- 未形成共同發現";
  const risks = input.consensus.risksAndValidation.map((item) => `- ${item}`).join("\n") || "- 依既有作業規範執行風險與成效驗證";
  const unresolved = input.consensus.unresolvedItems.length > 0 ? input.consensus.unresolvedItems.map((item) => `- ${item}`).join("\n") : "- 無未決歧見；五角色已形成共識。";
  return `# ${input.productionLineName}｜五角色 AI 共識改善報告

## 1. 管理摘要
${input.consensus.managementSummary}

## 2. 資料範圍與分析依據
${input.dataScope.map((item) => `- ${item}`).join("\n")}

## 3. 五角色審查共識
**共識狀態：** 已達成共識（${input.consensus.agreementScore.toFixed(0)} / 100）

**共同發現**
${findings}

## 4. 角色審查重點
${roleSections}

## 5. 優先改善行動
${actions}

## 6. 風險與驗證計畫
${risks}

## 7. 未決事項與治理條件
${unresolved}

## 8. 共識結論
本報告所列行動已通過五角色共識審查。執行前仍應由現場管理、工程與品質單位依實際設備能力、作業安全與產品規格完成核准。`;
}

export function buildConsensusClarificationSummary(input: StructuredConsensusReportInput, reason: string): string {
  const unresolved = input.consensus.unresolvedItems.length > 0
    ? input.consensus.unresolvedItems.map((item) => `- ${item}`).join("\n")
    : "- 請由現場人員確認五角色提出的資料限制與改善前提。";
  const gaps = input.dataScope.filter((item) => item.includes("資料") || item.includes("節拍"));
  return `# 五角色審查結果：尚待補充資料或釐清分歧

## 1. 正式報告狀態
**尚未核准。** 原因：${reason}。本次結果僅供補充資料與現場釐清使用，不能視為正式改善方案或建立改善行動的依據。

## 2. 五角色已觀察到的重點
${input.reviews.map((review) => `### ${review.roleName}\n${review.findings.map((item) => `- ${item}`).join("\n") || "- 無具體發現"}`).join("\n\n")}

## 3. 建議補充或確認的資料
${gaps.map((item) => `- ${item}`).join("\n") || "- 請確認各角色的風險提示、設備條件與品質資料。"}

## 4. 未決事項
${unresolved}

## 5. 下一步
請補充資料缺口並重新執行五角色審查；只有全部角色完成、共識分數達門檻且行動可驗證時，系統才會開放正式報告、互動追問與改善行動建立。`;
}

/**
 * 未達共識時仍可依當前資料彙整條件式改善建議，但不得標示為核准方案或直接建立改善行動。
 */
export function buildConditionalSuggestionReport(input: StructuredConsensusReportInput, reason: string): string {
  const roleSections = input.reviews.map((review) => {
    const findings = review.findings.map((item) => `- ${item}`).join("\n") || "- 無具體發現";
    const recommendations = review.recommendations.map((item) => `- ${item}`).join("\n") || "- 需待補充資料後提出建議";
    const risks = review.risks.map((item) => `- ${item}`).join("\n") || "- 請由現場確認作業與品質條件";
    return `### ${review.roleName}\n**審查信心：** ${review.confidence}\n\n**目前觀察**\n${findings}\n\n**待驗證建議**\n${recommendations}\n\n**限制與風險**\n${risks}`;
  }).join("\n\n");
  const conditionalActions = input.consensus.actions.map((action) => `### ${action.priority}｜${action.title}（待驗證）\n- **建議理由：** ${action.rationale}\n- **建議責任角色：** ${action.ownerRole}\n- **必要驗證指標：** ${action.validationMetric}\n- **建議時程：** ${action.targetHorizon}`).join("\n\n") || "- 目前未形成可安全執行的行動；請先完成下列資料補充與現場確認。";
  const unresolved = input.consensus.unresolvedItems.length > 0 ? input.consensus.unresolvedItems.map((item) => `- ${item}`).join("\n") : "- 請確認各角色的資料限制、品質與設備前提。";
  return `# ${input.productionLineName}｜五角色 AI 待驗證改善建議報告

## 1. 文件狀態與使用限制
**待驗證／非正式核准。** 五角色尚未形成正式共識，原因：${reason}。本報告僅依現有資料提供改善假設與驗證方向，不得視為已核准方案、效益承諾或直接建立改善行動的依據。

## 2. 目前資料範圍
${input.dataScope.map((item) => `- ${item}`).join("\n")}

## 3. 現階段管理摘要
${input.consensus.managementSummary || "目前資料不足以形成完整管理結論；請依後續資料缺口與角色分歧完成確認。"}

## 4. 五角色觀察與待驗證建議
${roleSections}

## 5. 優先改善假設
${conditionalActions}

## 6. 未共識原因、分歧與資料缺口
${unresolved}

## 7. 必要驗證與重新審查條件
- 補齊所有標示的資料缺口，並由建議提供者確認來源、量測期間與版本。
- 對每項待驗證建議先進行小規模試行，量測 CT、產出、良率、安全與資源影響。
- 完成現場確認後重新執行五角色審查；只有達成共識或完成管理員人工裁決，才能轉為正式核准報告與改善閉環。`;
}
