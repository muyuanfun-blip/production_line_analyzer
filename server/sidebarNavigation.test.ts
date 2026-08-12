import { describe, expect, it } from "vitest";
import { getSidebarGroups, shouldCloseNavigationAfterSelect } from "../shared/sidebarNavigation";

describe("側欄導覽群組", () => {
  it("一般使用者只看決策中心與生產改善群組", () => {
    expect(getSidebarGroups("user").map((group) => group.key)).toEqual(["decision", "improvement"]);
  });

  it("管理員可看治理群組，且行動裝置選取後需收合導航", () => {
    expect(getSidebarGroups("admin").map((group) => group.key)).toEqual(["decision", "improvement", "governance"]);
    expect(shouldCloseNavigationAfterSelect(true)).toBe(true);
    expect(shouldCloseNavigationAfterSelect(false)).toBe(false);
  });
});
