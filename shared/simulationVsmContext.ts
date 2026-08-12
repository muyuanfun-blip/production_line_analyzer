export type SimulationVsmContext = { lineId: number; scenarioId: number; scenarioName: string; balanceRate: number; upph: number };
export function buildSimulationVsmUrl(context: SimulationVsmContext) {
  const params = new URLSearchParams({ source: "simulation", scenarioId: String(context.scenarioId), scenarioName: context.scenarioName, balanceRate: String(context.balanceRate), upph: String(context.upph) });
  return `/lines/${context.lineId}/vsm?${params.toString()}`;
}
export function parseSimulationVsmContext(search: string, lineId: number): SimulationVsmContext | null {
  const params = new URLSearchParams(search);
  const scenarioId = Number(params.get("scenarioId"));
  if (params.get("source") !== "simulation" || lineId <= 0 || !Number.isFinite(scenarioId) || scenarioId <= 0) return null;
  return { lineId, scenarioId, scenarioName: params.get("scenarioName") || "模擬情境", balanceRate: Number(params.get("balanceRate")) || 0, upph: Number(params.get("upph")) || 0 };
}
