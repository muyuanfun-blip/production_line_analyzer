/**
 * dxf.test.ts
 * DXF 解析與 SVG 轉換的 Vitest 測試
 * 注意：dxfToSvg.ts 是前端模組，這裡直接測試其核心邏輯（不依賴 DOM）
 */
import { describe, it, expect } from 'vitest';

// ── 複製 dxfToSvg.ts 的核心函式供測試使用 ──────────────────────────────────

function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function arcPath(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number): string {
  const startRad = deg2rad(startAngleDeg);
  const endRad = deg2rad(endAngleDeg);
  const x1 = cx + r * Math.cos(startRad);
  const y1 = -(cy + r * Math.sin(startRad));
  const x2 = cx + r * Math.cos(endRad);
  const y2 = -(cy + r * Math.sin(endRad));
  let sweep = endAngleDeg - startAngleDeg;
  if (sweep < 0) sweep += 360;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 0 ${x2} ${y2}`;
}

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
        return arcPath(cx, cy, r, entity.startAngle ?? 0, entity.endAngle ?? 360);
      }
      case 'CIRCLE': {
        const cx = entity.center?.x ?? 0;
        const cy = -(entity.center?.y ?? 0);
        const r = entity.radius ?? 1;
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

// ── 測試 ──────────────────────────────────────────────────────────────────

describe('DXF entityToPath 轉換', () => {
  describe('LINE 實體', () => {
    it('應正確轉換 LINE（使用 start/end 格式）', () => {
      const entity = { type: 'LINE', start: { x: 0, y: 0 }, end: { x: 100, y: 50 } };
      const path = entityToPath(entity);
      expect(path).toBe('M 0 0 L 100 -50');
    });

    it('應正確轉換 LINE（使用 vertices 格式）', () => {
      const entity = { type: 'LINE', vertices: [{ x: 10, y: 20 }, { x: 30, y: 40 }] };
      const path = entityToPath(entity);
      expect(path).toBe('M 10 -20 L 30 -40');
    });

    it('Y 軸應翻轉（DXF Y 向上 → SVG Y 向下）', () => {
      const entity = { type: 'LINE', start: { x: 0, y: 100 }, end: { x: 0, y: 0 } };
      const path = entityToPath(entity);
      expect(path).toBe('M 0 -100 L 0 0');
    });
  });

  describe('LWPOLYLINE 實體', () => {
    it('應正確轉換多段折線', () => {
      const entity = {
        type: 'LWPOLYLINE',
        vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
      };
      const path = entityToPath(entity);
      expect(path).toBe('M 0 0 L 100 0 L 100 -100');
    });

    it('閉合折線應加上 Z', () => {
      const entity = {
        type: 'LWPOLYLINE',
        vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }],
        closed: true,
      };
      const path = entityToPath(entity);
      expect(path).toContain('Z');
    });

    it('少於 2 個頂點應回傳 null', () => {
      const entity = { type: 'LWPOLYLINE', vertices: [{ x: 0, y: 0 }] };
      const path = entityToPath(entity);
      expect(path).toBeNull();
    });
  });

  describe('CIRCLE 實體', () => {
    it('應轉換為兩段半圓弧', () => {
      const entity = { type: 'CIRCLE', center: { x: 50, y: 50 }, radius: 10 };
      const path = entityToPath(entity);
      expect(path).toContain('A 10 10');
      expect(path).toContain('Z');
      // 圓心 Y 應翻轉
      expect(path).toContain('-50');
    });
  });

  describe('ARC 實體', () => {
    it('應正確轉換 90 度圓弧', () => {
      const entity = {
        type: 'ARC',
        center: { x: 0, y: 0 },
        radius: 10,
        startAngle: 0,
        endAngle: 90,
      };
      const path = entityToPath(entity);
      expect(path).toContain('A 10 10');
      // 0 度起點：cos(0)=1, sin(0)=0 → (10, 0)
      expect(path).toMatch(/M 10 -?0/);
    });

    it('大於 180 度的圓弧應使用 largeArc=1', () => {
      const entity = {
        type: 'ARC',
        center: { x: 0, y: 0 },
        radius: 10,
        startAngle: 0,
        endAngle: 270,
      };
      const path = entityToPath(entity);
      expect(path).toContain('1 0');  // largeArc=1, sweep=0
    });
  });

  describe('SPLINE 實體', () => {
    it('應將控制點近似為直線段', () => {
      const entity = {
        type: 'SPLINE',
        controlPoints: [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }],
      };
      const path = entityToPath(entity);
      expect(path).toBe('M 0 0 L 50 -100 L 100 0');
    });

    it('少於 2 個控制點應回傳 null', () => {
      const entity = { type: 'SPLINE', controlPoints: [{ x: 0, y: 0 }] };
      const path = entityToPath(entity);
      expect(path).toBeNull();
    });
  });

  describe('不支援的實體類型', () => {
    it('TEXT 應回傳 null', () => {
      const entity = { type: 'TEXT', text: 'Hello', position: { x: 0, y: 0 } };
      const path = entityToPath(entity);
      expect(path).toBeNull();
    });

    it('MTEXT 應回傳 null', () => {
      const entity = { type: 'MTEXT', text: 'World', position: { x: 0, y: 0 } };
      const path = entityToPath(entity);
      expect(path).toBeNull();
    });

    it('DIMENSION 應回傳 null', () => {
      const entity = { type: 'DIMENSION' };
      const path = entityToPath(entity);
      expect(path).toBeNull();
    });
  });

  describe('容錯處理', () => {
    it('缺少必要屬性時不應拋出例外', () => {
      const entity = { type: 'LINE' };  // 沒有 start/end/vertices
      expect(() => entityToPath(entity)).not.toThrow();
    });

    it('null 屬性時不應拋出例外', () => {
      const entity = { type: 'CIRCLE', center: null, radius: null };
      expect(() => entityToPath(entity)).not.toThrow();
    });
  });
});

describe('arcPath 函式', () => {
  it('0 到 180 度應為小弧（largeArc=0）', () => {
    const path = arcPath(0, 0, 10, 0, 180);
    expect(path).toContain('0 0');  // largeArc=0, sweep=0
  });

  it('0 到 270 度應為大弧（largeArc=1）', () => {
    const path = arcPath(0, 0, 10, 0, 270);
    expect(path).toContain('1 0');  // largeArc=1, sweep=0
  });

  it('跨越 0 度（如 270 到 90）應正確計算 sweep', () => {
    const path = arcPath(0, 0, 10, 270, 90);
    // sweep = 90 - 270 = -180, +360 = 180, largeArc = 0
    expect(path).toContain('0 0');
  });
});

describe('DXF viewBox 計算', () => {
  it('應從路徑數字中提取 bounding box', () => {
    // 模擬 parseDxfToSvg 的 bounding box 計算邏輯
    const paths = ['M 0 0 L 100 -200', 'M 50 -50 L 150 -100'];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of paths) {
      const nums = p.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
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
    expect(minX).toBe(0);
    expect(maxX).toBe(150);
    expect(minY).toBe(-200);
    expect(maxY).toBe(0);
  });
});
