export type DataGapSeverity = "critical" | "warning" | "info";

export interface AnalysisDataGap {
  key: string;
  severity: DataGapSeverity;
  title: string;
  impact: string;
  requestedData: string;
  recommendedProvider: string;
  collectionLocation: "production_line" | "workstation" | "action_analysis";
}

export interface ReadinessWorkstation {
  name: string;
  cycleTime: number;
  manpower: number;
  actionStatistics?: { totalSteps: number; totalDuration: number };
}

export interface AnalysisReadinessInput {
  targetCycleTime?: number | null;
  workstations: ReadinessWorkstation[];
}

export function assessAnalysisDataReadiness(input: AnalysisReadinessInput): AnalysisDataGap[] {
  const gaps: AnalysisDataGap[] = [];
  if (!input.targetCycleTime || input.targetCycleTime <= 0) {
    gaps.push({ key: "takt_time", severity: "warning", title: "尚未設定目標節拍時間", impact: "無法量化各工站是否達成需求節奏，Takt 相關改善結論只能視為方向性建議。", requestedData: "客戶需求量、每班可用工時或核定目標節拍", recommendedProvider: "生產管理／計畫人員", collectionLocation: "production_line" });
  }
  const noActionStations = input.workstations.filter((station) => !station.actionStatistics || station.actionStatistics.totalSteps === 0);
  if (noActionStations.length > 0) {
    gaps.push({ key: "action_steps", severity: "critical", title: `${noActionStations.length} 個工站缺少動作拆解`, impact: "無法分辨增值、非增值與必要浪費，浪費消除與標準作業建議的可信度受限。", requestedData: `請補充：${noActionStations.slice(0, 5).map((station) => station.name).join("、")}${noActionStations.length > 5 ? " 等" : ""} 的步驟、秒數與動作分類`, recommendedProvider: "工業工程／現場班組長", collectionLocation: "action_analysis" });
  }
  const mismatchedStations = input.workstations.filter((station) => {
    const actionDuration = station.actionStatistics?.totalDuration;
    return actionDuration !== undefined && station.cycleTime > 0 && Math.abs(actionDuration - station.cycleTime) / station.cycleTime > 0.1;
  });
  if (mismatchedStations.length > 0) {
    gaps.push({ key: "cycle_time_alignment", severity: "warning", title: `${mismatchedStations.length} 個工站的 CT 與動作合計差異超過 10%`, impact: "瓶頸與平衡率可能使用了與現場動作不一致的週期時間。", requestedData: `請覆核：${mismatchedStations.slice(0, 5).map((station) => station.name).join("、")}${mismatchedStations.length > 5 ? " 等" : ""} 的標準 CT 與動作秒數`, recommendedProvider: "工業工程／製程工程", collectionLocation: "action_analysis" });
  }
  const invalidManpower = input.workstations.filter((station) => !Number.isFinite(station.manpower) || station.manpower <= 0);
  if (invalidManpower.length > 0) {
    gaps.push({ key: "manpower", severity: "critical", title: `${invalidManpower.length} 個工站缺少有效人力資料`, impact: "無法可靠計算 UPPH 或評估人力調整方案。", requestedData: `請補充：${invalidManpower.map((station) => station.name).join("、")} 的早班與晚班人力`, recommendedProvider: "產線主管／人力規劃人員", collectionLocation: "workstation" });
  }
  return gaps;
}

export function getReadinessLevel(gaps: AnalysisDataGap[]): "ready" | "limited" | "blocked" {
  if (gaps.some((gap) => gap.severity === "critical")) return "blocked";
  if (gaps.length > 0) return "limited";
  return "ready";
}
