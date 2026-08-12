import { describe, expect, it } from "vitest";
import { nextTaskStatusForManualDecision, shouldCreateHighFrequencyCompletionTask } from "../shared/governanceCompletionTasks";

describe("治理補件任務規則", () => {
  it("僅在缺口達門檻且沒有未結任務時建立補件任務", () => {
    expect(shouldCreateHighFrequencyCompletionTask({ frequencyCount: 3, threshold: 3, hasActiveTask: false })).toBe(true);
    expect(shouldCreateHighFrequencyCompletionTask({ frequencyCount: 2, threshold: 3, hasActiveTask: false })).toBe(false);
    expect(shouldCreateHighFrequencyCompletionTask({ frequencyCount: 5, threshold: 3, hasActiveTask: true })).toBe(false);
  });

  it("人工裁決退回補件時保留待處理狀態，其餘裁決保留原決策", () => {
    expect(nextTaskStatusForManualDecision("returned")).toBe("pending");
    expect(nextTaskStatusForManualDecision("approved")).toBe("approved");
    expect(nextTaskStatusForManualDecision("closed")).toBe("closed");
  });
});
