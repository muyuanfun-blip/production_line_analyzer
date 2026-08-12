import { describe, expect, it } from "vitest";
import { calculateReportCompleteness } from "../shared/reportCompleteness";

describe("AI 報告資訊完整度", () => {
  it("以資料覆蓋與對齊情況計分，而不將分數誤稱為改善成效", () => {
    const result = calculateReportCompleteness({ targetCycleTime: 20, workstations: [{ id: 1, name: "組裝", cycleTime: 20, manpower: 1 }], actionSteps: [{ workstationId: 1, duration: 20 }] });
    expect(result).toMatchObject({ score: 100, level: "high", label: "資訊完整" });
    expect(result.components.find((component) => component.key === "ct_alignment")?.score).toBe(20);
  });

  it("缺少節拍、動作拆解與人力時降低完整度並揭露缺口", () => {
    const result = calculateReportCompleteness({ targetCycleTime: null, workstations: [{ id: 1, name: "組裝", cycleTime: 20, manpower: 0 }], actionSteps: [] });
    expect(result.score).toBe(20);
    expect(result).toMatchObject({ level: "insufficient", label: "資訊不足" });
  });
});
