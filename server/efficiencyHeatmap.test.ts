import { describe, expect, it } from "vitest";
import { buildEfficiencyHeatmap } from "../shared/efficiencyHeatmap";

describe("buildEfficiencyHeatmap", () => {
  it("依工站與整點時段分桶，使用標準 CT 計算效率", () => {
    const result = buildEfficiencyHeatmap({
      workstations: [{ id: 1, name: "組裝", standardCycleTime: 30 }],
      records: [
        { workstationId: 1, workstationName: "組裝", actualCycleTime: 30, entryTime: "2026-08-12T08:10:00.000Z" },
        { workstationId: 1, workstationName: "組裝", actualCycleTime: 20, entryTime: "2026-08-12T08:40:00.000Z" },
        { workstationId: 1, workstationName: "組裝", actualCycleTime: 40, entryTime: "2026-08-12T09:15:00.000Z" },
      ],
      from: new Date("2026-08-12T08:00:00.000Z"),
      to: new Date("2026-08-12T09:59:59.000Z"),
      bucketMinutes: 60,
    });

    expect(result.bucketStarts).toHaveLength(2);
    expect(result.cells).toHaveLength(2);
    expect(result.cells[0]).toMatchObject({ sampleCount: 2, avgActualCycleTime: 25, standardCycleTime: 30, efficiency: 120, status: "ahead" });
    expect(result.cells[1]).toMatchObject({ sampleCount: 1, avgActualCycleTime: 40, standardCycleTime: 30, efficiency: 75, status: "loss" });
  });

  it("為模擬新增且沒有現行標準 CT 的工站，以區間平均實績作為比較基準", () => {
    const result = buildEfficiencyHeatmap({
      workstations: [],
      records: [
        { workstationId: -1, workstationName: "模擬測試站", actualCycleTime: 20, entryTime: "2026-08-12T08:00:00.000Z" },
        { workstationId: -1, workstationName: "模擬測試站", actualCycleTime: 30, entryTime: "2026-08-12T09:00:00.000Z" },
      ],
      from: new Date("2026-08-12T08:00:00.000Z"),
      to: new Date("2026-08-12T09:00:00.000Z"),
      bucketMinutes: 60,
    });

    expect(result.workstations[0]).toMatchObject({ id: -1, name: "模擬測試站" });
    expect(result.cells[0].standardCycleTime).toBe(25);
    expect(result.cells[0].efficiency).toBe(125);
    expect(result.cells[1].efficiency).toBeCloseTo(83.333, 2);
  });
});
