import { describe, expect, it } from "vitest";
import { buildMonitoringSimulationUrl, parseMonitoringSimulationContext } from "../shared/monitoringSimulationContext";

describe("monitoring simulation context", () => {
  it("將即時 KPI 與瓶頸工站帶入配置模擬器", () => {
    const url = buildMonitoringSimulationUrl({ lineId: 6, bottleneckWsId: 12, balanceRate: 87.5, upph: 15.25, criticalCount: 1 });
    expect(parseMonitoringSimulationContext(url.split("?")[1])).toEqual({ lineId: 6, bottleneckWsId: 12, balanceRate: 87.5, upph: 15.25, criticalCount: 1 });
  });

  it("拒絕非監控來源與缺失的產線識別", () => {
    expect(parseMonitoringSimulationContext("?source=vsm&lineId=6")).toBeNull();
    expect(parseMonitoringSimulationContext("?source=monitoring&lineId=0")).toBeNull();
  });
});
