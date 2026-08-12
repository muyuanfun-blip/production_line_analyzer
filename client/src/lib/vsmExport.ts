/**
 * VSM 匯出工具函式
 * 支援 PNG、JSON、CSV 格式匯出
 */
import { jsPDF } from "jspdf";

interface VSMProcess {
  id: number;
  name: string;
  type: string;
  cycleTime?: string | number | null;
  manpower?: number | null;
  valueAddedRate?: string | number | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  notes?: string | null;
}

interface VSMFlow {
  id: number;
  fromProcessId: number;
  toProcessId: number;
  flowType: string;
  cycleTime?: string | number | null;
  quantity?: number | null;
  notes?: string | null;
}

interface VSMDiagram {
  name: string;
  description?: string | null;
}

export type VSMReportData = {
  diagramName: string;
  description: string;
  totalCT: number;
  totalManpower: number;
  averageValueAddedRate: number;
  leadTime: number;
  bottleneckName: string;
  processCount: number;
  flowCount: number;
};

/**
 * 轉換 cycleTime 為數字
 */
const parseCycleTime = (ct: string | number | null | undefined): number => {
  if (ct === null || ct === undefined) return 0;
  if (typeof ct === 'number') return ct;
  return parseFloat(ct) || 0;
};

/**
 * 轉換 valueAddedRate 為數字
 */
const parseValueAddedRate = (var_: string | number | null | undefined): number => {
  if (var_ === null || var_ === undefined) return 0;
  if (typeof var_ === 'number') return var_;
  return parseFloat(var_) || 0;
};

/**
 * 下載 Blob 檔案
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 格式化日期為檔案名稱格式
 */
export const formatDateForFilename = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}`;
};

/**
 * 匯出為 JSON
 */
export const exportVSMAsJSON = (
  diagram: VSMDiagram,
  processes: VSMProcess[],
  flows: VSMFlow[]
): void => {
  const totalCT = processes.reduce((sum, p) => sum + parseCycleTime(p.cycleTime), 0);
  const totalManpower = processes.reduce((sum, p) => sum + (p.manpower || 0), 0);

  const data = {
    diagram: {
      name: diagram.name,
      description: diagram.description,
      exportedAt: new Date().toISOString(),
    },
    processes,
    flows,
    summary: {
      processCount: processes.length,
      flowCount: flows.length,
      totalCT,
      totalManpower,
    },
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `VSM_${diagram.name}_${formatDateForFilename()}.json`;
  downloadBlob(blob, filename);
};

/**
 * 匯出為 CSV（工序清單）
 */
export const exportVSMProcessesAsCSV = (
  diagram: VSMDiagram,
  processes: VSMProcess[]
): void => {
  const headers = ['ID', 'Name', 'Type', 'CycleTime(s)', 'Manpower', 'ValueAddedRate(%)', 'Notes'];
  const rows = processes.map(p => [
    p.id,
    p.name,
    p.type,
    parseCycleTime(p.cycleTime).toFixed(2),
    p.manpower ? p.manpower.toFixed(1) : '',
    parseValueAddedRate(p.valueAddedRate).toFixed(1),
    p.notes || '',
  ]);

  const csv = [
    `VSM Diagram: ${diagram.name}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `VSM_Processes_${diagram.name}_${formatDateForFilename()}.csv`;
  downloadBlob(blob, filename);
};

/**
 * 匯出為 CSV（流線清單）
 */
export const exportVSMFlowsAsCSV = (
  diagram: VSMDiagram,
  flows: VSMFlow[],
  processMap: Map<number, string>
): void => {
  const headers = ['ID', 'FromProcess', 'ToProcess', 'FlowType', 'CycleTime(s)', 'Quantity', 'Notes'];
  const rows = flows.map(f => [
    f.id,
    processMap.get(f.fromProcessId) || `Process ${f.fromProcessId}`,
    processMap.get(f.toProcessId) || `Process ${f.toProcessId}`,
    f.flowType,
    parseCycleTime(f.cycleTime).toFixed(2),
    f.quantity || '',
    f.notes || '',
  ]);

  const csv = [
    `VSM Diagram: ${diagram.name}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const filename = `VSM_Flows_${diagram.name}_${formatDateForFilename()}.csv`;
  downloadBlob(blob, filename);
};

/**
 * 匯出為 PNG（SVG → Canvas → PNG）
 */
export const exportVSMAsPNG = async (
  diagram: VSMDiagram,
  svgElement: SVGSVGElement
): Promise<void> => {
  try {
    const clonedSVG = svgElement.cloneNode(true) as SVGSVGElement;
    const bbox = svgElement.getBBox();
    clonedSVG.setAttribute('width', `${bbox.width + 40}`);
    clonedSVG.setAttribute('height', `${bbox.height + 40}`);
    clonedSVG.setAttribute('viewBox', `${bbox.x - 20} ${bbox.y - 20} ${bbox.width + 40} ${bbox.height + 40}`);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get canvas context');

    canvas.width = bbox.width + 40;
    canvas.height = bbox.height + 40;

    const svgString = new XMLSerializer().serializeToString(clonedSVG);
    const svg = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svg);

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          const filename = `VSM_${diagram.name}_${formatDateForFilename()}.png`;
          downloadBlob(blob, filename);
        }
        URL.revokeObjectURL(url);
      }, 'image/png');
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      throw new Error('Cannot convert SVG to image');
    };

    img.src = url;
  } catch (error) {
    console.error('PNG export failed:', error);
    throw error;
  }
};

/**
 * 建立 KPI 摘要
 */
export const buildVSMKPISummary = (processes: VSMProcess[], flows: VSMFlow[]): Record<string, number | string> => {
  const totalCT = processes.reduce((sum, p) => sum + parseCycleTime(p.cycleTime), 0);
  const totalManpower = processes.reduce((sum, p) => sum + (p.manpower || 0), 0);
  const processesWithVAR = processes.filter(p => p.valueAddedRate !== null && p.valueAddedRate !== undefined);
  const avgVAR = processesWithVAR.length > 0
    ? processesWithVAR.reduce((sum, p) => sum + parseValueAddedRate(p.valueAddedRate), 0) / processesWithVAR.length
    : 0;
  const leadTime = flows.reduce((sum, f) => sum + parseCycleTime(f.cycleTime), 0);

  return {
    'Total CT (s)': totalCT.toFixed(2),
    'Total Manpower': totalManpower.toFixed(1),
    'Avg VAR (%)': avgVAR.toFixed(1),
    'Lead Time (s)': leadTime.toFixed(2),
    'Process Count': processes.length,
    'Flow Count': flows.length,
  };
};

export const buildVSMReportData = (diagram: VSMDiagram, processes: VSMProcess[], flows: VSMFlow[]): VSMReportData => {
  const totalCT = processes.reduce((sum, process) => sum + parseCycleTime(process.cycleTime), 0);
  const totalManpower = processes.reduce((sum, process) => sum + (process.manpower || 0), 0);
  const ratedProcesses = processes.filter((process) => process.valueAddedRate !== null && process.valueAddedRate !== undefined);
  const averageValueAddedRate = ratedProcesses.length
    ? ratedProcesses.reduce((sum, process) => sum + parseValueAddedRate(process.valueAddedRate), 0) / ratedProcesses.length
    : 0;
  const bottleneck = [...processes].sort((a, b) => parseCycleTime(b.cycleTime) - parseCycleTime(a.cycleTime))[0];
  return {
    diagramName: diagram.name,
    description: diagram.description || "未提供圖表說明",
    totalCT,
    totalManpower,
    averageValueAddedRate,
    leadTime: flows.reduce((sum, flow) => sum + parseCycleTime(flow.cycleTime), 0),
    bottleneckName: bottleneck?.name || "—",
    processCount: processes.length,
    flowCount: flows.length,
  };
};

/** 先以 Canvas 繪製 CJK 文字，再嵌入 PDF，避免內建字型的中文相容性問題。 */
export const exportVSMAsPDF = (diagram: VSMDiagram, processes: VSMProcess[], flows: VSMFlow[]): void => {
  const report = buildVSMReportData(diagram, processes, flows);
  const canvas = document.createElement("canvas");
  canvas.width = 1600; canvas.height = 1120;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法建立 PDF 報告畫布");
  const font = '"Noto Sans TC", "Microsoft JhengHei", sans-serif';
  ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, 1600, 1120);
  ctx.fillStyle = "#22d3ee"; ctx.fillRect(0, 0, 1600, 12);
  ctx.fillStyle = "#f8fafc"; ctx.font = `bold 42px ${font}`; ctx.fillText("VSM 價值流程分析報告", 72, 86);
  ctx.fillStyle = "#cbd5e1"; ctx.font = `24px ${font}`; ctx.fillText(report.diagramName, 72, 128);
  ctx.fillStyle = "#64748b"; ctx.font = `18px ${font}`; ctx.fillText(`匯出時間：${new Date().toLocaleString("zh-TW")}`, 72, 164);
  const cards: Array<[string, string, string]> = [["總 CT", `${report.totalCT.toFixed(1)} 秒`, "#22d3ee"], ["總人力", `${report.totalManpower.toFixed(2)} 人`, "#a78bfa"], ["平均增值率", `${report.averageValueAddedRate.toFixed(1)}%`, "#4ade80"], ["Lead Time", `${report.leadTime.toFixed(1)} 秒`, "#fbbf24"]];
  cards.forEach(([label, value, color], index) => {
    const x = 72 + index * 370;
    ctx.fillStyle = "#172033"; ctx.fillRect(x, 210, 330, 132);
    ctx.fillStyle = color; ctx.fillRect(x, 210, 6, 132);
    ctx.fillStyle = "#94a3b8"; ctx.font = `18px ${font}`; ctx.fillText(label, x + 28, 254);
    ctx.fillStyle = "#f8fafc"; ctx.font = `bold 30px ${font}`; ctx.fillText(value, x + 28, 306);
  });
  ctx.fillStyle = "#172033"; ctx.fillRect(72, 380, 1456, 80);
  ctx.fillStyle = "#f59e0b"; ctx.font = `bold 21px ${font}`; ctx.fillText(`瓶頸工序：${report.bottleneckName}`, 100, 429);
  ctx.fillStyle = "#94a3b8"; ctx.font = `18px ${font}`; ctx.fillText(`工序 ${report.processCount} 項 ｜ 流線 ${report.flowCount} 條`, 950, 429);
  ctx.fillStyle = "#f8fafc"; ctx.font = `bold 22px ${font}`; ctx.fillText("工序明細", 72, 520);
  const columns = [72, 150, 620, 870, 1100, 1300];
  const labels = ["序", "工序名稱", "類型", "CT（秒）", "人力", "增值率"];
  ctx.fillStyle = "#263348"; ctx.fillRect(72, 542, 1456, 42);
  ctx.font = `bold 16px ${font}`; ctx.fillStyle = "#cbd5e1"; labels.forEach((label, index) => ctx.fillText(label, columns[index] + 14, 570));
  processes.slice(0, 10).forEach((process, index) => {
    const y = 584 + index * 46;
    ctx.fillStyle = index % 2 ? "#111c2e" : "#162235"; ctx.fillRect(72, y, 1456, 46);
    ctx.fillStyle = "#e2e8f0"; ctx.font = `15px ${font}`;
    const values = [String(index + 1), process.name, process.type, parseCycleTime(process.cycleTime).toFixed(1), (process.manpower || 0).toFixed(2), `${parseValueAddedRate(process.valueAddedRate).toFixed(1)}%`];
    values.forEach((value, valueIndex) => ctx.fillText(value.slice(0, valueIndex === 1 ? 22 : 14), columns[valueIndex] + 14, y + 30));
  });
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 297, 210, undefined, "FAST");
  pdf.save(`VSM_報告_${diagram.name}_${formatDateForFilename()}.pdf`);
};
