/**
 * VSM 匯出工具函式
 * 支援 PNG、JSON、CSV 格式匯出
 */

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
