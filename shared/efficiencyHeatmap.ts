export type EfficiencyHeatmapWorkstation = {
  id: number;
  name: string;
  standardCycleTime: number;
};

export type EfficiencyHeatmapRecord = {
  workstationId: number;
  workstationName: string;
  actualCycleTime: number | string | null;
  entryTime?: Date | string | null;
  createdAt?: Date | string | null;
};

export type EfficiencyHeatmapCell = {
  workstationId: number;
  workstationName: string;
  bucketStart: Date;
  sampleCount: number;
  avgActualCycleTime: number;
  standardCycleTime: number;
  efficiency: number;
  status: "ahead" | "on_target" | "slight_loss" | "loss";
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getBucketStart(date: Date, bucketMinutes: number): Date {
  const bucketMs = bucketMinutes * 60_000;
  return new Date(Math.floor(date.getTime() / bucketMs) * bucketMs);
}

function getStatus(efficiency: number): EfficiencyHeatmapCell["status"] {
  if (efficiency >= 105) return "ahead";
  if (efficiency >= 95) return "on_target";
  if (efficiency >= 85) return "slight_loss";
  return "loss";
}

/**
 * 以標準 CT 與實際 CT 的比值計算效率：標準 CT ÷ 平均實際 CT × 100%。
 * 若工站不存在於現有產線（例如模擬新增工站），採該工站所選區間的平均實績作為基準。
 */
export function buildEfficiencyHeatmap({
  workstations,
  records,
  from,
  to,
  bucketMinutes,
}: {
  workstations: EfficiencyHeatmapWorkstation[];
  records: EfficiencyHeatmapRecord[];
  from: Date;
  to: Date;
  bucketMinutes: number;
}) {
  if (bucketMinutes <= 0 || !Number.isInteger(bucketMinutes)) {
    throw new Error("bucketMinutes 必須為正整數。");
  }
  if (to.getTime() < from.getTime()) {
    throw new Error("結束時間不得早於開始時間。");
  }

  const normalized = records.flatMap((record) => {
    const actualCycleTime = Number(record.actualCycleTime);
    const occurredAt = asDate(record.entryTime) ?? asDate(record.createdAt);
    if (!Number.isFinite(actualCycleTime) || actualCycleTime <= 0 || !occurredAt) return [];
    if (occurredAt < from || occurredAt > to) return [];
    return [{ ...record, actualCycleTime, occurredAt }];
  });

  const workstationMap = new Map<number, EfficiencyHeatmapWorkstation>();
  workstations.forEach((workstation) => workstationMap.set(workstation.id, workstation));
  normalized.forEach((record) => {
    if (!workstationMap.has(record.workstationId)) {
      workstationMap.set(record.workstationId, {
        id: record.workstationId,
        name: record.workstationName,
        standardCycleTime: 0,
      });
    }
  });

  const fallbackBaseline = new Map<number, { total: number; count: number }>();
  normalized.forEach((record) => {
    const current = fallbackBaseline.get(record.workstationId) ?? { total: 0, count: 0 };
    current.total += record.actualCycleTime;
    current.count += 1;
    fallbackBaseline.set(record.workstationId, current);
  });

  const grouped = new Map<string, typeof normalized>();
  normalized.forEach((record) => {
    const bucketStart = getBucketStart(record.occurredAt, bucketMinutes);
    const key = `${record.workstationId}:${bucketStart.toISOString()}`;
    const list = grouped.get(key) ?? [];
    list.push(record);
    grouped.set(key, list);
  });

  const cells: EfficiencyHeatmapCell[] = Array.from(grouped.values()).map((recordsInCell) => {
    const first = recordsInCell[0]!;
    const workstation = workstationMap.get(first.workstationId)!;
    const baseline = fallbackBaseline.get(first.workstationId)!;
    const standardCycleTime = workstation.standardCycleTime > 0
      ? workstation.standardCycleTime
      : baseline.total / baseline.count;
    const avgActualCycleTime = recordsInCell.reduce((sum, record) => sum + record.actualCycleTime, 0) / recordsInCell.length;
    const efficiency = (standardCycleTime / avgActualCycleTime) * 100;
    return {
      workstationId: first.workstationId,
      workstationName: workstation.name,
      bucketStart: getBucketStart(first.occurredAt, bucketMinutes),
      sampleCount: recordsInCell.length,
      avgActualCycleTime,
      standardCycleTime,
      efficiency,
      status: getStatus(efficiency),
    };
  }).sort((a, b) => a.workstationName.localeCompare(b.workstationName) || a.bucketStart.getTime() - b.bucketStart.getTime());

  const bucketStarts: Date[] = [];
  const endBucket = getBucketStart(to, bucketMinutes).getTime();
  for (let timestamp = getBucketStart(from, bucketMinutes).getTime(); timestamp <= endBucket; timestamp += bucketMinutes * 60_000) {
    bucketStarts.push(new Date(timestamp));
  }

  return {
    workstations: Array.from(workstationMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    bucketStarts,
    cells,
  };
}
