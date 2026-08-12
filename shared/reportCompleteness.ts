export interface CompletenessWorkstation {
  id: number;
  name: string;
  cycleTime: number | string;
  manpower: number | string;
}

export interface CompletenessActionStep {
  workstationId: number;
  duration: number | string;
}

export interface CompletenessComponent {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  detail: string;
}

export interface ReportCompleteness {
  score: number;
  level: "high" | "usable" | "limited" | "insufficient";
  label: string;
  components: CompletenessComponent[];
}

const ratio = (numerator: number, denominator: number) => denominator > 0 ? Math.max(0, Math.min(1, numerator / denominator)) : 0;

export function calculateReportCompleteness(input: { targetCycleTime?: number | string | null; workstations: CompletenessWorkstation[]; actionSteps: CompletenessActionStep[] }): ReportCompleteness {
  const stations = input.workstations;
  const validCycleCount = stations.filter((station) => Number(station.cycleTime) > 0).length;
  const validManpowerCount = stations.filter((station) => Number(station.manpower) > 0).length;
  const actionByStation = new Map<number, number>();
  for (const step of input.actionSteps) actionByStation.set(step.workstationId, (actionByStation.get(step.workstationId) ?? 0) + (Number(step.duration) || 0));
  const actionCovered = stations.filter((station) => (actionByStation.get(station.id) ?? 0) > 0).length;
  const aligned = stations.filter((station) => {
    const cycle = Number(station.cycleTime);
    const actionDuration = actionByStation.get(station.id) ?? 0;
    return cycle > 0 && actionDuration > 0 && Math.abs(actionDuration - cycle) / cycle <= 0.1;
  }).length;
  const components: CompletenessComponent[] = [
    { key: "cycle_time", label: "工站週期時間", score: Math.round(ratio(validCycleCount, stations.length) * 20), maxScore: 20, detail: `${validCycleCount} / ${stations.length} 個工站具有效 CT` },
    { key: "takt_time", label: "目標節拍", score: Number(input.targetCycleTime) > 0 ? 15 : 0, maxScore: 15, detail: Number(input.targetCycleTime) > 0 ? "已設定目標節拍" : "尚未設定目標節拍" },
    { key: "manpower", label: "工站人力", score: Math.round(ratio(validManpowerCount, stations.length) * 15), maxScore: 15, detail: `${validManpowerCount} / ${stations.length} 個工站具有效人力` },
    { key: "action_coverage", label: "動作拆解覆蓋", score: Math.round(ratio(actionCovered, stations.length) * 30), maxScore: 30, detail: `${actionCovered} / ${stations.length} 個工站已有動作拆解` },
    { key: "ct_alignment", label: "CT 與動作秒數對齊", score: Math.round(ratio(aligned, stations.length) * 20), maxScore: 20, detail: `${aligned} / ${stations.length} 個工站差異在 10% 內` },
  ];
  const score = components.reduce((sum, component) => sum + component.score, 0);
  const level = score >= 85 ? "high" : score >= 70 ? "usable" : score >= 50 ? "limited" : "insufficient";
  const label = { high: "資訊完整", usable: "可用但仍有缺口", limited: "資訊受限", insufficient: "資訊不足" }[level];
  return { score, level, label, components };
}
