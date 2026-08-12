import { describe, expect, it } from "vitest";
import { buildMonitoringSnapshotPayload } from "../shared/monitoringSnapshot";

describe("monitoring snapshot payload", () => {
  it("將即時 KPI 以資料庫 decimal 精度與 JSON 明細安全序列化", () => {
    const workstations = [{ id: 1, name: "組裝" }];
    const anomalies = [{ id: "a-1", level: "warning" }];
    expect(buildMonitoringSnapshotPayload({
      balanceRate: 87.126,
      upph: 12.34567,
      taktAchievement: 91.999,
      productionTarget: 100.2,
      productionActual: 88.7,
      bottleneckWsId: 3,
      workstations,
      anomalies,
    }, "  交班前留存  ")).toEqual({
      balanceRate: "87.13",
      upph: "12.3457",
      taktAchievement: "92.00",
      productionTarget: 100,
      productionActual: 89,
      bottleneckWsId: 3,
      workstationsData: workstations,
      anomaliesData: anomalies,
      note: "交班前留存",
    });
  });

  it("處理非有限 KPI 與無瓶頸情境，避免無效資料寫入", () => {
    expect(buildMonitoringSnapshotPayload({
      balanceRate: Number.NaN,
      upph: Number.POSITIVE_INFINITY,
      taktAchievement: Number.NaN,
      productionTarget: -1,
      productionActual: -2,
      bottleneckWsId: 0,
      workstations: [],
      anomalies: [],
    })).toMatchObject({
      balanceRate: "0.00",
      upph: "0.0000",
      taktAchievement: "0.00",
      productionTarget: 0,
      productionActual: 0,
      bottleneckWsId: null,
      note: null,
    });
  });
});
