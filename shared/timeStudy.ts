export type TimeStudyObservationInput = {
  observedCycleTime: number;
  performanceRating?: number | null;
  isIncluded?: boolean | number | null;
};

export type TimeStudyCalculation = {
  sampleCount: number;
  observedAverageTime: number | null;
  normalTime: number | null;
  standardTime: number | null;
};

function roundSeconds(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * 標準工時公式：正常工時 = 有效觀測時間 × 評比係數；
 * 標準工時 = 正常工時 ×（1 + 寬放率）。
 * 每筆觀測可覆寫研究預設評比係數，排除樣本不會納入計算。
 */
export function calculateTimeStudy(
  observations: TimeStudyObservationInput[],
  defaultPerformanceRating: number,
  allowancePercent: number,
): TimeStudyCalculation {
  const included = observations.filter((item) => {
    const isIncluded = item.isIncluded === undefined || item.isIncluded === null || item.isIncluded === true || item.isIncluded === 1;
    return isIncluded && Number.isFinite(item.observedCycleTime) && item.observedCycleTime > 0;
  });

  if (included.length === 0) {
    return { sampleCount: 0, observedAverageTime: null, normalTime: null, standardTime: null };
  }

  const observedAverageTime = included.reduce((sum, item) => sum + item.observedCycleTime, 0) / included.length;
  const normalTime = included.reduce((sum, item) => {
    const rating = item.performanceRating ?? defaultPerformanceRating;
    return sum + item.observedCycleTime * rating;
  }, 0) / included.length;
  const standardTime = normalTime * (1 + allowancePercent / 100);

  return {
    sampleCount: included.length,
    observedAverageTime: roundSeconds(observedAverageTime),
    normalTime: roundSeconds(normalTime),
    standardTime: roundSeconds(standardTime),
  };
}

export function canPublishTimeStudy(calculation: TimeStudyCalculation, minimumSamples = 3) {
  return calculation.sampleCount >= minimumSamples && calculation.standardTime !== null;
}
