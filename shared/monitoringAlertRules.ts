export type AlertMetric = "efficiency_below" | "waiting_products_at_least" | "status_equals";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertWorkstationStatus = "normal" | "warning" | "critical" | "offline" | "idle";

export type MonitoringAlertRuleInput = {
  id: number;
  name: string;
  metric: AlertMetric;
  threshold?: number | string | null;
  statusValue?: AlertWorkstationStatus | null;
  severity: AlertSeverity;
  isActive: number | boolean;
  workstationId?: number | null;
};

export type MonitoringAlertWorkstation = {
  id: number;
  name: string;
  efficiency: number;
  waitingProducts: number;
  status: AlertWorkstationStatus;
};

export type CustomMonitoringAlert = {
  id: string;
  ruleId: number;
  wsId: number;
  wsName: string;
  level: AlertSeverity;
  message: string;
  suggestedAction: string;
};

export function evaluateMonitoringAlertRules(
  rules: MonitoringAlertRuleInput[],
  workstations: MonitoringAlertWorkstation[],
): CustomMonitoringAlert[] {
  const alerts: CustomMonitoringAlert[] = [];
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const candidates = rule.workstationId
      ? workstations.filter((workstation) => workstation.id === rule.workstationId)
      : workstations;
    for (const workstation of candidates) {
      const threshold = Number(rule.threshold);
      const matched = rule.metric === "efficiency_below"
        ? Number.isFinite(threshold) && workstation.efficiency < threshold
        : rule.metric === "waiting_products_at_least"
          ? Number.isFinite(threshold) && workstation.waitingProducts >= threshold
          : workstation.status === rule.statusValue;
      if (!matched) continue;

      const metricDetail = rule.metric === "efficiency_below"
        ? `效率 ${workstation.efficiency.toFixed(1)}%，低於 ${threshold.toFixed(1)}%`
        : rule.metric === "waiting_products_at_least"
          ? `等待產品 ${workstation.waitingProducts} 件，達到門檻 ${threshold.toFixed(0)} 件`
          : `工站狀態為「${workstation.status}」`;
      alerts.push({
        id: `custom-rule-${rule.id}-ws-${workstation.id}`,
        ruleId: rule.id,
        wsId: workstation.id,
        wsName: workstation.name,
        level: rule.severity,
        message: `規則「${rule.name}」觸發：${metricDetail}`,
        suggestedAction: rule.metric === "efficiency_below"
          ? "檢查作業方法、設備狀態與人力配置，確認是否存在瓶頸。"
          : rule.metric === "waiting_products_at_least"
            ? "檢查上游供料、在製品堆積與下游處理能力，排除卡料原因。"
            : "依工站狀態執行設備點檢、人力支援或復歸處置。",
      });
    }
  }
  return alerts;
}
