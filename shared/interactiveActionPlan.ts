import type { ConsensusResult } from "./aiConsensus";

export interface InteractiveActionDraft {
  title: string;
  description: string;
  ownerName: string;
  validationMetric: string;
  targetHorizon: string;
  sourceQuestion: string;
}

export function deriveInteractiveActionDraft(question: string, answer: string, consensus: ConsensusResult): InteractiveActionDraft {
  const primaryAction = consensus.actions[0];
  const title = question.trim().replace(/[？?。！!]+$/g, "").slice(0, 120) || primaryAction?.title || "AI 互動分析改善行動";
  return {
    title,
    description: `【互動分析來源問題】\n${question.trim()}\n\n【AI 互動分析建議】\n${answer.trim()}\n\n【既有五角色共識對照】\n${primaryAction ? `${primaryAction.priority}｜${primaryAction.title}\n改善理由：${primaryAction.rationale}` : "無既有優先行動"}`,
    ownerName: primaryAction?.ownerRole || "待指派",
    validationMetric: primaryAction?.validationMetric || "待確認驗證指標",
    targetHorizon: primaryAction?.targetHorizon || "待排定時程",
    sourceQuestion: question.trim(),
  };
}
