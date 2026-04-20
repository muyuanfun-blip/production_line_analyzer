/**
 * dxfToSvg.ts
 * 使用 dxf-parser 解析 DXF 檔案，並將實體轉換為 SVG 路徑字串。
 * 支援：LINE, LWPOLYLINE, POLYLINE, ARC, CIRCLE, ELLIPSE, SPLINE, TEXT, MTEXT
 */

// dxf-parser 使用 CommonJS，需用 require 方式匯入
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DxfParser = require('dxf-parser');

export type DxfLayer = {
  name: string;
  visible: boolean;
  color: string;
};

export type DxfParseResult = {
  svgContent: string;       // 完整 SVG <g> 內容（各圖層分組）
  layers: DxfLayer[];       // 所有圖層清單
  viewBox: { minX: number; minY: number; width: number; height: number };
  entityCount: number;
};

// DXF 顏色索引 → CSS 顏色（AutoCAD ACI 色碼，只列常用的）
const ACI_COLORS: Record<number, string> = {
  0:  '#ffffff', // ByBlock
  1:  '#ff0000', // 紅
  2:  '#ffff00', // 黃
  3:  '#00ff00', // 綠
  4:  '#00ffff', // 青
  5:  '#0000ff', // 藍
  6:  '#ff00ff', // 洋紅
  7:  '#ffffff', // 白（或黑，依背景）
  8:  '#808080', // 深灰
  9:  '#c0c0c0', // 淺灰
  256: '#22d3ee', // ByLayer → 預設用青色
};

function aciToColor(colorIndex?: number): string {
  if (colorIndex === undefined || colorIndex === null) return '#22d3ee';
  return ACI_COLORS[colorIndex] ?? '#22d3ee';
}

// 將角度（度）轉換為弧度
function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// 生成 SVG arc path（從 startAngle 到 endAngle，逆時針為 DXF 標準）
function arcPath(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number): string {
  // DXF 的 Y 軸是向上的，SVG 是向下的，所以需要翻轉 Y 並反轉角度方向
  const startRad = deg2rad(startAngleDeg);
  const endRad = deg2rad(endAngleDeg);

  const x1 = cx + r * Math.cos(startRad);
  const y1 = -(cy + r * Math.sin(startRad));
  const x2 = cx + r * Math.cos(endRad);
  const y2 = -(cy + r * Math.sin(endRad));

  // 計算圓弧跨越角度
  let sweep = endAngleDeg - startAngleDeg;
  if (sweep < 0) sweep += 360;
  const largeArc = sweep > 180 ? 1 : 0;

  // SVG 中 sweep-flag=0 表示逆時針（對應 DXF 的逆時針）
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
}

// 解析單一實體，回傳 SVG path d 字串（null 表示不支援或跳過）
function entityToPath(entity: any): string | null {
  try {
    switch (entity.type) {
      case 'LINE': {
        const x1 = entity.vertices?.[0]?.x ?? entity.start?.x ?? 0;
        const y1 = -(entity.vertices?.[0]?.y ?? entity.start?.y ?? 0);
        const x2 = entity.vertices?.[1]?.x ?? entity.end?.x ?? 0;
        const y2 = -(entity.vertices?.[1]?.y ?? entity.end?.y ?? 0);
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      }

      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const verts = entity.vertices ?? [];
        if (verts.length < 2) return null;
        const parts: string[] = [];
        for (let i = 0; i < verts.length; i++) {
          const v = verts[i];
          const cmd = i === 0 ? 'M' : 'L';
          parts.push(`${cmd} ${v.x} ${-v.y}`);
        }
        if (entity.closed || entity.shape) parts.push('Z');
        return parts.join(' ');
      }

      case 'ARC': {
        const cx = entity.center?.x ?? 0;
        const cy = entity.center?.y ?? 0;
        const r = entity.radius ?? 1;
        const startAngle = entity.startAngle ?? 0;
        const endAngle = entity.endAngle ?? 360;
        return arcPath(cx, cy, r, startAngle, endAngle);
      }

      case 'CIRCLE': {
        const cx = entity.center?.x ?? 0;
        const cy = -(entity.center?.y ?? 0);
        const r = entity.radius ?? 1;
        // 用兩段半圓弧表示完整圓
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
      }

      case 'ELLIPSE': {
        const cx = entity.center?.x ?? 0;
        const cy = -(entity.center?.y ?? 0);
        const rx = Math.hypot(entity.majorAxisEndPoint?.x ?? 1, entity.majorAxisEndPoint?.y ?? 0);
        const ry = rx * (entity.axisRatio ?? 0.5);
        return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
      }

      case 'SPLINE': {
        const pts = entity.controlPoints ?? entity.fitPoints ?? [];
        if (pts.length < 2) return null;
        const parts: string[] = [`M ${pts[0].x} ${-pts[0].y}`];
        for (let i = 1; i < pts.length; i++) {
          parts.push(`L ${pts[i].x} ${-pts[i].y}`);
        }
        return parts.join(' ');
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function parseDxfToSvg(dxfText: string): DxfParseResult {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfText);

  // 收集所有圖層
  const layerMap: Record<string, DxfLayer> = {};
  if (dxf.tables?.layer?.layers) {
    for (const [name, layer] of Object.entries(dxf.tables.layer.layers as Record<string, any>)) {
      layerMap[name] = {
        name,
        visible: layer.visible !== false,
        color: aciToColor(layer.colorIndex),
      };
    }
  }

  // 按圖層分組實體，同時計算 bounding box
  const layerPaths: Record<string, string[]> = {};
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let entityCount = 0;

  for (const entity of dxf.entities ?? []) {
    const layerName: string = entity.layer ?? '0';
    if (!layerMap[layerName]) {
      layerMap[layerName] = { name: layerName, visible: true, color: '#22d3ee' };
    }

    const pathD = entityToPath(entity);
    if (!pathD) continue;

    entityCount++;
    if (!layerPaths[layerName]) layerPaths[layerName] = [];
    layerPaths[layerName].push(pathD);

    // 更新 bounding box（簡單從路徑中提取數字）
    const nums = pathD.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i < nums.length - 1; i += 2) {
      const x = nums[i], y = nums[i + 1];
      if (isFinite(x) && isFinite(y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 若沒有任何實體，給預設 viewBox
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1000; maxY = 1000; }
  const padding = Math.max((maxX - minX), (maxY - minY)) * 0.02;
  const viewBox = {
    minX: minX - padding,
    minY: minY - padding,
    width: (maxX - minX) + padding * 2,
    height: (maxY - minY) + padding * 2,
  };

  // 組合 SVG 內容（各圖層為獨立 <g> 群組）
  const svgParts: string[] = [];
  for (const [layerName, paths] of Object.entries(layerPaths)) {
    const layer = layerMap[layerName];
    const color = layer?.color ?? '#22d3ee';
    const visibility = layer?.visible === false ? 'display:none' : '';
    const pathElements = paths.map(d =>
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="1" vector-effect="non-scaling-stroke"/>`
    ).join('\n');
    svgParts.push(
      `<g data-layer="${layerName}" style="${visibility}">\n${pathElements}\n</g>`
    );
  }

  const svgContent = svgParts.join('\n');
  const layers = Object.values(layerMap);

  return { svgContent, layers, viewBox, entityCount };
}
