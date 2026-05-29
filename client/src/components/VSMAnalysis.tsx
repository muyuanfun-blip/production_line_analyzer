import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, TrendingUp, Users, Zap, Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VSMProcess {
  id: number;
  name: string;
  type: 'process' | 'supplier' | 'customer' | 'inventory' | 'transport';
  cycleTime?: number | null;
  manpower?: number | null;
  valueAddedRate?: number | null;
}

interface VSMFlow {
  id: number;
  fromProcessId: number;
  toProcessId: number;
  flowType: 'material' | 'information' | 'kanban';
  cycleTime?: number | null;
  quantity?: number | null;
}

interface VSMAnalysisProps {
  processes: VSMProcess[];
  flows: VSMFlow[];
  onAddProcess?: () => void;
}

export const VSMAnalysis: React.FC<VSMAnalysisProps> = ({ processes, flows, onAddProcess }) => {
  const analysis = useMemo(() => {
    // 計算總 CT
    const totalCT = processes.reduce((sum, p) => sum + (p.cycleTime || 0), 0);

    // 計算總人力
    const totalManpower = processes.reduce((sum, p) => sum + (p.manpower || 0), 0);

    // 計算平均增值率
    const processesWithVAR = processes.filter(p => p.valueAddedRate !== null && p.valueAddedRate !== undefined);
    const avgVAR = processesWithVAR.length > 0
      ? processesWithVAR.reduce((sum, p) => sum + (p.valueAddedRate || 0), 0) / processesWithVAR.length
      : 0;

    // 識別瓶頸工序（最長 CT）
    const bottleneckProcess = processes.length > 0
      ? processes.reduce((max, p) => {
          const pCT = p.cycleTime || 0;
          const maxCT = max.cycleTime || 0;
          return pCT > maxCT ? p : max;
        })
      : null;

    // 計算 Lead Time（所有流線的 CT 總和）
    const leadTime = flows.reduce((sum, f) => sum + (f.cycleTime || 0), 0);

    // 計算物流 vs 資訊流比例
    const materialFlows = flows.filter(f => f.flowType === 'material').length;
    const informationFlows = flows.filter(f => f.flowType === 'information').length;
    const kanbanFlows = flows.filter(f => f.flowType === 'kanban').length;

    // 人力配置均衡度（標準差）
    const manpowerValues = processes.map(p => p.manpower || 0);
    const avgManpower = manpowerValues.length > 0 ? manpowerValues.reduce((a, b) => a + b, 0) / manpowerValues.length : 0;
    const variance = manpowerValues.length > 0
      ? manpowerValues.reduce((sum, val) => sum + Math.pow(val - avgManpower, 2), 0) / manpowerValues.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const balanceScore = avgManpower > 0 ? Math.max(0, 100 - (stdDev / avgManpower) * 100) : 100;

    return {
      totalCT,
      totalManpower,
      avgVAR,
      bottleneckProcess,
      leadTime,
      materialFlows,
      informationFlows,
      kanbanFlows,
      balanceScore,
      processCount: processes.length,
      flowCount: flows.length,
    };
  }, [processes, flows]);

  // 空狀態檢查
  if (processes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 animate-in fade-in-0 duration-500">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center max-w-sm animate-in fade-in-0 zoom-in-95 duration-500 delay-100">
          <div className="flex justify-center mb-4 animate-in fade-in-0 duration-500 delay-200">
            <Inbox className="w-12 h-12 text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 animate-in fade-in-0 duration-500 delay-300">尚無工序資料</h3>
          <p className="text-slate-400 text-sm mb-6 animate-in fade-in-0 duration-500 delay-400">
            開始建立 VSM 圖表，請先新增工序以進行價值流分析
          </p>
          {onAddProcess && (
            <div className="animate-in fade-in-0 duration-500 delay-500">
              <Button
                onClick={onAddProcess}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                新增工序
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 主要 KPI */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-slate-400 text-xs mb-1">總週期時間</div>
            <div className="text-2xl font-bold text-cyan-400">{analysis.totalCT.toFixed(1)}s</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-slate-400 text-xs mb-1">總人力數</div>
            <div className="text-2xl font-bold text-emerald-400">{analysis.totalManpower.toFixed(1)}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-slate-400 text-xs mb-1">平均增值率</div>
            <div className="text-2xl font-bold text-amber-400">{analysis.avgVAR.toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="pt-4">
            <div className="text-slate-400 text-xs mb-1">Lead Time</div>
            <div className="text-2xl font-bold text-purple-400">{analysis.leadTime.toFixed(1)}s</div>
          </CardContent>
        </Card>
      </div>

      {/* 瓶頸分析 */}
      {analysis.bottleneckProcess && (
        <Card className="bg-slate-800 border-slate-700 border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4" />
              瓶頸工序
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <div className="text-slate-400 text-xs">工序名稱</div>
              <div className="text-white font-medium">{analysis.bottleneckProcess.name}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">週期時間</div>
              <div className="text-red-400 font-bold">{analysis.bottleneckProcess.cycleTime?.toFixed(1) || 0}s</div>
            </div>
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
              ⚠️ 此工序是產線的主要瓶頸，優化此工序可顯著提升整體產能
            </div>
          </CardContent>
        </Card>
      )}

      {/* 人力配置均衡度 */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            人力配置均衡度
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-slate-400 text-xs">均衡分數</div>
            <div className={`text-lg font-bold ${analysis.balanceScore > 70 ? 'text-emerald-400' : analysis.balanceScore > 40 ? 'text-amber-400' : 'text-red-400'}`}>
              {analysis.balanceScore.toFixed(0)}%
            </div>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${analysis.balanceScore > 70 ? 'bg-emerald-500' : analysis.balanceScore > 40 ? 'bg-amber-500' : 'bg-red-500'}`}
              style={{ width: `${analysis.balanceScore}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 pt-2">
            {analysis.balanceScore > 70 ? '✓ 人力配置均衡' : analysis.balanceScore > 40 ? '⚠ 人力配置不夠均衡' : '✗ 人力配置嚴重不均'}
          </div>
        </CardContent>
      </Card>

      {/* 流線分析 */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4" />
            流線分析
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-slate-400 text-xs">物流</div>
              <div className="text-blue-400 font-bold text-lg">{analysis.materialFlows}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">資訊流</div>
              <div className="text-emerald-400 font-bold text-lg">{analysis.informationFlows}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs">看板</div>
              <div className="text-amber-400 font-bold text-lg">{analysis.kanbanFlows}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
            總流線數：{analysis.flowCount}
          </div>
        </CardContent>
      </Card>

      {/* 改善建議 */}
      <Card className="bg-slate-800 border-slate-700 border-blue-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-blue-400">
            <TrendingUp className="w-4 h-4" />
            改善建議
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-slate-300">
          {analysis.bottleneckProcess && (
            <div>• 優先優化「{analysis.bottleneckProcess.name}」工序，可提升整體產能</div>
          )}
          {analysis.balanceScore < 70 && (
            <div>• 調整人力配置，提高工序間的人力均衡度</div>
          )}
          {analysis.avgVAR < 50 && (
            <div>• 檢視低增值率工序，考慮流程簡化或自動化</div>
          )}
          {analysis.informationFlows === 0 && (
            <div>• 補充資訊流連接，完善生產流程的資訊同步</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
