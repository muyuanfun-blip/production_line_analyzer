import { describe, expect, it } from "vitest";
import { summarizeVsmImprovementActions } from "../shared/vsmImprovementActions";

describe("VSM 改善行動閉環摘要", () => {
  const now = new Date("2026-08-12T00:00:00Z");

  it("統計待開始、進行中、已完成與逾期行動", () => {
    expect(summarizeVsmImprovementActions([
      { status: "open", dueDate: "2026-08-11T00:00:00Z" },
      { status: "in_progress", dueDate: "2026-08-13T00:00:00Z" },
      { status: "completed", dueDate: "2026-08-10T00:00:00Z" },
      { status: "cancelled", dueDate: "2026-08-01T00:00:00Z" },
    ], now)).toEqual({ total: 4, activeCount: 2, completedCount: 1, overdueCount: 1, closureRate: 25 });
  });

  it("沒有改善行動時，完成率與逾期數為零", () => {
    expect(summarizeVsmImprovementActions([], now)).toEqual({ total: 0, activeCount: 0, completedCount: 0, overdueCount: 0, closureRate: 0 });
  });
});
