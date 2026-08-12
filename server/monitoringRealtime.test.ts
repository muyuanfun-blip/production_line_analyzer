import { describe, expect, it } from "vitest";
import { getChangedWorkstationIds, summarizeProductFlows } from "../shared/monitoringRealtime";

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
});
