import { describe, expect, it } from "vitest";
import { getMobileNavigationItems, isMobileNavigationActive } from "../shared/mobileNavigation";

describe("手機底部導覽", () => {
  it("只顯示帳號已獲授權的核心現場入口", () => {
    const viewer = getMobileNavigationItems("user", ["dashboard.view", "production.view"]);
    expect(viewer.map((item) => item.key)).toEqual(["home", "lines"]);
    const admin = getMobileNavigationItems("admin", []);
    expect(admin.map((item) => item.key)).toEqual(["home", "lines", "tasks"]);
  });

  it("能正確辨識產線與任務的手機導覽作用中狀態", () => {
    expect(isMobileNavigationActive("/lines/7/time-study", "/lines")).toBe(true);
    expect(isMobileNavigationActive("/data-completion-inbox", "/")).toBe(false);
  });
});
