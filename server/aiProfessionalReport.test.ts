import { describe, expect, it } from "vitest";
import { buildAIProfessionalReport, buildAIProfessionalReportHtml, markdownToSafeReportHtml } from "../shared/aiProfessionalReport";

describe("AI 專業圖文報告", () => {
  const report = buildAIProfessionalReport({
    productionLineName: "示範產線",
    generatedAt: new Date("2026-08-12T00:00:00.000Z"),
    targetCycleTime: 20,
    workstations: [
      { id: 1, name: "組裝", sequenceOrder: 2, cycleTime: "20", manpower: "1" },
      { id: 2, name: "測試", sequenceOrder: 1, cycleTime: "10", manpower: "2" },
    ],
    actionSteps: [
      { workstationId: 1, duration: "12", actionType: "value_added" },
      { workstationId: 1, duration: "8", actionType: "non_value_added" },
    ],
    aiSuggestion: "## 優先措施\n- **縮短** 等待時間\n<script>alert('xss')</script>",
  });

  it("依工站資料計算真實 KPI、節拍達標數與動作分類時間", () => {
    expect(report.kpis).toMatchObject({ workstationCount: 2, totalCycleTime: 30, maxCycleTime: 20, averageCycleTime: 15, totalManpower: 3, balanceRate: 75, taktPassCount: 2, bottleneckName: "組裝" });
    expect(report.kpis.upph).toBe(60);
    expect(report.actionBreakdown.find((item) => item.type === "value_added")).toMatchObject({ duration: 12, count: 1, share: 60 });
  });

  it("將 AI Markdown 安全轉換為可下載的報告 HTML，不執行輸入標籤", () => {
    expect(markdownToSafeReportHtml("**重要** <script>x</script>")).toContain("&lt;script&gt;x&lt;/script&gt;");
    const html = buildAIProfessionalReportHtml(report);
    expect(html).toContain("AI 產線優化分析報告");
    expect(html).toContain("示範產線");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});
