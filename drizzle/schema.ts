import {
  int,
  tinyint,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 生產線資料表
export const productionLines = mysqlTable("production_lines", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  targetCycleTime: decimal("targetCycleTime", { precision: 10, scale: 2 }), // 目標節拍時間（秒）
  status: mysqlEnum("status", ["active", "inactive", "archived"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProductionLine = typeof productionLines.$inferSelect;
export type InsertProductionLine = typeof productionLines.$inferInsert;

// 工站資料表
export const workstations = mysqlTable("workstations", {
  id: int("id").autoincrement().primaryKey(),
  productionLineId: int("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sequenceOrder: int("sequenceOrder").notNull().default(0), // 工站順序
  cycleTime: decimal("cycleTime", { precision: 10, scale: 2 }).notNull(), // 工序時間（秒）
  manpower: decimal("manpower", { precision: 5, scale: 1 }).notNull().default("1.0"), // 人員配置（支援小數，如 0.5）
  description: text("description"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workstation = typeof workstations.$inferSelect;
export type InsertWorkstation = typeof workstations.$inferInsert;

// 動作步驟資料表
export const actionSteps = mysqlTable("action_steps", {
  id: int("id").autoincrement().primaryKey(),
  workstationId: int("workstationId").notNull(),
  stepName: varchar("stepName", { length: 255 }).notNull(),
  stepOrder: int("stepOrder").notNull().default(0),
  duration: decimal("duration", { precision: 10, scale: 2 }).notNull(), // 步驟時間（秒）
  actionType: mysqlEnum("actionType", [
    "value_added",    // 增值動作
    "non_value_added", // 非增值動作
    "necessary_waste", // 必要浪費
  ]).default("value_added").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActionStep = typeof actionSteps.$inferSelect;
export type InsertActionStep = typeof actionSteps.$inferInsert;

// 雙手作業子表（方案 B）
export const handActions = mysqlTable("hand_actions", {
  id: int("id").autoincrement().primaryKey(),
  actionStepId: int("actionStepId").notNull(),   // 對應 action_steps.id
  hand: mysqlEnum("hand", ["left", "right"]).notNull(), // 左手 / 右手
  actionName: varchar("actionName", { length: 255 }).notNull(), // 動作描述
  duration: decimal("duration", { precision: 10, scale: 2 }).notNull(), // 該手動作時間（秒）
  handActionType: mysqlEnum("handActionType", [
    "value_added",     // 增值
    "non_value_added", // 非增值
    "necessary_waste", // 必要浪費
    "idle",            // 空手等待
  ]).default("value_added").notNull(),
  isIdle: int("isIdle").notNull().default(0),  // 1 = 空手等待（快速標記）
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type HandAction = typeof handActions.$inferSelect;
export type InsertHandAction = typeof handActions.$inferInsert;

// 分析快照資料表
export const analysisSnapshots = mysqlTable("analysis_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  productionLineId: int("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),           // 快照名稱
  note: text("note"),                                          // 備註
  // 平衡指標
  balanceRate: decimal("balanceRate", { precision: 6, scale: 2 }).notNull(),
  balanceLoss: decimal("balanceLoss", { precision: 6, scale: 2 }).notNull(),
  totalTime: decimal("totalTime", { precision: 10, scale: 2 }).notNull(),
  maxTime: decimal("maxTime", { precision: 10, scale: 2 }).notNull(),
  minTime: decimal("minTime", { precision: 10, scale: 2 }).notNull(),
  avgTime: decimal("avgTime", { precision: 10, scale: 2 }).notNull(),
  workstationCount: int("workstationCount").notNull(),
  totalManpower: int("totalManpower").notNull(),
  // Takt Time 相關
  taktTime: decimal("taktTime", { precision: 10, scale: 2 }),
  taktPassRate: decimal("taktPassRate", { precision: 6, scale: 2 }),
  taktPassCount: int("taktPassCount"),
  // UPPH （Units Per Person Per Hour）
  upph: decimal("upph", { precision: 10, scale: 4 }),
  // 工站快照（JSON）
  workstationsData: json("workstationsData").notNull(),
  bottleneckName: varchar("bottleneckName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalysisSnapshot = typeof analysisSnapshots.$inferSelect;
export type InsertAnalysisSnapshot = typeof analysisSnapshots.$inferInsert;

// 配置模擬情境資料表
export const simulationScenarios = mysqlTable("simulation_scenarios", {
  id: int("id").autoincrement().primaryKey(),
  productionLineId: int("productionLineId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  baseSnapshotId: int("baseSnapshotId"),          // 基準快照（可選）
  workstationsData: json("workstationsData").notNull(), // 模擬工站數據（與快照格式相同）
  notes: text("notes"),
  createdBy: int("createdBy"),                     // 建立者 userId
  // DXF 底圖相關欄位
  backgroundSvg: text("backgroundSvg"),           // 解析後的 SVG 字串（底圖向量）
  backgroundLayers: json("backgroundLayers"),     // 圖層設定 [{ name, visible, color }]
  backgroundOpacity: decimal("backgroundOpacity", { precision: 4, scale: 2 }).default("0.35"), // 底圖透明度（0–1）
  backgroundOffsetX: decimal("backgroundOffsetX", { precision: 10, scale: 2 }).default("0"),  // 底圖 X 偏移（px）
  backgroundOffsetY: decimal("backgroundOffsetY", { precision: 10, scale: 2 }).default("0"),  // 底圖 Y 偏移（px）
  backgroundScale: decimal("backgroundScale", { precision: 10, scale: 4 }).default("1.0000"), // 底圖縮放比例
  backgroundFileName: varchar("backgroundFileName", { length: 255 }), // 原始 DXF 檔名
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SimulationScenario = typeof simulationScenarios.$inferSelect;
export type InsertSimulationScenario = typeof simulationScenarios.$inferInsert;

// 產品型號資料表
export const productModels = mysqlTable("product_models", {
  id: int("id").autoincrement().primaryKey(),
  productionLineId: int("productionLineId").notNull(),
  modelCode: varchar("modelCode", { length: 64 }).notNull(),
  modelName: varchar("modelName", { length: 255 }).notNull(),
  targetCycleTime: decimal("targetCycleTime", { precision: 10, scale: 2 }),
  batchSize: int("batchSize").default(1),
  description: text("description"),
  isActive: tinyint("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ProductModel = typeof productModels.$inferSelect;
export type InsertProductModel = typeof productModels.$inferInsert;
