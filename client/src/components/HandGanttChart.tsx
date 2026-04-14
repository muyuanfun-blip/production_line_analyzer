import { useRef, useState, useCallback, useEffect } from "react";
import { Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── 型別 ─────────────────────────────────────────────────────────────────────

type HandActionType = "value_added" | "non_value_added" | "necessary_waste" | "idle";
type Hand = "left" | "right";

export interface GanttHandAction {
  id?: number;
  tempId: string;
  hand: Hand;
  actionName: string;
  duration: number; // 秒（已解析為數字）
  handActionType: HandActionType;
  isIdle: boolean;
  note?: string;
}

export interface GanttStep {
  tempId: string;
  stepName: string;
  duration: number;
  handActions: GanttHandAction[];
}

interface TooltipState {
  x: number;
  y: number;
  action: GanttHandAction;
  stepName: string;
  startSec: number;
}

// ─── 顏色設定 ─────────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<HandActionType, { fill: string; stroke: string; label: string }> = {
  value_added:     { fill: "#10b981", stroke: "#059669", label: "增值" },
  non_value_added: { fill: "#ef4444", stroke: "#dc2626", label: "非增值" },
  necessary_waste: { fill: "#f59e0b", stroke: "#d97706", label: "必要浪費" },
  idle:            { fill: "#374151", stroke: "#4b5563", label: "空手等待" },
};

const LEFT_COLOR  = "#3b82f6"; // 藍
const RIGHT_COLOR = "#8b5cf6"; // 紫

// ─── 常數 ─────────────────────────────────────────────────────────────────────

const ROW_H       = 28;  // 每行高度 px
const LABEL_W     = 52;  // 左側標籤寬度
const AXIS_H      = 24;  // 時間軸高度
const STEP_GAP    = 6;   // 步驟間距
const PADDING_TOP = 8;

// ─── 主元件 ───────────────────────────────────────────────────────────────────

interface HandGanttChartProps {
  steps: GanttStep[];
  workstationName?: string;
  taktTime?: number;
}

export function HandGanttChart({ steps, workstationName, taktTime }: HandGanttChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [zoom, setZoom] = useState(1);

  // 過濾有雙手資料的步驟
  const stepsWithHands = steps.filter(s => s.handActions.length > 0);

  // 計算總時間（取所有步驟 duration 的總和，或雙手最大值）
  const totalSec = stepsWithHands.reduce((acc, s) => {
    const leftEnd  = s.handActions.filter(h => h.hand === "left").reduce((a, h) => a + h.duration, 0);
    const rightEnd = s.handActions.filter(h => h.hand === "right").reduce((a, h) => a + h.duration, 0);
    return acc + Math.max(s.duration, leftEnd, rightEnd);
  }, 0);

  if (stepsWithHands.length === 0 || totalSec <= 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/40 text-sm gap-2">
        <svg viewBox="0 0 48 48" className="w-10 h-10 opacity-30" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="6" y="14" width="36" height="8" rx="2" />
          <rect x="6" y="26" width="36" height="8" rx="2" />
          <line x1="6" y1="10" x2="6" y2="38" />
        </svg>
        <p>尚無雙手動作資料</p>
        <p className="text-xs text-muted-foreground/30">請在動作步驟中展開「雙手輸入」並填寫左右手動作</p>
      </div>
    );
  }

  // SVG 尺寸計算
  // 每個步驟佔：左手行 + 右手行 + 步驟標籤行 = 3 * ROW_H + STEP_GAP
  const stepBlockH = ROW_H * 2 + STEP_GAP + 20; // 20 = 步驟名稱列
  const svgH = PADDING_TOP + AXIS_H + stepsWithHands.length * stepBlockH + 16;

  // 時間軸寬度（依 zoom）
  const chartW = 600 * zoom;

  function secToX(sec: number): number {
    return LABEL_W + (sec / totalSec) * chartW;
  }

  // 刻度生成
  function buildTicks(): number[] {
    const count = Math.max(5, Math.round(10 * zoom));
    const interval = totalSec / count;
    const ticks: number[] = [];
    for (let i = 0; i <= count; i++) ticks.push(i * interval);
    return ticks;
  }

  const ticks = buildTicks();

  // Tooltip 處理
  const handleMouseEnter = useCallback((
    e: React.MouseEvent<SVGRectElement>,
    action: GanttHandAction,
    stepName: string,
    startSec: number
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left + 12,
      y: e.clientY - rect.top - 8,
      action,
      stepName,
      startSec,
    });
  }, []);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  // 下載 PNG
  function handleDownload() {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      const ns = "http://www.w3.org/2000/svg";
      const bg = document.createElementNS(ns, "rect");
      bg.setAttribute("width", "100%");
      bg.setAttribute("height", "100%");
      bg.setAttribute("fill", "#0f0f1a");
      clone.insertBefore(bg, clone.firstChild);

      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(clone);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width  = svg.clientWidth  * 2;
        canvas.height = svg.clientHeight * 2;
        const ctx = canvas.getContext("2d")!;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = pngUrl;
        a.download = `雙手甘特圖_${workstationName ?? "工站"}.png`;
        a.click();
        toast.success("甘特圖已下載");
      };
      img.src = url;
    } catch {
      toast.error("下載失敗，請稍後再試");
    }
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* 工具列 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* 圖例 */}
          {(Object.entries(TYPE_COLOR) as [HandActionType, typeof TYPE_COLOR[HandActionType]][]).map(([k, c]) => (
            <div key={k} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.fill }} />
              <span className="text-[10px] text-muted-foreground/70">{c.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setZoom(z => Math.min(z + 0.25, 3))} title="放大">
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} title="縮小">
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6"
            onClick={() => setZoom(1)} title="重置縮放">
            <RotateCcw className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs"
            onClick={handleDownload}>
            <Download className="w-3 h-3 mr-1" />下載
          </Button>
        </div>
      </div>

      {/* SVG 容器（可橫向捲動） */}
      <div
        ref={containerRef}
        className="relative overflow-x-auto rounded-lg border border-white/8 bg-background/40"
        style={{ maxHeight: "520px", overflowY: "auto" }}
      >
        <svg
          ref={svgRef}
          width={LABEL_W + chartW + 16}
          height={svgH}
          style={{ display: "block", minWidth: LABEL_W + chartW + 16 }}
        >
          {/* 背景 */}
          <rect width="100%" height="100%" fill="transparent" />

          {/* ── 時間軸 ── */}
          <g transform={`translate(0, ${PADDING_TOP})`}>
            {/* 軸線 */}
            <line
              x1={LABEL_W} y1={AXIS_H - 2}
              x2={LABEL_W + chartW} y2={AXIS_H - 2}
              stroke="rgba(255,255,255,0.1)" strokeWidth="1"
            />
            {/* 刻度 */}
            {ticks.map((t, i) => {
              const x = secToX(t);
              return (
                <g key={i}>
                  <line x1={x} y1={AXIS_H - 6} x2={x} y2={AXIS_H - 2}
                    stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x={x} y={AXIS_H - 10} textAnchor="middle"
                    fontSize="9" fill="rgba(255,255,255,0.35)">
                    {t.toFixed(1)}s
                  </text>
                </g>
              );
            })}

            {/* Takt Time 參考線 */}
            {taktTime && taktTime > 0 && taktTime <= totalSec && (
              <g>
                <line
                  x1={secToX(taktTime)} y1={AXIS_H - 2}
                  x2={secToX(taktTime)} y2={svgH - PADDING_TOP - 8}
                  stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7"
                />
                <text x={secToX(taktTime) + 3} y={AXIS_H + 8}
                  fontSize="9" fill="#a78bfa" opacity="0.9">
                  Takt {taktTime.toFixed(1)}s
                </text>
              </g>
            )}
          </g>

          {/* ── 步驟區塊 ── */}
          {stepsWithHands.map((step, si) => {
            const offsetY = PADDING_TOP + AXIS_H + si * stepBlockH;
            const leftActions  = step.handActions.filter(h => h.hand === "left");
            const rightActions = step.handActions.filter(h => h.hand === "right");

            // 計算步驟在全域時間軸上的起始秒
            const stepStartSec = stepsWithHands
              .slice(0, si)
              .reduce((acc, s) => {
                const lEnd = s.handActions.filter(h => h.hand === "left").reduce((a, h) => a + h.duration, 0);
                const rEnd = s.handActions.filter(h => h.hand === "right").reduce((a, h) => a + h.duration, 0);
                return acc + Math.max(s.duration, lEnd, rEnd);
              }, 0);

            // 步驟背景斑馬紋
            const stepW = secToX(
              Math.max(
                step.duration,
                leftActions.reduce((a, h) => a + h.duration, 0),
                rightActions.reduce((a, h) => a + h.duration, 0)
              )
            ) - LABEL_W;

            return (
              <g key={step.tempId} transform={`translate(0, ${offsetY})`}>
                {/* 步驟名稱列 */}
                <rect x={0} y={0} width={LABEL_W + chartW + 16} height={20}
                  fill={si % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent"} />
                <text x={LABEL_W / 2} y={13} textAnchor="middle"
                  fontSize="9" fill="rgba(255,255,255,0.5)" fontWeight="500">
                  {`S${si + 1}`}
                </text>
                <text x={LABEL_W + 4} y={13}
                  fontSize="9" fill="rgba(255,255,255,0.55)">
                  {step.stepName.length > 20 ? step.stepName.slice(0, 20) + "…" : step.stepName}
                </text>

                {/* 步驟範圍底色 */}
                <rect
                  x={LABEL_W} y={20}
                  width={stepW} height={ROW_H * 2 + 2}
                  fill={si % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent"}
                  rx="2"
                />

                {/* 左手行 */}
                <g transform={`translate(0, 20)`}>
                  {/* 行標籤 */}
                  <rect x={0} y={0} width={LABEL_W} height={ROW_H}
                    fill="rgba(59,130,246,0.08)" />
                  <text x={LABEL_W / 2} y={ROW_H / 2 + 4} textAnchor="middle"
                    fontSize="9" fill={LEFT_COLOR} fontWeight="600">左手</text>

                  {/* 左手動作區塊 */}
                  {(() => {
                    let cursor = stepStartSec;
                    return leftActions.map((ha, hi) => {
                      const x1 = secToX(cursor);
                      const w  = Math.max(1, secToX(cursor + ha.duration) - x1);
                      const cfg = TYPE_COLOR[ha.isIdle ? "idle" : ha.handActionType];
                      const startSec = cursor;
                      cursor += ha.duration;
                      return (
                        <g key={ha.tempId}>
                          <rect
                            x={x1} y={2} width={w} height={ROW_H - 4}
                            fill={cfg.fill} stroke={cfg.stroke} strokeWidth="0.5"
                            rx="3" opacity={ha.isIdle ? 0.45 : 0.85}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={e => handleMouseEnter(e, ha, step.stepName, startSec)}
                            onMouseLeave={handleMouseLeave}
                          />
                          {/* 動作名稱（寬度夠才顯示） */}
                          {w > 30 && (
                            <text
                              x={x1 + w / 2} y={ROW_H / 2 + 3}
                              textAnchor="middle" fontSize="8"
                              fill="rgba(255,255,255,0.9)"
                              style={{ pointerEvents: "none", userSelect: "none" }}>
                              {ha.isIdle ? "空手" : (ha.actionName.length > Math.floor(w / 6) ? ha.actionName.slice(0, Math.floor(w / 6)) + "…" : ha.actionName)}
                            </text>
                          )}
                          {/* 時間標籤（寬度夠才顯示） */}
                          {w > 22 && (
                            <text
                              x={x1 + w / 2} y={ROW_H - 5}
                              textAnchor="middle" fontSize="7"
                              fill="rgba(255,255,255,0.55)"
                              style={{ pointerEvents: "none", userSelect: "none" }}>
                              {ha.duration.toFixed(1)}s
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}
                </g>

                {/* 右手行 */}
                <g transform={`translate(0, ${20 + ROW_H})`}>
                  {/* 行標籤 */}
                  <rect x={0} y={0} width={LABEL_W} height={ROW_H}
                    fill="rgba(139,92,246,0.08)" />
                  <text x={LABEL_W / 2} y={ROW_H / 2 + 4} textAnchor="middle"
                    fontSize="9" fill={RIGHT_COLOR} fontWeight="600">右手</text>

                  {/* 右手動作區塊 */}
                  {(() => {
                    let cursor = stepStartSec;
                    return rightActions.map((ha, hi) => {
                      const x1 = secToX(cursor);
                      const w  = Math.max(1, secToX(cursor + ha.duration) - x1);
                      const cfg = TYPE_COLOR[ha.isIdle ? "idle" : ha.handActionType];
                      const startSec = cursor;
                      cursor += ha.duration;
                      return (
                        <g key={ha.tempId}>
                          <rect
                            x={x1} y={2} width={w} height={ROW_H - 4}
                            fill={cfg.fill} stroke={cfg.stroke} strokeWidth="0.5"
                            rx="3" opacity={ha.isIdle ? 0.45 : 0.85}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={e => handleMouseEnter(e, ha, step.stepName, startSec)}
                            onMouseLeave={handleMouseLeave}
                          />
                          {w > 30 && (
                            <text
                              x={x1 + w / 2} y={ROW_H / 2 + 3}
                              textAnchor="middle" fontSize="8"
                              fill="rgba(255,255,255,0.9)"
                              style={{ pointerEvents: "none", userSelect: "none" }}>
                              {ha.isIdle ? "空手" : (ha.actionName.length > Math.floor(w / 6) ? ha.actionName.slice(0, Math.floor(w / 6)) + "…" : ha.actionName)}
                            </text>
                          )}
                          {w > 22 && (
                            <text
                              x={x1 + w / 2} y={ROW_H - 5}
                              textAnchor="middle" fontSize="7"
                              fill="rgba(255,255,255,0.55)"
                              style={{ pointerEvents: "none", userSelect: "none" }}>
                              {ha.duration.toFixed(1)}s
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}
                </g>

                {/* 步驟分隔線 */}
                {si < stepsWithHands.length - 1 && (
                  <line
                    x1={0} y1={stepBlockH - STEP_GAP / 2}
                    x2={LABEL_W + chartW + 16} y2={stepBlockH - STEP_GAP / 2}
                    stroke="rgba(255,255,255,0.06)" strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <div className="bg-card border border-border rounded-xl p-3 shadow-2xl text-xs min-w-[160px] max-w-[220px]">
              <p className="font-semibold text-foreground mb-2 border-b border-border pb-1.5 truncate">
                {tooltip.stepName}
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: TYPE_COLOR[tooltip.action.isIdle ? "idle" : tooltip.action.handActionType].fill }}
                  />
                  <span className="text-foreground font-medium truncate">
                    {tooltip.action.isIdle ? "空手等待" : (tooltip.action.actionName || "未命名")}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">手別</span>
                  <span style={{ color: tooltip.action.hand === "left" ? LEFT_COLOR : RIGHT_COLOR }}>
                    {tooltip.action.hand === "left" ? "左手" : "右手"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">類型</span>
                  <span style={{ color: TYPE_COLOR[tooltip.action.isIdle ? "idle" : tooltip.action.handActionType].fill }}>
                    {TYPE_COLOR[tooltip.action.isIdle ? "idle" : tooltip.action.handActionType].label}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">開始</span>
                  <span className="tabular-nums text-foreground">{tooltip.startSec.toFixed(2)}s</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">持續</span>
                  <span className="tabular-nums font-bold text-foreground">{tooltip.action.duration.toFixed(2)}s</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">結束</span>
                  <span className="tabular-nums text-foreground">{(tooltip.startSec + tooltip.action.duration).toFixed(2)}s</span>
                </div>
                {tooltip.action.note && (
                  <div className="pt-1 border-t border-border/50">
                    <span className="text-muted-foreground/70 text-[10px]">{tooltip.action.note}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部統計摘要 */}
      <GanttSummary steps={stepsWithHands} totalSec={totalSec} taktTime={taktTime} />
    </div>
  );
}

// ─── 底部統計摘要 ─────────────────────────────────────────────────────────────

function GanttSummary({
  steps,
  totalSec,
  taktTime,
}: {
  steps: GanttStep[];
  totalSec: number;
  taktTime?: number;
}) {
  const allHands = steps.flatMap(s => s.handActions);
  const leftHands  = allHands.filter(h => h.hand === "left");
  const rightHands = allHands.filter(h => h.hand === "right");

  const leftTotal  = leftHands.reduce((a, h) => a + h.duration, 0);
  const rightTotal = rightHands.reduce((a, h) => a + h.duration, 0);
  const leftIdle   = leftHands.filter(h => h.isIdle || h.handActionType === "idle").reduce((a, h) => a + h.duration, 0);
  const rightIdle  = rightHands.filter(h => h.isIdle || h.handActionType === "idle").reduce((a, h) => a + h.duration, 0);
  const leftActive  = leftTotal - leftIdle;
  const rightActive = rightTotal - rightIdle;
  const maxTotal    = Math.max(leftTotal, rightTotal);
  const syncRate    = maxTotal > 0 ? (Math.min(leftActive, rightActive) / maxTotal) * 100 : 0;

  const syncColor = syncRate >= 80 ? "#10b981" : syncRate >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="grid grid-cols-4 gap-2 text-xs">
      <div className="rounded-lg border border-white/8 bg-card/40 p-2.5 text-center">
        <p className="text-muted-foreground/60 mb-0.5">總週期時間</p>
        <p className="font-bold text-foreground tabular-nums">{totalSec.toFixed(2)}s</p>
      </div>
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-2.5 text-center">
        <p className="text-blue-400/70 mb-0.5">左手作業</p>
        <p className="font-bold tabular-nums" style={{ color: LEFT_COLOR }}>
          {leftActive.toFixed(1)}s
          {leftIdle > 0 && <span className="text-[9px] text-muted-foreground/50 ml-1">空{leftIdle.toFixed(1)}s</span>}
        </p>
      </div>
      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5 text-center">
        <p className="text-violet-400/70 mb-0.5">右手作業</p>
        <p className="font-bold tabular-nums" style={{ color: RIGHT_COLOR }}>
          {rightActive.toFixed(1)}s
          {rightIdle > 0 && <span className="text-[9px] text-muted-foreground/50 ml-1">空{rightIdle.toFixed(1)}s</span>}
        </p>
      </div>
      <div className="rounded-lg border border-white/8 bg-card/40 p-2.5 text-center">
        <p className="text-muted-foreground/60 mb-0.5">雙手同步率</p>
        <p className="font-bold tabular-nums" style={{ color: syncColor }}>
          {syncRate.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
