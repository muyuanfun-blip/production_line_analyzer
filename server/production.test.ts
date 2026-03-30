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
