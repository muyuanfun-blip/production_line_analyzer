import { describe, expect, it } from "vitest";
import { getMobileRouteLoadingLabel, isMobileDeepRoute, MOBILE_ROUTE_TRANSITION_MS } from "../shared/mobileRouteTransition";

describe("手機深層路由過場規則", () => {
  it("僅將工站與其現場工作流程判定為深層路由", () => {
    expect(isMobileDeepRoute("/mobile/lines/30001")).toBe(true);
    expect(isMobileDeepRoute("/mobile/lines/30001/time-study")).toBe(true);
    expect(isMobileDeepRoute("/mobile/lines/30001/balance")).toBe(true);
    expect(isMobileDeepRoute("/mobile/lines/30001/ai")).toBe(true);
    expect(isMobileDeepRoute("/mobile/lines")).toBe(false);
    expect(isMobileDeepRoute("/mobile/tasks")).toBe(false);
  });

  it("為每種手機現場流程提供可讀載入提示與短暫過場時間", () => {
    expect(getMobileRouteLoadingLabel("/mobile/lines/30001/time-study")).toContain("工時觀測");
    expect(getMobileRouteLoadingLabel("/mobile/lines/30001/balance")).toContain("平衡");
    expect(getMobileRouteLoadingLabel("/mobile/lines/30001/ai")).toContain("AI");
    expect(MOBILE_ROUTE_TRANSITION_MS).toBeGreaterThanOrEqual(150);
    expect(MOBILE_ROUTE_TRANSITION_MS).toBeLessThanOrEqual(300);
  });
});
