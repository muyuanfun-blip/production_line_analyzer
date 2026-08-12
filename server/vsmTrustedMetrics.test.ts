import { calculateTrustedVsmKpis, inspectVsmModel } from "../shared/vsmTrustedMetrics";
import { describe, expect, it } from "vitest";

describe("VSM trusted metrics", () => {
  const processes = [
    { id: 1, name: "組裝", type: "process" as const, cycleTime: 50, valueAddedRate: 80 },
    { id: 2, name: "測試", type: "process" as const, cycleTime: 70, valueAddedRate: 60 },
  ];
  const flows = [{ id: 1, fromProcessId: 1, toProcessId: 2, flowType: "material" as const, cycleTime: 10 }];

  it("僅使用製程工序計算工作內容與瓶頸，且標記節拍狀態", () => {
    expect(calculateTrustedVsmKpis(processes, flows, 60)).toMatchObject({ totalWorkContentSec: 120, valueAddedSec: 82, materialTransportSec: 10, taktStatus: "fail", quality: "trusted" });
  });

  it("針對無效流線、缺失 CT 與未設定 Takt 回傳可行動的資料品質問題", () => {
    const issues = inspectVsmModel([{ id: 1, name: "未量測", type: "process" }], [{ id: 1, fromProcessId: 1, toProcessId: 9, flowType: "material" }]);
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["MISSING_CT", "INVALID_FLOW", "MISSING_TAKT"]));
  });
});
