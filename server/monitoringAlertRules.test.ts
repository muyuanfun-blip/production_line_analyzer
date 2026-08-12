import { describe, expect, it } from "vitest";
import { evaluateMonitoringAlertRules } from "../shared/monitoringAlertRules";

const workstations = [
  { id: 1, name: "組裝", efficiency: 82, waitingProducts: 1, status: "normal" as const },
  { id: 2, name: "測試", efficiency: 96, waitingProducts: 4, status: "warning" as const },
];

describe("custom monitoring alert rules", () => {
  it("依效率、等待量與工站狀態建立對應嚴重度的警示", () => {
    const alerts = evaluateMonitoringAlertRules([
      { id: 1, name: "組裝效率下限", metric: "efficiency_below", threshold: 85, severity: "critical", isActive: 1, workstationId: 1 },
      { id: 2, name: "全線在製品堆積", metric: "waiting_products_at_least", threshold: 3, severity: "warning", isActive: 1 },
      { id: 3, name: "測試預警狀態", metric: "status_equals", statusValue: "warning", severity: "info", isActive: 1, workstationId: 2 },
    ], workstations);

    expect(alerts).toHaveLength(3);
    expect(alerts.map((alert) => [alert.wsId, alert.level])).toEqual([[1, "critical"], [2, "warning"], [2, "info"]]);
  });

  it("忽略停用規則與不符合特定工站範圍的規則", () => {
    const alerts = evaluateMonitoringAlertRules([
      { id: 4, name: "停用規則", metric: "efficiency_below", threshold: 100, severity: "warning", isActive: 0 },
      { id: 5, name: "其他工站", metric: "status_equals", statusValue: "warning", severity: "warning", isActive: 1, workstationId: 1 },
    ], workstations);
    expect(alerts).toEqual([]);
  });
});
