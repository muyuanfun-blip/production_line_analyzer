import { describe, expect, it } from "vitest";
import { resolveActionTypeForReview } from "../shared/actionReview";

describe("action review resolution", () => {
  it("接受建議時將動作分類改為建議分類", () => {
    expect(resolveActionTypeForReview({
      currentActionType: "value_added",
      suggestedActionType: "non_value_added",
      decision: "approved",
    })).toBe("non_value_added");
  });

  it("駁回建議時保留目前分類", () => {
    expect(resolveActionTypeForReview({
      currentActionType: "value_added",
      suggestedActionType: "necessary_waste",
      decision: "rejected",
    })).toBe("value_added");
  });

  it("接受沒有建議分類的覆核時仍保留目前分類", () => {
    expect(resolveActionTypeForReview({
      currentActionType: "necessary_waste",
      suggestedActionType: null,
      decision: "approved",
    })).toBe("necessary_waste");
  });
});
