import { describe, expect, it } from "vitest";
import { calculateTimeStudy, canPublishTimeStudy } from "../shared/timeStudy";

describe("數位工時研究與標準工時計算", () => {
  it("以有效觀測、評比係數與寬放率計算觀測平均、正常工時及標準工時", () => {
    const result = calculateTimeStudy([
      { observedCycleTime: 10, performanceRating: 1.1 },
      { observedCycleTime: 12 },
      { observedCycleTime: 50, isIncluded: false },
    ], 1, 15);

    expect(result).toEqual({
      sampleCount: 2,
      observedAverageTime: 11,
      normalTime: 11.5,
      standardTime: 13.23,
    });
  });

  it("沒有有效觀測時不產生標準工時，且發布至少需三筆有效樣本", () => {
    expect(calculateTimeStudy([{ observedCycleTime: 0 }], 1, 15)).toEqual({
      sampleCount: 0,
      observedAverageTime: null,
      normalTime: null,
      standardTime: null,
    });
    expect(canPublishTimeStudy({ sampleCount: 2, observedAverageTime: 10, normalTime: 10, standardTime: 11.5 })).toBe(false);
    expect(canPublishTimeStudy({ sampleCount: 3, observedAverageTime: 10, normalTime: 10, standardTime: 11.5 })).toBe(true);
  });
});
