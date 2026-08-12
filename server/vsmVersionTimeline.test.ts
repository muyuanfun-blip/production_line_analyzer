import { describe, expect, it } from "vitest";
import { buildVsmComparisonPair, sortVsmVersionsForTimeline } from "../shared/vsmVersionTimeline";

const versions = [
  { id: 3, name: "v3", createdAt: new Date("2026-08-03T08:00:00Z") },
  { id: 1, name: "v1", createdAt: new Date("2026-08-01T08:00:00Z") },
  { id: 2, name: "v2", createdAt: new Date("2026-08-02T08:00:00Z") },
];

describe("VSM version timeline", () => {
  it("依建立時間由舊到新排序版本", () => {
    expect(sortVsmVersionsForTimeline(versions).map((version) => version.id)).toEqual([1, 2, 3]);
  });

  it("將任意兩個版本配對為由舊到新的比較順序", () => {
    expect(buildVsmComparisonPair(versions, 3, 1)).toEqual([1, 3]);
    expect(buildVsmComparisonPair(versions, 2, 2)).toBeNull();
  });
});
