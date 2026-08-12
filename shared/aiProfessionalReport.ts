export type ReportActionType = "value_added" | "non_value_added" | "necessary_waste";

export interface ReportWorkstation {
  id: number;
  name: string;
  sequenceOrder: number;
  cycleTime: number | string;
  manpower: number | string;
  morningManpower?: number | string | null;
  eveningManpower?: number | string | null;
}

export interface ReportActionStep {
  workstationId: number;
  duration: number | string;
  actionType: ReportActionType;
}

export interface AIProfessionalReportInput {
  productionLineName: string;
  generatedAt: Date;
  targetCycleTime?: number | string | null;
  workstations: ReportWorkstation[];
  actionSteps: ReportActionStep[];
  aiSuggestion: string;
}

const actionMeta: Record<ReportActionType, { label: string; color: string }> = {
  value_added: { label: "增值", color: "#0f766e" },
  non_value_added: { label: "非增值", color: "#dc2626" },
  necessary_waste: { label: "必要浪費", color: "#d97706" },
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

export function markdownToSafeReportHtml(markdown: string): string {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const result: string[] = [];
  let listOpen = false;
  const closeList = () => { if (listOpen) { result.push("</ul>"); listOpen = false; } };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { closeList(); continue; }
    const content = escapeHtml(line.replace(/^#{1,3}\s+/, ""))
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
    if (/^###\s+/.test(line)) { closeList(); result.push(`<h3>${content}</h3>`); }
    else if (/^##\s+/.test(line)) { closeList(); result.push(`<h2>${content}</h2>`); }
    else if (/^[-*+]\s+/.test(line)) {
      if (!listOpen) { result.push("<ul>"); listOpen = true; }
      result.push(`<li>${content.replace(/^[-*+]\s+/, "")}</li>`);
    } else { closeList(); result.push(`<p>${content}</p>`); }
  }
  closeList();
  return result.join("\n");
}

export function buildAIProfessionalReport(input: AIProfessionalReportInput) {
  const workstations = input.workstations.map((station) => {
    const morning = Number(station.morningManpower) || 0;
    const evening = Number(station.eveningManpower) || 0;
    return { ...station, cycleTime: Number(station.cycleTime) || 0, manpower: morning + evening || Number(station.manpower) || 0 };
  }).sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const totalCycleTime = workstations.reduce((sum, station) => sum + station.cycleTime, 0);
  const maxCycleTime = Math.max(...workstations.map((station) => station.cycleTime), 0);
  const averageCycleTime = workstations.length > 0 ? totalCycleTime / workstations.length : 0;
  const totalManpower = workstations.reduce((sum, station) => sum + station.manpower, 0);
  const balanceRate = maxCycleTime > 0 && workstations.length > 0 ? (totalCycleTime / (maxCycleTime * workstations.length)) * 100 : 0;
  const upph = maxCycleTime > 0 && totalManpower > 0 ? 3600 / maxCycleTime / totalManpower : null;
  const bottleneck = workstations.find((station) => station.cycleTime === maxCycleTime) ?? null;
  const targetCycleTime = input.targetCycleTime === null || input.targetCycleTime === undefined ? null : Number(input.targetCycleTime);
  const taktPassCount = targetCycleTime && targetCycleTime > 0 ? workstations.filter((station) => station.cycleTime <= targetCycleTime).length : null;
  const actionBreakdown = (Object.keys(actionMeta) as ReportActionType[]).map((type) => {
    const duration = input.actionSteps.filter((step) => step.actionType === type).reduce((sum, step) => sum + (Number(step.duration) || 0), 0);
    const count = input.actionSteps.filter((step) => step.actionType === type).length;
    const totalDuration = input.actionSteps.reduce((sum, step) => sum + (Number(step.duration) || 0), 0);
    return { type, ...actionMeta[type], duration, count, share: totalDuration > 0 ? (duration / totalDuration) * 100 : 0 };
  });
  return {
    productionLineName: input.productionLineName,
    generatedAt: input.generatedAt,
    aiSuggestion: input.aiSuggestion,
    aiSuggestionHtml: markdownToSafeReportHtml(input.aiSuggestion),
    kpis: { workstationCount: workstations.length, totalCycleTime, maxCycleTime, averageCycleTime, totalManpower, balanceRate, upph, targetCycleTime, taktPassCount, bottleneckName: bottleneck?.name ?? null },
    workstations,
    actionBreakdown,
  };
}

export type AIProfessionalReport = ReturnType<typeof buildAIProfessionalReport>;

export function buildAIProfessionalReportHtml(report: AIProfessionalReport): string {
  const generatedAt = report.generatedAt.toLocaleString("zh-TW");
  const maxTime = Math.max(report.kpis.maxCycleTime, 1);
  const actionGradient = report.actionBreakdown.map((item, index) => {
    const start = report.actionBreakdown.slice(0, index).reduce((sum, current) => sum + current.share, 0);
    return `${item.color} ${start}% ${start + item.share}%`;
  }).join(", ");
  const actionLegend = report.actionBreakdown.map((item) => `<div class="legend"><i style="background:${item.color}"></i><span>${item.label}</span><b>${item.share.toFixed(1)}%</b><small>${item.duration.toFixed(1)} 秒 · ${item.count} 筆</small></div>`).join("");
  const stations = report.workstations.map((station) => `<tr><td>${escapeHtml(station.name)}</td><td>${station.cycleTime.toFixed(1)} 秒</td><td><div class="bar"><span style="width:${(station.cycleTime / maxTime) * 100}%"></span></div></td><td>${station.manpower.toFixed(2)}</td></tr>`).join("");
  const taktText = report.kpis.targetCycleTime && report.kpis.taktPassCount !== null ? `${report.kpis.taktPassCount} / ${report.kpis.workstationCount} 工站達標` : "未設定";
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8" /><title>${escapeHtml(report.productionLineName)}_AI分析報告</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#172033;font:12px/1.6 Arial,"Noto Sans TC",sans-serif}.report{max-width:960px;margin:0 auto;background:#fff;padding:34px}.cover{background:linear-gradient(135deg,#0f172a,#0f766e);color:#fff;padding:30px;border-radius:12px}.eyebrow{font-size:10px;letter-spacing:.16em;color:#99f6e4;font-weight:700}.cover h1{font-size:28px;line-height:1.2;margin:12px 0 6px}.cover p{margin:0;color:#d1fae5}.meta{margin-top:18px;font-size:11px;color:#cbd5e1}.section{margin-top:26px}.section h2{font-size:17px;margin:0 0 10px;color:#0f172a;border-left:4px solid #0f766e;padding-left:9px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpi{border:1px solid #dbe4ee;background:#f8fafc;padding:12px;border-radius:8px}.kpi label{display:block;font-size:10px;color:#64748b}.kpi strong{display:block;font-size:20px;color:#0f172a;margin-top:3px}.kpi span{font-size:10px;color:#64748b}.split{display:grid;grid-template-columns:1.05fr .95fr;gap:20px}.chart{display:flex;align-items:center;gap:22px;border:1px solid #e2e8f0;border-radius:8px;padding:18px}.donut{width:140px;height:140px;border-radius:50%;background:conic-gradient(${actionGradient || "#cbd5e1 0 100%"});position:relative;flex:none}.donut:after{content:"動作分類";position:absolute;inset:31px;background:#fff;border-radius:50%;display:grid;place-items:center;text-align:center;font-weight:700;color:#334155}.legend{display:grid;grid-template-columns:12px 1fr auto;gap:7px;align-items:center;margin:6px 0}.legend i{width:10px;height:10px;border-radius:50%}.legend b{font-size:11px}.legend small{grid-column:2 / 4;color:#64748b}.callout{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px}.callout b{color:#047857}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f1f5f9;color:#475569;text-align:left;font-weight:700}th,td{padding:8px;border-bottom:1px solid #e2e8f0}.bar{width:100%;height:7px;background:#e2e8f0;border-radius:99px;overflow:hidden}.bar span{display:block;height:100%;background:#0f766e;border-radius:99px}.ai{border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;padding:16px}.ai h2{font-size:15px;border:0;padding:0;color:#92400e;margin-top:15px}.ai h3{font-size:13px;color:#78350f}.ai p,.ai li{color:#4b5563}.ai code{background:#fef3c7;padding:1px 4px;border-radius:3px}.footer{margin-top:26px;padding-top:10px;border-top:1px solid #e2e8f0;color:#64748b;font-size:10px}@media print{body{background:#fff}.report{max-width:none;padding:0}.cover{break-inside:avoid}.section{break-inside:avoid}}
  </style></head><body><main class="report"><header class="cover"><div class="eyebrow">PRODUCTION LINE ANALYZER · AI PERFORMANCE REVIEW</div><h1>${escapeHtml(report.productionLineName)}<br/>AI 產線優化分析報告</h1><p>依目前工站、動作拆解與 AI 分析結果產出之決策支援文件。</p><div class="meta">產生時間：${escapeHtml(generatedAt)}　｜　報告範圍：${report.kpis.workstationCount} 個工站</div></header><section class="section"><h2>管理摘要</h2><div class="kpis"><div class="kpi"><label>產線平衡率</label><strong>${report.kpis.balanceRate.toFixed(1)}%</strong><span>以現有工站 CT 計算</span></div><div class="kpi"><label>瓶頸工站</label><strong>${escapeHtml(report.kpis.bottleneckName ?? "—")}</strong><span>${report.kpis.maxCycleTime.toFixed(1)} 秒</span></div><div class="kpi"><label>UPPH</label><strong>${report.kpis.upph === null ? "—" : report.kpis.upph.toFixed(2)}</strong><span>件／人／時</span></div><div class="kpi"><label>節拍達標</label><strong>${escapeHtml(taktText)}</strong><span>目標節拍：${report.kpis.targetCycleTime ?? "—"} 秒</span></div></div></section><section class="section split"><div><h2>動作分類結構</h2><div class="chart"><div class="donut"></div><div>${actionLegend || "<p>尚無動作拆解資料</p>"}</div></div></div><div><h2>分析範圍</h2><div class="callout"><b>資料依據</b><br/>工站數：${report.kpis.workstationCount}　｜　總 CT：${report.kpis.totalCycleTime.toFixed(1)} 秒　｜　平均 CT：${report.kpis.averageCycleTime.toFixed(1)} 秒　｜　合計人力：${report.kpis.totalManpower.toFixed(2)} 人<br/><br/><b>瓶頸焦點</b><br/>${escapeHtml(report.kpis.bottleneckName ?? "尚無可辨識瓶頸")} 為目前最長週期工站；請搭配下方 AI 建議確認優先改善措施。</div></div></section><section class="section"><h2>工站週期時間分布</h2><table><thead><tr><th>工站</th><th>CT</th><th>相對瓶頸負荷</th><th>人力</th></tr></thead><tbody>${stations || "<tr><td colspan=\"4\">尚無工站資料</td></tr>"}</tbody></table></section><section class="section"><h2>AI 診斷與改善建議</h2><article class="ai">${report.aiSuggestionHtml}</article></section><footer class="footer">資料來源：本系統在 ${escapeHtml(generatedAt)} 匯出的工站主資料、動作拆解資料及本次 AI 分析回覆。KPI 為系統依現有資料計算；AI 建議應由現場工程與管理人員覆核後執行。</footer></main></body></html>`;
}
