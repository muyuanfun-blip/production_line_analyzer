import { describe, expect, it } from "vitest";
import { buildActionCockpitSummary, getChangedWorkstationIds, summarizeProductFlows } from "../shared/monitoringRealtime";

describe("monitoring realtime helpers", () => {
  it("僅標示狀態實際改變的既有工站，首次快照不觸發動畫", () => {
    expect(getChangedWorkstationIds(new Map(), [{ id: 1, status: "normal" }])).toEqual([]);
    const previous = new Map<number, "normal" | "warning" | "critical" | "offline" | "idle">([[1, "normal"], [2, "warning"]]);
    expect(getChangedWorkstationIds(previous, [{ id: 1, status: "critical" }, { id: 2, status: "warning" }])).toEqual([1]);
  });

  it("正確彙整產品流程的完成、加工與卡料數量", () => {
    expect(summarizeProductFlows([
      { status: "completed" },
      { status: "waiting" },
      { status: "in_progress" },
      { status: "completed" },
    ])).toEqual({ completed: 2, in_progress: 1, waiting: 1 });
  });

  it("為瓶頸處置駕駛艙提供等待量優先的行動摘要", () => {
    expect(buildActionCockpitSummary({ status: "warning", utilization: 87.5, waitingProducts: 3 })).toEqual({
      hasWaiting: true,
      severity: "warning",
      message: "目前有 3 件等待產品，建議優先確認物料與前後工站節拍。",
    });
  });
});
