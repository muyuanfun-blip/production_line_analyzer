import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
    const ctx: TrpcContext = {
      ...createContext(),
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("Balance Analysis Calculation", () => {
  it("calculates balance rate correctly", () => {
    // Balance Rate = Sum(CT) / (Max(CT) × N) × 100%
    const cycleTimes = [45, 60, 38, 52, 41];
    const totalTime = cycleTimes.reduce((s, t) => s + t, 0); // 236
    const maxTime = Math.max(...cycleTimes); // 60
    const n = cycleTimes.length; // 5
    const balanceRate = (totalTime / (maxTime * n)) * 100;

    expect(totalTime).toBe(236);
    expect(maxTime).toBe(60);
    expect(balanceRate).toBeCloseTo(78.67, 1);
  });

  it("identifies bottleneck station", () => {
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 },
      { name: "站C", cycleTime: 38 },
    ];
    const bottleneck = workstations.reduce((max, w) =>
      w.cycleTime > max.cycleTime ? w : max, workstations[0]);
    expect(bottleneck.name).toBe("站B");
    expect(bottleneck.cycleTime).toBe(60);
  });

  it("calculates balance loss rate", () => {
    const cycleTimes = [45, 60, 38];
    const total = cycleTimes.reduce((s, t) => s + t, 0); // 143
    const max = Math.max(...cycleTimes); // 60
    const n = cycleTimes.length; // 3
    const balanceRate = (total / (max * n)) * 100; // 79.44%
    const balanceLoss = 100 - balanceRate; // 20.56%

    expect(balanceLoss).toBeCloseTo(20.56, 1);
  });

  it("handles single workstation (100% balance)", () => {
    const cycleTimes = [50];
    const total = cycleTimes[0]!;
    const max = cycleTimes[0]!;
    const n = 1;
    const balanceRate = (total / (max * n)) * 100;
    expect(balanceRate).toBe(100);
  });

  it("handles equal cycle times (100% balance)", () => {
    const cycleTimes = [40, 40, 40, 40];
    const total = cycleTimes.reduce((s, t) => s + t, 0); // 160
    const max = Math.max(...cycleTimes); // 40
    const n = cycleTimes.length; // 4
    const balanceRate = (total / (max * n)) * 100;
    expect(balanceRate).toBe(100);
  });
});

describe("Takt Time Analysis", () => {
  it("identifies stations exceeding takt time", () => {
    const taktTime = 55;
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 }, // 超出
      { name: "站C", cycleTime: 38 },
      { name: "站D", cycleTime: 58 }, // 超出
    ];
    const exceedStations = workstations.filter(w => w.cycleTime > taktTime);
    const passStations = workstations.filter(w => w.cycleTime <= taktTime);
    const passRate = (passStations.length / workstations.length) * 100;

    expect(exceedStations).toHaveLength(2);
    expect(exceedStations.map(w => w.name)).toEqual(["站B", "站D"]);
    expect(passStations).toHaveLength(2);
    expect(passRate).toBe(50);
  });

  it("calculates takt time pass rate correctly", () => {
    const taktTime = 60;
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 }, // 剛好達標
      { name: "站C", cycleTime: 38 },
      { name: "站D", cycleTime: 52 },
    ];
    const passCount = workstations.filter(w => w.cycleTime <= taktTime).length;
    const passRate = (passCount / workstations.length) * 100;

    expect(passCount).toBe(4); // 全部達標（等於也算達標）
    expect(passRate).toBe(100);
  });

  it("calculates takt time deviation correctly", () => {
    const taktTime = 55;
    const cycleTime = 65;
    const deviation = cycleTime - taktTime;
    const deviationPct = (deviation / taktTime) * 100;

    expect(deviation).toBe(10);
    expect(deviationPct).toBeCloseTo(18.18, 1);
  });

  it("calculates hourly capacity from takt time", () => {
    const taktTime = 60; // 60 秒一件
    const hourlyCapacity = Math.floor(3600 / taktTime);
    expect(hourlyCapacity).toBe(60);

    const taktTime2 = 45; // 45 秒一件
    const hourlyCapacity2 = Math.floor(3600 / taktTime2);
    expect(hourlyCapacity2).toBe(80);
  });

  it("all stations exceed takt time returns 0% pass rate", () => {
    const taktTime = 30;
    const workstations = [
      { name: "站A", cycleTime: 45 },
      { name: "站B", cycleTime: 60 },
    ];
    const passCount = workstations.filter(w => w.cycleTime <= taktTime).length;
    const passRate = (passCount / workstations.length) * 100;
    expect(passCount).toBe(0);
    expect(passRate).toBe(0);
  });
});

describe("Action Type Analysis", () => {
  it("calculates value-added ratio correctly", () => {
    const steps = [
      { actionType: "value_added", duration: 30 },
      { actionType: "non_value_added", duration: 10 },
      { actionType: "necessary_waste", duration: 5 },
    ];
    const total = steps.reduce((s, step) => s + step.duration, 0); // 45
    const valueAdded = steps.filter(s => s.actionType === "value_added")
      .reduce((s, step) => s + step.duration, 0); // 30
    const ratio = (valueAdded / total) * 100;

    expect(total).toBe(45);
    expect(valueAdded).toBe(30);
    expect(ratio).toBeCloseTo(66.67, 1);
  });
});
