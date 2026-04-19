import { describe, it, expect } from "vitest";

// ─── 生產線配置模擬 KPI 計算邏輯單元測試 ─────────────────────────────────────

type SimWorkstation = {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  sequenceOrder: number;
};

function calcKPI(workstations: SimWorkstation[], taktTime?: number) {
  if (!workstations.length) return null;
  const times = workstations.map(w => w.cycleTime);
  const totalTime = times.reduce((s, t) => s + t, 0);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = totalTime / times.length;
  const bottleneck = workstations.find(w => w.cycleTime === maxTime);
  const balanceRate = (totalTime / (maxTime * workstations.length)) * 100;
  const balanceLoss = 100 - balanceRate;
  const totalManpower = workstations.reduce((s, w) => s + w.manpower, 0);
  const upph = totalManpower > 0 && maxTime > 0 ? 3600 / maxTime / totalManpower : 0;
  const taktStats = taktTime ? {
    passCount: workstations.filter(w => w.cycleTime <= taktTime).length,
    exceedCount: workstations.filter(w => w.cycleTime > taktTime).length,
    passRate: (workstations.filter(w => w.cycleTime <= taktTime).length / workstations.length) * 100,
  } : null;
  const capacity = maxTime > 0 ? 3600 / maxTime : 0;
  return { totalTime, maxTime, minTime, avgTime, bottleneck, balanceRate, balanceLoss, totalManpower, upph, taktStats, capacity };
}

function mergeWorkstations(ws1: SimWorkstation, ws2: SimWorkstation): SimWorkstation {
  return {
    id: ws1.id,
    name: `${ws1.name}+${ws2.name}`,
    cycleTime: parseFloat((ws1.cycleTime + ws2.cycleTime).toFixed(2)),
    manpower: parseFloat((ws1.manpower + ws2.manpower).toFixed(1)),
    sequenceOrder: ws1.sequenceOrder,
  };
}

function splitWorkstation(ws: SimWorkstation, ratio: number): [SimWorkstation, SimWorkstation] {
  const ct1 = parseFloat((ws.cycleTime * ratio).toFixed(2));
  const ct2 = parseFloat((ws.cycleTime * (1 - ratio)).toFixed(2));
  const mp1 = Math.max(0.5, parseFloat((ws.manpower * ratio).toFixed(1)));
  const mp2 = Math.max(0.5, parseFloat((ws.manpower * (1 - ratio)).toFixed(1)));
  return [
    { id: ws.id, name: `${ws.name}-A`, cycleTime: ct1, manpower: mp1, sequenceOrder: ws.sequenceOrder },
    { id: -(Date.now()), name: `${ws.name}-B`, cycleTime: ct2, manpower: mp2, sequenceOrder: ws.sequenceOrder + 1 },
  ];
}

// ─── 測試套件 ──────────────────────────────────────────────────────────────────

describe("配置模擬 KPI 計算", () => {
  const sampleWs: SimWorkstation[] = [
    { id: 1, name: "ST-01", cycleTime: 30, manpower: 1, sequenceOrder: 0 },
    { id: 2, name: "ST-02", cycleTime: 50, manpower: 2, sequenceOrder: 1 },
    { id: 3, name: "ST-03", cycleTime: 40, manpower: 1, sequenceOrder: 2 },
  ];

  it("空工站列表應回傳 null", () => {
    expect(calcKPI([])).toBeNull();
  });

  it("正確計算平衡率", () => {
    const kpi = calcKPI(sampleWs)!;
    // totalTime = 120, maxTime = 50, workstationCount = 3
    // balanceRate = 120 / (50 * 3) * 100 = 80%
    expect(kpi.balanceRate).toBeCloseTo(80, 1);
  });

  it("正確識別瓶頸工站", () => {
    const kpi = calcKPI(sampleWs)!;
    expect(kpi.bottleneck?.name).toBe("ST-02");
    expect(kpi.maxTime).toBe(50);
  });

  it("正確計算 UPPH（每人每小時產能）", () => {
    const kpi = calcKPI(sampleWs)!;
    // UPPH = 3600 / 50 / 4 = 18
    expect(kpi.upph).toBeCloseTo(18, 1);
  });

  it("正確計算預估產能（件/時）", () => {
    const kpi = calcKPI(sampleWs)!;
    // capacity = 3600 / 50 = 72
    expect(kpi.capacity).toBeCloseTo(72, 1);
  });

  it("Takt Time 達標率計算正確", () => {
    const kpi = calcKPI(sampleWs, 45)!;
    // ST-01(30) ✓, ST-02(50) ✗, ST-03(40) ✓ → passRate = 2/3 ≈ 66.7%
    expect(kpi.taktStats?.passCount).toBe(2);
    expect(kpi.taktStats?.exceedCount).toBe(1);
    expect(kpi.taktStats?.passRate).toBeCloseTo(66.7, 1);
  });

  it("未設定 Takt Time 時 taktStats 應為 null", () => {
    const kpi = calcKPI(sampleWs)!;
    expect(kpi.taktStats).toBeNull();
  });

  it("單工站時平衡率應為 100%", () => {
    const single: SimWorkstation[] = [{ id: 1, name: "ST-01", cycleTime: 30, manpower: 1, sequenceOrder: 0 }];
    const kpi = calcKPI(single)!;
    expect(kpi.balanceRate).toBeCloseTo(100, 1);
  });

  it("支援小數人力（0.5 人）計算 UPPH", () => {
    const ws: SimWorkstation[] = [
      { id: 1, name: "ST-01", cycleTime: 30, manpower: 0.5, sequenceOrder: 0 },
      { id: 2, name: "ST-02", cycleTime: 30, manpower: 0.5, sequenceOrder: 1 },
    ];
    const kpi = calcKPI(ws)!;
    // totalManpower = 1, UPPH = 3600 / 30 / 1 = 120
    expect(kpi.totalManpower).toBe(1);
    expect(kpi.upph).toBeCloseTo(120, 1);
  });
});

describe("工站合併功能", () => {
  it("合併兩工站後 CT 為加總", () => {
    const ws1: SimWorkstation = { id: 1, name: "ST-01", cycleTime: 30, manpower: 1, sequenceOrder: 0 };
    const ws2: SimWorkstation = { id: 2, name: "ST-02", cycleTime: 20, manpower: 1, sequenceOrder: 1 };
    const merged = mergeWorkstations(ws1, ws2);
    expect(merged.cycleTime).toBe(50);
    expect(merged.manpower).toBe(2);
    expect(merged.name).toBe("ST-01+ST-02");
  });

  it("合併後保留第一站的 id 和 sequenceOrder", () => {
    const ws1: SimWorkstation = { id: 5, name: "A", cycleTime: 10, manpower: 1, sequenceOrder: 2 };
    const ws2: SimWorkstation = { id: 6, name: "B", cycleTime: 15, manpower: 1, sequenceOrder: 3 };
    const merged = mergeWorkstations(ws1, ws2);
    expect(merged.id).toBe(5);
    expect(merged.sequenceOrder).toBe(2);
  });
});

describe("工站拆分功能", () => {
  it("50/50 拆分時兩站 CT 各半", () => {
    const ws: SimWorkstation = { id: 1, name: "ST-01", cycleTime: 40, manpower: 2, sequenceOrder: 0 };
    const [ws1, ws2] = splitWorkstation(ws, 0.5);
    expect(ws1.cycleTime).toBeCloseTo(20, 2);
    expect(ws2.cycleTime).toBeCloseTo(20, 2);
  });

  it("70/30 拆分時 CT 正確分配", () => {
    const ws: SimWorkstation = { id: 1, name: "ST-01", cycleTime: 100, manpower: 2, sequenceOrder: 0 };
    const [ws1, ws2] = splitWorkstation(ws, 0.7);
    expect(ws1.cycleTime).toBeCloseTo(70, 1);
    expect(ws2.cycleTime).toBeCloseTo(30, 1);
  });

  it("拆分後人力不低於 0.5 人", () => {
    const ws: SimWorkstation = { id: 1, name: "ST-01", cycleTime: 10, manpower: 0.5, sequenceOrder: 0 };
    const [ws1, ws2] = splitWorkstation(ws, 0.5);
    expect(ws1.manpower).toBeGreaterThanOrEqual(0.5);
    expect(ws2.manpower).toBeGreaterThanOrEqual(0.5);
  });

  it("拆分後名稱加上 -A/-B 後綴", () => {
    const ws: SimWorkstation = { id: 1, name: "組裝站", cycleTime: 30, manpower: 1, sequenceOrder: 0 };
    const [ws1, ws2] = splitWorkstation(ws, 0.5);
    expect(ws1.name).toBe("組裝站-A");
    expect(ws2.name).toBe("組裝站-B");
  });
});

describe("情境比較差異計算", () => {
  it("計算兩情境 KPI 差異（平衡率改善）", () => {
    const baseWs: SimWorkstation[] = [
      { id: 1, name: "ST-01", cycleTime: 30, manpower: 1, sequenceOrder: 0 },
      { id: 2, name: "ST-02", cycleTime: 60, manpower: 1, sequenceOrder: 1 },
    ];
    const simWs: SimWorkstation[] = [
      { id: 1, name: "ST-01", cycleTime: 40, manpower: 1, sequenceOrder: 0 },
      { id: 2, name: "ST-02", cycleTime: 50, manpower: 1, sequenceOrder: 1 },
    ];
    const baseKpi = calcKPI(baseWs)!;
    const simKpi = calcKPI(simWs)!;
    // base: 90/(60*2)*100 = 75%, sim: 90/(50*2)*100 = 90%
    expect(simKpi.balanceRate).toBeGreaterThan(baseKpi.balanceRate);
    expect(simKpi.balanceRate).toBeCloseTo(90, 1);
  });

  it("套用變更清單：正確識別新增/更新/移除工站", () => {
    const lineWs: SimWorkstation[] = [
      { id: 1, name: "ST-01", cycleTime: 30, manpower: 1, sequenceOrder: 0 },
      { id: 2, name: "ST-02", cycleTime: 40, manpower: 1, sequenceOrder: 1 },
      { id: 3, name: "ST-03", cycleTime: 20, manpower: 1, sequenceOrder: 2 },
    ];
    const simWs: SimWorkstation[] = [
      { id: 1, name: "ST-01", cycleTime: 35, manpower: 1, sequenceOrder: 0 }, // 更新 CT
      { id: 2, name: "ST-02", cycleTime: 40, manpower: 1, sequenceOrder: 1 }, // 無變更
      { id: -1, name: "ST-NEW", cycleTime: 25, manpower: 1, sequenceOrder: 2 }, // 新增
      // ST-03 被移除
    ];

    const changes: Array<{ type: string; name: string }> = [];
    for (const sw of simWs) {
      if (sw.id > 0) {
        const existing = lineWs.find(w => w.id === sw.id);
        if (existing) {
          if (Math.abs(existing.cycleTime - sw.cycleTime) > 0.01 ||
              Math.abs(existing.manpower - sw.manpower) > 0.01 ||
              existing.name !== sw.name) {
            changes.push({ type: "update", name: sw.name });
          }
        } else {
          changes.push({ type: "add", name: sw.name });
        }
      } else {
        changes.push({ type: "add", name: sw.name });
      }
    }
    const simIds = new Set(simWs.filter(w => w.id > 0).map(w => w.id));
    for (const ew of lineWs) {
      if (!simIds.has(ew.id)) {
        changes.push({ type: "remove", name: ew.name });
      }
    }

    expect(changes.filter(c => c.type === "update").length).toBe(1);
    expect(changes.filter(c => c.type === "add").length).toBe(1);
    expect(changes.filter(c => c.type === "remove").length).toBe(1);
    expect(changes.find(c => c.type === "update")?.name).toBe("ST-01");
    expect(changes.find(c => c.type === "add")?.name).toBe("ST-NEW");
    expect(changes.find(c => c.type === "remove")?.name).toBe("ST-03");
  });
});

// ─── FloorPlanSimulator 距離計算邏輯測試 ─────────────────────────────────────
// 複製前端 pixelDist 邏輯（bounding-box 邊緣距離）進行驗證

type FloorWsLite = { x: number; y: number; width: number; height: number };

function pixelDistTest(a: FloorWsLite, b: FloorWsLite): number {
  const aRight = a.x + a.width;  const aBottom = a.y + a.height;
  const bRight = b.x + b.width;  const bBottom = b.y + b.height;
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(aRight, bRight));
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(aBottom, bBottom));
  return Math.sqrt(gapX * gapX + gapY * gapY);
}

describe("FloorPlanSimulator 距離計算（bounding-box 邊緣距離）", () => {
  const WS_W = 140;
  const WS_H = 80;
  const GRID = 20;
  const SCALE = 40; // 40px = 1m，每格 20px = 0.5m

  it("相鄰工站（緊靠）距離應為 0px", () => {
    const a: FloorWsLite = { x: 0, y: 0, width: WS_W, height: WS_H };
    const b: FloorWsLite = { x: WS_W, y: 0, width: WS_W, height: WS_H };
    expect(pixelDistTest(a, b)).toBe(0);
  });

  it("水平間隔一格（20px）應為 20px = 0.5m", () => {
    const a: FloorWsLite = { x: 0, y: 0, width: WS_W, height: WS_H };
    const b: FloorWsLite = { x: WS_W + GRID, y: 0, width: WS_W, height: WS_H };
    expect(pixelDistTest(a, b)).toBe(GRID);
    expect(pixelDistTest(a, b) / SCALE).toBeCloseTo(0.5);
  });

  it("水平間隔兩格（40px）應為 40px = 1.0m", () => {
    const a: FloorWsLite = { x: 0, y: 0, width: WS_W, height: WS_H };
    const b: FloorWsLite = { x: WS_W + GRID * 2, y: 0, width: WS_W, height: WS_H };
    expect(pixelDistTest(a, b)).toBe(GRID * 2);
    expect(pixelDistTest(a, b) / SCALE).toBeCloseTo(1.0);
  });

  it("垂直間隔一格（20px）應為 20px = 0.5m", () => {
    const a: FloorWsLite = { x: 0, y: 0, width: WS_W, height: WS_H };
    const b: FloorWsLite = { x: 0, y: WS_H + GRID, width: WS_W, height: WS_H };
    expect(pixelDistTest(a, b)).toBe(GRID);
    expect(pixelDistTest(a, b) / SCALE).toBeCloseTo(0.5);
  });

  it("垂直相鄰（緊靠）距離應為 0px", () => {
    const a: FloorWsLite = { x: 0, y: 0, width: WS_W, height: WS_H };
    const b: FloorWsLite = { x: 0, y: WS_H, width: WS_W, height: WS_H };
    expect(pixelDistTest(a, b)).toBe(0);
  });

  it("對角間隔一格（gapX=20, gapY=20）應為 sqrt(800) ≈ 28.28px", () => {
    const a: FloorWsLite = { x: 0, y: 0, width: WS_W, height: WS_H };
    const b: FloorWsLite = { x: WS_W + GRID, y: WS_H + GRID, width: WS_W, height: WS_H };
    expect(pixelDistTest(a, b)).toBeCloseTo(Math.sqrt(GRID * GRID + GRID * GRID), 5);
  });

  it("重疊工站距離應為 0px", () => {
    const a: FloorWsLite = { x: 0, y: 0, width: WS_W, height: WS_H };
    const b: FloorWsLite = { x: 10, y: 10, width: WS_W, height: WS_H };
    expect(pixelDistTest(a, b)).toBe(0);
  });
});

// ─── 輸送帶側邊吸附點與自動連線計算測試 ──────────────────────────────────────

describe("輸送帶側邊吸附點距離計算", () => {
  const SCALE = 40; // 40px = 1m

  // 模擬 computeConnMetrics 的核心邏輯（有 fromPt/toPt 時用直線距離）
  function computeConnMetricsTest(
    conn: { fromPt?: { x: number; y: number }; toPt?: { x: number; y: number }; speed: number },
    scalePxPerM: number
  ): { distance: number; transportTime: number } {
    if (scalePxPerM <= 0) return { distance: 0, transportTime: 0 };
    if (!conn.fromPt || !conn.toPt) return { distance: 0, transportTime: 0 };
    const distPx = Math.hypot(conn.toPt.x - conn.fromPt.x, conn.toPt.y - conn.fromPt.y);
    const dist = distPx / scalePxPerM;
    const time = conn.speed > 0 ? (dist / conn.speed) * 60 : 0;
    return { distance: parseFloat(dist.toFixed(2)), transportTime: parseFloat(time.toFixed(2)) };
  }

  it("水平輸送帶（兩端吸附點距離 80px）應為 2.0m", () => {
    const conn = {
      fromPt: { x: 100, y: 200 },
      toPt:   { x: 180, y: 200 },
      speed: 20,
    };
    const metrics = computeConnMetricsTest(conn, SCALE);
    expect(metrics.distance).toBeCloseTo(2.0, 1);
  });

  it("垂直輸送帶（兩端吸附點距離 40px）應為 1.0m", () => {
    const conn = {
      fromPt: { x: 100, y: 100 },
      toPt:   { x: 100, y: 140 },
      speed: 20,
    };
    const metrics = computeConnMetricsTest(conn, SCALE);
    expect(metrics.distance).toBeCloseTo(1.0, 1);
  });

  it("斜向輸送帶（gapX=40, gapY=40）距離應為 sqrt(3200)/40 ≈ 1.41m", () => {
    const conn = {
      fromPt: { x: 100, y: 100 },
      toPt:   { x: 140, y: 140 },
      speed: 20,
    };
    const metrics = computeConnMetricsTest(conn, SCALE);
    expect(metrics.distance).toBeCloseTo(Math.sqrt(40 * 40 + 40 * 40) / SCALE, 2);
  });

  it("搬運時間計算：2m ÷ 20 m/min = 6s", () => {
    const conn = {
      fromPt: { x: 0,  y: 0 },
      toPt:   { x: 80, y: 0 },  // 80px / 40px/m = 2m
      speed: 20,
    };
    const metrics = computeConnMetricsTest(conn, SCALE);
    expect(metrics.distance).toBeCloseTo(2.0, 1);
    expect(metrics.transportTime).toBeCloseTo(6.0, 1);
  });

  it("搬運時間計算：1m ÷ 60 m/min = 1s", () => {
    const conn = {
      fromPt: { x: 0,  y: 0 },
      toPt:   { x: 40, y: 0 },  // 40px / 40px/m = 1m
      speed: 60,
    };
    const metrics = computeConnMetricsTest(conn, SCALE);
    expect(metrics.distance).toBeCloseTo(1.0, 1);
    expect(metrics.transportTime).toBeCloseTo(1.0, 1);
  });

  it("速度為 0 時搬運時間應為 0", () => {
    const conn = {
      fromPt: { x: 0,  y: 0 },
      toPt:   { x: 80, y: 0 },
      speed: 0,
    };
    const metrics = computeConnMetricsTest(conn, SCALE);
    expect(metrics.transportTime).toBe(0);
  });
});
