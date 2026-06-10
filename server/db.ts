import {
  eq, desc, asc,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  productionLines, InsertProductionLine,
  workstations, InsertWorkstation,
  actionSteps, InsertActionStep,
  handActions, InsertHandAction,
  analysisSnapshots, InsertAnalysisSnapshot,
  simulationScenarios, InsertSimulationScenario,
  productModels, InsertProductModel,
  productInstances, InsertProductInstance,
  productFlowRecords, InsertProductFlowRecord,
  vsmDiagrams, InsertVSMDiagram, VSMDiagram,
  vsmProcesses, InsertVSMProcess, VSMProcess,
  vsmFlows, InsertVSMFlow, VSMFlow,
  vsmVersions, InsertVSMVersion, VSMVersion,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    assignNullable("name");
    assignNullable("email");
    assignNullable("loginMethod");
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.warn("[Database] upsertUser failed:", error);
  }
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users);
}

export async function createLocalUser(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(users).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return db.select().from(users).where(eq(users.id, Number(insertId))).limit(1).then(rows => rows[0]);
}

// ─── Production Lines ────────────────────────────────────────────────────────

export async function listProductionLines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productionLines).orderBy(asc(productionLines.id));
}

export async function getProductionLineById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(productionLines).where(eq(productionLines.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createProductionLine(data: InsertProductionLine) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productionLines).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getProductionLineById(Number(insertId));
}

export async function updateProductionLine(id: number, data: Partial<InsertProductionLine>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productionLines).set(data).where(eq(productionLines.id, id));
  return getProductionLineById(id);
}

export async function deleteProductionLine(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(productionLines).where(eq(productionLines.id, id));
}

// ─── Workstations ───────────────────────────────────────────────────────────

export async function listWorkstationsByLine(productionLineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workstations)
    .where(eq(workstations.productionLineId, productionLineId))
    .orderBy(asc(workstations.sequenceOrder));
}

export async function getWorkstationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(workstations).where(eq(workstations.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createWorkstation(data: InsertWorkstation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(workstations).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getWorkstationById(Number(insertId));
}

export async function updateWorkstation(id: number, data: Partial<InsertWorkstation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workstations).set(data).where(eq(workstations.id, id));
  return getWorkstationById(id);
}

export async function deleteWorkstation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(workstations).where(eq(workstations.id, id));
}

export async function bulkCreateWorkstations(data: InsertWorkstation[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return [];
  await db.insert(workstations).values(data);
  const ids = data.map((_, i) => i + 1);
  return Promise.all(ids.map(id => getWorkstationById(id)));
}

// ─── Action Steps ───────────────────────────────────────────────────────────

export async function getActionStepsByWorkstation(workstationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionSteps)
    .where(eq(actionSteps.workstationId, workstationId))
    .orderBy(asc(actionSteps.sequenceOrder));
}

export async function getActionStepsByWorkstationIds(workstationIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (workstationIds.length === 0) return [];
  return db.select().from(actionSteps).where(
    (col) => col.inArray(actionSteps.workstationId, workstationIds)
  );
}

export async function createActionStep(data: InsertActionStep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(actionSteps).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  const rows = await db.select().from(actionSteps).where(eq(actionSteps.id, Number(insertId))).limit(1);
  return rows[0] ?? null;
}

export async function updateActionStep(id: number, data: Partial<InsertActionStep>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(actionSteps).set(data).where(eq(actionSteps.id, id));
  const rows = await db.select().from(actionSteps).where(eq(actionSteps.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteActionStep(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(actionSteps).where(eq(actionSteps.id, id));
}

export async function bulkCreateActionSteps(data: InsertActionStep[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return [];
  await db.insert(actionSteps).values(data);
  const workstationIds = [...new Set(data.map(d => d.workstationId))];
  return getActionStepsByWorkstationIds(workstationIds);
}

// ─── Snapshots ──────────────────────────────────────────────────────────────

export async function getSnapshotsByLine(productionLineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(analysisSnapshots)
    .where(eq(analysisSnapshots.productionLineId, productionLineId))
    .orderBy(desc(analysisSnapshots.createdAt));
}

export async function getSnapshotById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(analysisSnapshots).where(eq(analysisSnapshots.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSnapshot(data: InsertAnalysisSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(analysisSnapshots).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getSnapshotById(Number(insertId));
}

export async function deleteSnapshot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(analysisSnapshots).where(eq(analysisSnapshots.id, id));
}

export async function updateSnapshotData(id: number, data: Partial<InsertAnalysisSnapshot>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(analysisSnapshots).set(data).where(eq(analysisSnapshots.id, id));
  return getSnapshotById(id);
}

export async function getAllLinesSnapshotHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];

  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db
        .select()
        .from(analysisSnapshots)
        .where(eq(analysisSnapshots.productionLineId, line.id))
        .orderBy(desc(analysisSnapshots.createdAt))
        .limit(100);

      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        targetCycleTime: line.targetCycleTime ? Number(line.targetCycleTime) : null,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          name: s.name,
          balanceRate: Number(s.balanceRate),
          balanceLoss: Number(s.balanceLoss),
          maxTime: Number(s.maxTime),
          avgTime: Number(s.avgTime),
          workstationCount: s.workstationCount,
          totalManpower: s.totalManpower,
          taktPassRate: s.taktPassRate ? Number(s.taktPassRate) : null,
          upph: s.upph ? Number(s.upph) : null,
          bottleneckName: s.bottleneckName,
          createdAt: s.createdAt,
        })),
      };
    })
  );

  return results.filter((r) => r.snapshots.length > 0);
}

export async function getAllLinesLatestSnapshot() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];

  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db
        .select()
        .from(analysisSnapshots)
        .where(eq(analysisSnapshots.productionLineId, line.id))
        .orderBy(desc(analysisSnapshots.createdAt))
        .limit(1);
      const latest = snapshots[0] ?? null;
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        targetCycleTime: line.targetCycleTime ? Number(line.targetCycleTime) : null,
        snapshot: latest ? {
          id: latest.id,
          name: latest.name,
          balanceRate: Number(latest.balanceRate),
          balanceLoss: Number(latest.balanceLoss),
          maxTime: Number(latest.maxTime),
          avgTime: Number(latest.avgTime),
          workstationCount: latest.workstationCount,
          totalManpower: latest.totalManpower,
          taktPassRate: latest.taktPassRate ? Number(latest.taktPassRate) : null,
          upph: latest.upph ? Number(latest.upph) : null,
          bottleneckName: latest.bottleneckName,
          createdAt: latest.createdAt,
        } : null,
      };
    })
  );
  return results;
}

// 取得快照名稱中日期最新的快照
export async function getAllLinesLatestSnapshotByDate() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];

  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db
        .select()
        .from(analysisSnapshots)
        .where(eq(analysisSnapshots.productionLineId, line.id));
      
      if (snapshots.length === 0) {
        return {
          lineId: line.id,
          lineName: line.name,
          lineStatus: line.status,
          targetCycleTime: line.targetCycleTime ? Number(line.targetCycleTime) : null,
          snapshot: null,
        };
      }

      // 從快照名稱中提取日期並排序
      const snapshotsWithDate = snapshots
        .map((s) => {
          // 嘗試從名稱中提取日期（格式：YYYY/M/D 或 YYYY/MM/DD）
          const dateMatch = s.name.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
          let date = new Date(0);
          if (dateMatch) {
            const year = parseInt(dateMatch[1], 10);
            const month = parseInt(dateMatch[2], 10);
            const day = parseInt(dateMatch[3], 10);
            date = new Date(year, month - 1, day);
          }
          return { snapshot: s, date };
        })
        .sort((a, b) => b.date.getTime() - a.date.getTime());

      const latest = snapshotsWithDate[0]?.snapshot ?? null;
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        targetCycleTime: line.targetCycleTime ? Number(line.targetCycleTime) : null,
        snapshot: latest ? {
          id: latest.id,
          name: latest.name,
          balanceRate: Number(latest.balanceRate),
          balanceLoss: Number(latest.balanceLoss),
          maxTime: Number(latest.maxTime),
          avgTime: Number(latest.avgTime),
          workstationCount: latest.workstationCount,
          totalManpower: latest.totalManpower,
          taktPassRate: latest.taktPassRate ? Number(latest.taktPassRate) : null,
          upph: latest.upph ? Number(latest.upph) : null,
          bottleneckName: latest.bottleneckName,
          createdAt: latest.createdAt,
        } : null,
      };
    })
  );
  return results;
}

// ─── Simulation Scenarios ─────────────────────────────────────────────────────

export async function listSimulations(productionLineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(simulationScenarios)
    .where(eq(simulationScenarios.productionLineId, productionLineId))
    .orderBy(desc(simulationScenarios.updatedAt));
}

export async function getSimulationById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(simulationScenarios)
    .where(eq(simulationScenarios.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSimulation(data: InsertSimulationScenario) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(simulationScenarios).values(data);
  const insertId = (result as any)[0]?.insertId ?? (result as any).insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getSimulationById(Number(insertId));
}

export async function updateSimulation(id: number, data: Partial<InsertSimulationScenario>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(simulationScenarios).set(data).where(eq(simulationScenarios.id, id));
  return getSimulationById(id);
}

export async function deleteSimulation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(simulationScenarios).where(eq(simulationScenarios.id, id));
}

// ─── Product Models ─────────────────────────────────────────────────────────

export async function getProductModelsByLine(productionLineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productModels)
    .where(eq(productModels.productionLineId, productionLineId))
    .orderBy(asc(productModels.modelCode));
}

export async function getProductModelById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(productModels).where(eq(productModels.id, id)).limit(1);
  return result[0];
}

export async function createProductModel(data: InsertProductModel) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productModels).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getProductModelById(Number(insertId));
}

export async function updateProductModel(id: number, data: Partial<InsertProductModel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productModels).set(data).where(eq(productModels.id, id));
  return getProductModelById(id);
}

export async function deleteProductModel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(productModels).where(eq(productModels.id, id));
}

// ─── Product Instances ──────────────────────────────────────────────────────

export async function getProductInstancesByModel(productModelId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productInstances)
    .where(eq(productInstances.productModelId, productModelId))
    .orderBy(desc(productInstances.createdAt));
}

export async function getProductInstanceById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(productInstances).where(eq(productInstances.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createProductInstance(data: InsertProductInstance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productInstances).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getProductInstanceById(Number(insertId));
}

export async function updateProductInstance(id: number, data: Partial<InsertProductInstance>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productInstances).set(data).where(eq(productInstances.id, id));
  return getProductInstanceById(id);
}

export async function deleteProductInstance(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(productInstances).where(eq(productInstances.id, id));
}

// ─── Product Flow Records ───────────────────────────────────────────────────

export async function getProductFlowRecordsByInstance(productInstanceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productFlowRecords)
    .where(eq(productFlowRecords.productInstanceId, productInstanceId))
    .orderBy(asc(productFlowRecords.sequenceOrder));
}

export async function getProductFlowRecordById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(productFlowRecords).where(eq(productFlowRecords.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createProductFlowRecord(data: InsertProductFlowRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productFlowRecords).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getProductFlowRecordById(Number(insertId));
}

export async function updateProductFlowRecord(id: number, data: Partial<InsertProductFlowRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productFlowRecords).set(data).where(eq(productFlowRecords.id, id));
  return getProductFlowRecordById(id);
}

export async function deleteProductFlowRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(productFlowRecords).where(eq(productFlowRecords.id, id));
}

// ─── VSM Diagrams ───────────────────────────────────────────────────────────

export async function listVSMDiagrams(productionLineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vsmDiagrams)
    .where(eq(vsmDiagrams.productionLineId, productionLineId))
    .orderBy(desc(vsmDiagrams.updatedAt));
}

export async function getVSMDiagramById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vsmDiagrams).where(eq(vsmDiagrams.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createVSMDiagram(data: InsertVSMDiagram) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmDiagrams).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getVSMDiagramById(Number(insertId));
}

export async function updateVSMDiagram(id: number, data: Partial<InsertVSMDiagram>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsmDiagrams).set(data).where(eq(vsmDiagrams.id, id));
  return getVSMDiagramById(id);
}

export async function deleteVSMDiagram(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmDiagrams).where(eq(vsmDiagrams.id, id));
}

// ─── VSM Processes ──────────────────────────────────────────────────────────

export async function listVSMProcesses(diagramId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vsmProcesses)
    .where(eq(vsmProcesses.diagramId, diagramId))
    .orderBy(asc(vsmProcesses.sequenceOrder));
}

export async function getVSMProcessById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vsmProcesses).where(eq(vsmProcesses.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createVSMProcess(data: InsertVSMProcess) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmProcesses).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getVSMProcessById(Number(insertId));
}

export async function updateVSMProcess(id: number, data: Partial<InsertVSMProcess>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsmProcesses).set(data).where(eq(vsmProcesses.id, id));
  return getVSMProcessById(id);
}

export async function deleteVSMProcess(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmProcesses).where(eq(vsmProcesses.id, id));
}

export async function deleteVSMProcessesByDiagram(diagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmProcesses).where(eq(vsmProcesses.diagramId, diagramId));
}

// ─── VSM Flows ──────────────────────────────────────────────────────────────

export async function listVSMFlows(diagramId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vsmFlows)
    .where(eq(vsmFlows.diagramId, diagramId));
}

export async function getVSMFlowById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vsmFlows).where(eq(vsmFlows.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createVSMFlow(data: InsertVSMFlow) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmFlows).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getVSMFlowById(Number(insertId));
}

export async function updateVSMFlow(id: number, data: Partial<InsertVSMFlow>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsmFlows).set(data).where(eq(vsmFlows.id, id));
  return getVSMFlowById(id);
}

export async function deleteVSMFlow(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmFlows).where(eq(vsmFlows.id, id));
}

export async function deleteVSMFlowsByDiagram(diagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmFlows).where(eq(vsmFlows.diagramId, diagramId));
}

// ─── VSM Versions ───────────────────────────────────────────────────────────

export async function listVSMVersions(diagramId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vsmVersions)
    .where(eq(vsmVersions.diagramId, diagramId))
    .orderBy(desc(vsmVersions.createdAt));
}

export async function getVSMVersionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(vsmVersions).where(eq(vsmVersions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createVSMVersion(data: InsertVSMVersion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmVersions).values(data);
  const insertId = (result as any)[0]?.insertId;
  if (!insertId) throw new Error("Failed to get insertId");
  return getVSMVersionById(Number(insertId));
}

export async function restoreVSMVersion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const version = await getVSMVersionById(id);
  if (!version) throw new Error("Version not found");
  
  const diagram = await getVSMDiagramById(version.diagramId);
  if (!diagram) throw new Error("Diagram not found");
  
  // 清除現有工序和流線
  await deleteVSMProcessesByDiagram(version.diagramId);
  await deleteVSMFlowsByDiagram(version.diagramId);
  
  // 恢復版本中的工序和流線
  const processesSnapshot = JSON.parse(version.processesSnapshot as string) as InsertVSMProcess[];
  const flowsSnapshot = JSON.parse(version.flowsSnapshot as string) as InsertVSMFlow[];
  
  for (const process of processesSnapshot) {
    await createVSMProcess(process);
  }
  
  for (const flow of flowsSnapshot) {
    await createVSMFlow(flow);
  }
  
  return getVSMDiagramById(version.diagramId);
}

// ─── Hand Actions ───────────────────────────────────────────────────────────

export async function getHandActionsByStep(actionStepId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(handActions)
    .where(eq(handActions.actionStepId, actionStepId))
    .orderBy(asc(handActions.sequenceOrder));
}

export async function getHandActionsByStepIds(stepIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (stepIds.length === 0) return [];
  return db.select().from(handActions).where(
    (col) => col.inArray(handActions.actionStepId, stepIds)
  );
}

export async function upsertHandAction(data: InsertHandAction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(handActions).values(data).onDuplicateKeyUpdate({ set: data });
  const rows = await db.select().from(handActions)
    .where(eq(handActions.actionStepId, data.actionStepId))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteHandAction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(handActions).where(eq(handActions.id, id));
}

export async function deleteHandActionsByStep(actionStepId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(handActions).where(eq(handActions.actionStepId, actionStepId));
}
