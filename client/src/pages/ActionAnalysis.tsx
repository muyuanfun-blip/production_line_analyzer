import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save,
  Clock, Users, TrendingUp, AlertTriangle, CheckCircle2,
  BarChart3, RefreshCw, Zap, Minus, Info, Download, Activity,
  Hand, ChevronRight, ChevronDown as ChevronDownIcon
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine
} from "recharts";

// ─── 型別定義 ─────────────────────────────────────────────────────────────────

type ActionType = "value_added" | "non_value_added" | "necessary_waste";
type HandActionType = "value_added" | "non_value_added" | "necessary_waste" | "idle";
type Hand = "left" | "right";

interface LocalHandAction {
  id?: number;
  tempId: string;
  hand: Hand;
  actionName: string;
  duration: string;
  handActionType: HandActionType;
  isIdle: boolean;
  note: string;
  isDirty: boolean;
  isNew: boolean;
}

interface LocalStep {
  id?: number;
  tempId: string;
  stepName: string;
  duration: string;
  actionType: ActionType;
  description: string;
  stepOrder: number;
  isDirty: boolean;
  isNew: boolean;
  handActions: LocalHandAction[];
  showHands: boolean;
}

// ─── 常數 ─────────────────────────────────────────────────────────────────────

const ACTION_TYPE_CONFIG: Record<ActionType, {
  label: string; color: string; bg: string; border: string;
  icon: React.ReactNode; shortLabel: string;
}> = {
  value_added: {
    label: "增值動作", shortLabel: "增值",
    color: "#10b981", bg: "bg-emerald-500/10", border: "border-emerald-500/30",
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  non_value_added: {
    label: "非增值動作", shortLabel: "非增值",
    color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/30",
    icon: <Minus className="w-3.5 h-3.5" />,
  },
  necessary_waste: {
    label: "必要浪費", shortLabel: "必要浪費",
    color: "#f59e0b", bg: "bg-amber-500/10", border: "border-amber-500/30",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

const HAND_ACTION_TYPE_CONFIG: Record<HandActionType, { label: string; color: string }> = {
  value_added:    { label: "增值",   color: "#10b981" },
  non_value_added:{ label: "非增值", color: "#ef4444" },
  necessary_waste:{ label: "必要浪費", color: "#f59e0b" },
  idle:           { label: "空手等待", color: "#6b7280" },
};

// ─── 工具函數 ─────────────────────────────────────────────────────────────────

function genTempId() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseDuration(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? 0 : n;
}

function defaultHandAction(hand: Hand): LocalHandAction {
  return {
    tempId: genTempId(),
    hand,
    actionName: "",
    duration: "",
    handActionType: hand === "left" ? "value_added" : "value_added",
    isIdle: false,
    note: "",
    isDirty: true,
    isNew: true,
  };
}

// ─── 子元件：雙手作業輸入列 ────────────────────────────────────────────────────

interface HandRowProps {
  ha: LocalHandAction;
  stepDuration: number;
  onChange: (tempId: string, field: string, value: string | boolean) => void;
  onDelete: (tempId: string) => void;
}

function HandRow({ ha, stepDuration, onChange, onDelete }: HandRowProps) {
  const cfg = HAND_ACTION_TYPE_CONFIG[ha.handActionType];
  const sec = parseDuration(ha.duration);
  const pct = stepDuration > 0 ? Math.min((sec / stepDuration) * 100, 100) : 0;
  const isLeft = ha.hand === "left";

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border transition-all
      ${isLeft ? "border-blue-500/20 bg-blue-500/5" : "border-violet-500/20 bg-violet-500/5"}
      ${ha.isIdle ? "opacity-60" : ""}`}>

      {/* 手別標籤 */}
      <div className={`shrink-0 w-10 text-center text-[10px] font-bold rounded px-1 py-0.5
        ${isLeft ? "bg-blue-500/20 text-blue-400" : "bg-violet-500/20 text-violet-400"}`}>
        {isLeft ? "左手" : "右手"}
      </div>

      {/* 動作名稱 */}
      <Input
        value={ha.actionName}
        onChange={e => onChange(ha.tempId, "actionName", e.target.value)}
        placeholder={ha.isIdle ? "空手等待" : `${isLeft ? "左" : "右"}手動作`}
        disabled={ha.isIdle}
        className="h-7 text-xs flex-1 bg-background/30 border-white/8"
      />

      {/* 類型選擇 */}
      <Select
        value={ha.handActionType}
        onValueChange={v => onChange(ha.tempId, "handActionType", v)}
      >
        <SelectTrigger className="h-7 text-xs w-[90px] bg-background/30 border-white/8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(HAND_ACTION_TYPE_CONFIG) as [HandActionType, { label: string; color: string }][]).map(([k, c]) => (
            <SelectItem key={k} value={k}>
              <span style={{ color: c.color }} className="text-xs">{c.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 時間 */}
      <div className="relative w-[72px] shrink-0">
        <Input
          type="number" min="0" step="0.1"
          value={ha.duration}
          onChange={e => onChange(ha.tempId, "duration", e.target.value)}
          placeholder="0.0"
          className="h-7 text-xs pr-5 bg-background/30 border-white/8 text-right tabular-nums"
        />
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 pointer-events-none">s</span>
      </div>

      {/* 佔比條 */}
      {sec > 0 && stepDuration > 0 && (
        <div className="w-12 shrink-0">
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
          </div>
          <span className="text-[9px] text-muted-foreground/40 tabular-nums">{pct.toFixed(0)}%</span>
        </div>
      )}

      {/* 空手勾選 */}
      <label className="flex items-center gap-1 shrink-0 cursor-pointer">
        <input type="checkbox" checked={ha.isIdle}
          onChange={e => onChange(ha.tempId, "isIdle", e.target.checked)}
          className="w-3 h-3 accent-gray-500" />
        <span className="text-[10px] text-muted-foreground/60">空手</span>
      </label>

      {/* 刪除 */}
      <button onClick={() => onDelete(ha.tempId)}
        className="p-1 rounded hover:bg-red-500/20 text-muted-foreground/30 hover:text-red-400 transition-all shrink-0">
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── 子元件：單一動作列 ────────────────────────────────────────────────────────

interface StepRowProps {
  step: LocalStep;
  index: number;
  total: number;
  totalSec: number;
  onChange: (tempId: string, field: string, value: string) => void;
  onDelete: (tempId: string) => void;
  onMove: (tempId: string, dir: "up" | "down") => void;
  onToggleHands: (tempId: string) => void;
  onAddHand: (tempId: string, hand: Hand) => void;
  onHandChange: (stepTempId: string, haTempId: string, field: string, value: string | boolean) => void;
  onHandDelete: (stepTempId: string, haTempId: string) => void;
}

function StepRow({
  step, index, total, totalSec,
  onChange, onDelete, onMove, onToggleHands,
  onAddHand, onHandChange, onHandDelete
}: StepRowProps) {
  const cfg = ACTION_TYPE_CONFIG[step.actionType];
  const sec = parseDuration(step.duration);
  const pct = totalSec > 0 ? (sec / totalSec) * 100 : 0;
  const leftHands = step.handActions.filter(h => h.hand === "left");
  const rightHands = step.handActions.filter(h => h.hand === "right");
  const hasHands = step.handActions.length > 0;

  return (
    <div className={`group relative rounded-xl border transition-all duration-200
      ${cfg.bg} ${cfg.border}
      ${step.isDirty ? "ring-1 ring-purple-500/30" : ""}
      hover:shadow-sm`}>

      {/* 主行 */}
      <div className="flex items-start gap-2 p-3">
        {/* 序號 + 排序按鈕 */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5 min-w-[26px]">
          <span className="text-[10px] font-mono text-muted-foreground/50 leading-none tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <button onClick={() => onMove(step.tempId, "up")} disabled={index === 0}
            className="mt-1 p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-colors">
            <ChevronUp className="w-3 h-3 text-muted-foreground" />
          </button>
          <button onClick={() => onMove(step.tempId, "down")} disabled={index === total - 1}
            className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-colors">
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>

        {/* 動作名稱 + 備註 */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <Input
            value={step.stepName}
            onChange={e => onChange(step.tempId, "stepName", e.target.value)}
            placeholder="動作名稱（如：取料、組裝螺絲、目視檢查）"
            className="h-8 text-sm bg-background/50 border-white/10 focus:border-purple-500/50 placeholder:text-muted-foreground/40"
          />
          <Input
            value={step.description}
            onChange={e => onChange(step.tempId, "description", e.target.value)}
            placeholder="備註說明（選填）"
            className="h-6 text-[11px] bg-background/20 border-white/5 focus:border-purple-500/20 text-muted-foreground placeholder:text-muted-foreground/30"
          />
          {sec > 0 && totalSec > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: cfg.color, opacity: 0.7 }} />
              </div>
              <span className="text-[10px] text-muted-foreground/50 tabular-nums">{pct.toFixed(0)}%</span>
            </div>
          )}
        </div>

        {/* 動作類型選擇 */}
        <div className="w-[130px] shrink-0">
          <Select value={step.actionType} onValueChange={v => onChange(step.tempId, "actionType", v)}>
            <SelectTrigger className="h-8 text-xs bg-background/50 border-white/10 focus:border-purple-500/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ACTION_TYPE_CONFIG) as [ActionType, typeof ACTION_TYPE_CONFIG[ActionType]][]).map(([key, c]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-1.5">
                    <span style={{ color: c.color }}>{c.icon}</span>
                    <span>{c.label}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 秒數輸入 */}
        <div className="w-[88px] shrink-0">
          <div className="relative">
            <Input
              type="number" min="0" step="0.1"
              value={step.duration}
              onChange={e => onChange(step.tempId, "duration", e.target.value)}
              placeholder="0.0"
              className="h-8 text-sm pr-7 bg-background/50 border-white/10 focus:border-purple-500/50 text-right tabular-nums"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60 pointer-events-none">秒</span>
          </div>
        </div>

        {/* 雙手展開 + 刪除 */}
        <div className="flex items-start gap-1 pt-1">
          <button
            onClick={() => onToggleHands(step.tempId)}
            title="雙手作業拆解"
            className={`p-1 rounded transition-all ${
              hasHands
                ? "text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                : "text-muted-foreground/40 hover:text-blue-400 hover:bg-blue-500/10 opacity-0 group-hover:opacity-100"
            }`}>
            <Hand className="w-3.5 h-3.5" />
          </button>
          {step.isDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse mt-1" title="未儲存" />
          )}
          <button onClick={() => onDelete(step.tempId)}
            className="p-1 rounded hover:bg-red-500/20 text-muted-foreground/40 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 雙手作業展開區 */}
      {step.showHands && (
        <div className="px-3 pb-3 pt-0 border-t border-white/8 mt-0">
          <div className="flex items-center gap-2 mb-2 mt-2">
            <Hand className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-medium text-blue-400">雙手作業拆解</span>
            <span className="text-[10px] text-muted-foreground/50">（左右手各自的動作與時間）</span>
          </div>

          {/* 左手 */}
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-blue-400/70 font-medium uppercase tracking-wider">左手 ({leftHands.length})</span>
              <button onClick={() => onAddHand(step.tempId, "left")}
                className="text-[10px] text-blue-400/60 hover:text-blue-400 flex items-center gap-0.5 transition-colors">
                <Plus className="w-2.5 h-2.5" />新增左手動作
              </button>
            </div>
            {leftHands.length === 0 ? (
              <div className="text-[10px] text-muted-foreground/30 py-1 pl-2 italic">尚無左手動作記錄</div>
            ) : (
              leftHands.map(ha => (
                <HandRow key={ha.tempId} ha={ha} stepDuration={sec}
                  onChange={(haTempId, field, val) => onHandChange(step.tempId, haTempId, field, val)}
                  onDelete={haTempId => onHandDelete(step.tempId, haTempId)} />
              ))
            )}
          </div>

          {/* 右手 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-violet-400/70 font-medium uppercase tracking-wider">右手 ({rightHands.length})</span>
              <button onClick={() => onAddHand(step.tempId, "right")}
                className="text-[10px] text-violet-400/60 hover:text-violet-400 flex items-center gap-0.5 transition-colors">
                <Plus className="w-2.5 h-2.5" />新增右手動作
              </button>
            </div>
            {rightHands.length === 0 ? (
              <div className="text-[10px] text-muted-foreground/30 py-1 pl-2 italic">尚無右手動作記錄</div>
            ) : (
              rightHands.map(ha => (
                <HandRow key={ha.tempId} ha={ha} stepDuration={sec}
                  onChange={(haTempId, field, val) => onHandChange(step.tempId, haTempId, field, val)}
                  onDelete={haTempId => onHandDelete(step.tempId, haTempId)} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 主元件 ───────────────────────────────────────────────────────────────────

export default function ActionAnalysis() {
  const { id: lineId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const search = useSearch();
  const lineIdNum = parseInt(lineId ?? "0");

  const initialWsId = useMemo(() => {
    const params = new URLSearchParams(search);
    const ws = params.get("ws");
    return ws ? parseInt(ws) : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedWsId, setSelectedWsId] = useState<number | null>(initialWsId);
  const [steps, setSteps] = useState<LocalStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [syncCycleTime, setSyncCycleTime] = useState(false);
  const [wsStepCounts, setWsStepCounts] = useState<Record<number, number>>({});

  // ── 查詢 ──────────────────────────────────────────────────────────────────
  const { data: line } = trpc.productionLine.getById.useQuery(
    { id: lineIdNum }, { enabled: lineIdNum > 0 }
  );
  const { data: workstations = [] } = trpc.workstation.listByLine.useQuery(
    { productionLineId: lineIdNum }, { enabled: lineIdNum > 0 }
  );

  const selectedWs = workstations.find(w => w.id === selectedWsId);

  const { data: dbSteps = [], refetch: refetchSteps } = trpc.actionStep.listByWorkstation.useQuery(
    { workstationId: selectedWsId! },
    { enabled: selectedWsId !== null }
  );

  // 取得所有步驟的手部動作（批次查詢）
  const stepIds = useMemo(() => dbSteps.map((s: any) => s.id as number), [dbSteps]);
  const { data: dbHandActions = [] } = trpc.handAction.listByStepIds.useQuery(
    { actionStepIds: stepIds },
    { enabled: stepIds.length > 0 }
  );

  const prevDbStepsKeyRef = useRef<string>("");
  const selectedWsIdRef = useRef<number | null>(selectedWsId);
  useEffect(() => { selectedWsIdRef.current = selectedWsId; });

  useEffect(() => {
    const key = dbSteps.map((s: any) => `${s.id}:${s.stepOrder}:${s.stepName}:${s.duration}:${s.actionType}`).join("|");
    if (key === prevDbStepsKeyRef.current) return;
    prevDbStepsKeyRef.current = key;

    // 建立 stepId -> handActions 的映射
    const handMap: Record<number, LocalHandAction[]> = {};
    (dbHandActions as any[]).forEach(ha => {
      if (!handMap[ha.actionStepId]) handMap[ha.actionStepId] = [];
      handMap[ha.actionStepId]!.push({
        id: ha.id,
        tempId: genTempId(),
        hand: ha.hand as Hand,
        actionName: ha.actionName,
        duration: String(parseFloat(ha.duration)),
        handActionType: ha.handActionType as HandActionType,
        isIdle: Boolean(ha.isIdle),
        note: ha.note ?? "",
        isDirty: false,
        isNew: false,
      });
    });

    setSteps(
      [...dbSteps]
        .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
        .map((s: any) => ({
          id: s.id,
          tempId: genTempId(),
          stepName: s.stepName,
          duration: String(parseFloat(s.duration)),
          actionType: s.actionType as ActionType,
          description: s.description ?? "",
          stepOrder: s.stepOrder,
          isDirty: false,
          isNew: false,
          handActions: handMap[s.id] ?? [],
          showHands: (handMap[s.id] ?? []).length > 0,
        }))
    );
    const wsId = selectedWsIdRef.current;
    if (wsId !== null) {
      setWsStepCounts(prev => ({ ...prev, [wsId]: dbSteps.length }));
    }
  }, [dbSteps, dbHandActions]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createStep = trpc.actionStep.create.useMutation();
  const updateStep = trpc.actionStep.update.useMutation();
  const deleteStep = trpc.actionStep.delete.useMutation();
  const updateWorkstation = trpc.workstation.update.useMutation();
  const upsertHandAction = trpc.handAction.upsert.useMutation();
  const deleteHandAction = trpc.handAction.delete.useMutation();
  const deleteHandActionsByStep = trpc.handAction.deleteByStep.useMutation();
  const utils = trpc.useUtils();

  // ── 雙手統計 ──────────────────────────────────────────────────────────────
  const handStats = useMemo(() => {
    const allHands = steps.flatMap(s => s.handActions);
    if (allHands.length === 0) return null;

    const leftHands = allHands.filter(h => h.hand === "left");
    const rightHands = allHands.filter(h => h.hand === "right");

    const leftTotal = leftHands.reduce((a, h) => a + parseDuration(h.duration), 0);
    const rightTotal = rightHands.reduce((a, h) => a + parseDuration(h.duration), 0);
    const leftIdle = leftHands.filter(h => h.isIdle || h.handActionType === "idle").reduce((a, h) => a + parseDuration(h.duration), 0);
    const rightIdle = rightHands.filter(h => h.isIdle || h.handActionType === "idle").reduce((a, h) => a + parseDuration(h.duration), 0);

    // 雙手同步率：左右手同時作業的時間比例（近似：取兩手中較小的有效作業時間 / 較大總時間）
    const leftActive = leftTotal - leftIdle;
    const rightActive = rightTotal - rightIdle;
    const maxTotal = Math.max(leftTotal, rightTotal);
    const syncRate = maxTotal > 0
      ? (Math.min(leftActive, rightActive) / maxTotal) * 100
      : 0;

    // 各類型統計
    const byType: Record<HandActionType, number> = {
      value_added: 0, non_value_added: 0, necessary_waste: 0, idle: 0
    };
    allHands.forEach(h => {
      const type = h.isIdle ? "idle" : h.handActionType;
      byType[type] += parseDuration(h.duration);
    });

    return { leftTotal, rightTotal, leftIdle, rightIdle, leftActive, rightActive, syncRate, byType, total: allHands.length };
  }, [steps]);

  // ── 計算統計 ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalSec = steps.reduce((acc, s) => acc + parseDuration(s.duration), 0);
    const byType = {
      value_added: steps.filter(s => s.actionType === "value_added").reduce((a, s) => a + parseDuration(s.duration), 0),
      non_value_added: steps.filter(s => s.actionType === "non_value_added").reduce((a, s) => a + parseDuration(s.duration), 0),
      necessary_waste: steps.filter(s => s.actionType === "necessary_waste").reduce((a, s) => a + parseDuration(s.duration), 0),
    };
    const cycleTime = parseFloat(selectedWs?.cycleTime ?? "0");
    const taktTime = parseFloat(line?.targetCycleTime ?? "0");
    const diff = totalSec - cycleTime;
    const taktDiff = taktTime > 0 ? totalSec - taktTime : null;
    const valueAddedRate = totalSec > 0 ? (byType.value_added / totalSec) * 100 : 0;
    const pieData = [
      { name: "增值動作", value: byType.value_added, color: "#10b981" },
      { name: "非增值動作", value: byType.non_value_added, color: "#ef4444" },
      { name: "必要浪費", value: byType.necessary_waste, color: "#f59e0b" },
    ].filter(d => d.value > 0);
    return { totalSec, byType, diff, taktDiff, valueAddedRate, pieData, cycleTime, taktTime };
  }, [steps, selectedWs, line]);

  const workstationBarData = useMemo(() =>
    workstations
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
      .map(w => ({
        name: w.name.length > 5 ? w.name.slice(0, 5) + "…" : w.name,
        cycleTime: parseFloat(w.cycleTime),
        isSelected: w.id === selectedWsId,
      })),
    [workstations, selectedWsId]
  );

  // ── 事件處理 ──────────────────────────────────────────────────────────────

  function handleSelectWs(id: number) {
    if (id === selectedWsId) return;
    setSelectedWsId(id);
    setSteps([]);
    prevDbStepsKeyRef.current = "";
  }

  function handleAddStep() {
    setSteps(prev => [...prev, {
      tempId: genTempId(),
      stepName: "", duration: "", actionType: "value_added",
      description: "", stepOrder: prev.length, isDirty: true, isNew: true,
      handActions: [], showHands: false,
    }]);
  }

  function handleChange(tempId: string, field: string, value: string) {
    setSteps(prev => prev.map(s =>
      s.tempId === tempId ? { ...s, [field]: value, isDirty: true } : s
    ));
  }

  function handleDelete(tempId: string) {
    const step = steps.find(s => s.tempId === tempId);
    if (step?.id) {
      deleteStep.mutate({ id: step.id });
      deleteHandActionsByStep.mutate({ actionStepId: step.id });
    }
    setSteps(prev => prev.filter(s => s.tempId !== tempId));
  }

  function handleMove(tempId: string, dir: "up" | "down") {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.tempId === tempId);
      if (idx < 0) return prev;
      const arr = [...prev];
      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx]!, arr[idx]!];
      return arr.map((s, i) => ({ ...s, stepOrder: i, isDirty: true }));
    });
  }

  function handleToggleHands(tempId: string) {
    setSteps(prev => prev.map(s =>
      s.tempId === tempId ? { ...s, showHands: !s.showHands } : s
    ));
  }

  function handleAddHand(stepTempId: string, hand: Hand) {
    setSteps(prev => prev.map(s =>
      s.tempId === stepTempId
        ? { ...s, handActions: [...s.handActions, defaultHandAction(hand)], showHands: true, isDirty: true }
        : s
    ));
  }

  function handleHandChange(stepTempId: string, haTempId: string, field: string, value: string | boolean) {
    setSteps(prev => prev.map(s =>
      s.tempId === stepTempId
        ? {
            ...s, isDirty: true,
            handActions: s.handActions.map(ha =>
              ha.tempId === haTempId ? { ...ha, [field]: value, isDirty: true } : ha
            )
          }
        : s
    ));
  }

  function handleHandDelete(stepTempId: string, haTempId: string) {
    const step = steps.find(s => s.tempId === stepTempId);
    const ha = step?.handActions.find(h => h.tempId === haTempId);
    if (ha?.id) deleteHandAction.mutate({ id: ha.id });
    setSteps(prev => prev.map(s =>
      s.tempId === stepTempId
        ? { ...s, handActions: s.handActions.filter(h => h.tempId !== haTempId), isDirty: true }
        : s
    ));
  }

  async function handleSave() {
    if (!selectedWsId) return;
    const invalid = steps.find(s => !s.stepName.trim() || parseDuration(s.duration) <= 0);
    if (invalid) { toast.error("請確認所有步驟均已填寫名稱與有效秒數"); return; }

    setIsSaving(true);
    try {
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i]!;
        let stepId = s.id;

        if (s.isDirty || s.isNew) {
          const payload = {
            stepName: s.stepName.trim(),
            stepOrder: i,
            duration: parseDuration(s.duration),
            actionType: s.actionType,
            description: s.description.trim() || undefined,
          };
          if (s.isNew) {
            const res = await createStep.mutateAsync({ workstationId: selectedWsId, ...payload });
            stepId = res.insertId;
          } else if (s.id) {
            await updateStep.mutateAsync({ id: s.id, ...payload });
          }
        }

        // 儲存手部動作（只處理有 stepId 的情況）
        if (stepId) {
          for (const ha of s.handActions) {
            if (!ha.isDirty) continue;
            await upsertHandAction.mutateAsync({
              id: ha.id,
              actionStepId: stepId,
              hand: ha.hand,
              actionName: ha.isIdle ? "空手等待" : ha.actionName.trim() || "未命名",
              duration: parseDuration(ha.duration),
              handActionType: ha.isIdle ? "idle" : ha.handActionType,
              isIdle: ha.isIdle,
              note: ha.note.trim() || undefined,
            });
          }
        }
      }

      if (syncCycleTime && stats.totalSec > 0) {
        await updateWorkstation.mutateAsync({ id: selectedWsId, cycleTime: stats.totalSec });
        await utils.workstation.listByLine.invalidate({ productionLineId: lineIdNum });
        await utils.workstation.getById.invalidate({ id: selectedWsId });
        toast.success(`工站時間已同步更新為 ${stats.totalSec.toFixed(1)}s`);
      }
      await refetchSteps();
      await utils.actionStep.listByWorkstation.invalidate({ workstationId: selectedWsId });
      await utils.handAction.listByStepIds.invalidate({ actionStepIds: stepIds });
      toast.success("動作步驟與雙手記錄已儲存成功");
    } catch {
      toast.error("儲存失敗，請稍後再試");
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportCSV() {
    if (!steps.length) { toast.error("尚無步驟資料"); return; }
    const header = "序號,動作名稱,類型,時間(秒),佔比(%),備註,左手動作,右手動作\n";
    const rows = steps.map((s, i) => {
      const leftStr = s.handActions.filter(h => h.hand === "left").map(h => `${h.actionName}(${parseDuration(h.duration).toFixed(1)}s)`).join(";");
      const rightStr = s.handActions.filter(h => h.hand === "right").map(h => `${h.actionName}(${parseDuration(h.duration).toFixed(1)}s)`).join(";");
      return `${i + 1},${s.stepName},${ACTION_TYPE_CONFIG[s.actionType].label},${parseDuration(s.duration).toFixed(1)},${stats.totalSec > 0 ? ((parseDuration(s.duration) / stats.totalSec) * 100).toFixed(1) : 0},${s.description},${leftStr},${rightStr}`;
    }).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${selectedWs?.name ?? "steps"}_動作拆解.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 已下載（含雙手資料）");
  }

  function handleClearAll() {
    if (!confirm(`確定要清除「${selectedWs?.name}」的所有動作步驟嗎？`)) return;
    steps.forEach(s => {
      if (s.id) {
        deleteStep.mutate({ id: s.id });
        deleteHandActionsByStep.mutate({ actionStepId: s.id });
      }
    });
    setSteps([]);
  }

  const hasDirty = steps.some(s => s.isDirty || s.handActions.some(h => h.isDirty));

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background p-6">
      {/* 頁首 */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/lines/${lineId}/balance`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">動作分析</h1>
          <p className="text-sm text-muted-foreground">{line?.name ?? "載入中..."}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasDirty && (
            <Badge variant="outline" className="text-purple-400 border-purple-500/40 bg-purple-500/10 text-xs animate-pulse">
              有未儲存的變更
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={steps.length === 0} className="text-xs h-8">
            <Download className="w-3.5 h-3.5 mr-1.5" />匯出 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/lines/${lineId}/balance`)} className="text-xs h-8">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />平衡分析
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* ── 左側：工站選擇 ── */}
        <div className="col-span-3 space-y-4">
          <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />工站列表
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-1.5">
              {workstations.length === 0 ? (
                <div className="text-center py-6">
                  <Activity className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">尚無工站</p>
                </div>
              ) : (
                workstations
                  .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
                  .map(w => {
                    const ct = parseFloat(w.cycleTime);
                    const takt = parseFloat(line?.targetCycleTime ?? "0");
                    const isOver = takt > 0 && ct > takt;
                    const isSelected = w.id === selectedWsId;
                    const stepCount = wsStepCounts[w.id] ?? 0;
                    return (
                      <button key={w.id} onClick={() => handleSelectWs(w.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all duration-200 ${
                          isSelected
                            ? "border-purple-500/50 bg-purple-500/10"
                            : "border-white/8 bg-background/20 hover:border-white/20 hover:bg-background/40"
                        }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-medium truncate ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                            {w.name}
                          </span>
                          {isOver && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                            <Clock className="w-2.5 h-2.5" />{ct.toFixed(1)}s
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                            <Users className="w-2.5 h-2.5" />{w.manpower}人
                          </span>
                          {stepCount > 0 && (
                            <span className="text-[11px] text-purple-400/70">{stepCount}步驟</span>
                          )}
                        </div>
                      </button>
                    );
                  })
              )}
            </CardContent>
          </Card>

          {/* 各工站時間小圖 */}
          {workstationBarData.length > 0 && (
            <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">各工站時間比較</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={workstationBarData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} />
                    {stats.taktTime > 0 && (
                      <ReferenceLine y={stats.taktTime} stroke="#a855f7" strokeDasharray="3 2" strokeWidth={1} />
                    )}
                    <Bar dataKey="cycleTime" radius={[2, 2, 0, 0]}>
                      {workstationBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.isSelected ? "#a855f7" : "#374151"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 中間：動作拆解輸入 ── */}
        <div className="col-span-6">
          {!selectedWsId ? (
            <Card className="border-white/8 bg-card/60 backdrop-blur-sm h-full">
              <CardContent className="flex flex-col items-center justify-center h-full py-20">
                <BarChart3 className="w-14 h-14 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">請從左側選擇工站</p>
                <p className="text-muted-foreground/50 text-sm mt-1">選擇工站後可輸入動作拆解步驟</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">{selectedWs?.name}</CardTitle>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />工站設定：{parseFloat(selectedWs?.cycleTime ?? "0").toFixed(1)}s
                      </span>
                      {stats.taktTime > 0 && (
                        <span className="text-xs text-purple-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" />Takt：{stats.taktTime.toFixed(1)}s
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {steps.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={handleClearAll}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-3 h-3 mr-1" />清除
                      </Button>
                    )}
                    <Button size="sm" onClick={handleAddStep}
                      className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700">
                      <Plus className="w-3.5 h-3.5 mr-1" />新增動作
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {/* 欄位標題 */}
                <div className="flex items-center gap-2 mb-2 px-1 text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  <div className="w-[26px]" />
                  <div className="flex-1">動作名稱 / 備註</div>
                  <div className="w-[130px] shrink-0">類型</div>
                  <div className="w-[88px] shrink-0 text-right">時間</div>
                  <div className="w-12" />
                </div>

                {/* 動作列表 */}
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-0.5">
                  {steps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 border border-dashed border-white/10 rounded-xl">
                      <Plus className="w-10 h-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">尚無動作步驟</p>
                      <p className="text-xs text-muted-foreground/50 mt-1">點擊「新增動作」開始拆解工站動作</p>
                      <Button size="sm" onClick={handleAddStep} className="mt-4 h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700">
                        <Plus className="w-3.5 h-3.5 mr-1" />新增第一個動作
                      </Button>
                    </div>
                  ) : (
                    steps.map((step, idx) => (
                      <StepRow
                        key={step.tempId} step={step} index={idx}
                        total={steps.length} totalSec={stats.totalSec}
                        onChange={handleChange} onDelete={handleDelete} onMove={handleMove}
                        onToggleHands={handleToggleHands}
                        onAddHand={handleAddHand}
                        onHandChange={handleHandChange}
                        onHandDelete={handleHandDelete}
                      />
                    ))
                  )}
                </div>

                {/* 底部：合計 + 儲存 */}
                {steps.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/8 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          合計 {stats.totalSec.toFixed(1)}s
                        </span>
                        {stats.cycleTime > 0 && (
                          <span className={`text-xs flex items-center gap-1 ${
                            Math.abs(stats.diff) < 0.5 ? "text-emerald-400" :
                            stats.diff > 0 ? "text-red-400" : "text-amber-400"
                          }`}>
                            {Math.abs(stats.diff) < 0.5
                              ? <><CheckCircle2 className="w-3 h-3" />與工站時間吻合</>
                              : stats.diff > 0
                              ? <><AlertTriangle className="w-3 h-3" />超出 {stats.diff.toFixed(1)}s</>
                              : <><Info className="w-3 h-3" />少於 {Math.abs(stats.diff).toFixed(1)}s</>
                            }
                          </span>
                        )}
                      </div>
                      <span className={`text-xs flex items-center gap-1 ${
                        stats.valueAddedRate >= 70 ? "text-emerald-400" :
                        stats.valueAddedRate >= 50 ? "text-amber-400" : "text-red-400"
                      }`}>
                        <TrendingUp className="w-3 h-3" />增值率 {stats.valueAddedRate.toFixed(1)}%
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {(Object.entries(ACTION_TYPE_CONFIG) as [ActionType, typeof ACTION_TYPE_CONFIG[ActionType]][]).map(([key, cfg]) => {
                        const sec = stats.byType[key];
                        const pct = stats.totalSec > 0 ? (sec / stats.totalSec) * 100 : 0;
                        if (sec === 0) return null;
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <div className="flex items-center gap-1 w-[100px] shrink-0">
                              <span style={{ color: cfg.color }}>{cfg.icon}</span>
                              <span className="text-xs text-muted-foreground">{cfg.label}</span>
                            </div>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: cfg.color }} />
                            </div>
                            <span className="text-xs text-muted-foreground/70 w-[90px] text-right tabular-nums shrink-0">
                              {sec.toFixed(1)}s ({pct.toFixed(0)}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 cursor-pointer select-none group/sync">
                        <input type="checkbox" checked={syncCycleTime}
                          onChange={e => setSyncCycleTime(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-purple-500" />
                        <span className="text-xs text-muted-foreground group-hover/sync:text-foreground transition-colors">
                          同步合計時間（{stats.totalSec.toFixed(1)}s）至工站設定
                        </span>
                      </label>
                      <Button onClick={handleSave} disabled={isSaving || !hasDirty}
                        className="h-8 px-4 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-40">
                        {isSaving
                          ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />儲存中...</>
                          : <><Save className="w-3.5 h-3.5 mr-1.5" />儲存步驟</>
                        }
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── 右側：即時分析 ── */}
        <div className="col-span-3 space-y-4">
          {/* 圓餅圖 */}
          <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">動作類型分佈</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {stats.pieData.length === 0 ? (
                <div className="flex items-center justify-center h-36 text-muted-foreground/30 text-xs">
                  輸入動作後即時顯示
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={stats.pieData} cx="50%" cy="50%"
                      innerRadius={38} outerRadius={62} paddingAngle={3} dataKey="value">
                      {stats.pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)}s`, ""]}
                      contentStyle={{
                        background: "#0f0f1a", border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "8px", fontSize: "11px"
                      }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* KPI 指標 */}
          <Card className="border-white/8 bg-card/60 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">分析指標</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2.5">
              {[
                { label: "動作步驟數", value: `${steps.length} 項`, color: "text-foreground" },
                { label: "合計時間", value: `${stats.totalSec.toFixed(1)}s`, color: "text-foreground" },
                {
                  label: "增值率",
                  value: `${stats.valueAddedRate.toFixed(1)}%`,
                  color: stats.valueAddedRate >= 70 ? "text-emerald-400" : stats.valueAddedRate >= 50 ? "text-amber-400" : "text-red-400"
                },
                ...(stats.cycleTime > 0 ? [{
                  label: "與工站差異",
                  value: `${stats.diff >= 0 ? "+" : ""}${stats.diff.toFixed(1)}s`,
                  color: Math.abs(stats.diff) < 0.5 ? "text-emerald-400" : stats.diff > 0 ? "text-red-400" : "text-amber-400"
                }] : []),
                ...(stats.taktTime > 0 ? [{
                  label: "vs Takt Time",
                  value: stats.totalSec <= stats.taktTime ? "✓ 達標" : `超出 ${(stats.totalSec - stats.taktTime).toFixed(1)}s`,
                  color: stats.totalSec <= stats.taktTime ? "text-emerald-400" : "text-red-400"
                }] : []),
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 雙手作業統計 */}
          {handStats && (
            <Card className="border-blue-500/20 bg-blue-500/5 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Hand className="w-3.5 h-3.5" />雙手作業統計
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 space-y-3">
                {/* 雙手同步率 */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">雙手同步率</span>
                    <span className={`text-sm font-bold tabular-nums ${
                      handStats.syncRate >= 80 ? "text-emerald-400" :
                      handStats.syncRate >= 60 ? "text-amber-400" : "text-red-400"
                    }`}>{handStats.syncRate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${handStats.syncRate}%`,
                        backgroundColor: handStats.syncRate >= 80 ? "#10b981" : handStats.syncRate >= 60 ? "#f59e0b" : "#ef4444"
                      }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {handStats.syncRate >= 80 ? "雙手協調良好" : handStats.syncRate >= 60 ? "有改善空間" : "單手空閒過多，建議優化"}
                  </p>
                </div>

                {/* 左右手時間 */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-blue-400 w-8 shrink-0">左手</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.max(handStats.leftTotal, handStats.rightTotal) > 0 ? (handStats.leftTotal / Math.max(handStats.leftTotal, handStats.rightTotal)) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums w-10 text-right">{handStats.leftTotal.toFixed(1)}s</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-violet-400 w-8 shrink-0">右手</span>
                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full transition-all"
                        style={{ width: `${Math.max(handStats.leftTotal, handStats.rightTotal) > 0 ? (handStats.rightTotal / Math.max(handStats.leftTotal, handStats.rightTotal)) * 100 : 0}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums w-10 text-right">{handStats.rightTotal.toFixed(1)}s</span>
                  </div>
                </div>

                {/* 空手等待 */}
                {(handStats.leftIdle > 0 || handStats.rightIdle > 0) && (
                  <div className="pt-1 border-t border-white/8 space-y-1">
                    <p className="text-[10px] text-amber-400 font-medium">空手等待時間</p>
                    {handStats.leftIdle > 0 && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-blue-400/70">左手空手</span>
                        <span className="text-amber-400 tabular-nums">{handStats.leftIdle.toFixed(1)}s</span>
                      </div>
                    )}
                    {handStats.rightIdle > 0 && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-violet-400/70">右手空手</span>
                        <span className="text-amber-400 tabular-nums">{handStats.rightIdle.toFixed(1)}s</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 手部動作類型分佈 */}
                <div className="pt-1 border-t border-white/8">
                  <p className="text-[10px] text-muted-foreground/60 mb-1.5">手部動作類型分佈</p>
                  {(Object.entries(HAND_ACTION_TYPE_CONFIG) as [HandActionType, { label: string; color: string }][]).map(([k, c]) => {
                    const sec = handStats.byType[k];
                    const total = Object.values(handStats.byType).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? (sec / total) * 100 : 0;
                    if (sec === 0) return null;
                    return (
                      <div key={k} className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] w-14 shrink-0" style={{ color: c.color }}>{c.label}</span>
                        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                        </div>
                        <span className="text-[9px] text-muted-foreground/50 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 改善提示卡片 */}
          {steps.length > 0 && stats.byType.non_value_added > 0 && (
            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-red-400">改善機會</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    非增值動作 {stats.byType.non_value_added.toFixed(1)}s
                    （佔 {((stats.byType.non_value_added / stats.totalSec) * 100).toFixed(0)}%），建議優先消除。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
          {steps.length > 0 && stats.valueAddedRate >= 80 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-3 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-emerald-400">優良工站</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    增值率達 {stats.valueAddedRate.toFixed(0)}%，動作效率良好。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
