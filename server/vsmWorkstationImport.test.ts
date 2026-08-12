import { describe, expect, it } from "vitest";
import { buildVsmWorkstationImportPlan } from "../shared/vsmWorkstationImport";

describe("VSM workstation import plan", () => {
  it("依工站順序水平配置工序，並建立相鄰工序連線", () => {
    const plan = buildVsmWorkstationImportPlan([
      { id: 8, name: "測試", sequenceOrder: 2, cycleTime: "40", manpower: "1" },
      { id: 3, name: "組裝", sequenceOrder: 1, cycleTime: "30", manpower: "1.5" },
    ]);
    expect(plan.processes.map((process) => process.name)).toEqual(["組裝", "測試"]);
    expect(plan.processes.map((process) => process.positionX)).toEqual([100, 290]);
    expect(plan.links).toEqual([{ fromWorkstationId: 3, toWorkstationId: 8 }]);
  });
});
