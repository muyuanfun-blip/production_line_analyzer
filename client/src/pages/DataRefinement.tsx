import { useState, useEffect, useCallback, useId, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  PencilLine,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Info,
  Plus,
  Trash2,
  Hand,
  Zap,
  Minus,
  Loader2,
  XCircle,
  RefreshCw,
} from "lucide-react";

// ─── 型別 ──────────────────────────────────────────────────────────────────

type ActionType = "value_added" | "non_value_added" | "necessary_waste";
type HandActionType = "value_added" | "non_value_added" | "necessary_waste" | "idle";
type Hand = "left" | "right";

interface HandActionItem {
  _key: string;
  id?: number;
  hand: Hand;
  actionName: string;
  duration: string;
  handActionType: HandActionType;
  isIdle: boolean;
  note: string;
}

interface ActionStepItem {
  _key: string;
  id?: number;
  stepName: string;
  stepOrder: number;
  duration: string;
  actionType: ActionType;
  description: string;
  handActions: HandActionItem[];
  _showHands: boolean;
}

interface WorkstationRow {
  id: number;
  name: string;
  cycleTime: number;
  manpower: number;
  morningManpower?: number;
  eveningManpower?: number;
  sequenceOrder: number;
  description?: string;
  actionStepCount?: number;
  totalStepSec?: number;
  valueAddedSec?: number;
  nonValueAddedSec?: number;
  necessaryWasteSec?: number;
  valueAddedRate?: number | null;
  actionSteps?: ActionStepItem[];
}

interface EditRow extends WorkstationRow {
  _origCycleTime: number;
  _origManpower: number;
  _origName: string;
  _dirty: boolean;
  _expanded: boolean;
  actionSteps: ActionStepItem[];
}

// ─── 常數 ──────────────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  value_added: "增值",
  non_value_added: "非增值",
  necessary_waste: "必要浪費",
};

const ACTION_TYPE_COLORS: Record<ActionType, string> = {
  value_added: "text-emerald-400",
  non_value_added: "text-red-400",
  necessary_waste: "text-amber-400",
};

const HAND_ACTION_TYPE_LABELS: Record<HandActionType, string> = {
  value_added: "增值",
  non_value_added: "非增值",
  necessary_waste: "必要浪費",
  idle: "空手等待",
};

// ─── 工具函數 ──────────────────────────────────────────────────────────────

function genKey() {
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseDur(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) || n < 0 ? 0 : n;
}

function toStepItems(raw: any[]): ActionStepItem[] {
  return raw.map((s: any) => ({
    _key: genKey(),
    id: s.id,
    stepName: s.stepName ?? "",
    stepOrder: s.stepOrder ?? 0,
    duration: String(parseFloat(String(s.duration ?? "0"))),
    actionType: (s.actionType ?? "value_added") as ActionType,
    description: s.description ?? "",
    handActions: (s.handActions ?? []).map((h: any) => ({
      _key: genKey(),
      id: h.id,
      hand: h.hand as Hand,
      actionName: h.actionName ?? "",
      duration: String(parseFloat(String(h.duration ?? "0"))),
      handActionType: (h.handActionType ?? "value_added") as HandActionType,
      isIdle: Boolean(h.isIdle),
      note: h.note ?? "",
    })),
    _showHands: (s.handActions ?? []).length > 0,
  }));
}

// ─── KPI 即時計算 ──────────────────────────────────────────────────────────

function calcKpi(rows: EditRow[], taktTime: number | null) {
  if (rows.length === 0) return null;
  const times = rows.map(r => r.cycleTime);
  const totalTime = times.reduce((s, t) => s + t, 0);
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  const avgTime = totalTime / rows.length;
  const balanceRate = maxTime > 0 ? (totalTime / (maxTime * rows.length)) * 100 : 0;
  // 計算總人力：優先使用早晚班加總，若無則使用 manpower 欄位（相容舊資料）
  const totalManpower = rows.reduce((s, r) => {
    const morning = parseFloat(r.morningManpower?.toString() ?? "0") || 0;
    const evening = parseFloat(r.eveningManpower?.toString() ?? "0") || 0;
    const combined = morning + evening;
    return s + (combined > 0 ? combined : r.manpower);
  }, 0);
  const upph = maxTime > 0 && totalManpower > 0 ? 3600 / maxTime / totalManpower : 0;
  const bottleneck = rows.find(r => r.cycleTime === maxTime);
  const taktPassCount = taktTime ? rows.filter(r => r.cycleTime <= taktTime).length : null;
  const taktPassRate = taktTime && rows.length > 0 ? (taktPassCount! / rows.length) * 100 : null;
  return { totalTime, maxTime, minTime, avgTime, balanceRate, totalManpower, upph, bottleneck, taktPassCount, taktPassRate };
}

// ─── 主元件 ────────────────────────────────────────────────────────────────

export default function DataRefinement() {
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedSnapId, setSelectedSnapId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [snapName, setSnapName] = useState("");
  const [snapNote, setSnapNote] = useState("");
  const [taktTimeInput, setTaktTimeInput] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const justSavedRef = useRef(false); // 儲存後跳過 useEffect 重置 UI 狀態
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState<{ message: string; detail?: string } | null>(null);
  const saveErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [newWsCt, setNewWsCt] = useState("");
  const [newWsManpower, setNewWsManpower] = useState("1");
  const [newWsInsertAfter, setNewWsInsertAfter] = useState<string>("last");

  // ─── 查詢 ──────────────────────────────────────────────────────────────
  const { data: lines = [] } = trpc.productionLine.list.useQuery();
  const { data: snapshots = [], refetch: refetchSnaps } = trpc.snapshot.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: selectedLineId != null }
  );
  const { data: snapDetail, refetch: refetchDetail } = trpc.snapshot.getById.useQuery(
    { id: selectedSnapId! },
    { enabled: selectedSnapId != null }
  );

  // ─── 載入快照資料至編輯列 ──────────────────────────────────────────────
  useEffect(() => {
    if (!snapDetail) return;
    const ws = (snapDetail.workstationsData as any[] | null) ?? [];
    const sorted = [...ws].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

    if (justSavedRef.current) {
      // 儲存後：只更新基準值（_orig*、_dirty），保留 _expanded / _showHands / _key 等 UI 狀態
      justSavedRef.current = false;
      setEditRows(prev => {
        const byId = new Map(sorted.map(w => [w.id, w]));
        return prev.map(row => {
          const fresh = byId.get(row.id);
          if (!fresh) return row;
          const ct = Number(fresh.cycleTime);
          const mp = Number(fresh.manpower);
          // 合併最新的 actionSteps 資料，但保留 _key / _showHands
          const freshSteps = fresh.actionSteps ?? [];
          const mergedSteps = row.actionSteps.map((s, si) => {
            const fs = freshSteps[si];
            if (!fs) return s;
            return {
              ...s,
              id: fs.id ?? s.id,
              stepName: fs.stepName ?? s.stepName,
              stepOrder: fs.stepOrder ?? s.stepOrder,
              duration: String(parseFloat(String(fs.duration ?? s.duration))),
              actionType: (fs.actionType ?? s.actionType) as ActionType,
              description: fs.description ?? s.description,
              // 合併 handActions，保留 _key
              handActions: s.handActions.map((h, hi) => {
                const fh = (fs.handActions ?? [])[hi];
                if (!fh) return h;
                return {
                  ...h,
                  id: fh.id ?? h.id,
                  actionName: fh.actionName ?? h.actionName,
                  duration: String(parseFloat(String(fh.duration ?? h.duration))),
                  handActionType: (fh.handActionType ?? h.handActionType) as HandActionType,
                  isIdle: Boolean(fh.isIdle ?? h.isIdle),
                  note: fh.note ?? h.note,
                };
              }),
            };
          });
          return {
            ...row,
            cycleTime: ct,
            manpower: mp,
            _origCycleTime: ct,
            _origManpower: mp,
            _origName: fresh.name,
            _dirty: false,
            actionSteps: mergedSteps,
          };
        });
      });
      setIsDirty(false);
    } else {
      // 初次載入或切換快照：完整重置
      setEditRows(sorted.map(w => ({
        ...w,
        cycleTime: Number(w.cycleTime),
        manpower: Number(w.manpower),
        _origCycleTime: Number(w.cycleTime),
        _origManpower: Number(w.manpower),
        _origName: w.name,
        _dirty: false,
        _expanded: false,
        actionSteps: toStepItems(w.actionSteps ?? []),
      })));
      setSnapName(snapDetail.name);
      setSnapNote(snapDetail.note ?? "");
      setTaktTimeInput(snapDetail.taktTime ? String(snapDetail.taktTime) : "");
      setIsDirty(false);
    }
  }, [snapDetail]);

  // ─── 新增工站 ──────────────────────────────────────────────────────────
  const handleAddWorkstation = useCallback(() => {
    const name = newWsName.trim();
    const ct = parseFloat(newWsCt);
    const mp = parseFloat(newWsManpower);
    if (!name) { toast.error("請輸入工站名稱"); return; }
    if (isNaN(ct) || ct <= 0) { toast.error("請輸入有效的週期時間"); return; }
    if (isNaN(mp) || mp <= 0) { toast.error("請輸入有效的人力"); return; }
    const tempId = -(Date.now());
    const newRow: EditRow = {
      id: tempId,
      name,
      cycleTime: ct,
      manpower: mp,
      sequenceOrder: 0,
      description: "",
      _origCycleTime: ct,
      _origManpower: mp,
      _origName: name,
      _dirty: true,
      _expanded: false,
      actionSteps: [],
    };
    setEditRows(prev => {
      let next: EditRow[];
      if (newWsInsertAfter === "last") {
        next = [...prev, newRow];
      } else {
        const afterId = parseInt(newWsInsertAfter, 10);
        const idx = prev.findIndex(r => r.id === afterId);
        next = idx === -1 ? [...prev, newRow] : [...prev.slice(0, idx + 1), newRow, ...prev.slice(idx + 1)];
      }
      return next.map((r, i) => ({ ...r, sequenceOrder: i + 1 }));
    });
    setIsDirty(true);
    setNewWsName(""); setNewWsCt(""); setNewWsManpower("1"); setNewWsInsertAfter("last");
    setShowAddForm(false);
    toast.success(`已新增工站「${name}」，請記得按「儲存變更」`);
  }, [newWsName, newWsCt, newWsManpower, newWsInsertAfter]);

  // ─── 刪除工站（僅限新增的暫存列） ─────────────────────────────────────
  const handleRemoveRow = useCallback((idx: number) => {
    setEditRows(prev => {
      const next = [...prev];
      next.splice(idx, 1);
      return next.map((r, i) => ({ ...r, sequenceOrder: i + 1 }));
    });
    setIsDirty(true);
  }, []);

  // ─── 工站欄位更新 ──────────────────────────────────────────────────────
  const updateRow = useCallback((idx: number, field: "cycleTime" | "manpower" | "name", raw: string) => {
    setEditRows(prev => {
      const next = [...prev];
      const row = { ...next[idx] };
      if (field === "cycleTime") {
        const v = parseFloat(raw);
        row.cycleTime = isNaN(v) ? row.cycleTime : v;
      } else if (field === "manpower") {
        const v = parseFloat(raw);
        row.manpower = isNaN(v) ? row.manpower : v;
      } else {
        row.name = raw;
      }
      row._dirty = row.cycleTime !== row._origCycleTime || row.manpower !== row._origManpower || row.name !== row._origName;
      next[idx] = row;
      return next;
    });
    setIsDirty(true);
  }, []);

  // ─── 展開/收合工站 ─────────────────────────────────────────────────────
  const toggleExpand = useCallback((idx: number) => {
    setEditRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], _expanded: !next[idx]._expanded };
      return next;
    });
  }, []);

  // ─── 動作步驟操作 ──────────────────────────────────────────────────────
  const addStep = useCallback((wsIdx: number) => {
    setEditRows(prev => {
      const next = [...prev];
      const ws = { ...next[wsIdx] };
      const newStep: ActionStepItem = {
        _key: genKey(),
        stepName: "",
        stepOrder: ws.actionSteps.length,
        duration: "",
        actionType: "value_added",
        description: "",
        handActions: [],
        _showHands: false,
      };
      ws.actionSteps = [...ws.actionSteps, newStep];
      ws._dirty = true;
      next[wsIdx] = ws;
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeStep = useCallback((wsIdx: number, stepKey: string) => {
    setEditRows(prev => {
      const next = [...prev];
      const ws = { ...next[wsIdx] };
      ws.actionSteps = ws.actionSteps.filter(s => s._key !== stepKey).map((s, i) => ({ ...s, stepOrder: i }));
      ws._dirty = true;
      next[wsIdx] = ws;
      return next;
    });
    setIsDirty(true);
  }, []);

  const updateStep = useCallback((wsIdx: number, stepKey: string, field: string, value: string) => {
    setEditRows(prev => {
      const next = [...prev];
      const ws = { ...next[wsIdx] };
      ws.actionSteps = ws.actionSteps.map(s => {
        if (s._key !== stepKey) return s;
        return { ...s, [field]: value };
      });
      ws._dirty = true;
      next[wsIdx] = ws;
      return next;
    });
    setIsDirty(true);
  }, []);

  const toggleStepHands = useCallback((wsIdx: number, stepKey: string) => {
    setEditRows(prev => {
      const next = [...prev];
      const ws = { ...next[wsIdx] };
      ws.actionSteps = ws.actionSteps.map(s =>
        s._key === stepKey ? { ...s, _showHands: !s._showHands } : s
      );
      next[wsIdx] = ws;
      return next;
    });
  }, []);

  // ─── 手部動作操作 ──────────────────────────────────────────────────────
  const addHandAction = useCallback((wsIdx: number, stepKey: string, hand: Hand) => {
    setEditRows(prev => {
      const next = [...prev];
      const ws = { ...next[wsIdx] };
      ws.actionSteps = ws.actionSteps.map(s => {
        if (s._key !== stepKey) return s;
        const newHa: HandActionItem = {
          _key: genKey(),
          hand,
          actionName: "",
          duration: "",
          handActionType: "value_added",
          isIdle: false,
          note: "",
        };
        return { ...s, handActions: [...s.handActions, newHa], _showHands: true };
      });
      ws._dirty = true;
      next[wsIdx] = ws;
      return next;
    });
    setIsDirty(true);
  }, []);

  const removeHandAction = useCallback((wsIdx: number, stepKey: string, haKey: string) => {
    setEditRows(prev => {
      const next = [...prev];
      const ws = { ...next[wsIdx] };
      ws.actionSteps = ws.actionSteps.map(s => {
        if (s._key !== stepKey) return s;
        return { ...s, handActions: s.handActions.filter(h => h._key !== haKey) };
      });
      ws._dirty = true;
      next[wsIdx] = ws;
      return next;
    });
    setIsDirty(true);
  }, []);

  const updateHandAction = useCallback((wsIdx: number, stepKey: string, haKey: string, field: string, value: string | boolean) => {
    setEditRows(prev => {
      const next = [...prev];
      const ws = { ...next[wsIdx] };
      ws.actionSteps = ws.actionSteps.map(s => {
        if (s._key !== stepKey) return s;
        return {
          ...s,
          handActions: s.handActions.map(h =>
            h._key !== haKey ? h : { ...h, [field]: value }
          ),
        };
      });
      ws._dirty = true;
      next[wsIdx] = ws;
      return next;
    });
    setIsDirty(true);
  }, []);

  // ─── 更新 mutation ─────────────────────────────────────────────────────
  const utils = trpc.useUtils();
  const updateMutation = trpc.snapshot.updateData.useMutation({
    onSuccess: () => {
      justSavedRef.current = true; // 標記為儲存後刷新，保留 UI 展開狀態
      refetchDetail();
      refetchSnaps();
      utils.snapshot.getAllLinesLatest.invalidate();
      utils.snapshot.getAllLinesHistory.invalidate();
      setIsDirty(false);
      setSaveError(null); // 清除先前的錯誤
      // 顯示成功動畫 Banner（2.5 秒後自動消失）
      setShowSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => setShowSaveSuccess(false), 2500);
    },
    onError: (err) => {
      // 分類錯誤類型
      let message = "儲存失敗";
      let detail: string | undefined;
      const msg = err.message ?? "";
      if (
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("ERR_NETWORK")
      ) {
        message = "網路連線異常";
        detail = "請檢查網路連線後再試一次。若問題持續，請重新整理頁面。";
      } else if (
        msg.includes("UNAUTHORIZED") ||
        msg.includes("FORBIDDEN") ||
        msg.includes("401") ||
        msg.includes("403")
      ) {
        message = "登入已過期或權限不足";
        detail = "請重新登入後再試。";
      } else if (
        msg.includes("BAD_REQUEST") ||
        msg.includes("PARSE_ERROR") ||
        msg.includes("ZodError") ||
        msg.includes("validation") ||
        msg.includes("invalid")
      ) {
        message = "資料格式錯誤";
        detail = "請檢查工站名稱、CT 與人力欄位是否填寫正確。";
      } else if (
        msg.includes("TIMEOUT") ||
        msg.includes("timeout") ||
        msg.includes("AbortError")
      ) {
        message = "請求逾時";
        detail = "伺服器回應超時，請稍後再試。";
      } else if (msg.includes("INTERNAL_SERVER_ERROR") || msg.includes("500")) {
        message = "伺服器內部錯誤";
        detail = "伺服器發生未預期錯誤，請稍後再試。";
      } else {
        message = "儲存失敗";
        detail = msg || "未知錯誤，請稍後再試。";
      }
      setSaveError({ message, detail });
      // 永久顯示錯誤 Banner（需手動關閉）
      if (saveErrorTimerRef.current) clearTimeout(saveErrorTimerRef.current);
    },
    onSettled: () => {
      // 儲存完成（無論成功或失敗）都移除過期的錯誤狀態（成功時清除）
    },
  });

  // ─── 重置 ──────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!snapDetail) return;
    const ws = (snapDetail.workstationsData as any[] | null) ?? [];
    const sorted = [...ws].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    setEditRows(sorted.map(w => ({
      ...w,
      cycleTime: Number(w.cycleTime),
      manpower: Number(w.manpower),
      _origCycleTime: Number(w.cycleTime),
      _origManpower: Number(w.manpower),
      _origName: w.name,
      _dirty: false,
      _expanded: false,
      actionSteps: toStepItems(w.actionSteps ?? []),
    })));
    setSnapName(snapDetail.name);
    setSnapNote(snapDetail.note ?? "");
    setTaktTimeInput(snapDetail.taktTime ? String(snapDetail.taktTime) : "");
    setIsDirty(false);
    toast.info("已還原至原始數據");
  }, [snapDetail]);

  // ─── 儲存 ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!selectedSnapId) return;
    // 前端資料驗證
    const invalidWs = editRows.find(r => !r.name?.trim());
    if (invalidWs) {
      setSaveError({ message: "資料格式錯誤", detail: `工站「${invalidWs.name || "(空白)"}」的名稱不能為空。` });
      return;
    }
    const invalidCt = editRows.find(r => isNaN(Number(r.cycleTime)) || Number(r.cycleTime) < 0);
    if (invalidCt) {
      setSaveError({ message: "資料格式錯誤", detail: `工站「${invalidCt.name}」的週期時間格式不正確，請輸入有效數字。` });
      return;
    }
    const invalidMp = editRows.find(r => isNaN(Number(r.manpower)) || Number(r.manpower) <= 0);
    if (invalidMp) {
      setSaveError({ message: "資料格式錯誤", detail: `工站「${invalidMp.name}」的人力必須大於 0。` });
      return;
    }
    const invalidStep = editRows.flatMap(r => r.actionSteps).find(s => !s.stepName?.trim());
    if (invalidStep) {
      setSaveError({ message: "資料格式錯誤", detail: "存在名稱為空的動作步驟，請先填寫步驟名稱。" });
      return;
    }
    setSaveError(null); // 清除舊錯誤
    const taktTime = taktTimeInput ? parseFloat(taktTimeInput) : null;
    updateMutation.mutate({
      id: selectedSnapId,
      name: snapName,
      note: snapNote || null,
      taktTime: taktTime && !isNaN(taktTime) ? taktTime : null,
      workstationsData: editRows.map(r => ({
        id: r.id,
        name: r.name,
        cycleTime: r.cycleTime,
        manpower: r.manpower,
        sequenceOrder: r.sequenceOrder,
        description: r.description,
        actionStepCount: r.actionSteps.length || r.actionStepCount,
        totalStepSec: r.totalStepSec,
        valueAddedSec: r.valueAddedSec,
        nonValueAddedSec: r.nonValueAddedSec,
        necessaryWasteSec: r.necessaryWasteSec,
        valueAddedRate: r.valueAddedRate,
        actionSteps: r.actionSteps.map((s, si) => ({
          id: s.id,
          stepName: s.stepName,
          stepOrder: si,
          duration: parseDur(s.duration),
          actionType: s.actionType,
          description: s.description,
          handActions: s.handActions.map(h => ({
            id: h.id,
            hand: h.hand,
            actionName: h.actionName,
            duration: parseDur(h.duration),
            handActionType: h.handActionType,
            isIdle: h.isIdle,
            note: h.note,
          })),
        })),
      })),
    });
  }, [selectedSnapId, snapName, snapNote, taktTimeInput, editRows, updateMutation]);

  // ─── 即時 KPI ──────────────────────────────────────────────────────────
  const taktNum = taktTimeInput ? parseFloat(taktTimeInput) : null;
  const kpi = calcKpi(editRows, taktNum && !isNaN(taktNum) ? taktNum : null);
  const dirtyCount = editRows.filter(r => r._dirty).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 relative">
      {/* 儲存中全頁半透明遮罩 */}
      {updateMutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 bg-card border border-border rounded-2xl px-10 py-8 shadow-2xl">
            <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
            <div className="text-center">
              <p className="text-base font-semibold text-foreground">儲存中...</p>
              <p className="text-sm text-muted-foreground mt-1">正在儲存快照資料與重算 KPI</p>
            </div>
          </div>
        </div>
      )}
      {/* 儲存成功 Banner */}
      <div
        className={[
          "fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3",
          "bg-emerald-500/95 text-white px-6 py-3 rounded-full shadow-lg",
          "transition-all duration-500",
          showSaveSuccess ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none",
        ].join(" ")}
      >
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium text-sm">快照已成功儲存，KPI 已自動重算</span>
      </div>
      {/* 儲存失敗 Banner */}
      {saveError && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
          <div className="flex items-start gap-3 bg-red-600/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-red-400/30">
            <XCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{saveError.message}</p>
              {saveError.detail && (
                <p className="text-xs text-red-100 mt-1 leading-relaxed">{saveError.detail}</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />重試
                </button>
                <button
                  onClick={() => setSaveError(null)}
                  className="flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 頁首 */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10">
          <PencilLine className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">數據修整</h1>
          <p className="text-sm text-muted-foreground">選取歷史快照，修改工站 CT、人力、動作步驟與雙手動作，KPI 將自動重算</p>
        </div>
      </div>

      {/* 選取產線 & 快照 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">選取快照</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">產線</Label>
              <Select
                value={selectedLineId ? String(selectedLineId) : ""}
                onValueChange={v => {
                  setSelectedLineId(Number(v));
                  setSelectedSnapId(null);
                  setEditRows([]);
                  setIsDirty(false);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="選擇產線..." />
                </SelectTrigger>
                <SelectContent>
                  {lines.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedLineId && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
            {selectedLineId && (
              <div className="space-y-1.5 min-w-[240px]">
                <Label className="text-xs text-muted-foreground">快照</Label>
                <Select
                  value={selectedSnapId ? String(selectedSnapId) : ""}
                  onValueChange={v => {
                    setSelectedSnapId(Number(v));
                    setIsDirty(false);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="選擇快照..." />
                  </SelectTrigger>
                  <SelectContent>
                    {snapshots.length === 0 && (
                      <SelectItem value="__none__" disabled>此產線無快照</SelectItem>
                    )}
                    {snapshots.map(s => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString("zh-TW")}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 快照基本資訊編輯 */}
      {selectedSnapId && snapDetail && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">快照基本資訊</CardTitle>
            <CardDescription className="text-xs">修改快照名稱、備註與 Takt Time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">快照名稱</Label>
                <Input
                  value={snapName}
                  onChange={e => { setSnapName(e.target.value); setIsDirty(true); }}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Takt Time（秒，留空則不設定）</Label>
                <Input
                  type="number" min="0.1" step="0.1"
                  value={taktTimeInput}
                  onChange={e => { setTaktTimeInput(e.target.value); setIsDirty(true); }}
                  placeholder="例：60"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">備註</Label>
                <Textarea
                  value={snapNote}
                  onChange={e => { setSnapNote(e.target.value); setIsDirty(true); }}
                  rows={1}
                  className="resize-none"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 工站數據編輯 */}
      {editRows.length > 0 && (
        <>
          {/* 即時 KPI 預覽 */}
          {kpi && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: "平衡率", value: `${kpi.balanceRate.toFixed(1)}%`, highlight: kpi.balanceRate >= 85 },
                { label: "瓶頸 CT", value: `${kpi.maxTime.toFixed(1)}s`, highlight: false },
                { label: "平均 CT", value: `${kpi.avgTime.toFixed(1)}s`, highlight: false },
                { label: "總人力", value: `${kpi.totalManpower.toFixed(1)} 人`, highlight: false },
                { label: "UPPH", value: kpi.upph.toFixed(2), highlight: false },
                ...(kpi.taktPassRate != null
                  ? [{ label: "Takt 達標率", value: `${kpi.taktPassRate.toFixed(1)}%`, highlight: kpi.taktPassRate >= 80 }]
                  : []),
              ].map(item => (
                <Card key={item.label} className="py-3 px-4">
                  <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                  <div className={`text-lg font-semibold ${item.highlight ? "text-emerald-400" : "text-foreground"}`}>
                    {item.value}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* 操作列 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {dirtyCount > 0 && (
                <Badge variant="outline" className="text-amber-400 border-amber-400/40 bg-amber-400/10 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {dirtyCount} 個工站已修改
                </Badge>
              )}
              {!isDirty && editRows.length > 0 && (
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/40 bg-emerald-400/10 gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  無未儲存變更
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => setShowAddForm(v => !v)}
                className="gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Plus className="h-3.5 w-3.5" />新增工站
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleReset}
                disabled={!isDirty || updateMutation.isPending}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />還原
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || updateMutation.isPending}
                className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white min-w-[96px] relative"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    儲存中...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    儲存變更
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 新增工站表單 */}
          {showAddForm && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                  <Plus className="h-4 w-4" />新增工站至快照
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="space-y-1.5 flex-1 min-w-[160px]">
                    <Label className="text-xs text-muted-foreground">工站名稱 <span className="text-red-400">*</span></Label>
                    <Input value={newWsName} onChange={e => setNewWsName(e.target.value)} placeholder="例：WS-05" className="h-9" onKeyDown={e => e.key === "Enter" && handleAddWorkstation()} />
                  </div>
                  <div className="space-y-1.5 w-36">
                    <Label className="text-xs text-muted-foreground">週期時間（秒）<span className="text-red-400">*</span></Label>
                    <Input type="number" min="0.1" step="0.1" value={newWsCt} onChange={e => setNewWsCt(e.target.value)} placeholder="例：45" className="h-9" onKeyDown={e => e.key === "Enter" && handleAddWorkstation()} />
                  </div>
                  <div className="space-y-1.5 w-28">
                    <Label className="text-xs text-muted-foreground">人力（人）<span className="text-red-400">*</span></Label>
                    <Input type="number" min="0.5" step="0.5" value={newWsManpower} onChange={e => setNewWsManpower(e.target.value)} className="h-9" onKeyDown={e => e.key === "Enter" && handleAddWorkstation()} />
                  </div>
                  <div className="space-y-1.5 w-48">
                    <Label className="text-xs text-muted-foreground">插入位置</Label>
                    <Select value={newWsInsertAfter} onValueChange={setNewWsInsertAfter}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last">加在最後（第 {editRows.length + 1} 站）</SelectItem>
                        {editRows.map((row, idx) => (
                          <SelectItem key={row.id} value={String(row.id)}>第 {idx + 1} 站之後（{row.name}）</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddWorkstation} className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Plus className="h-3.5 w-3.5" />確認新增
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowAddForm(false); setNewWsName(""); setNewWsCt(""); setNewWsManpower("1"); setNewWsInsertAfter("last"); }} className="h-9">取消</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 提示 */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>點擊工站列左側的展開箭頭可編輯動作步驟與雙手動作；直接點擊名稱、CT 或人力欄位可修改。儲存後系統將自動重算所有 KPI 與增值率。</span>
          </div>

          {/* 工站列表（可展開） */}
          <div className="space-y-2">
            {editRows.map((row, wsIdx) => {
              const taktOk = taktNum && !isNaN(taktNum) ? row.cycleTime <= taktNum : null;
              const stepCount = row.actionSteps.length;
              const totalStepSec = row.actionSteps.reduce((a, s) => a + parseDur(s.duration), 0);
              const vaRate = totalStepSec > 0
                ? (row.actionSteps.filter(s => s.actionType === "value_added").reduce((a, s) => a + parseDur(s.duration), 0) / totalStepSec * 100)
                : (row.valueAddedRate ?? null);

              return (
                <Card key={row.id} className={`border ${row._dirty ? "border-amber-500/40 bg-amber-500/5" : "border-border/60"}`}>
                  {/* 工站主列 */}
                  <div className="flex items-center gap-2 px-4 py-2.5">
                    {/* 展開按鈕 */}
                    <button
                      onClick={() => toggleExpand(wsIdx)}
                      className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground"
                      title={row._expanded ? "收合" : "展開動作步驟"}
                    >
                      {row._expanded
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />}
                    </button>

                    {/* 序號 */}
                    <span className="shrink-0 text-xs text-muted-foreground/60 w-5 text-center font-mono">{row.sequenceOrder}</span>

                    {/* 工站名稱 */}
                    <Input
                      value={row.name}
                      onChange={e => updateRow(wsIdx, "name", e.target.value)}
                      className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border px-2 flex-1 min-w-[120px]"
                    />

                    {/* CT */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number" min="0.1" step="0.1"
                        value={row.cycleTime}
                        onChange={e => updateRow(wsIdx, "cycleTime", e.target.value)}
                        className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border px-2 w-20 text-right"
                      />
                      <span className="text-xs text-muted-foreground/50">s</span>
                      {row._dirty && row.cycleTime !== row._origCycleTime && (
                        <span className="text-[10px] text-muted-foreground/50">原{row._origCycleTime}s</span>
                      )}
                    </div>

                    {/* 人力 */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        type="number" min="0.5" step="0.5"
                        value={row.manpower}
                        onChange={e => updateRow(wsIdx, "manpower", e.target.value)}
                        className="h-8 text-sm border-transparent bg-transparent hover:border-border focus:border-border px-2 w-16 text-right"
                      />
                      <span className="text-xs text-muted-foreground/50">人</span>
                    </div>

                    {/* 增值率 */}
                    <div className="shrink-0 w-16 text-right">
                      {vaRate != null
                        ? <span className="text-xs text-emerald-400">{typeof vaRate === "number" ? vaRate.toFixed(1) : vaRate}%</span>
                        : <span className="text-xs text-muted-foreground/40">—</span>}
                    </div>

                    {/* 步驟數 */}
                    <div className="shrink-0 w-16 text-right">
                      {stepCount > 0
                        ? <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30 bg-blue-400/10">{stepCount} 步驟</Badge>
                        : <span className="text-xs text-muted-foreground/40">無步驟</span>}
                    </div>

                    {/* Takt 狀態 */}
                    <div className="shrink-0 w-14">
                      {taktOk === true && <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-[10px]">達標</Badge>}
                      {taktOk === false && <Badge variant="outline" className="text-red-400 border-red-400/30 bg-red-400/10 text-[10px]">超出</Badge>}
                    </div>

                    {/* 刪除（僅新增的暫存列） */}
                    {row.id < 0 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/60 hover:text-red-400 hover:bg-red-400/10 shrink-0" onClick={() => handleRemoveRow(wsIdx)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* 展開：動作步驟 */}
                  {row._expanded && (
                    <div className="border-t border-border/40 px-4 pt-3 pb-4 space-y-3 bg-background/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">動作步驟（{stepCount} 個）</span>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => addStep(wsIdx)}
                          className="h-7 text-xs gap-1 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                        >
                          <Plus className="h-3 w-3" />新增步驟
                        </Button>
                      </div>

                      {row.actionSteps.length === 0 && (
                        <div className="text-xs text-muted-foreground/50 py-2 text-center">尚無動作步驟，點擊「新增步驟」開始新增</div>
                      )}

                      {row.actionSteps.map((step, stepIdx) => {
                        const stepSec = parseDur(step.duration);
                        return (
                          <div key={step._key} className="rounded-lg border border-border/40 bg-card/40 overflow-hidden">
                            {/* 步驟主列 */}
                            <div className="flex items-center gap-2 px-3 py-2">
                              <span className="text-[10px] text-muted-foreground/50 font-mono w-4 shrink-0">{stepIdx + 1}</span>

                              {/* 步驟名稱 */}
                              <Input
                                value={step.stepName}
                                onChange={e => updateStep(wsIdx, step._key, "stepName", e.target.value)}
                                placeholder="動作名稱"
                                className="h-7 text-xs border-transparent bg-transparent hover:border-border focus:border-border px-1.5 flex-1 min-w-[100px]"
                              />

                              {/* 類型 */}
                              <Select value={step.actionType} onValueChange={v => updateStep(wsIdx, step._key, "actionType", v)}>
                                <SelectTrigger className="h-7 text-xs w-24 border-transparent bg-transparent hover:border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(Object.entries(ACTION_TYPE_LABELS) as [ActionType, string][]).map(([k, label]) => (
                                    <SelectItem key={k} value={k}>
                                      <span className={ACTION_TYPE_COLORS[k]}>{label}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* 時間 */}
                              <div className="flex items-center gap-1 shrink-0">
                                <Input
                                  type="number" min="0" step="0.1"
                                  value={step.duration}
                                  onChange={e => updateStep(wsIdx, step._key, "duration", e.target.value)}
                                  placeholder="0.0"
                                  className="h-7 text-xs border-transparent bg-transparent hover:border-border focus:border-border px-1.5 w-16 text-right"
                                />
                                <span className="text-[10px] text-muted-foreground/50">s</span>
                              </div>

                              {/* 雙手展開按鈕 */}
                              <button
                                onClick={() => toggleStepHands(wsIdx, step._key)}
                                className={`shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors
                                  ${step._showHands ? "bg-violet-500/20 text-violet-400" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5"}`}
                                title="展開/收合雙手動作"
                              >
                                <Hand className="h-3 w-3" />
                                {step.handActions.length > 0 ? `${step.handActions.length}` : "雙手"}
                              </button>

                              {/* 刪除步驟 */}
                              <button
                                onClick={() => removeStep(wsIdx, step._key)}
                                className="shrink-0 p-1 rounded hover:bg-red-500/20 text-muted-foreground/30 hover:text-red-400 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>

                            {/* 雙手動作展開區 */}
                            {step._showHands && (
                              <div className="border-t border-border/30 px-3 pt-2 pb-3 bg-background/20 space-y-1.5">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-muted-foreground/60">雙手動作（{step.handActions.length} 筆）</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => addHandAction(wsIdx, step._key, "left")}
                                      className="text-[10px] px-2 py-0.5 rounded border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors"
                                    >+ 左手</button>
                                    <button
                                      onClick={() => addHandAction(wsIdx, step._key, "right")}
                                      className="text-[10px] px-2 py-0.5 rounded border border-violet-500/30 text-violet-400 hover:bg-violet-500/10 transition-colors"
                                    >+ 右手</button>
                                  </div>
                                </div>

                                {step.handActions.length === 0 && (
                                  <div className="text-[10px] text-muted-foreground/40 text-center py-1">尚無雙手動作</div>
                                )}

                                {step.handActions.map(ha => (
                                  <div key={ha._key} className={`flex items-center gap-1.5 p-1.5 rounded border transition-all
                                    ${ha.hand === "left" ? "border-blue-500/20 bg-blue-500/5" : "border-violet-500/20 bg-violet-500/5"}`}>
                                    {/* 手別標籤 */}
                                    <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded
                                      ${ha.hand === "left" ? "bg-blue-500/20 text-blue-400" : "bg-violet-500/20 text-violet-400"}`}>
                                      {ha.hand === "left" ? "左" : "右"}
                                    </span>

                                    {/* 動作名稱 */}
                                    <Input
                                      value={ha.actionName}
                                      onChange={e => updateHandAction(wsIdx, step._key, ha._key, "actionName", e.target.value)}
                                      placeholder={ha.isIdle ? "空手等待" : "動作名稱"}
                                      disabled={ha.isIdle}
                                      className="h-6 text-[11px] border-transparent bg-transparent hover:border-border focus:border-border px-1.5 flex-1 min-w-[80px]"
                                    />

                                    {/* 類型 */}
                                    <Select value={ha.handActionType} onValueChange={v => updateHandAction(wsIdx, step._key, ha._key, "handActionType", v)}>
                                      <SelectTrigger className="h-6 text-[10px] w-20 border-transparent bg-transparent hover:border-border">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {(Object.entries(HAND_ACTION_TYPE_LABELS) as [HandActionType, string][]).map(([k, label]) => (
                                          <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    {/* 時間 */}
                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <Input
                                        type="number" min="0" step="0.1"
                                        value={ha.duration}
                                        onChange={e => updateHandAction(wsIdx, step._key, ha._key, "duration", e.target.value)}
                                        placeholder="0.0"
                                        className="h-6 text-[11px] border-transparent bg-transparent hover:border-border focus:border-border px-1.5 w-14 text-right"
                                      />
                                      <span className="text-[9px] text-muted-foreground/40">s</span>
                                    </div>

                                    {/* 空手勾選 */}
                                    <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={ha.isIdle}
                                        onChange={e => updateHandAction(wsIdx, step._key, ha._key, "isIdle", e.target.checked)}
                                        className="w-3 h-3 accent-gray-500"
                                      />
                                      <span className="text-[9px] text-muted-foreground/50">空手</span>
                                    </label>

                                    {/* 刪除 */}
                                    <button
                                      onClick={() => removeHandAction(wsIdx, step._key, ha._key)}
                                      className="shrink-0 p-0.5 rounded hover:bg-red-500/20 text-muted-foreground/30 hover:text-red-400 transition-colors"
                                    >
                                      <Trash2 className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* 空狀態 */}
      {selectedSnapId && editRows.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">此快照無工站數據</div>
      )}
      {!selectedLineId && (
        <div className="text-center py-16 text-muted-foreground text-sm">請先選擇產線與快照以開始修整數據</div>
      )}
    </div>
  );
}
