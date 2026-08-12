import { describe, expect, it } from "vitest";
import { rankCycleTimeDifferences } from "../shared/snapshotComparison";

describe("rankCycleTimeDifferences", () => {
  it("依週期時間絕對變化由大到小取前三個工站", () => {
    const result = rankCycleTimeDifferences([
      { name: "工站 A", delta: 1.5 },
      { name: "工站 B", delta: -7.25 },
      { name: "工站 C", delta: 4.0 },
      { name: "工站 D", delta: -2.5 },
    ]);

    expect(result.map((station) => station.name)).toEqual(["工站 B", "工站 C", "工站 D"]);
    expect(result.map((station) => station.absoluteCycleTimeDelta)).toEqual([7.25, 4, 2.5]);
  });

  it("保留原始資料並支援自訂顯示數量", () => {
    const source = [
      { name: "工站 A", delta: 2 },
      { name: "工站 B", delta: -5 },
    ];

    const result = rankCycleTimeDifferences(source, 1);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ name: "工站 B", absoluteCycleTimeDelta: 5 });
    expect(source).toEqual([
      { name: "工站 A", delta: 2 },
      { name: "工站 B", delta: -5 },
    ]);
  });
});
