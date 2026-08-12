import { describe, expect, it } from "vitest";
import { buildVsmTrackingUrl, parseVsmTrackingContext } from "../shared/vsmTrackingContext";

describe("VSM tracking context", () => {
  it("將 VSM 工序帶入產品追蹤", () => {
    const url = buildVsmTrackingUrl({ lineId: 3, workstationId: 21, processName: "組裝" });
    expect(parseVsmTrackingContext(url.split("?")[1])).toEqual({ lineId: 3, workstationId: 21, processName: "組裝" });
  });
  it("拒絕無效工站情境", () => expect(parseVsmTrackingContext("?source=vsm&lineId=3&workstationId=0")).toBeNull());
});
