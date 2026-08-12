export type VsmNodeType = "process" | "supplier" | "customer" | "inventory" | "transport";

export type TrustedVsmProcess = {
  id: number;
  name: string;
  type: VsmNodeType;
  cycleTime?: number | null;
  valueAddedRate?: number | null;
  wipQuantity?: number | null;
  availabilityRate?: number | null;
};

export type TrustedVsmFlow = {
  id: number;
  fromProcessId: number;
  toProcessId: number;
  flowType: "material" | "information" | "kanban";
  cycleTime?: number | null;
};

export type VsmQualityIssue = { severity: "error" | "warning"; code: string; message: string };

export function inspectVsmModel(processes: TrustedVsmProcess[], flows: TrustedVsmFlow[], taktTime?: number | null): VsmQualityIssue[] {
  const issues: VsmQualityIssue[] = [];
  const ids = new Set(processes.map((process) => process.id));
  const processNodes = processes.filter((process) => process.type === "process");
  if (!processNodes.length) issues.push({ severity: "error", code: "NO_PROCESS", message: "尚未建立可計算的製程工序。" });
  processNodes.filter((process) => !process.cycleTime || process.cycleTime <= 0).forEach((process) => issues.push({ severity: "error", code: "MISSING_CT", message: `工序「${process.name}」缺少有效 CT。` }));
  processNodes.filter((process) => process.valueAddedRate == null).forEach((process) => issues.push({ severity: "warning", code: "MISSING_VAR", message: `工序「${process.name}」缺少增值率，VA 時間將標示為估算。` }));
  flows.filter((flow) => !ids.has(flow.fromProcessId) || !ids.has(flow.toProcessId)).forEach(() => issues.push({ severity: "error", code: "INVALID_FLOW", message: "存在指向不存在節點的流線。" }));
  processNodes.filter((process) => !flows.some((flow) => flow.fromProcessId === process.id || flow.toProcessId === process.id)).forEach((process) => issues.push({ severity: "warning", code: "ISOLATED_PROCESS", message: `工序「${process.name}」未連接任何流線。` }));
  if (!taktTime || taktTime <= 0) issues.push({ severity: "warning", code: "MISSING_TAKT", message: "尚未設定需求節拍；無法判定工序是否滿足需求。" });
  return issues;
}

export function calculateTrustedVsmKpis(processes: TrustedVsmProcess[], flows: TrustedVsmFlow[], taktTime?: number | null) {
  const processNodes = processes.filter((process) => process.type === "process");
  const hasCompleteCt = processNodes.length > 0 && processNodes.every((process) => Number(process.cycleTime) > 0);
  const hasCompleteVar = processNodes.length > 0 && processNodes.every((process) => process.valueAddedRate != null);
  const totalWorkContentSec = hasCompleteCt ? processNodes.reduce((total, process) => total + Number(process.cycleTime), 0) : null;
  const valueAddedSec = hasCompleteCt && hasCompleteVar ? processNodes.reduce((total, process) => total + Number(process.cycleTime) * Number(process.valueAddedRate) / 100, 0) : null;
  const materialTransportSec = flows.filter((flow) => flow.flowType === "material").every((flow) => flow.cycleTime != null)
    ? flows.filter((flow) => flow.flowType === "material").reduce((total, flow) => total + Number(flow.cycleTime || 0), 0)
    : null;
  const bottleneck = processNodes.filter((process) => Number(process.cycleTime) > 0).sort((a, b) => Number(b.cycleTime) - Number(a.cycleTime))[0] ?? null;
  const taktStatus = taktTime && bottleneck?.cycleTime != null ? Number(bottleneck.cycleTime) <= taktTime ? "pass" : "fail" : "unknown";
  return { totalWorkContentSec, valueAddedSec, materialTransportSec, bottleneck, taktStatus, quality: hasCompleteCt ? hasCompleteVar ? "trusted" : "estimated" : "insufficient" as "trusted" | "estimated" | "insufficient" };
}
