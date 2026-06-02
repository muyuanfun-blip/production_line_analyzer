import * as db from "./db";
import type { Workstation } from "../drizzle/schema";

/**
 * 工站狀態等級
 */
export enum WorkstationStatus {
  NORMAL = "normal",      // 正常
  WARNING = "warning",    // 預警
  CRITICAL = "critical",  // 異常
  OFFLINE = "offline",    // 停機
  IDLE = "idle",          // 離線
}

/**
 * 實時工站狀態
 */
export interface RealtimeWorkstation {
  id: number;
  name: string;
  cycleTime: number;      // 當前週期時間（秒）
  targetCycleTime: number; // 目標週期時間
  manpower: number;
  status: WorkstationStatus;
  efficiency: number;     // 效率百分比 (0-100)
  utilization: number;    // 利用率百分比 (0-100)
  currentProduct?: string; // 當前加工產品序號
  waitingProducts: number; // 等待中的產品數
}

/**
 * 實時產線狀態
 */
export interface RealtimeLineStatus {
  lineId: number;
  lineName: string;
  timestamp: Date;
  workstations: RealtimeWorkstation[];
  balanceRate: number;    // 平衡率 (0-100)
  upph: number;           // 每小時產能
  taktAchievement: number; // Takt 達標率 (0-100)
  productionTarget: number; // 日產能目標
  productionActual: number; // 日產能實績
  bottleneckWsId: number; // 瓶頸工站 ID
  anomalies: Anomaly[];   // 異常列表
}

/**
 * 異常警示
 */
export interface Anomaly {
  id: string;
  wsId: number;
  wsName: string;
  level: "info" | "warning" | "critical";
  message: string;
  timestamp: Date;
  suggestedAction?: string;
}

/**
 * 歷史趨勢資料
 */
export interface HistoricalTrend {
  timestamp: Date;
  balanceRate: number;
  upph: number;
  taktAchievement: number;
  productionActual: number;
}

/**
 * 產品流程記錄（用於甘特圖）
 */
export interface ProductFlowRecord {
  productId: string;
  wsId: number;
  wsName: string;
  startTime: Date;
  endTime?: Date;
  cycleTime: number;
  status: "in_progress" | "completed" | "waiting";
}

/**
 * 生成模擬的實時工站狀態
 * 模擬 CT 波動、異常工站、產品流轉
 */
export function generateRealtimeWorkstations(
  workstations: Workstation[],
  targetCycleTime: number,
  seed: number = Date.now()
): RealtimeWorkstation[] {
  const random = seededRandom(seed);

  return workstations.map((ws) => {
    // 模擬 CT 波動（±20%）
    const variation = 0.8 + random() * 0.4;
    const baseCT = typeof ws.cycleTime === 'string' ? parseFloat(ws.cycleTime) : ws.cycleTime;
    const cycleTime = baseCT * variation;

    // 計算效率
    const efficiency = Math.min(100, (baseCT / cycleTime) * 100);

    // 計算利用率（基於人力配置）
    const baseManpower = typeof ws.manpower === 'string' ? parseFloat(ws.manpower) : ws.manpower;
    const utilization = Math.min(100, (cycleTime / (baseCT * baseManpower)) * 100);

    // 隨機決定工站狀態
    const statusRandom = random();
    let status: WorkstationStatus;
    if (statusRandom < 0.7) {
      status = WorkstationStatus.NORMAL;
    } else if (statusRandom < 0.85) {
      status = WorkstationStatus.WARNING;
    } else if (statusRandom < 0.95) {
      status = WorkstationStatus.CRITICAL;
    } else {
      status = WorkstationStatus.OFFLINE;
    }

    // 隨機產品序號
    const currentProduct = random() > 0.3 ? `P${Math.floor(random() * 10000)}` : undefined;

    return {
      id: ws.id,
      name: ws.name,
      cycleTime,
      targetCycleTime: baseCT,
      manpower: baseManpower,
      status,
      efficiency,
      utilization,
      currentProduct,
      waitingProducts: Math.floor(random() * 5),
    };
  });
}

/**
 * 計算實時產線 KPI
 */
export function calculateLineKPI(
  workstations: RealtimeWorkstation[],
  targetCycleTime: number,
  productionTarget: number = 100
): {
  balanceRate: number;
  upph: number;
  taktAchievement: number;
  bottleneckWsId: number;
} {
  if (workstations.length === 0) {
    return { balanceRate: 0, upph: 0, taktAchievement: 0, bottleneckWsId: 0 };
  }

  // 找瓶頸工站（最長 CT）
  const maxCT = Math.max(...workstations.map((ws) => ws.cycleTime));
  const bottleneckWs = workstations.find((ws) => ws.cycleTime === maxCT);
  const bottleneckWsId = bottleneckWs?.id || 0;

  // 計算平衡率 = 平均 CT / 最大 CT
  const avgCT = workstations.reduce((sum, ws) => sum + ws.cycleTime, 0) / workstations.length;
  const balanceRate = Math.round((avgCT / (maxCT || 1)) * 100);

  // 計算 UPPH = 3600 / maxCT / totalManpower
  const totalManpower = workstations.reduce((sum, ws) => sum + ws.manpower, 0);
  const upph = Math.round(3600 / maxCT / totalManpower);

  // 計算 Takt 達標率
  const taktAchievingWs = workstations.filter((ws) => ws.cycleTime <= targetCycleTime).length;
  const taktAchievement = Math.round((taktAchievingWs / workstations.length) * 100);

  return { balanceRate, upph, taktAchievement, bottleneckWsId };
}

/**
 * 生成異常警示
 */
export function generateAnomalies(workstations: RealtimeWorkstation[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  let anomalyId = 0;

  workstations.forEach((ws) => {
    if (ws.status === WorkstationStatus.CRITICAL) {
      anomalies.push({
        id: `anomaly_${anomalyId++}`,
        wsId: ws.id,
        wsName: ws.name,
        level: "critical",
        message: `${ws.name} 工序時間超標 ${Math.round(ws.cycleTime - ws.targetCycleTime)}秒，為瓶頸工站`,
        timestamp: new Date(),
        suggestedAction: `檢查 ${ws.name} 的人力配置或設備狀態，考慮增加人力或優化流程`,
      });
    } else if (ws.status === WorkstationStatus.WARNING) {
      anomalies.push({
        id: `anomaly_${anomalyId++}`,
        wsId: ws.id,
        wsName: ws.name,
        level: "warning",
        message: `${ws.name} 工序時間接近目標，效率 ${Math.round(ws.efficiency)}%`,
        timestamp: new Date(),
        suggestedAction: `監控 ${ws.name} 的運行狀態，準備應對措施`,
      });
    } else if (ws.status === WorkstationStatus.OFFLINE) {
      anomalies.push({
        id: `anomaly_${anomalyId++}`,
        wsId: ws.id,
        wsName: ws.name,
        level: "critical",
        message: `${ws.name} 工序離線，無法加工產品`,
        timestamp: new Date(),
        suggestedAction: `立即檢查 ${ws.name} 的設備狀態和人力配置`,
      });
    }

    if (ws.waitingProducts > 3) {
      anomalies.push({
        id: `anomaly_${anomalyId++}`,
        wsId: ws.id,
        wsName: ws.name,
        level: "warning",
        message: `${ws.name} 等待產品數 ${ws.waitingProducts}，可能存在卡料`,
        timestamp: new Date(),
        suggestedAction: `檢查 ${ws.name} 的上游工站是否有延遲`,
      });
    }
  });

  return anomalies;
}

/**
 * 生成歷史趨勢資料（模擬過去 24 小時）
 */
export function generateHistoricalTrend(
  workstations: RealtimeWorkstation[],
  targetCycleTime: number,
  productionTarget: number = 100
): HistoricalTrend[] {
  const trends: HistoricalTrend[] = [];
  const now = new Date();

  for (let i = 23; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    const seed = timestamp.getTime();

    // 生成該時刻的工站狀態
    const wsAtTime = generateRealtimeWorkstations(
      workstations.map((ws) => ({
        ...ws,
        cycleTime: ws.targetCycleTime,
      })) as unknown as Workstation[],
      targetCycleTime,
      seed
    );

    const kpi = calculateLineKPI(wsAtTime, targetCycleTime, productionTarget);

    trends.push({
      timestamp,
      balanceRate: kpi.balanceRate,
      upph: kpi.upph,
      taktAchievement: kpi.taktAchievement,
      productionActual: Math.round(productionTarget * (0.7 + Math.random() * 0.3)),
    });
  }

  return trends;
}

/**
 * 生成產品流程記錄（用於甘特圖）
 */
export function generateProductFlowRecords(
  workstations: RealtimeWorkstation[],
  productCount: number = 10
): ProductFlowRecord[] {
  const records: ProductFlowRecord[] = [];
  const now = new Date();

  for (let p = 0; p < productCount; p++) {
    const productId = `P${String(Math.floor(Math.random() * 10000)).padStart(5, "0")}`;
    let currentTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 小時前開始

    (workstations as unknown as RealtimeWorkstation[]).forEach((ws, index) => {
      const cycleTime = ws.cycleTime * 1000; // 轉換為毫秒
      const endTime = new Date(currentTime.getTime() + cycleTime);

      // 決定產品狀態
      let status: "in_progress" | "completed" | "waiting" = "completed";
      if (index === workstations.length - 1) {
        status = "in_progress"; // 最後一個工站在加工中
      } else if (Math.random() > 0.8) {
        status = "waiting"; // 10% 概率等待
      }

      records.push({
        productId,
        wsId: ws.id,
        wsName: ws.name,
        startTime: currentTime,
        endTime: status === "completed" ? endTime : undefined,
        cycleTime: ws.cycleTime,
        status,
      });

      currentTime = new Date(endTime.getTime() + 5000); // 加 5 秒等待時間
    });
  }

  return records;
}

/**
 * 種子隨機數生成器（用於可重現的隨機數）
 */
function seededRandom(seed: number): () => number {
  return function () {
    seed = ((seed * 9301 + 49297) % 233280);
    return seed / 233280;
  };
}

/**
 * 生成完整的實時產線狀態
 */
export async function generateRealtimeLineStatus(
  lineId: number,
  lineName: string,
  targetCycleTime: number,
  productionTarget: number = 100
): Promise<RealtimeLineStatus> {
  // 從資料庫取得工站列表
  const workstations = await db.getWorkstationsByLine(lineId);

  if (workstations.length === 0) {
    return {
      lineId,
      lineName,
      timestamp: new Date(),
      workstations: [],
      balanceRate: 0,
      upph: 0,
      taktAchievement: 0,
      productionTarget,
      productionActual: 0,
      bottleneckWsId: 0,
      anomalies: [],
    };
  }

  // 轉換工站資料格式
  const wsForGeneration = workstations.map((ws: any) => ({
    ...ws,
    cycleTime: typeof ws.cycleTime === 'string' ? parseFloat(ws.cycleTime) : ws.cycleTime,
    manpower: typeof ws.manpower === 'string' ? parseFloat(ws.manpower) : ws.manpower,
  }));

  // 生成實時工站狀態
  const realtimeWs = generateRealtimeWorkstations(
    wsForGeneration as unknown as Workstation[],
    targetCycleTime,
    Date.now()
  );

  // 計算 KPI
  const kpi = calculateLineKPI(realtimeWs, targetCycleTime, productionTarget);

  // 生成異常警示
  const anomalies = generateAnomalies(realtimeWs);

  // 計算日產能實績
  const productionActual = Math.round(productionTarget * (0.7 + Math.random() * 0.3));

  return {
    lineId,
    lineName,
    timestamp: new Date(),
    workstations: realtimeWs,
    balanceRate: kpi.balanceRate,
    upph: kpi.upph,
    taktAchievement: kpi.taktAchievement,
    productionTarget,
    productionActual,
    bottleneckWsId: kpi.bottleneckWsId,
    anomalies,
  };
}
