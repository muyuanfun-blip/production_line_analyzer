import { describe, expect, it } from "vitest";
import { buildSimulationRunPlan, normalizeSimulationWorkstations } from "../shared/simulationRun";

describe("simulation run planning", () => {
  it("兼容平面圖格式並依序整理可執行工站", () => {
    const workstations = normalizeSimulationWorkstations({
      workstations: [
        { id: 2, name: "測試", operatorTime: 20, machineTime: 35, sequenceOrder: 1 },
        { id: 1, name: "組裝", cycleTime: 30, sequenceOrder: 0 },
        { id: 3, name: "無效站", cycleTime: 0, sequenceOrder: 2 },
      ],
    });

    expect(workstations).toEqual([
      { id: 1, name: "組裝", cycleTime: 30, sequenceOrder: 0, description: undefined },
      { id: 2, name: "測試", cycleTime: 35, sequenceOrder: 1, description: undefined },
    ]);
  });

  it("依瓶頸時間投入產品並建立各工站完成時間", () => {
    const startedAt = new Date("2026-08-12T00:00:00.000Z");
    const plan = buildSimulationRunPlan({
      scenarioId: 10,
      scenarioName: "雙站改善情境",
      quantity: 2,
      startedAt,
      workstations: [
        { id: 1, name: "組裝", cycleTime: 30, sequenceOrder: 0 },
        { id: 2, name: "測試", cycleTime: 45, sequenceOrder: 1 },
      ],
    });

    expect(plan).toHaveLength(2);
    expect(plan[0].totalLeadTime).toBe(75);
    expect(plan[0].flowRecords).toHaveLength(2);
    expect(plan[0].flowRecords[0].entryTime).toEqual(startedAt);
    expect(plan[0].flowRecords[1].entryTime.getTime()).toBe(startedAt.getTime() + 30_000);
    expect(plan[1].startTime.getTime()).toBe(startedAt.getTime() + 45_000);
    expect(plan[0].serialNumber).toMatch(/^SIM-10-[A-Z0-9]+-001$/);
    expect(plan[1].serialNumber).toMatch(/^SIM-10-[A-Z0-9]+-002$/);
  });
});
