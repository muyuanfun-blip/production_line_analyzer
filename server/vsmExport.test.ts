import { describe, expect, it } from "vitest";
import { buildVSMReportData } from "../client/src/lib/vsmExport";

describe("VSM PDF report data", () => {
  it("彙整 KPI 並正確識別最高週期時間的瓶頸工序", () => {
    const report = buildVSMReportData(
      { name: "組裝線", description: "改善前" },
      [
        { id: 1, name: "組裝", type: "process", cycleTime: 20, manpower: 1, valueAddedRate: 80, positionX: 0, positionY: 0, width: 1, height: 1 },
        { id: 2, name: "測試", type: "process", cycleTime: 40, manpower: 1.5, valueAddedRate: 60, positionX: 0, positionY: 0, width: 1, height: 1 },
      ],
      [{ id: 1, fromProcessId: 1, toProcessId: 2, flowType: "material", cycleTime: 8, quantity: 1 }],
    );
    expect(report).toMatchObject({ totalCT: 60, totalManpower: 2.5, averageValueAddedRate: 70, leadTime: 8, bottleneckName: "測試", processCount: 2, flowCount: 1 });
  });
});
