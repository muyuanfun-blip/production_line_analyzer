export const reviewableActionTypes = [
  "value_added",
  "non_value_added",
  "necessary_waste",
] as const;

export type ReviewableActionType = (typeof reviewableActionTypes)[number];
export type ActionReviewDecision = "approved" | "rejected";

/**
 * 接受建議時才採用建議分類；駁回或未提供建議時，一律保留目前分類。
 * 此函式是資料庫批次覆核寫入的唯一分類決策規則。
 */
export function resolveActionTypeForReview(input: {
  currentActionType: ReviewableActionType;
  suggestedActionType: ReviewableActionType | null;
  decision: ActionReviewDecision;
}): ReviewableActionType {
  if (input.decision === "approved" && input.suggestedActionType) {
    return input.suggestedActionType;
  }
  return input.currentActionType;
}
