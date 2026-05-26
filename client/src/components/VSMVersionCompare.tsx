import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Minus, Edit } from 'lucide-react';

interface VSMProcess {
  id: number;
  name: string;
  type: string;
  cycleTime?: string | number | null;
  manpower?: number | null;
  valueAddedRate?: string | number | null;
}

interface VSMFlow {
  id: number;
  fromProcessId: number;
  toProcessId: number;
  flowType: string;
  cycleTime?: string | number | null;
  quantity?: number | null;
}

interface VSMVersion {
  id: number;
  name: string;
  description?: string | null;
  createdAt: Date;
  processes: VSMProcess[];
  flows: VSMFlow[];
}

interface VSMVersionCompareProps {
  versionA: VSMVersion;
  versionB: VSMVersion;
}

type DiffType = 'added' | 'removed' | 'modified' | 'unchanged';

interface ProcessDiff {
  type: DiffType;
  processA?: VSMProcess;
  processB?: VSMProcess;
  changes?: Record<string, { from: any; to: any }>;
}

interface FlowDiff {
  type: DiffType;
  flowA?: VSMFlow;
  flowB?: VSMFlow;
  changes?: Record<string, { from: any; to: any }>;
}

export const VSMVersionCompare: React.FC<VSMVersionCompareProps> = ({
  versionA,
  versionB,
}) => {
  const { processDiffs, flowDiffs, summary } = useMemo(() => {
    const processMapA = new Map(versionA.processes.map(p => [p.id, p]));
    const processMapB = new Map(versionB.processes.map(p => [p.id, p]));

    const processDiffs: ProcessDiff[] = [];

    // 檢查 A 中的所有工序
    versionA.processes.forEach(pA => {
      const pB = processMapB.get(pA.id);
      if (!pB) {
        processDiffs.push({ type: 'removed', processA: pA });
      } else {
        // 檢查是否有變化
        const changes: Record<string, { from: any; to: any }> = {};
        if (pA.name !== pB.name) changes.name = { from: pA.name, to: pB.name };
        if (pA.type !== pB.type) changes.type = { from: pA.type, to: pB.type };
        if (pA.cycleTime !== pB.cycleTime) changes.cycleTime = { from: pA.cycleTime, to: pB.cycleTime };
        if (pA.manpower !== pB.manpower) changes.manpower = { from: pA.manpower, to: pB.manpower };
        if (pA.valueAddedRate !== pB.valueAddedRate) changes.valueAddedRate = { from: pA.valueAddedRate, to: pB.valueAddedRate };

        if (Object.keys(changes).length > 0) {
          processDiffs.push({ type: 'modified', processA: pA, processB: pB, changes });
        } else {
          processDiffs.push({ type: 'unchanged', processA: pA, processB: pB });
        }
      }
    });

    // 檢查 B 中新增的工序
    versionB.processes.forEach(pB => {
      if (!processMapA.has(pB.id)) {
        processDiffs.push({ type: 'added', processB: pB });
      }
    });

    // 類似地檢查流線
    const flowMapA = new Map(versionA.flows.map(f => [f.id, f]));
    const flowMapB = new Map(versionB.flows.map(f => [f.id, f]));

    const flowDiffs: FlowDiff[] = [];

    versionA.flows.forEach(fA => {
      const fB = flowMapB.get(fA.id);
      if (!fB) {
        flowDiffs.push({ type: 'removed', flowA: fA });
      } else {
        const changes: Record<string, { from: any; to: any }> = {};
        if (fA.flowType !== fB.flowType) changes.flowType = { from: fA.flowType, to: fB.flowType };
        if (fA.cycleTime !== fB.cycleTime) changes.cycleTime = { from: fA.cycleTime, to: fB.cycleTime };
        if (fA.quantity !== fB.quantity) changes.quantity = { from: fA.quantity, to: fB.quantity };

        if (Object.keys(changes).length > 0) {
          flowDiffs.push({ type: 'modified', flowA: fA, flowB: fB, changes });
        } else {
          flowDiffs.push({ type: 'unchanged', flowA: fA, flowB: fB });
        }
      }
    });

    versionB.flows.forEach(fB => {
      if (!flowMapA.has(fB.id)) {
        flowDiffs.push({ type: 'added', flowB: fB });
      }
    });

    return {
      processDiffs,
      flowDiffs,
      summary: {
        processesAdded: processDiffs.filter(d => d.type === 'added').length,
        processesRemoved: processDiffs.filter(d => d.type === 'removed').length,
        processesModified: processDiffs.filter(d => d.type === 'modified').length,
        flowsAdded: flowDiffs.filter(d => d.type === 'added').length,
        flowsRemoved: flowDiffs.filter(d => d.type === 'removed').length,
        flowsModified: flowDiffs.filter(d => d.type === 'modified').length,
      },
    };
  }, [versionA, versionB]);

  const getDiffBadge = (type: DiffType) => {
    switch (type) {
      case 'added':
        return <Badge className="bg-emerald-900 text-emerald-200"><Plus className="w-3 h-3 mr-1" />新增</Badge>;
      case 'removed':
        return <Badge className="bg-red-900 text-red-200"><Minus className="w-3 h-3 mr-1" />刪除</Badge>;
      case 'modified':
        return <Badge className="bg-amber-900 text-amber-200"><Edit className="w-3 h-3 mr-1" />修改</Badge>;
      default:
        return <Badge variant="outline">無變化</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* 版本資訊 */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">版本 A</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-slate-300">
            <div><strong>{versionA.name}</strong></div>
            <div>{versionA.createdAt.toLocaleString()}</div>
            <div>工序: {versionA.processes.length} | 流線: {versionA.flows.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">版本 B</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-slate-300">
            <div><strong>{versionB.name}</strong></div>
            <div>{versionB.createdAt.toLocaleString()}</div>
            <div>工序: {versionB.processes.length} | 流線: {versionB.flows.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 變化摘要 */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">變化摘要</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-slate-400">工序新增</div>
              <div className="text-emerald-400 font-bold">{summary.processesAdded}</div>
            </div>
            <div>
              <div className="text-slate-400">工序刪除</div>
              <div className="text-red-400 font-bold">{summary.processesRemoved}</div>
            </div>
            <div>
              <div className="text-slate-400">工序修改</div>
              <div className="text-amber-400 font-bold">{summary.processesModified}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-700">
            <div>
              <div className="text-slate-400">流線新增</div>
              <div className="text-emerald-400 font-bold">{summary.flowsAdded}</div>
            </div>
            <div>
              <div className="text-slate-400">流線刪除</div>
              <div className="text-red-400 font-bold">{summary.flowsRemoved}</div>
            </div>
            <div>
              <div className="text-slate-400">流線修改</div>
              <div className="text-amber-400 font-bold">{summary.flowsModified}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 工序變化 */}
      {processDiffs.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">工序變化</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {processDiffs.map((diff, idx) => (
              <div key={idx} className="text-xs border-l-2 border-slate-700 pl-2 py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-200">
                    {diff.processA?.name || diff.processB?.name}
                  </span>
                  {getDiffBadge(diff.type)}
                </div>
                {diff.changes && Object.keys(diff.changes).length > 0 && (
                  <div className="space-y-1 text-slate-400">
                    {Object.entries(diff.changes).map(([key, change]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}:</span>
                        <span>{change.from} → {change.to}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 流線變化 */}
      {flowDiffs.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">流線變化</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {flowDiffs.map((diff, idx) => (
              <div key={idx} className="text-xs border-l-2 border-slate-700 pl-2 py-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-200">
                    {diff.flowA?.flowType || diff.flowB?.flowType}
                  </span>
                  {getDiffBadge(diff.type)}
                </div>
                {diff.changes && Object.keys(diff.changes).length > 0 && (
                  <div className="space-y-1 text-slate-400">
                    {Object.entries(diff.changes).map(([key, change]) => (
                      <div key={key} className="flex justify-between">
                        <span>{key}:</span>
                        <span>{change.from} → {change.to}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
