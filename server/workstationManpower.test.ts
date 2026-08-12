import { describe, expect, it } from "vitest";
import { getManpowerQuality, normalizeManpower } from "../shared/workstationManpower";

describe("workstation manpower normalization", () => {
  it("以早晚班人力作為合計人力的唯一來源", () => {
    expect(normalizeManpower({ manpower: 99, morningManpower: 1.25, eveningManpower: 0.75 })).toEqual({
      morningManpower: 1.25,
      eveningManpower: 0.75,
      totalManpower: 2,
      source: "shifts",
    });
  });

  it("相容舊有人力欄位並將其對應至早班", () => {
    expect(normalizeManpower({ manpower: 1.5 })).toMatchObject({
      morningManpower: 1.5,
      eveningManpower: 0,
      totalManpower: 1.5,
      source: "legacy",
    });
  });

  it("偵測既有人力與早晚班合計不一致", () => {
    const quality = getManpowerQuality({ manpower: 1, morningManpower: 0.75, eveningManpower: 0.5 });
    expect(quality.isValid).toBe(false);
    expect(quality.issues).toContain("既有人力欄位與早晚班合計不一致");
  });

  it("拒絕不符合 0.25 單位的人力", () => {
    expect(() => normalizeManpower({ morningManpower: 0.3, eveningManpower: 0 })).toThrow("0.25");
  });

  it("將既有非 0.25 單位資料回報為品質異常而不阻斷查詢", () => {
    const quality = getManpowerQuality({ manpower: 0.3, morningManpower: 0.3, eveningManpower: 0 });
    expect(quality.isValid).toBe(false);
    expect(quality.totalManpower).toBe(0.3);
    expect(quality.issues).toContain("早晚班人力必須以 0.25 為單位");
  });
});
