import { describe, expect, it } from "vitest";
import { buildMonitoringBalanceUrl, parseMonitoringBalanceContext } from "../shared/monitoringBalanceContext";

describe("monitoring balance context", () => {
  it("將監控 KPI 安全傳遞到同一產線的平衡分析路由", () => {
    const url = buildMonitoringBalanceUrl(42, {
      balanceRate: 86.5,
      upph: 12.75,
      taktAchievement: 91,
      productionActual: 87,
      productionTarget: 100,
      bottleneckWsId: 9,
    });
    expect(url).toContain("/lines/42/balance?");
    expect(parseMonitoringBalanceContext(url.split("?")[1])).toEqual({
      balanceRate: 86.5,
      upph: 12.75,
      taktAchievement: 91,
      productionActual: 87,
      productionTarget: 100,
      bottleneckWsId: 9,
    });
  });

  it("忽略非監控來源，並對無效數值提供安全預設值", () => {
    expect(parseMonitoringBalanceContext("?source=snapshot")).toBeNull();
    expect(parseMonitoringBalanceContext("?source=monitoring&balanceRate=NaN&upph=Infinity")).toMatchObject({ balanceRate: 0, upph: 0 });
  });
});
