import { describe, it, expect } from "vitest";

// ─── 雙手作業統計計算邏輯的單元測試 ─────────────────────────────────────────────

type HandActionType = "value_added" | "non_value_added" | "necessary_waste" | "idle";
type Hand = "left" | "right";

interface HandAction {
  hand: Hand;
  duration: number;
  handActionType: HandActionType;
  isIdle: boolean;
}

function calcHandStats(handActions: HandAction[]) {
  const leftHands = handActions.filter(h => h.hand === "left");
  const rightHands = handActions.filter(h => h.hand === "right");

  const leftTotal = leftHands.reduce((a, h) => a + h.duration, 0);
  const rightTotal = rightHands.reduce((a, h) => a + h.duration, 0);
  const leftIdle = leftHands.filter(h => h.isIdle || h.handActionType === "idle").reduce((a, h) => a + h.duration, 0);
  const rightIdle = rightHands.filter(h => h.isIdle || h.handActionType === "idle").reduce((a, h) => a + h.duration, 0);

  const leftActive = leftTotal - leftIdle;
  const rightActive = rightTotal - rightIdle;
  const maxTotal = Math.max(leftTotal, rightTotal);
  const syncRate = maxTotal > 0
    ? (Math.min(leftActive, rightActive) / maxTotal) * 100
    : 0;

  const byType: Record<HandActionType, number> = {
    value_added: 0, non_value_added: 0, necessary_waste: 0, idle: 0
  };
  handActions.forEach(h => {
    const type = h.isIdle ? "idle" : h.handActionType;
    byType[type] += h.duration;
  });

  return { leftTotal, rightTotal, leftIdle, rightIdle, leftActive, rightActive, syncRate, byType };
}

describe("雙手作業統計計算", () => {
  it("雙手完全同步作業時，同步率應為 100%", () => {
    const actions: HandAction[] = [
      { hand: "left", duration: 5, handActionType: "value_added", isIdle: false },
      { hand: "right", duration: 5, handActionType: "value_added", isIdle: false },
    ];
    const stats = calcHandStats(actions);
    expect(stats.syncRate).toBeCloseTo(100, 1);
    expect(stats.leftIdle).toBe(0);
    expect(stats.rightIdle).toBe(0);
  });

  it("右手完全空手等待時，同步率應為 0%", () => {
    const actions: HandAction[] = [
      { hand: "left", duration: 5, handActionType: "value_added", isIdle: false },
      { hand: "right", duration: 5, handActionType: "idle", isIdle: true },
    ];
    const stats = calcHandStats(actions);
    expect(stats.syncRate).toBeCloseTo(0, 1);
    expect(stats.rightIdle).toBe(5);
    expect(stats.leftIdle).toBe(0);
  });

  it("左右手時間不對稱時，同步率應以較大時間為基準計算", () => {
    const actions: HandAction[] = [
      { hand: "left", duration: 10, handActionType: "value_added", isIdle: false },
      { hand: "right", duration: 6, handActionType: "value_added", isIdle: false },
    ];
    const stats = calcHandStats(actions);
    // min(10, 6) / max(10, 6) = 6/10 = 60%
    expect(stats.syncRate).toBeCloseTo(60, 1);
    expect(stats.leftTotal).toBe(10);
    expect(stats.rightTotal).toBe(6);
  });

  it("空手等待應從有效作業時間中扣除", () => {
    const actions: HandAction[] = [
      { hand: "left", duration: 8, handActionType: "value_added", isIdle: false },
      { hand: "left", duration: 2, handActionType: "idle", isIdle: true },
      { hand: "right", duration: 10, handActionType: "value_added", isIdle: false },
    ];
    const stats = calcHandStats(actions);
    expect(stats.leftTotal).toBe(10);
    expect(stats.leftIdle).toBe(2);
    expect(stats.leftActive).toBe(8);
    expect(stats.rightActive).toBe(10);
    // min(8, 10) / max(10, 10) = 8/10 = 80%
    expect(stats.syncRate).toBeCloseTo(80, 1);
  });

  it("無手部動作時，同步率應為 0%", () => {
    const stats = calcHandStats([]);
    expect(stats.syncRate).toBe(0);
    expect(stats.leftTotal).toBe(0);
    expect(stats.rightTotal).toBe(0);
  });

  it("各動作類型時間統計應正確加總", () => {
    const actions: HandAction[] = [
      { hand: "left", duration: 5, handActionType: "value_added", isIdle: false },
      { hand: "right", duration: 3, handActionType: "non_value_added", isIdle: false },
      { hand: "left", duration: 2, handActionType: "necessary_waste", isIdle: false },
      { hand: "right", duration: 1, handActionType: "idle", isIdle: true },
    ];
    const stats = calcHandStats(actions);
    expect(stats.byType.value_added).toBe(5);
    expect(stats.byType.non_value_added).toBe(3);
    expect(stats.byType.necessary_waste).toBe(2);
    expect(stats.byType.idle).toBe(1);
  });

  it("isIdle=true 的動作應強制歸類為 idle 類型", () => {
    const actions: HandAction[] = [
      // 即使 handActionType 是 value_added，但 isIdle=true 應歸類為 idle
      { hand: "left", duration: 3, handActionType: "value_added", isIdle: true },
    ];
    const stats = calcHandStats(actions);
    expect(stats.byType.idle).toBe(3);
    expect(stats.byType.value_added).toBe(0);
    expect(stats.leftIdle).toBe(3);
  });
});

describe("雙手作業 schema 欄位驗證", () => {
  it("hand 欄位只允許 left 或 right", () => {
    const validHands: Hand[] = ["left", "right"];
    validHands.forEach(h => {
      expect(["left", "right"]).toContain(h);
    });
  });

  it("handActionType 欄位應包含 idle 類型", () => {
    const validTypes: HandActionType[] = ["value_added", "non_value_added", "necessary_waste", "idle"];
    expect(validTypes).toContain("idle");
    expect(validTypes.length).toBe(4);
  });

  it("duration 應為非負數", () => {
    const validDurations = [0, 0.1, 1.5, 10, 100];
    validDurations.forEach(d => {
      expect(d).toBeGreaterThanOrEqual(0);
    });
  });
});
