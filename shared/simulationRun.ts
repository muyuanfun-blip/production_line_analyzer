export type SimulationRunWorkstation = {
  id: number;
  name: string;
  cycleTime: number;
  sequenceOrder: number;
  description?: string;
};

export type SimulatedFlowPlan = {
  workstationId: number;
  workstationName: string;
  sequenceOrder: number;
  actualCycleTime: number;
  waitTime: number;
  entryTime: Date;
  exitTime: Date;
  notes: string;
};

export type SimulatedProductPlan = {
  serialNumber: string;
  startTime: Date;
  endTime: Date;
  totalLeadTime: number;
  flowRecords: SimulatedFlowPlan[];
};

type RawWorkstation = {
  id?: unknown;
  name?: unknown;
  cycleTime?: unknown;
  operatorTime?: unknown;
  machineTime?: unknown;
  sequenceOrder?: unknown;
  description?: unknown;
};

/** 兼容標準模擬陣列與平面圖 workstations 物件格式。 */
export function normalizeSimulationWorkstations(rawData: unknown): SimulationRunWorkstation[] {
  const candidates = Array.isArray(rawData)
    ? rawData
    : rawData && typeof rawData === "object" && Array.isArray((rawData as { workstations?: unknown }).workstations)
      ? (rawData as { workstations: unknown[] }).workstations
      : [];

  return candidates
    .map((value, index) => {
      const raw = (value ?? {}) as RawWorkstation;
      const directCycleTime = Number(raw.cycleTime);
      const cycleTime = Number.isFinite(directCycleTime) && directCycleTime > 0
        ? directCycleTime
        : Math.max(Number(raw.operatorTime) || 0, Number(raw.machineTime) || 0);
      const id = Number(raw.id);
      const sequenceOrder = Number(raw.sequenceOrder);
      return {
        id: Number.isInteger(id) && id !== 0 ? id : -(index + 1),
        name: typeof raw.name === "string" ? raw.name.trim() : "",
        cycleTime,
        sequenceOrder: Number.isInteger(sequenceOrder) ? sequenceOrder : index,
        description: typeof raw.description === "string" ? raw.description : undefined,
      };
    })
    .filter((workstation) => workstation.name.length > 0 && workstation.cycleTime > 0)
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

/**
 * 建立批次模擬的產品與工站流程時間表。
 * 每件產品依瓶頸時間投入產線，工站內則依情境 CT 順序完成加工。
 */
export function buildSimulationRunPlan({
  scenarioId,
  scenarioName,
  workstations,
  quantity,
  startedAt,
}: {
  scenarioId: number;
  scenarioName: string;
  workstations: SimulationRunWorkstation[];
  quantity: number;
  startedAt: Date;
}): SimulatedProductPlan[] {
  if (workstations.length === 0 || quantity <= 0) return [];

  const bottleneckCycleTime = Math.max(...workstations.map((workstation) => workstation.cycleTime));
  const runToken = startedAt.getTime().toString(36).toUpperCase();
  const totalLeadTime = workstations.reduce((sum, workstation) => sum + workstation.cycleTime, 0);

  return Array.from({ length: quantity }, (_, productIndex) => {
    const startTime = new Date(startedAt.getTime() + productIndex * bottleneckCycleTime * 1000);
    let cursor = startTime.getTime();
    const serialNumber = `SIM-${scenarioId}-${runToken}-${String(productIndex + 1).padStart(3, "0")}`;
    const flowRecords = workstations.map((workstation) => {
      const entryTime = new Date(cursor);
      cursor += workstation.cycleTime * 1000;
      const exitTime = new Date(cursor);
      return {
        workstationId: workstation.id,
        workstationName: workstation.name,
        sequenceOrder: workstation.sequenceOrder,
        actualCycleTime: workstation.cycleTime,
        waitTime: 0,
        entryTime,
        exitTime,
        notes: `由模擬情境「${scenarioName}」自動建立`,
      };
    });

    return {
      serialNumber,
      startTime,
      endTime: new Date(cursor),
      totalLeadTime,
      flowRecords,
    };
  });
}
