import { eq, asc, desc, inArray, and, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { or } from "drizzle-orm";
import {
  InsertUser, users,
  productionLines, InsertProductionLine,
  workstations, InsertWorkstation,
  masterDataAuditLogs,
  aiConsensusReviewEvents, InsertAIConsensusReviewEvent,
  governanceDataCompletionTasks, InsertGovernanceDataCompletionTask,
  governanceTaskNotifications, InsertGovernanceTaskNotification,
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
  vsmImprovementActions, InsertVSMImprovementAction,
  userAccountAuditLogs, InsertUserAccountAuditLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { resolveActionTypeForReview } from "../shared/actionReview";
import { summarizeActionReviewQuality } from "../shared/actionReviewQuality";
import { hasMasterDataAuditChangedField } from "../shared/masterDataAudit";
import { summarizeAIConsensusGovernanceEvents } from "../shared/aiGovernance";
import { shouldCreateHighFrequencyCompletionTask } from "../shared/governanceCompletionTasks";

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

export interface AIConsensusReviewEventFilters {
  productionLineId?: number;
  status?: "approved" | "needs_clarification";
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export async function createAIConsensusReviewEvent(data: InsertAIConsensusReviewEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(aiConsensusReviewEvents).values(data);
  const id = (result as any)[0]?.insertId as number;
  const rows = await db.select().from(aiConsensusReviewEvents).where(eq(aiConsensusReviewEvents.id, id));
  return rows[0] ?? null;
}

export async function listAIConsensusReviewEvents(filters: AIConsensusReviewEventFilters = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [] as any[];
  if (filters.productionLineId) conditions.push(eq(aiConsensusReviewEvents.productionLineId, filters.productionLineId));
  if (filters.status) conditions.push(eq(aiConsensusReviewEvents.status, filters.status));
  if (filters.startDate) conditions.push(gte(aiConsensusReviewEvents.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(aiConsensusReviewEvents.createdAt, filters.endDate));
  const query = db.select().from(aiConsensusReviewEvents).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(desc(aiConsensusReviewEvents.createdAt));
  return query.limit(Math.min(filters.limit ?? 250, 500));
}

export async function getAIConsensusGovernanceStats(filters: AIConsensusReviewEventFilters = {}) {
  const events = await listAIConsensusReviewEvents({ ...filters, limit: 500 });
  return { ...summarizeAIConsensusGovernanceEvents(events), events };
}

export async function resolveAIConsensusReviewEvent(input: { id: number; decision: "approved" | "returned" | "closed"; decisionNote: string; roleDisagreements: unknown; decidedBy: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(aiConsensusReviewEvents).set({ resolutionStatus: input.decision, manualDecision: input.decision, decisionNote: input.decisionNote, roleDisagreements: input.roleDisagreements, decidedBy: input.decidedBy, decidedAt: new Date() }).where(eq(aiConsensusReviewEvents.id, input.id));
  const rows = await db.select().from(aiConsensusReviewEvents).where(eq(aiConsensusReviewEvents.id, input.id));
  return rows[0] ?? null;
}

export async function listGovernanceDataCompletionTasks(filters: { productionLineId?: number; assigneeId?: number; status?: "open" | "in_progress" | "completed" | "cancelled" } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [] as any[];
  if (filters.productionLineId) conditions.push(eq(governanceDataCompletionTasks.productionLineId, filters.productionLineId));
  if (filters.assigneeId) conditions.push(eq(governanceDataCompletionTasks.assigneeId, filters.assigneeId));
  if (filters.status) conditions.push(eq(governanceDataCompletionTasks.status, filters.status));
  return db.select().from(governanceDataCompletionTasks).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(governanceDataCompletionTasks.createdAt));
}

export async function createGovernanceDataCompletionTask(data: InsertGovernanceDataCompletionTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(governanceDataCompletionTasks).values(data);
  const id = (result as any)[0]?.insertId as number;
  const rows = await db.select().from(governanceDataCompletionTasks).where(eq(governanceDataCompletionTasks.id, id));
  return rows[0] ?? null;
}

export async function updateGovernanceDataCompletionTask(id: number, data: Partial<Pick<InsertGovernanceDataCompletionTask, "assigneeId" | "status" | "dueDate">>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(governanceDataCompletionTasks).set(data).where(eq(governanceDataCompletionTasks.id, id));
  const rows = await db.select().from(governanceDataCompletionTasks).where(eq(governanceDataCompletionTasks.id, id));
  return rows[0] ?? null;
}

export async function createGovernanceTaskNotification(data: InsertGovernanceTaskNotification) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(governanceTaskNotifications).values(data);
}

export async function listGovernanceTaskNotifications(recipientId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(governanceTaskNotifications).where(eq(governanceTaskNotifications.recipientId, recipientId)).orderBy(desc(governanceTaskNotifications.createdAt)).limit(50);
}

export async function createHighFrequencyDataCompletionTasks(input: { productionLineId: number; sourceEventId: number; dataGaps: Array<{ key: string; title: string; impact: string; requestedData: string; recommendedProvider: string }>; createdBy?: number | null; threshold?: number }) {
  const threshold = input.threshold ?? 3;
  const events = await listAIConsensusReviewEvents({ productionLineId: input.productionLineId, limit: 500 });
  const existingTasks = await listGovernanceDataCompletionTasks({ productionLineId: input.productionLineId });
  const created = [] as Awaited<ReturnType<typeof createGovernanceDataCompletionTask>>[];
  for (const gap of input.dataGaps) {
    const frequencyCount = events.reduce((count, event) => count + (Array.isArray(event.dataGaps) && event.dataGaps.some((item: any) => item?.key === gap.key) ? 1 : 0), 0);
    const hasActiveTask = existingTasks.some((task) => task.sourceGapKey === gap.key && (task.status === "open" || task.status === "in_progress"));
    if (!shouldCreateHighFrequencyCompletionTask({ frequencyCount, threshold, hasActiveTask })) continue;
    const task = await createGovernanceDataCompletionTask({ productionLineId: input.productionLineId, sourceGapKey: gap.key, title: `補件：${gap.title}`, description: `${gap.impact}\n\n需補充資料：${gap.requestedData}`, recommendedProvider: gap.recommendedProvider, assigneeId: null, status: "open", frequencyCount, threshold, sourceEventId: input.sourceEventId, dueDate: null, createdBy: input.createdBy ?? null });
    if (task) created.push(task);
  }
  return created;
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

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? undefined;
}

export async function countActiveAdministrators() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(users).where(and(eq(users.role, "admin"), eq(users.isActive, 1)));
  return Number(result[0]?.count ?? 0);
}

export async function createUserAccountAuditLog(data: InsertUserAccountAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(userAccountAuditLogs).values(data);
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
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
  return Promise.all(rows.map(async (user) => ({ ...user, businessRecordSummary: await getUserBusinessRecordSummary(user.id) })));
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
  await db.update(users).set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}

export async function toggleUserActive(userId: number, isActive: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ isActive, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}

export async function updateUserRole(userId: number, role: 'user' | 'admin') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(users).set({ role, sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId));
}

export type UserBusinessRecordSummary = {
  total: number;
  records: Array<{ key: string; label: string; count: number }>;
};

async function countUserLinkedRecords(table: any, condition: any) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ count: sql<number>`count(*)` }).from(table).where(condition);
  return Number(rows[0]?.count ?? 0);
}

export async function getUserBusinessRecordSummary(userId: number): Promise<UserBusinessRecordSummary> {
  const counts = await Promise.all([
    countUserLinkedRecords(masterDataAuditLogs, eq(masterDataAuditLogs.operatorId, userId)),
    countUserLinkedRecords(actionSteps, eq(actionSteps.reviewedBy, userId)),
    countUserLinkedRecords(aiConsensusReviewEvents, or(eq(aiConsensusReviewEvents.createdBy, userId), eq(aiConsensusReviewEvents.decidedBy, userId))),
    countUserLinkedRecords(governanceDataCompletionTasks, or(eq(governanceDataCompletionTasks.createdBy, userId), eq(governanceDataCompletionTasks.assigneeId, userId))),
    countUserLinkedRecords(simulationScenarios, eq(simulationScenarios.createdBy, userId)),
    countUserLinkedRecords(vsmImprovementActions, eq(vsmImprovementActions.createdBy, userId)),
  ]);
  const templates = [
    ["master_data", "主資料異動"],
    ["action_review", "動作覆核"],
    ["ai_governance", "AI 審查或裁決"],
    ["completion_task", "補件任務建立或指派"],
    ["simulation", "配置模擬"],
    ["improvement_action", "改善行動"],
  ] as const;
  const records = templates.map(([key, label], index) => ({ key, label, count: counts[index] })).filter(record => record.count > 0);
  return { total: records.reduce((sum, record) => sum + record.count, 0), records };
}

export async function deleteUserAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, userId));
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

type MasterDataEntityType = "production_line" | "workstation";
type MasterDataAuditAction = "create" | "update" | "delete" | "bulk_import";

export async function createMasterDataAuditLog(data: {
  entityType: MasterDataEntityType;
  entityId: number | null;
  productionLineId: number | null;
  action: MasterDataAuditAction;
  beforeData?: unknown | null;
  afterData?: unknown | null;
  operatorId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.insert(masterDataAuditLogs).values({
    entityType: data.entityType,
    entityId: data.entityId,
    productionLineId: data.productionLineId,
    action: data.action,
    beforeData: data.beforeData ?? null,
    afterData: data.afterData ?? null,
    operatorId: data.operatorId,
  } as any);
}

export async function listMasterDataAuditLogs(filters: {
  productionLineId?: number;
  entityType?: MasterDataEntityType;
  action?: MasterDataAuditAction;
  entityId?: number;
  operatorId?: number;
  changedField?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conditions = [] as any[];
  if (filters.productionLineId !== undefined) conditions.push(eq(masterDataAuditLogs.productionLineId, filters.productionLineId));
  if (filters.entityType !== undefined) conditions.push(eq(masterDataAuditLogs.entityType, filters.entityType));
  if (filters.action !== undefined) conditions.push(eq(masterDataAuditLogs.action, filters.action));
  if (filters.entityId !== undefined) conditions.push(eq(masterDataAuditLogs.entityId, filters.entityId));
  if (filters.operatorId !== undefined) conditions.push(eq(masterDataAuditLogs.operatorId, filters.operatorId));
  if (filters.from !== undefined) conditions.push(gte(masterDataAuditLogs.createdAt, filters.from));
  if (filters.to !== undefined) conditions.push(lte(masterDataAuditLogs.createdAt, filters.to));
  const query = db.select({
    id: masterDataAuditLogs.id,
    entityType: masterDataAuditLogs.entityType,
    entityId: masterDataAuditLogs.entityId,
    productionLineId: masterDataAuditLogs.productionLineId,
    action: masterDataAuditLogs.action,
    beforeData: masterDataAuditLogs.beforeData,
    afterData: masterDataAuditLogs.afterData,
    operatorId: masterDataAuditLogs.operatorId,
    operatorName: users.name,
    operatorUsername: users.username,
    createdAt: masterDataAuditLogs.createdAt,
  }).from(masterDataAuditLogs)
    .leftJoin(users, eq(masterDataAuditLogs.operatorId, users.id));
  const rows = conditions.length > 0
    ? await query.where(and(...conditions)).orderBy(desc(masterDataAuditLogs.createdAt)).limit(filters.limit ?? 100)
    : await query.orderBy(desc(masterDataAuditLogs.createdAt)).limit(filters.limit ?? 100);
  return filters.changedField
    ? rows.filter((row) => hasMasterDataAuditChangedField(row.beforeData, row.afterData, filters.changedField!))
    : rows;
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

export async function getActionStepsByWorkstationIds(workstationIds: number[]) {
  const db = await getDb();
  if (!db || workstationIds.length === 0) return [];
  return db.select().from(actionSteps)
    .where(inArray(actionSteps.workstationId, workstationIds))
    .orderBy(asc(actionSteps.workstationId), asc(actionSteps.stepOrder));
}

type ActionReviewStatus = "unreviewed" | "pending" | "approved" | "rejected";
type ReviewableActionType = "value_added" | "non_value_added" | "necessary_waste";

export async function getActionReviewQueue(
  productionLineId: number,
  statuses: ActionReviewStatus[] = ["unreviewed", "pending"],
) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: actionSteps.id,
    workstationId: actionSteps.workstationId,
    workstationName: workstations.name,
    sequenceOrder: workstations.sequenceOrder,
    stepName: actionSteps.stepName,
    stepOrder: actionSteps.stepOrder,
    duration: actionSteps.duration,
    actionType: actionSteps.actionType,
    suggestedActionType: actionSteps.suggestedActionType,
    reviewStatus: actionSteps.reviewStatus,
    reviewNote: actionSteps.reviewNote,
    reviewedBy: actionSteps.reviewedBy,
    reviewedAt: actionSteps.reviewedAt,
    description: actionSteps.description,
  }).from(actionSteps)
    .innerJoin(workstations, eq(actionSteps.workstationId, workstations.id))
    .where(and(
      eq(workstations.productionLineId, productionLineId),
      inArray(actionSteps.reviewStatus, statuses),
    ))
    .orderBy(asc(workstations.sequenceOrder), asc(actionSteps.stepOrder));
}

export async function queueActionStepsForReview(
  ids: number[],
  suggestedActionType: ReviewableActionType,
  reviewNote: string | null,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (ids.length === 0) return;
  return db.update(actionSteps).set({
    reviewStatus: "pending",
    suggestedActionType,
    reviewNote,
    reviewedBy: null,
    reviewedAt: null,
  }).where(inArray(actionSteps.id, ids));
}

export async function resolveActionStepReviews(
  ids: number[],
  decision: "approved" | "rejected",
  reviewerId: number,
  reviewNote: string | null,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (ids.length === 0) return;

  const candidates = await db.select({
    id: actionSteps.id,
    actionType: actionSteps.actionType,
    suggestedActionType: actionSteps.suggestedActionType,
  }).from(actionSteps).where(inArray(actionSteps.id, ids));

  for (const candidate of candidates) {
    const resolvedActionType = resolveActionTypeForReview({
      currentActionType: candidate.actionType as ReviewableActionType,
      suggestedActionType: candidate.suggestedActionType as ReviewableActionType | null,
      decision,
    });
    const updateData: Partial<InsertActionStep> = {
      reviewStatus: decision,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewNote,
      actionType: resolvedActionType,
    };
    await db.update(actionSteps).set(updateData).where(eq(actionSteps.id, candidate.id));
  }
}

export async function getActionReviewQualityStats(productionLineId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const query = db.select({
    productionLineId: workstations.productionLineId,
    workstationId: workstations.id,
    workstationName: workstations.name,
    duration: actionSteps.duration,
    actionType: actionSteps.actionType,
    reviewStatus: actionSteps.reviewStatus,
  }).from(actionSteps)
    .innerJoin(workstations, eq(actionSteps.workstationId, workstations.id));
  const rows = productionLineId !== undefined
    ? await query.where(eq(workstations.productionLineId, productionLineId))
    : await query;
  return summarizeActionReviewQuality(rows as any);
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
      morningManpower?: number | string;
      eveningManpower?: number | string;
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
  // 計算總人力：優先使用早晚班加總，若無則使用 manpower 欄位（相容舊資料）
  const totalManpower = ws.reduce((s, w) => {
    const morning = Number(w.morningManpower) || 0;
    const evening = Number(w.eveningManpower) || 0;
    const combined = morning + evening;
    return s + (combined > 0 ? combined : Number(w.manpower) || 0);
  }, 0);
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
        .orderBy(desc(analysisSnapshots.createdAt));
      // 按快照名稱中的日期排序（新到舊）
      const snapshotsWithDate = snapshots.map((s) => {
        const dateMatch = s.name.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
        let date = new Date(0);
        if (dateMatch) {
          const year = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10);
          const day = parseInt(dateMatch[3], 10);
          date = new Date(year, month - 1, day);
        }
        return { snapshot: s, date };
      }).sort((a, b) => b.date.getTime() - a.date.getTime());
      
      return {
        lineId: line.id,
        lineName: line.name,
        lineStatus: line.status,
        snapshots: snapshotsWithDate.map((item) => ({
          id: item.snapshot.id,
          name: item.snapshot.name,
          balanceRate: Number(item.snapshot.balanceRate),
          taktPassRate: item.snapshot.taktPassRate ? Number(item.snapshot.taktPassRate) : null,
          upph: item.snapshot.upph ? Number(item.snapshot.upph) : null,
          maxTime: Number(item.snapshot.maxTime),
          avgTime: Number(item.snapshot.avgTime),
          workstationCount: item.snapshot.workstationCount,
          createdAt: item.snapshot.createdAt,
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

export async function updateScenarioBackground(
  id: number,
  data: {
    backgroundSvg?: string | null;
    backgroundLayers?: unknown;
    backgroundOpacity?: string;
    backgroundOffsetX?: string;
    backgroundOffsetY?: string;
    backgroundScale?: string;
    backgroundFileName?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(simulationScenarios).set(data as any).where(eq(simulationScenarios.id, id));
  return getSimulationById(id);
}

// ─── Product Instances ─────────────────────────────────────────────────────



export async function listProductInstances(productionLineId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productInstances)
    .where(eq(productInstances.productionLineId, productionLineId))
    .orderBy(productInstances.createdAt);
}

export async function getProductInstanceById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(productInstances).where(eq(productInstances.id, id));
  return rows[0] ?? null;
}

export async function createProductInstance(data: InsertProductInstance) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productInstances).values(data);
  const id = (result as any)[0]?.insertId as number;
  return getProductInstanceById(id);
}

export async function updateProductInstance(id: number, data: Partial<InsertProductInstance>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productInstances).set(data as any).where(eq(productInstances.id, id));
  return getProductInstanceById(id);
}

export async function deleteProductInstance(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 先刪除所有流程記錄
  await db.delete(productFlowRecords).where(eq(productFlowRecords.productInstanceId, id));
  return db.delete(productInstances).where(eq(productInstances.id, id));
}

// ─── Product Flow Records ─────────────────────────────────────────────────────

export async function listFlowRecordsByInstance(productInstanceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productFlowRecords)
    .where(eq(productFlowRecords.productInstanceId, productInstanceId))
    .orderBy(productFlowRecords.sequenceOrder);
}

export async function getFlowRecordById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(productFlowRecords).where(eq(productFlowRecords.id, id));
  return rows[0] ?? null;
}

export async function createFlowRecord(data: InsertProductFlowRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(productFlowRecords).values(data);
  const id = (result as any)[0]?.insertId as number;
  return getFlowRecordById(id);
}

export async function updateFlowRecord(id: number, data: Partial<InsertProductFlowRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(productFlowRecords).set(data as any).where(eq(productFlowRecords.id, id));
  return getFlowRecordById(id);
}

export async function deleteFlowRecord(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(productFlowRecords).where(eq(productFlowRecords.id, id));
}

export async function upsertFlowRecords(productInstanceId: number, records: InsertProductFlowRecord[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 刪除舊記錄後重新插入（批量更新）
  await db.delete(productFlowRecords).where(eq(productFlowRecords.productInstanceId, productInstanceId));
  if (records.length > 0) {
    await db.insert(productFlowRecords).values(records);
  }
  return listFlowRecordsByInstance(productInstanceId);
}

// 批次查詢多個 instance 的所有流程記錄（用於甘特圖）
export async function listFlowRecordsByInstances(instanceIds: number[]) {
  if (instanceIds.length === 0) return [];
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(productFlowRecords)
    .where(inArray(productFlowRecords.productInstanceId, instanceIds))
    .orderBy(productFlowRecords.productInstanceId, productFlowRecords.sequenceOrder);
}


// ============ VSM 工作流程 ============

// VSM 圖表 - 列表查詢
export async function listVSMDiagrams(productionLineId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(vsmDiagrams)
    .where(eq(vsmDiagrams.productionLineId, productionLineId))
    .orderBy(desc(vsmDiagrams.updatedAt));
}

// VSM 圖表 - 單筆查詢
export async function getVSMDiagramById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(vsmDiagrams).where(eq(vsmDiagrams.id, id));
  return rows[0] ?? null;
}

// VSM 圖表 - 建立
export async function createVSMDiagram(data: InsertVSMDiagram) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmDiagrams).values(data);
  const id = (result as any)[0]?.insertId as number;
  return getVSMDiagramById(id);
}

// VSM 圖表 - 更新
export async function updateVSMDiagram(id: number, data: Partial<InsertVSMDiagram>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsmDiagrams).set(data as any).where(eq(vsmDiagrams.id, id));
  return getVSMDiagramById(id);
}

// VSM 圖表 - 刪除
export async function deleteVSMDiagram(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmDiagrams).where(eq(vsmDiagrams.id, id));
}

// VSM 工序 - 列表查詢
export async function listVSMProcesses(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(vsmProcesses)
    .where(eq(vsmProcesses.vsmDiagramId, vsmDiagramId))
    .orderBy(asc(vsmProcesses.positionX), asc(vsmProcesses.positionY));
}

// VSM 工序 - 單筆查詢
export async function getVSMProcessById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(vsmProcesses).where(eq(vsmProcesses.id, id));
  return rows[0] ?? null;
}

// VSM 工序 - 建立
export async function createVSMProcess(data: InsertVSMProcess) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmProcesses).values(data);
  const id = (result as any)[0]?.insertId as number;
  return getVSMProcessById(id);
}

// VSM 工序 - 更新
export async function updateVSMProcess(id: number, data: Partial<InsertVSMProcess>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsmProcesses).set(data as any).where(eq(vsmProcesses.id, id));
  return getVSMProcessById(id);
}

// VSM 工序 - 刪除
export async function deleteVSMProcess(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmProcesses).where(eq(vsmProcesses.id, id));
}

// VSM 工序 - 批量刪除（用於刪除圖表時）
export async function deleteVSMProcessesByDiagram(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmProcesses).where(eq(vsmProcesses.vsmDiagramId, vsmDiagramId));
}

// VSM 流線 - 列表查詢
export async function listVSMFlows(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(vsmFlows)
    .where(eq(vsmFlows.vsmDiagramId, vsmDiagramId))
    .orderBy(asc(vsmFlows.fromProcessId), asc(vsmFlows.toProcessId));
}

// VSM 流線 - 單筆查詢
export async function getVSMFlowById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(vsmFlows).where(eq(vsmFlows.id, id));
  return rows[0] ?? null;
}

// VSM 流線 - 建立
export async function createVSMFlow(data: InsertVSMFlow) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmFlows).values(data);
  const id = (result as any)[0]?.insertId as number;
  return getVSMFlowById(id);
}

// VSM 流線 - 更新
export async function updateVSMFlow(id: number, data: Partial<InsertVSMFlow>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsmFlows).set(data as any).where(eq(vsmFlows.id, id));
  return getVSMFlowById(id);
}

// VSM 流線 - 刪除
export async function deleteVSMFlow(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmFlows).where(eq(vsmFlows.id, id));
}

// VSM 流線 - 批量刪除（用於刪除圖表時）
export async function deleteVSMFlowsByDiagram(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmFlows).where(eq(vsmFlows.vsmDiagramId, vsmDiagramId));
}

// VSM 版本 - 列表查詢
export async function listVSMVersions(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select().from(vsmVersions)
    .where(eq(vsmVersions.vsmDiagramId, vsmDiagramId))
    .orderBy(desc(vsmVersions.versionNumber));
}

// VSM 版本 - 單筆查詢
export async function getVSMVersionById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(vsmVersions).where(eq(vsmVersions.id, id));
  const version = rows[0];
  if (!version) return null;

  // 解析快照
  const processes = Array.isArray(version.processesSnapshot) ? version.processesSnapshot : JSON.parse(version.processesSnapshot as any);
  const flows = Array.isArray(version.flowsSnapshot) ? version.flowsSnapshot : JSON.parse(version.flowsSnapshot as any);

  return {
    ...version,
    name: `Version ${version.versionNumber}`,
    processes,
    flows,
  };
}

// VSM 版本 - 建立（保存快照）
export async function createVSMVersion(data: InsertVSMVersion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmVersions).values(data);
  const id = (result as any)[0]?.insertId as number;
  return getVSMVersionById(id);
}

// VSM 版本 - 依圖表批量刪除（用於刪除圖表時）
export async function deleteVSMVersionsByDiagram(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmVersions).where(eq(vsmVersions.vsmDiagramId, vsmDiagramId));
}

// VSM 改善行動 - 列表（附帶工序名稱，供閉環摘要與追蹤面板使用）
export async function listVSMImprovementActions(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.select({
    id: vsmImprovementActions.id,
    vsmDiagramId: vsmImprovementActions.vsmDiagramId,
    vsmProcessId: vsmImprovementActions.vsmProcessId,
    processName: vsmProcesses.name,
    sourceSnapshotId: vsmImprovementActions.sourceSnapshotId,
    title: vsmImprovementActions.title,
    description: vsmImprovementActions.description,
    ownerName: vsmImprovementActions.ownerName,
    dueDate: vsmImprovementActions.dueDate,
    status: vsmImprovementActions.status,
    createdBy: vsmImprovementActions.createdBy,
    completedAt: vsmImprovementActions.completedAt,
    createdAt: vsmImprovementActions.createdAt,
    updatedAt: vsmImprovementActions.updatedAt,
  }).from(vsmImprovementActions)
    .innerJoin(vsmProcesses, eq(vsmImprovementActions.vsmProcessId, vsmProcesses.id))
    .where(eq(vsmImprovementActions.vsmDiagramId, vsmDiagramId))
    .orderBy(asc(vsmImprovementActions.status), asc(vsmImprovementActions.dueDate), desc(vsmImprovementActions.createdAt));
}

export async function getVSMImprovementActionById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(vsmImprovementActions).where(eq(vsmImprovementActions.id, id));
  return rows[0] ?? null;
}

export async function createVSMImprovementAction(data: InsertVSMImprovementAction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vsmImprovementActions).values(data);
  const id = (result as any)[0]?.insertId as number;
  return getVSMImprovementActionById(id);
}

export async function updateVSMImprovementAction(id: number, data: Partial<InsertVSMImprovementAction>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vsmImprovementActions).set(data as any).where(eq(vsmImprovementActions.id, id));
  return getVSMImprovementActionById(id);
}

export async function deleteVSMImprovementAction(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmImprovementActions).where(eq(vsmImprovementActions.id, id));
}

export async function deleteVSMImprovementActionsByDiagram(vsmDiagramId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmImprovementActions).where(eq(vsmImprovementActions.vsmDiagramId, vsmDiagramId));
}

export async function deleteVSMImprovementActionsByProcess(vsmProcessId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.delete(vsmImprovementActions).where(eq(vsmImprovementActions.vsmProcessId, vsmProcessId));
}

// VSM 版本 - 恢復到特定版本
export async function restoreVSMVersion(versionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const version = await getVSMVersionById(versionId);
  if (!version) throw new Error("Version not found");
  
  // 取得圖表資訊
  const diagram = await getVSMDiagramById(version.vsmDiagramId);
  if (!diagram) throw new Error("Diagram not found");
  
  // 刪除現有工序和流線
  await deleteVSMProcessesByDiagram(version.vsmDiagramId);
  await deleteVSMFlowsByDiagram(version.vsmDiagramId);
  
  // 恢復工序
  const processesSnapshot = version.processesSnapshot as any[];
  if (Array.isArray(processesSnapshot)) {
    for (const process of processesSnapshot) {
      await createVSMProcess({
        vsmDiagramId: version.vsmDiagramId,
        name: process.name,
        type: process.type,
        cycleTime: process.cycleTime,
        manpower: process.manpower,
        valueAddedRate: process.valueAddedRate,
        positionX: process.positionX,
        positionY: process.positionY,
        width: process.width,
        height: process.height,
        notes: process.notes,
        workstationId: process.workstationId,
      });
    }
  }
  
  // 恢復流線
  const flowsSnapshot = version.flowsSnapshot as any[];
  if (Array.isArray(flowsSnapshot)) {
    for (const flow of flowsSnapshot) {
      await createVSMFlow({
        vsmDiagramId: version.vsmDiagramId,
        fromProcessId: flow.fromProcessId,
        toProcessId: flow.toProcessId,
        flowType: flow.flowType,
        cycleTime: flow.cycleTime,
        quantity: flow.quantity,
        notes: flow.notes,
      });
    }
  }
  
  return diagram;
}


// 取得快照名稱中日期最新的快照
export async function getAllLinesLatestSnapshotByDate() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 取得所有產線
  const lines = await db.select().from(productionLines).orderBy(asc(productionLines.id));
  if (lines.length === 0) return [];

  // 對每條產線取得所有快照，按名稱中的日期排序
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

      // 從快Snapshot名稱中提取日期並排序
      const snapshotsWithDate = snapshots
        .map((s) => {
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
