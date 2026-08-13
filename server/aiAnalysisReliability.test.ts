import { describe, expect, it } from "vitest";
import { getFriendlyAIAnalysisError, retryAIRequest } from "../shared/aiAnalysisReliability";

describe("AI 分析服務韌性", () => {
  it("將模型逾時與服務錯誤轉為可讀中文提示", () => {
    expect(getFriendlyAIAnalysisError(new Error("AI 模型回應逾時"))).toContain("逾時");
    expect(getFriendlyAIAnalysisError(new Error("Ollama API 錯誤 (500): unavailable"))).toContain("暫時忙碌");
    expect(getFriendlyAIAnalysisError(new Error("Ollama API 錯誤 (401): unauthorized"))).toContain("驗證失敗");
  });

  it("暫時性失敗後會重試並回傳成功結果", async () => {
    let attempts = 0;
    const result = await retryAIRequest(async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });
});
