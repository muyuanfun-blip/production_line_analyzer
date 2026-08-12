import { describe, expect, it } from "vitest";
import { buildSimulationVsmUrl, parseSimulationVsmContext } from "../shared/simulationVsmContext";
describe("simulation VSM context", () => it("傳遞模擬 KPI 至 VSM", () => {
  const url = buildSimulationVsmUrl({ lineId: 4, scenarioId: 12, scenarioName: "改善案", balanceRate: 91.5, upph: 20 });
  expect(parseSimulationVsmContext(url.split("?")[1], 4)).toEqual({ lineId: 4, scenarioId: 12, scenarioName: "改善案", balanceRate: 91.5, upph: 20 });
}));
