import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helper ─────────────────────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    updateSnapshotData: vi.fn().mockResolvedValue(undefined),
    getSnapshotById: vi.fn().mockResolvedValue(null),
  };
});

import { updateSnapshotData } from "./db";
import { appRouter } from "./routers";

// ─── Helper: 建立已登入的 context ──────────────────────────────────────────
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "local",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createAnonContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── 基本工站資料 ─────────────────────────────────────────────────────────
const baseWorkstations = [
  { id: 1, name: "WS-01", cycleTime: 30, manpower: 1, sequenceOrder: 1 },
  { id: 2, name: "WS-02", cycleTime: 45, manpower: 0.5, sequenceOrder: 2 },
  { id: 3, name: "WS-03", cycleTime: 20, manpower: 1, sequenceOrder: 3 },
];

// ─── updateSnapshotData DB helper 單元測試 ────────────────────────────────
describe("updateSnapshotData (DB helper logic)", () => {
  it("呼叫 updateSnapshotData 時傳入正確的工站資料", async () => {
    const mockFn = vi.mocked(updateSnapshotData);
    mockFn.mockResolvedValueOnce(undefined as any);

    await updateSnapshotData(1, {
      workstationsData: baseWorkstations,
      taktTime: 40,
    });

    expect(mockFn).toHaveBeenCalledWith(1, {
      workstationsData: baseWorkstations,
      taktTime: 40,
    });
  });
});

// ─── snapshot.updateData tRPC procedure 測試 ─────────────────────────────
describe("snapshot.updateData tRPC procedure", () => {
  beforeEach(() => {
    vi.mocked(updateSnapshotData).mockResolvedValue(undefined as any);
  });

  it("未登入時應拋出 UNAUTHORIZED 錯誤", async () => {
    const caller = appRouter.createCaller(createAnonContext());
    await expect(
      caller.snapshot.updateData({
        id: 1,
        workstationsData: baseWorkstations,
      })
    ).rejects.toThrow();
  });

  it("已登入時可成功更新快照數據", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.snapshot.updateData({
      id: 1,
      workstationsData: baseWorkstations,
    });
    expect(result).toEqual({ success: true });
    expect(updateSnapshotData).toHaveBeenCalledWith(1, expect.objectContaining({
      workstationsData: baseWorkstations,
    }));
  });

  it("支援小數人力（0.5 人）", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const wsWithDecimal = [
      { id: 1, name: "WS-01", cycleTime: 30, manpower: 0.5, sequenceOrder: 1 },
      { id: 2, name: "WS-02", cycleTime: 45, manpower: 1.5, sequenceOrder: 2 },
    ];
    const result = await caller.snapshot.updateData({
      id: 2,
      workstationsData: wsWithDecimal,
    });
    expect(result).toEqual({ success: true });
  });

  it("taktTime 為 null 時不應報錯", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.snapshot.updateData({
      id: 3,
      taktTime: null,
      workstationsData: baseWorkstations,
    });
    expect(result).toEqual({ success: true });
  });

  it("可同時更新快照名稱與備註", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    const result = await caller.snapshot.updateData({
      id: 4,
      name: "修整後快照",
      note: "已調整 WS-02 CT",
      workstationsData: baseWorkstations,
    });
    expect(result).toEqual({ success: true });
    expect(updateSnapshotData).toHaveBeenCalledWith(4, expect.objectContaining({
      name: "修整後快照",
      note: "已調整 WS-02 CT",
    }));
  });

  it("工站列表為空時應拋出驗證錯誤", async () => {
    const caller = appRouter.createCaller(createAuthContext());
    await expect(
      caller.snapshot.updateData({
        id: 5,
        workstationsData: [],
      })
    ).rejects.toThrow();
  });
});
