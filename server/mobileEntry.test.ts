import { describe, expect, it } from "vitest";
import { getMobileLineFlowPath, isMobileEntryPath, MOBILE_ENTRY_PATH } from "../shared/mobileEntry";

describe("獨立手機入口路徑", () => {
  it("以 /mobile 作為與桌面管理版分離的入口命名空間", () => {
    expect(MOBILE_ENTRY_PATH).toBe("/mobile");
    expect(isMobileEntryPath("/mobile")).toBe(true);
    expect(isMobileEntryPath("/mobile/lines/12/time-study")).toBe(true);
    expect(isMobileEntryPath("/lines/12/time-study")).toBe(false);
  });

  it("為各手機現場流程建立專屬路由", () => {
    expect(getMobileLineFlowPath(12)).toBe("/mobile/lines/12");
    expect(getMobileLineFlowPath(12, "time-study")).toBe("/mobile/lines/12/time-study");
    expect(getMobileLineFlowPath(12, "ai")).toBe("/mobile/lines/12/ai");
  });
});
