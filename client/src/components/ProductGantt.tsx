/**
 * ProductGantt.tsx
 * 多個產品序號並排比較的甘特圖
 * 橫軸：時間（可縮放 / 拖曳）
 * 縱軸：各產品序號
 * 每列顯示各工站的加工時間（實色）和等待時間（半透明）
 */
import { useRef, useState, useCallback, useMemo, useEffect } from "react";
import {
  ZoomIn, ZoomOut, RotateCcw, CheckCircle2, Clock, RotateCcw as ReworkIcon,
  Minus, Filter, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── 型別 ─────────────────────────────────────────────────────────────────────
type FlowStatus = "normal" | "rework" | "waiting" | "skipped";

export interface GanttFlowRecord {
  id: number;
  productInstanceId: number;
  workstationId: number;
  workstationName: string;
  sequenceOrder: number;
  entryTime?: Date | string | null;
  exitTime?: Date | string | null;
  actualCycleTime?: string | number | null;
  waitTime?: string | number | null;
  status: FlowStatus | string;
  operatorName?: string | null;
}

export interface GanttInstance {
  id: number;
  serialNumber: string;
  batchNumber?: string | null;
  status: string;
}

interface ProductGanttProps {
  instances: GanttInstance[];
  flowRecords: GanttFlowRecord[];
  /** 所有工站名稱（用於圖例） */
  workstationNames?: string[];
}

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 160;
const HEADER_HEIGHT = 36;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.25;

// 工站顏色調色盤（最多 20 個工站）
const WS_COLORS = [
  "#22c55e", "#3b82f6", "#f97316", "#a855f7", "#06b6d4",
  "#ec4899", "#eab308", "#14b8a6", "#f43f5e", "#8b5cf6",
  "#84cc16", "#0ea5e9", "#fb923c", "#c084fc", "#2dd4bf",
  "#f472b6", "#facc15", "#34d399", "#60a5fa", "#e879f9",
];

const STATUS_COLORS: Record<string, string> = {
  normal: "#22c55e",
  rework: "#f97316",
  waiting: "#3b82f6",
  skipped: "#6b7280",
};

// ─── 工具函式 ─────────────────────────────────────────────────────────────────
function toSec(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function fmtSec(sec: number): string {
  if (sec <= 0) return "0s";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(0).padStart(2, "0");
  return `${m}m${s}s`;
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export default function ProductGantt({ instances, flowRecords, workstationNames }: ProductGanttProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0); // 橫向偏移（px）
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [tooltip, setTooltip] = useState<{
    visible: boolean; x: number; y: number;
    record: GanttFlowRecord | null; instanceSN: string;
  }>({ visible: false, x: 0, y: 0, record: null, instanceSN: "" });
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [colorMode, setColorMode] = useState<"workstation" | "status">("workstation");

  // ─── 計算甘特圖資料 ──────────────────────────────────────────────────────
  const ganttData = useMemo(() => {
    // 收集所有工站名稱（用於顏色對應）
    const wsNames: string[] = workstationNames ?? [];
    const wsColorMap = new Map<string, string>();
    const allWsNames = Array.from(new Set(flowRecords.map(r => r.workstationName)));
    allWsNames.forEach((name, i) => {
      if (!wsColorMap.has(name)) wsColorMap.set(name, WS_COLORS[i % WS_COLORS.length]);
    });

    // 計算每個 instance 的時間資料
    const rows = instances.map(inst => {
      const records = flowRecords
        .filter(r => r.productInstanceId === inst.id)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder);

      // 判斷是否有時間戳
      const hasTimestamps = records.some(r => r.entryTime);

      let segments: Array<{
        record: GanttFlowRecord;
        startSec: number;
        ctSec: number;
        wtSec: number;
        color: string;
        wsIndex: number;
      }> = [];

      if (hasTimestamps) {
        // 模式 A：使用實際時間戳
        const entryTimes = records.filter(r => r.entryTime).map(r => new Date(r.entryTime!).getTime());
        const minTime = Math.min(...entryTimes);
        records.forEach(r => {
          const startMs = r.entryTime ? new Date(r.entryTime).getTime() - minTime : 0;
          const startSec = startMs / 1000;
          let ctSec = toSec(r.actualCycleTime);
          if (r.entryTime && r.exitTime) {
            const diff = (new Date(r.exitTime).getTime() - new Date(r.entryTime).getTime()) / 1000;
            if (diff > 0) ctSec = diff;
          }
          const wtSec = toSec(r.waitTime);
          const wsIdx = allWsNames.indexOf(r.workstationName);
          segments.push({
            record: r, startSec, ctSec, wtSec,
            color: colorMode === "workstation"
              ? (wsColorMap.get(r.workstationName) ?? WS_COLORS[0])
              : (STATUS_COLORS[r.status] ?? STATUS_COLORS.normal),
            wsIndex: wsIdx,
          });
        });
      } else {
        // 模式 B：累積時間
        let cursor = 0;
        records.forEach(r => {
          const wtSec = toSec(r.waitTime);
          const ctSec = toSec(r.actualCycleTime);
          const startSec = cursor;
          cursor += wtSec + ctSec;
          const wsIdx = allWsNames.indexOf(r.workstationName);
          segments.push({
            record: r, startSec, ctSec, wtSec,
            color: colorMode === "workstation"
              ? (wsColorMap.get(r.workstationName) ?? WS_COLORS[0])
              : (STATUS_COLORS[r.status] ?? STATUS_COLORS.normal),
            wsIndex: wsIdx,
          });
        });
      }

      // 計算此 instance 的總時長
      const totalSec = segments.reduce((max, s) => Math.max(max, s.startSec + s.wtSec + s.ctSec), 0);
      const totalCt = segments.reduce((s, seg) => s + seg.ctSec, 0);
      const totalWt = segments.reduce((s, seg) => s + seg.wtSec, 0);

      return { inst, segments, totalSec, totalCt, totalWt, hasTimestamps };
    });

    // 找出全局最大時長（用於縮放基準）
    const globalMaxSec = Math.max(...rows.map(r => r.totalSec), 1);

    return { rows, wsColorMap, allWsNames, globalMaxSec };
  }, [instances, flowRecords, colorMode, workstationNames]);

  // ─── 縮放計算 ────────────────────────────────────────────────────────────
  // 基準：1px = globalMaxSec / baseWidth 秒
  const baseWidth = 800; // 甘特圖基準寬度（px）
  const pxPerSec = useMemo(
    () => (baseWidth * zoom) / ganttData.globalMaxSec,
    [zoom, ganttData.globalMaxSec]
  );

  const totalGanttWidth = useMemo(
    () => ganttData.globalMaxSec * pxPerSec,
    [ganttData.globalMaxSec, pxPerSec]
  );

  // ─── 縮放控制 ────────────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM)), []);
  const handleReset = useCallback(() => { setZoom(1); setPanOffset(0); }, []);

  // 滾輪縮放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  }, []);

  // 拖曳平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX - panOffset);
  }, [panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const newOffset = e.clientX - dragStart;
    const maxOffset = 0;
    const minOffset = -(totalGanttWidth - baseWidth * 0.5);
    setPanOffset(Math.min(maxOffset, Math.max(minOffset, newOffset)));
  }, [isDragging, dragStart, totalGanttWidth]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // ─── 篩選 ────────────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (filterStatus === "all") return ganttData.rows;
    return ganttData.rows.filter(row =>
      row.segments.some(s => s.record.status === filterStatus)
    );
  }, [ganttData.rows, filterStatus]);

  // ─── 時間刻度 ────────────────────────────────────────────────────────────
  const timeTicksSec = useMemo(() => {
    const totalSec = ganttData.globalMaxSec;
    // 選擇合適的刻度間隔
    const targetTicks = 8;
    const rawInterval = totalSec / targetTicks;
    const niceIntervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];
    const interval = niceIntervals.find(i => i >= rawInterval) ?? 3600;
    const ticks: number[] = [];
    for (let t = 0; t <= totalSec + interval; t += interval) {
      ticks.push(t);
    }
    return { ticks, interval };
  }, [ganttData.globalMaxSec]);

  // ─── 空狀態 ───────────────────────────────────────────────────────────────
  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-sm">尚無產品序號資料</p>
        <p className="text-xs mt-1 opacity-60">請先在「產品追蹤」頁面建立產品序號並新增流程記錄</p>
      </div>
    );
  }

  const canvasHeight = filteredRows.length * ROW_HEIGHT + HEADER_HEIGHT;

  return (
    <div className="flex flex-col h-full">
      {/* ─── 工具列 ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-card/20 shrink-0">
        {/* 縮放控制 */}
        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden">
          <button onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM}
            className="px-2 py-1.5 hover:bg-accent/50 disabled:opacity-30 transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-xs font-mono min-w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
          <button onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}
            className="px-2 py-1.5 hover:bg-accent/50 disabled:opacity-30 transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
        <button onClick={handleReset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 border border-border rounded-md hover:bg-accent/50">
          <RotateCcw className="w-3.5 h-3.5" />重置
        </button>

        <div className="h-4 w-px bg-border/50" />

        {/* 顏色模式 */}
        <div className="flex items-center gap-1 border border-border rounded-md overflow-hidden text-xs">
          <button
            onClick={() => setColorMode("workstation")}
            className={`px-2.5 py-1.5 transition-colors ${colorMode === "workstation" ? "bg-primary text-primary-foreground" : "hover:bg-accent/50"}`}
          >按工站</button>
          <button
            onClick={() => setColorMode("status")}
            className={`px-2.5 py-1.5 transition-colors ${colorMode === "status" ? "bg-primary text-primary-foreground" : "hover:bg-accent/50"}`}
          >按狀態</button>
        </div>

        {/* 篩選 */}
        <div className="relative">
          <button
            onClick={() => setShowFilterMenu(m => !m)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-border rounded-md hover:bg-accent/50"
          >
            <Filter className="w-3.5 h-3.5" />
            {filterStatus === "all" ? "全部序號" : filterStatus}
            <ChevronDown className="w-3 h-3" />
          </button>
          {showFilterMenu && (
            <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-20 min-w-32 py-1">
              {["all", "in_progress", "completed", "rework", "scrapped"].map(s => (
                <button
                  key={s}
                  onClick={() => { setFilterStatus(s); setShowFilterMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-accent/50 ${filterStatus === s ? "text-primary" : ""}`}
                >
                  {s === "all" ? "全部序號" : s === "in_progress" ? "生產中" : s === "completed" ? "完成" : s === "rework" ? "重工中" : "報廢"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <span>共 {filteredRows.length} 個序號</span>
          <span className="opacity-50">｜</span>
          <span>滾輪縮放 · 拖曳平移</span>
        </div>
      </div>

      {/* ─── 甘特圖主體 ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左側：序號標籤（固定） */}
        <div
          className="shrink-0 border-r border-border bg-card/30"
          style={{ width: LABEL_WIDTH }}
        >
          {/* 標頭空白 */}
          <div
            className="border-b border-border bg-card/50 flex items-center px-3"
            style={{ height: HEADER_HEIGHT }}
          >
            <span className="text-xs font-semibold text-muted-foreground">產品序號</span>
          </div>
          {/* 各列標籤 */}
          {filteredRows.map(({ inst, totalCt, totalWt }) => {
            const leadTime = totalCt + totalWt;
            const vr = leadTime > 0 ? (totalCt / leadTime) * 100 : 0;
            return (
              <div
                key={inst.id}
                className="border-b border-border/50 flex flex-col justify-center px-3"
                style={{ height: ROW_HEIGHT }}
              >
                <span className="text-xs font-mono font-medium truncate" title={inst.serialNumber}>
                  {inst.serialNumber}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-muted-foreground font-mono">{fmtSec(leadTime)}</span>
                  <span className={`text-xs ${vr >= 70 ? "text-emerald-400" : vr >= 40 ? "text-amber-400" : "text-red-400"}`}>
                    {leadTime > 0 ? `${vr.toFixed(0)}%` : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 右側：甘特圖畫布 */}
        <div
          className="flex-1 overflow-hidden relative"
          style={{ cursor: isDragging ? "grabbing" : "grab" }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setShowFilterMenu(false)}
        >
          {/* 可平移的內容層 */}
          <div
            style={{
              transform: `translateX(${panOffset}px)`,
              width: totalGanttWidth + 40,
              minWidth: "100%",
              position: "relative",
            }}
          >
            {/* 時間刻度 Header */}
            <div
              className="border-b border-border bg-card/50 flex items-end"
              style={{ height: HEADER_HEIGHT, position: "sticky", top: 0, zIndex: 10 }}
            >
              {timeTicksSec.ticks.map((t, i) => (
                <div
                  key={i}
                  className="absolute bottom-0 flex flex-col items-center"
                  style={{ left: t * pxPerSec }}
                >
                  <div className="h-2 w-px bg-border/60" />
                  <span className="text-xs text-muted-foreground/70 font-mono whitespace-nowrap" style={{ fontSize: 10 }}>
                    {fmtSec(t)}
                  </span>
                </div>
              ))}
            </div>

            {/* 各列甘特條 */}
            {filteredRows.map(({ inst, segments }) => (
              <div
                key={inst.id}
                className="border-b border-border/30 relative"
                style={{ height: ROW_HEIGHT }}
              >
                {/* 垂直格線 */}
                {timeTicksSec.ticks.map((t, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/20"
                    style={{ left: t * pxPerSec }}
                  />
                ))}

                {/* 甘特條 */}
                {segments.map((seg) => {
                  const x = seg.startSec * pxPerSec;
                  const wtW = seg.wtSec * pxPerSec;
                  const ctW = Math.max(seg.ctSec * pxPerSec, seg.ctSec > 0 ? 2 : 0);
                  const barY = (ROW_HEIGHT - 24) / 2;

                  return (
                    <div key={seg.record.id}>
                      {/* 等待時間（半透明） */}
                      {seg.wtSec > 0 && (
                        <div
                          className="absolute rounded-sm"
                          style={{
                            left: x,
                            top: barY,
                            width: Math.max(wtW, 2),
                            height: 24,
                            backgroundColor: `${seg.color}33`,
                            border: `1px solid ${seg.color}66`,
                          }}
                        />
                      )}
                      {/* 加工時間（實色） */}
                      {seg.ctSec > 0 && (
                        <div
                          className="absolute rounded-sm cursor-pointer"
                          style={{
                            left: x + wtW,
                            top: barY,
                            width: ctW,
                            height: 24,
                            backgroundColor: seg.color,
                            opacity: 0.9,
                          }}
                          onMouseEnter={(e) => {
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltip({
                                visible: true,
                                x: e.clientX - rect.left,
                                y: e.clientY - rect.top,
                                record: seg.record,
                                instanceSN: inst.serialNumber,
                              });
                            }
                          }}
                          onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                          onMouseMove={(e) => {
                            const rect = canvasRef.current?.getBoundingClientRect();
                            if (rect) {
                              setTooltip(t => ({ ...t, x: e.clientX - rect.left, y: e.clientY - rect.top }));
                            }
                          }}
                        />
                      )}
                      {/* 跳過：虛線 */}
                      {seg.record.status === "skipped" && seg.ctSec === 0 && (
                        <div
                          className="absolute"
                          style={{
                            left: x,
                            top: ROW_HEIGHT / 2 - 1,
                            width: 20,
                            height: 2,
                            borderTop: "2px dashed #6b7280",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Tooltip（相對於外層容器） */}
          {tooltip.visible && tooltip.record && (
            <div
              className="absolute z-50 pointer-events-none bg-popover border border-border rounded-lg shadow-xl p-3 text-xs min-w-52"
              style={{
                left: tooltip.x + 14,
                top: tooltip.y - 10,
                transform: tooltip.x > 500 ? "translateX(-110%)" : undefined,
              }}
              ref={canvasRef}
            >
              <p className="font-semibold mb-1">{tooltip.instanceSN}</p>
              <p className="text-muted-foreground mb-1.5">{tooltip.record.workstationName}</p>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between gap-4">
                  <span>加工時間</span>
                  <span className="text-primary font-mono">{fmtSec(toSec(tooltip.record.actualCycleTime))}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>等待時間</span>
                  <span className="text-amber-400 font-mono">
                    {toSec(tooltip.record.waitTime) > 0 ? fmtSec(toSec(tooltip.record.waitTime)) : "—"}
                  </span>
                </div>
                {tooltip.record.entryTime && (
                  <div className="flex justify-between gap-4">
                    <span>進入</span>
                    <span className="font-mono">{fmtDateTime(tooltip.record.entryTime)}</span>
                  </div>
                )}
                {tooltip.record.exitTime && (
                  <div className="flex justify-between gap-4">
                    <span>離開</span>
                    <span className="font-mono">{fmtDateTime(tooltip.record.exitTime)}</span>
                  </div>
                )}
                {tooltip.record.operatorName && (
                  <div className="flex justify-between gap-4">
                    <span>作業員</span>
                    <span>{tooltip.record.operatorName}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span>狀態</span>
                  <span className={
                    tooltip.record.status === "normal" ? "text-emerald-400" :
                    tooltip.record.status === "rework" ? "text-orange-400" :
                    tooltip.record.status === "waiting" ? "text-blue-400" : "text-gray-400"
                  }>
                    {tooltip.record.status === "normal" ? "正常" :
                     tooltip.record.status === "rework" ? "重工" :
                     tooltip.record.status === "waiting" ? "等待" : "跳過"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 圖例 ────────────────────────────────────────────────────────── */}
      <div className="border-t border-border/50 px-4 py-2 bg-card/20 shrink-0">
        {colorMode === "workstation" ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {ganttData.allWsNames.map((name, i) => (
              <div key={name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className="inline-block w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: WS_COLORS[i % WS_COLORS.length] }}
                />
                {name}
              </div>
            ))}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-4">
              <span className="inline-block w-3 h-3 rounded-sm border border-dashed border-muted-foreground/50 bg-muted/30" />
              等待時間（半透明）
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                {status === "normal" ? "正常" : status === "rework" ? "重工" : status === "waiting" ? "等待" : "跳過"}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
