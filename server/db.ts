import { eq, asc, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  productionLines, InsertProductionLine,
  workstations, InsertWorkstation,
  actionSteps, InsertActionStep,
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
