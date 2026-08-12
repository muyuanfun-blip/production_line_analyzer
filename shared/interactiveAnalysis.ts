import type { ConsensusResult, RoleReview } from "./aiConsensus";

export const INTERACTIVE_QUICK_QUESTIONS = [
  "哪一個工站應優先改善？請說明依據與驗證指標。",
  "請將 P1 改善行動拆成現場可執行的三個步驟。",
  "目前建議有哪些品質、設備或資料不足風險？",
  "若瓶頸工站 CT 降低 10%，應優先驗證哪些 KPI？",
] as const;

export interface InteractiveAnalysisContextInput {
  productionLineName: string;
  dataScope: string[];
  consensus: ConsensusResult;
  reviews: RoleReview[];
  workstationSummary: string[];
}

export function validateInteractiveQuestion(question: string): string | null {
  const normalized = question.trim();
  if (normalized.length < 2) return "請輸入至少 2 個字的問題。";
  if (normalized.length > 800) return "單次問題請勿超過 800 個字。";
  return null;
}

export function buildInteractiveAnalysisContext(input: InteractiveAnalysisContextInput): string {
  const roles = input.reviews.map((review) => `${review.roleName}：${review.findings.slice(0, 2).join("；") || "無摘要"}`).join("\n");
  const actions = input.consensus.actions.map((action) => `${action.priority}｜${action.title}｜責任：${action.ownerRole}｜驗證：${action.validationMetric}`).join("\n");
  return [
    `產線：${input.productionLineName}`,
    "資料範圍：", ...input.dataScope.map((item) => `- ${item}`),
    `五角色共識：已達成，分數 ${input.consensus.agreementScore.toFixed(0)} / 100`,
    `管理摘要：${input.consensus.managementSummary}`,
    "已核准改善行動：", actions || "- 無",
    "角色審查重點：", roles || "- 無",
    "工站摘要：", ...input.workstationSummary.map((item) => `- ${item}`),
  ].join("\n");
}
