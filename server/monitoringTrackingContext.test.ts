import { describe, expect, it } from "vitest";
import { buildMonitoringTrackingUrl, parseMonitoringTrackingContext } from "../shared/monitoringTrackingContext";

describe("monitoring tracking context", () => {
  it("將流程卡料與產品識別安全帶入產品追蹤頁面", () => {
    const url = buildMonitoringTrackingUrl({ lineId: 7, waitingCount: 3, activeCount: 2, productIds: ["P0001", "P0002"] });
    expect(parseMonitoringTrackingContext(url.split("?")[1])).toEqual({ lineId: 7, waitingCount: 3, activeCount: 2, productIds: ["P0001", "P0002"] });
  });

  it("拒絕非監控來源與缺少產線識別的無效情境", () => {
    expect(parseMonitoringTrackingContext("?source=balance&lineId=7")).toBeNull();
    expect(parseMonitoringTrackingContext("?source=monitoring&lineId=0")).toBeNull();
  });
});
