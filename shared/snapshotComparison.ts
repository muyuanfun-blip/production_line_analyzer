export type CycleTimeDifference = {
  delta: number;
};

export type RankedCycleTimeDifference<T extends CycleTimeDifference> = T & {
  absoluteCycleTimeDelta: number;
};

/**
 * 依週期時間變化的絕對值由大到小排序，取得指定數量的工站差異。
 * 不會改動呼叫端傳入的原始陣列。
 */
export function rankCycleTimeDifferences<T extends CycleTimeDifference>(
  differences: T[],
  limit = 3,
): Array<RankedCycleTimeDifference<T>> {
  return differences
    .map((difference) => ({
      ...difference,
      absoluteCycleTimeDelta: Math.abs(difference.delta),
    }))
    .sort((a, b) => b.absoluteCycleTimeDelta - a.absoluteCycleTimeDelta)
    .slice(0, Math.max(0, limit));
}
