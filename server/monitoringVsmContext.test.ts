import { describe, expect, it } from "vitest";
import { buildMonitoringVsmUrl, parseMonitoringVsmContext } from "../shared/monitoringVsmContext";

describe("monitoring VSM context", () => {
  it("將即時瓶頸與警示摘要帶入同一產線的 VSM 路由", () => {
    const url = buildMonitoringVsmUrl({ lineId: 9, bottleneckWsId: 31, balanceRate: 84.2, criticalCount: 1, warningCount: 2 });
    expect(parseMonitoringVsmContext(url.split("?")[1], 9)).toEqual({ lineId: 9, bottleneckWsId: 31, balanceRate: 84.2, criticalCount: 1, warningCount: 2 });
  });

  it("拒絕非監控來源或無效產線識別", () => {
    expect(parseMonitoringVsmContext("?source=tracking", 9)).toBeNull();
    expect(parseMonitoringVsmContext("?source=monitoring", 0)).toBeNull();
  });
});
