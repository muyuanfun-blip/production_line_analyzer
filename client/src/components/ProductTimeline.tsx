/**
 * ProductTimeline.tsx
 * 單一產品序號的流程時間軸視圖
 * 以甘特圖式橫向時間軸呈現各工站的加工時間與等待時間分佈
 */
import { useMemo, useState, useRef } from "react";
import { Clock, RotateCcw, AlertCircle, CheckCircle2, XCircle, Minus } from "lucide-react";

// ─── 型別 ─────────────────────────────────────────────────────────────────────
type FlowStatus = "normal" | "rework" | "waiting" | "skipped";

export interface TimelineRecord {
  id: number;
  workstationId: number;
  workstationName: string;
  sequenceOrder: number;
  entryTime?: Date | string | null;
  exitTime?: Date | string | null;
  actualCycleTime?: string | number | null;
  waitTime?: string | number | null;
  status: FlowStatus | string;
  operatorName?: string | null;
  notes?: string | null;
}

interface ProductTimelineProps {
  records: TimelineRecord[];
  serialNumber: string;
}

// ─── 常數 ─────────────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, { bar: string; wait: string; badge: string; text: string }> = {
  normal:  { bar: "#22c55e", wait: "#f59e0b", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", text: "正常" },
  rework:  { bar: "#f97316", wait: "#f59e0b", badge: "bg-orange-500/15 text-orange-400 border-orange-500/30", text: "重工" },
  waiting: { bar: "#3b82f6", wait: "#f59e0b", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30", text: "等待" },
  skipped: { bar: "#6b7280", wait: "#6b7280", badge: "bg-gray-500/15 text-gray-400 border-gray-500/30", text: "跳過" },
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  normal:  <CheckCircle2 className="w-3 h-3" />,
  rework:  <RotateCcw className="w-3 h-3" />,
  waiting: <Clock className="w-3 h-3" />,
  skipped: <Minus className="w-3 h-3" />,
};

// ─── 工具函式 ─────────────────────────────────────────────────────────────────
function toSec(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

function fmtSec(sec: number): string {
  if (sec <= 0) return "—";
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(0).padStart(2, "0");
  return `${m}m ${s}s`;
}

function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────
export default function ProductTimeline({ records, serialNumber }: ProductTimelineProps) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // ─── 計算各工站時間資料 ───────────────────────────────────────────────────
  const processedRecords = useMemo(() => {
    return records.map((r) => {
      const ct = toSec(r.actualCycleTime);
      const wt = toSec(r.waitTime);
      // 若有 entryTime / exitTime，優先從時間戳計算實際 CT
      let computedCt = ct;
      if (r.entryTime && r.exitTime) {
        const entry = new Date(r.entryTime).getTime();
        const exit = new Date(r.exitTime).getTime();
        const diffSec = (exit - entry) / 1000;
        if (diffSec > 0) computedCt = diffSec;
      }
      return { ...r, ct: computedCt, wt, total: computedCt + wt };
    });
  }, [records]);

  const totalCt = useMemo(() => processedRecords.reduce((s, r) => s + r.ct, 0), [processedRecords]);
  const totalWt = useMemo(() => processedRecords.reduce((s, r) => s + r.wt, 0), [processedRecords]);
  const totalLeadTime = totalCt + totalWt;
  const valueAddRatio = totalLeadTime > 0 ? (totalCt / totalLeadTime) * 100 : 0;

  // ─── 甘特圖時間軸計算 ────────────────────────────────────────────────────
  // 找出最早進入時間作為基準點
  const timelineData = useMemo(() => {
    const hasTimestamps = processedRecords.some(r => r.entryTime);

    if (hasTimestamps) {
      // 模式 A：使用實際時間戳
      const times = processedRecords
        .filter(r => r.entryTime)
        .map(r => new Date(r.entryTime!).getTime());
      const minTime = Math.min(...times);
      const maxTime = Math.max(
        ...processedRecords
          .filter(r => r.exitTime)
          .map(r => new Date(r.exitTime!).getTime()),
        ...processedRecords
          .filter(r => r.entryTime)
          .map(r => new Date(r.entryTime!).getTime() + (r.ct + r.wt) * 1000)
      );
      const totalDuration = (maxTime - minTime) / 1000;

      return processedRecords.map((r) => {
        const startSec = r.entryTime ? (new Date(r.entryTime).getTime() - minTime) / 1000 : 0;
        const ctSec = r.ct;
        const wtSec = r.wt;
        return {
          ...r,
          startPct: totalDuration > 0 ? (startSec / totalDuration) * 100 : 0,
          ctPct: totalDuration > 0 ? (ctSec / totalDuration) * 100 : 0,
          wtPct: totalDuration > 0 ? (wtSec / totalDuration) * 100 : 0,
          totalDuration,
          minTime,
        };
      });
    } else {
      // 模式 B：使用累積時間（無時間戳時）
      let cursor = 0;
      return processedRecords.map((r) => {
        const startSec = cursor;
        cursor += r.ct + r.wt;
        return {
          ...r,
          startPct: totalLeadTime > 0 ? (startSec / totalLeadTime) * 100 : 0,
          ctPct: totalLeadTime > 0 ? (r.ct / totalLeadTime) * 100 : 0,
          wtPct: totalLeadTime > 0 ? (r.wt / totalLeadTime) * 100 : 0,
          totalDuration: totalLeadTime,
          minTime: 0,
        };
      });
    }
  }, [processedRecords, totalLeadTime]);

  const hasTimestamps = processedRecords.some(r => r.entryTime);

  // ─── 空狀態 ───────────────────────────────────────────────────────────────
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <AlertCircle className="w-10 h-10 mb-3 opacity-20" />
        <p className="text-sm">尚無工站流程記錄</p>
        <p className="text-xs mt-1 opacity-60">請先在「記錄」頁面新增工站流程記錄</p>
      </div>
    );
  }

  const hoveredRecord = hoveredId != null ? timelineData.find(r => r.id === hoveredId) : null;

  return (
    <div className="space-y-6 px-6 py-4" ref={containerRef}>
      {/* ─── KPI 統計列 ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "流經工站", value: records.length, unit: "站", color: "text-foreground" },
          { label: "總加工時間", value: fmtSec(totalCt), unit: "", color: "text-primary" },
          { label: "總等待時間", value: fmtSec(totalWt), unit: "", color: "text-amber-400" },
          { label: "Lead Time", value: fmtSec(totalLeadTime), unit: "", color: "text-foreground" },
          { label: "增值率", value: `${valueAddRatio.toFixed(1)}%`, unit: "", color: valueAddRatio >= 70 ? "text-emerald-400" : valueAddRatio >= 40 ? "text-amber-400" : "text-red-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card/40 border border-border/50 rounded-lg px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}<span className="text-sm font-normal ml-0.5">{kpi.unit}</span></p>
          </div>
        ))}
      </div>

      {/* ─── 增值率進度條 ────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>增值時間（加工）</span>
          <span>非增值時間（等待）</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden bg-muted flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${valueAddRatio}%` }}
          />
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${100 - valueAddRatio}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-emerald-400">{fmtSec(totalCt)} ({valueAddRatio.toFixed(1)}%)</span>
          <span className="text-amber-400">{fmtSec(totalWt)} ({(100 - valueAddRatio).toFixed(1)}%)</span>
        </div>
      </div>

      {/* ─── 甘特圖時間軸 ────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 mb-3">
          <h3 className="text-sm font-semibold">工站時間軸</h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm bg-emerald-500" />加工時間
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-2 rounded-sm bg-amber-500" />等待時間
            </span>
          </div>
          {hasTimestamps && (
            <span className="ml-auto text-xs text-muted-foreground">
              {fmtDate(processedRecords.find(r => r.entryTime)?.entryTime)}
            </span>
          )}
        </div>

        {/* 時間軸主體 */}
        <div className="space-y-1.5">
          {timelineData.map((r) => {
            const statusColor = STATUS_COLORS[r.status] ?? STATUS_COLORS.normal;
            const isHovered = hoveredId === r.id;
            const minBarPct = r.ct > 0 || r.wt > 0 ? Math.max(r.ctPct, 0.5) : 0;
            const minWtPct = r.wt > 0 ? Math.max(r.wtPct, 0.3) : 0;

            return (
              <div key={r.id} className="flex items-center gap-3 group">
                {/* 工站名稱（固定寬度） */}
                <div className="w-32 shrink-0 text-right">
                  <span className="text-xs font-medium truncate block" title={r.workstationName}>
                    {r.sequenceOrder}. {r.workstationName}
                  </span>
                </div>

                {/* 甘特條 */}
                <div className="flex-1 relative h-7">
                  {/* 背景軌道 */}
                  <div className="absolute inset-0 bg-muted/30 rounded" />

                  {/* 等待時間（左側，在加工時間之前） */}
                  {r.wt > 0 && (
                    <div
                      className="absolute top-0 h-full rounded-l overflow-hidden"
                      style={{
                        left: `${r.startPct}%`,
                        width: `${minWtPct}%`,
                        backgroundColor: "#f59e0b33",
                        borderLeft: "2px solid #f59e0b",
                      }}
                    />
                  )}

                  {/* 加工時間條 */}
                  {r.ct > 0 && (
                    <div
                      className="absolute top-0 h-full rounded cursor-pointer transition-opacity"
                      style={{
                        left: `${r.startPct + (r.wt > 0 ? minWtPct : 0)}%`,
                        width: `${minBarPct}%`,
                        backgroundColor: statusColor.bar,
                        opacity: isHovered ? 1 : 0.85,
                      }}
                      onMouseEnter={(e) => {
                        setHoveredId(r.id);
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                      }}
                      onMouseLeave={() => setHoveredId(null)}
                      onMouseMove={(e) => {
                        const rect = containerRef.current?.getBoundingClientRect();
                        if (rect) setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                      }}
                    />
                  )}

                  {/* 跳過工站（虛線） */}
                  {r.status === "skipped" && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-0.5 border-t-2 border-dashed border-gray-500/50"
                      style={{ left: `${r.startPct}%`, width: "100%" }}
                    />
                  )}
                </div>

                {/* 時間標籤 */}
                <div className="w-20 shrink-0 text-right">
                  <span className="text-xs font-mono text-muted-foreground">
                    {r.ct > 0 ? fmtSec(r.ct) : r.status === "skipped" ? "跳過" : "—"}
                  </span>
                </div>

                {/* 狀態徽章 */}
                <div className="w-14 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${statusColor.badge}`}>
                    {STATUS_ICONS[r.status] ?? STATUS_ICONS.normal}
                    {statusColor.text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 時間軸刻度 */}
        <div className="flex ml-[8.5rem] mr-[8.5rem] mt-1">
          {[0, 25, 50, 75, 100].map((pct) => (
            <div key={pct} className="flex-1 text-center" style={{ marginLeft: pct === 0 ? 0 : undefined }}>
              <div className="h-1.5 border-l border-border/40 mx-auto w-px" />
              <span className="text-xs text-muted-foreground/60">
                {pct === 0 ? "0" : pct === 100 ? fmtSec(totalLeadTime) : fmtSec(totalLeadTime * pct / 100)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 工站詳細卡片列表 ────────────────────────────────────────────── */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">各工站詳細資料</h3>
        <div className="grid grid-cols-1 gap-2">
          {processedRecords.map((r, idx) => {
            const statusColor = STATUS_COLORS[r.status] ?? STATUS_COLORS.normal;
            const ctPct = r.ct + r.wt > 0 ? (r.ct / (r.ct + r.wt)) * 100 : 0;
            return (
              <div
                key={r.id}
                className={`border rounded-lg p-3 transition-colors ${hoveredId === r.id ? "border-primary/50 bg-primary/5" : "border-border/50 bg-card/30"}`}
                onMouseEnter={() => setHoveredId(r.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* 左：工站資訊 */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.workstationName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${statusColor.badge}`}>
                          {STATUS_ICONS[r.status]}{statusColor.text}
                        </span>
                        {r.operatorName && (
                          <span className="text-xs text-muted-foreground">作業員：{r.operatorName}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 中：時間資訊 */}
                  <div className="flex gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">進入</p>
                      <p className="text-xs font-mono">{fmtTime(r.entryTime)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">離開</p>
                      <p className="text-xs font-mono">{fmtTime(r.exitTime)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">加工</p>
                      <p className="text-sm font-bold text-primary">{fmtSec(r.ct)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">等待</p>
                      <p className="text-sm font-bold text-amber-400">{r.wt > 0 ? fmtSec(r.wt) : "—"}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">增值率</p>
                      <p className={`text-sm font-bold ${ctPct >= 70 ? "text-emerald-400" : ctPct >= 40 ? "text-amber-400" : "text-red-400"}`}>
                        {r.ct + r.wt > 0 ? `${ctPct.toFixed(0)}%` : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 工站內加工/等待比例條 */}
                {(r.ct > 0 || r.wt > 0) && (
                  <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-muted flex">
                    <div className="h-full bg-emerald-500 transition-all" style={{ width: `${ctPct}%` }} />
                    <div className="h-full bg-amber-500 transition-all" style={{ width: `${100 - ctPct}%` }} />
                  </div>
                )}

                {/* 備註 */}
                {r.notes && (
                  <p className="text-xs text-muted-foreground mt-1.5 pl-10">備註：{r.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 懸停 Tooltip ────────────────────────────────────────────────── */}
      {hoveredRecord && (
        <div
          className="fixed z-50 pointer-events-none bg-popover border border-border rounded-lg shadow-lg p-3 text-xs min-w-48"
          style={{
            left: tooltipPos.x + 12,
            top: tooltipPos.y - 10,
            transform: tooltipPos.x > 600 ? "translateX(-110%)" : undefined,
          }}
        >
          <p className="font-semibold mb-1.5">{hoveredRecord.workstationName}</p>
          <div className="space-y-1 text-muted-foreground">
            <div className="flex justify-between gap-4">
              <span>加工時間</span>
              <span className="text-primary font-mono">{fmtSec(hoveredRecord.ct)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>等待時間</span>
              <span className="text-amber-400 font-mono">{hoveredRecord.wt > 0 ? fmtSec(hoveredRecord.wt) : "—"}</span>
            </div>
            {hoveredRecord.entryTime && (
              <div className="flex justify-between gap-4">
                <span>進入</span>
                <span className="font-mono">{fmtTime(hoveredRecord.entryTime)}</span>
              </div>
            )}
            {hoveredRecord.exitTime && (
              <div className="flex justify-between gap-4">
                <span>離開</span>
                <span className="font-mono">{fmtTime(hoveredRecord.exitTime)}</span>
              </div>
            )}
            {hoveredRecord.operatorName && (
              <div className="flex justify-between gap-4">
                <span>作業員</span>
                <span>{hoveredRecord.operatorName}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
