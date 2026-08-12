import { describe, expect, it } from "vitest";
import { assessAnalysisDataReadiness, getReadinessLevel } from "../shared/analysisDataReadiness";

describe("AI 分析資料就緒度", () => {
  it("主動識別節拍、動作拆解、人力與 CT 對齊缺口", () => {
    const gaps = assessAnalysisDataReadiness({ targetCycleTime: null, workstations: [
      { name: "組裝", cycleTime: 20, manpower: 0 },
      { name: "測試", cycleTime: 10, manpower: 1, actionStatistics: { totalSteps: 2, totalDuration: 14 } },
    ] });
    expect(gaps.map((gap) => gap.key)).toEqual(expect.arrayContaining(["takt_time", "action_steps", "cycle_time_alignment", "manpower"]));
    expect(getReadinessLevel(gaps)).toBe("blocked");
  });

  it("完整且對齊的資料可進入可用分析狀態", () => {
    const gaps = assessAnalysisDataReadiness({ targetCycleTime: 18, workstations: [{ name: "組裝", cycleTime: 18, manpower: 1, actionStatistics: { totalSteps: 3, totalDuration: 18 } }] });
    expect(gaps).toEqual([]);
    expect(getReadinessLevel(gaps)).toBe("ready");
  });
});
