import { eq, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  productionLines, InsertProductionLine,
  workstations, InsertWorkstation,
  actionSteps, InsertActionStep,
  handActions, InsertHandAction,
  analysisSnapshots, InsertAnalysisSnapshot,
  simulationScenarios, InsertSimulationScenario,
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
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    openId: users.openId,
    username: users.username,
    name: users.name,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function createLocalUser(data: {
  username: string;
  passwordHash: string;
  name: string;
  role: 'user' | 'admin';
}) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const openId = `local_${data.username}_${Date.now()}`;
  await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    role: data.role,
    loginMethod: 'local',
    isActive: 1,
    lastSignedIn: new Date(),
  });
  return getUserByUsername(data.username);
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function toggleUserActive(userId: number, isActive: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ isActive }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

// ─── Production Lines ────────────────────────────────────────────────────────

export async function getAllProductionLines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(productionLines).orderBy(desc(productionLines.createdAt));
}

export async function getProductionLineById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(productionLines).where(eq(productionLines.id, id)).limit(1);
  return result[0];
}

export async function createProductionLine(data: InsertProductionLine) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productionLines).values(data);
  return result;
}

export async function updateProductionLine(id: number, data: Partial<InsertProductionLine>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(productionLines).set(data).where(eq(productionLines.id, id));
}

export async function deleteProductionLine(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related workstations and action steps first
  const ws = await db.select().from(workstations).where(eq(workstations.productionLineId, id));
  for (const w of ws) {
    await db.delete(actionSteps).where(eq(actionSteps.workstationId, w.id));
  }
  await db.delete(workstations).where(eq(workstations.productionLineId, id));
  return db.delete(productionLines).where(eq(productionLines.id, id));
}

// ─── Workstations ────────────────────────────────────────────────────────────

export async function getWorkstationsByLine(productionLineId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workstations)
    .where(eq(workstations.productionLineId, productionLineId))
    .orderBy(asc(workstations.sequenceOrder));
}

export async function getWorkstationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(workstations).where(eq(workstations.id, id)).limit(1);
  return result[0];
}

export async function createWorkstation(data: InsertWorkstation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(workstations).values(data);
}

export async function updateWorkstation(id: number, data: Partial<InsertWorkstation>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(workstations).set(data).where(eq(workstations.id, id));
}

export async function deleteWorkstation(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(actionSteps).where(eq(actionSteps.workstationId, id));
  return db.delete(workstations).where(eq(workstations.id, id));
}

export async function bulkCreateWorkstations(data: InsertWorkstation[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  return db.insert(workstations).values(data);
}

// ─── Action Steps ────────────────────────────────────────────────────────────

export async function getActionStepsByWorkstation(workstationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionSteps)
    .where(eq(actionSteps.workstationId, workstationId))
    .orderBy(asc(actionSteps.stepOrder));
}

export async function createActionStep(data: InsertActionStep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(actionSteps).values(data);
}

export async function updateActionStep(id: number, data: Partial<InsertActionStep>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.update(actionSteps).set(data).where(eq(actionSteps.id, id));
}

export async function deleteActionStep(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(actionSteps).where(eq(actionSteps.id, id));
}

export async function bulkCreateActionSteps(data: InsertActionStep[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.length === 0) return;
  return db.insert(actionSteps).values(data);
}

// ─── Hand Actions ──────────────────────────────────────────────────────────────────────────────────────

export async function getHandActionsByStep(actionStepId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(handActions)
    .where(eq(handActions.actionStepId, actionStepId))
    .orderBy(asc(handActions.hand)); // left 先、right 後
}

export async function getHandActionsByStepIds(actionStepIds: number[]) {
  if (actionStepIds.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  const { inArray } = await import("drizzle-orm");
  return db.select().from(handActions)
    .where(inArray(handActions.actionStepId, actionStepIds))
    .orderBy(asc(handActions.actionStepId), asc(handActions.hand));
}

export async function upsertHandAction(data: InsertHandAction & { id?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.id) {
    const { id, ...rest } = data;
    return db.update(handActions).set(rest).where(eq(handActions.id, id));
  }
  return db.insert(handActions).values(data);
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

// ─── Analysis Snapshot Queries ──────────────────────────────────────────────────────
export async function getSnapshotsByLine(productionLineId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(analysisSnapshots)
    .where(eq(analysisSnapshots.productionLineId, productionLineId))
    .orderBy(desc(analysisSnapshots.createdAt));
}

export async function getSnapshotById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(analysisSnapshots).where(eq(analysisSnapshots.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createSnapshot(data: InsertAnalysisSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(analysisSnapshots).values(data);
}

export async function deleteSnapshot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(analysisSnapshots).where(eq(analysisSnapshots.id, id));
}

/**
 * 更新快照的工站數據並重算衍生 KPI
 */
export async function updateSnapshotData(
  id: number,
  data: {
    name?: string;
    note?: string | null;
    workstationsData: Array<{
      id: number;
      name: string;
      cycleTime: number;
      manpower: number;
      sequenceOrder: number;
      description?: string;
      // 保留原有動作拆解摘要
      actionStepCount?: number;
      totalStepSec?: number;
      valueAddedSec?: number;
      nonValueAddedSec?: number;
      necessaryWasteSec?: number;
      valueAddedRate?: number | null;
    }>;
    taktTime?: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const ws = data.workstationsData;
  const times = ws.map(w => w.cycleTime);
  const totalTime = times.reduce((s, t) => s + t, 0);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = times.length > 0 ? totalTime / times.length : 0;
  const balanceRate = maxTime > 0 ? (totalTime / (maxTime * ws.length)) * 100 : 0;
  const balanceLoss = 100 - balanceRate;
  const totalManpower = ws.reduce((s, w) => s + w.manpower, 0);
  const upph = maxTime > 0 && totalManpower > 0 ? 3600 / maxTime / totalManpower : 0;
  const bottleneck = ws.find(w => w.cycleTime === maxTime);

  const taktPassStations = data.taktTime
    ? ws.filter(w => w.cycleTime <= data.taktTime!)
    : [];
  const taktPassRate = data.taktTime && ws.length > 0
    ? (taktPassStations.length / ws.length) * 100
    : null;
  const taktPassCount = data.taktTime ? taktPassStations.length : null;

  const updateFields: Record<string, unknown> = {
    workstationsData: ws,
    totalTime: String(totalTime.toFixed(2)),
    maxTime: String(maxTime.toFixed(2)),
    minTime: String(minTime.toFixed(2)),
    avgTime: String(avgTime.toFixed(2)),
    balanceRate: String(balanceRate.toFixed(2)),
    balanceLoss: String(balanceLoss.toFixed(2)),
    workstationCount: ws.length,
    totalManpower: Math.round(totalManpower * 10) / 10, // 保留一位小數精度
    upph: String(upph.toFixed(4)),
    bottleneckName: bottleneck?.name ?? null,
    taktTime: data.taktTime != null ? String(data.taktTime) : null,
    taktPassRate: taktPassRate != null ? String(taktPassRate.toFixed(2)) : null,
    taktPassCount: taktPassCount,
  };
  if (data.name !== undefined) updateFields.name = data.name;
  if (data.note !== undefined) updateFields.note = data.note;

  return db.update(analysisSnapshots)
    .set(updateFields as any)
    .where(eq(analysisSnapshots.id, id));
}

/**
 * 取得所有產線的最新快照摘要（用於首頁並排比較圖表）
 */
export async function getAllLinesSnapshotHistory() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 取得所有產線
  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];
  // 對每條產線取得所有快照（按時間排序）
  const results = await Promise.all(
    lines.map(async (line) => {
      const snapshots = await db
        .select()
        .from(analysisSnapshots)
        .where(eq(analysisSnapshots.productionLineId, line.id))
        .orderBy(asc(analysisSnapshots.createdAt));
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        snapshots: snapshots.map((s) => ({
          id: s.id,
          name: s.name,
          balanceRate: Number(s.balanceRate),
          taktPassRate: s.taktPassRate ? Number(s.taktPassRate) : null,
          upph: s.upph ? Number(s.upph) : null,
          maxTime: Number(s.maxTime),
          avgTime: Number(s.avgTime),
          workstationCount: s.workstationCount,
          createdAt: s.createdAt,
        })),
      };
    })
  );
  // 只回傳有快照的產線
  return results.filter((r) => r.snapshots.length > 0);
}

export async function getAllLinesLatestSnapshot() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 取得所有產線
  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];

  // 對每條產線取得最新快照
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
