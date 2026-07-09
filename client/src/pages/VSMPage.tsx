import React, { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { VSMCanvas } from '@/components/VSMCanvas';
import { VSMAnalysis } from '@/components/VSMAnalysis';
import { VSMVersionCompare } from '@/components/VSMVersionCompare';
import { VSMSkeleton } from '@/components/VSMSkeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Save, Download, RotateCcw, Clock, FileJson, FileSpreadsheet } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { exportVSMAsJSON, exportVSMProcessesAsCSV, exportVSMFlowsAsCSV, exportVSMAsPNG } from '@/lib/vsmExport';

interface VSMProcessDisplay {
  id: number;
  name: string;
  type: 'process' | 'supplier' | 'customer' | 'inventory' | 'transport';
  cycleTime?: number | null;
  manpower?: number | null;
  valueAddedRate?: number | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

interface VSMProcess extends VSMProcessDisplay {
  vsmDiagramId: number;
  workstationId?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VSMFlowDisplay {
  id: number;
  fromProcessId: number;
  toProcessId: number;
  flowType: 'material' | 'information' | 'kanban';
  cycleTime?: number | null;
  quantity?: number | null;
}

interface VSMDiagram {
  id: number;
  productionLineId: number;
  name: string;
  description?: string | null;
  status: 'draft' | 'published' | 'archived';
  versionNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export const VSMPage: React.FC = () => {
  const { lineId } = useParams<{ lineId: string }>();
  const [selectedDiagramId, setSelectedDiagramId] = useState<number | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<VSMProcessDisplay | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<VSMFlowDisplay | null>(null);
  const [showNewProcessDialog, setShowNewProcessDialog] = useState(false);
  const [showNewFlowDialog, setShowNewFlowDialog] = useState(false);
  const [showNewDiagramDialog, setShowNewDiagramDialog] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);
  const [showCompareDialog, setShowCompareDialog] = useState(false);

  const lineIdNum = lineId ? parseInt(lineId) : 0;

  // 查詢圖表列表
  const { data: diagrams, isLoading: diagramsLoading } = trpc.vsm.listDiagrams.useQuery(
    { productionLineId: lineIdNum },
    { enabled: lineIdNum > 0 }
  );

  // 查詢工序
  const { data: processes, isLoading: processesLoading } = trpc.vsm.listProcesses.useQuery(
    { vsmDiagramId: selectedDiagramId || 0 },
    { enabled: (selectedDiagramId || 0) > 0 }
  );

  // 取得版本詳細資訊
  const versionAQuery = trpc.vsm.getVersionById.useQuery(
    { id: compareVersions?.[0] || 0 },
    { enabled: !!compareVersions?.[0] }
  );
  const versionBQuery = trpc.vsm.getVersionById.useQuery(
    { id: compareVersions?.[1] || 0 },
    { enabled: !!compareVersions?.[1] }
  );
  const versionA = versionAQuery.data;
  const versionB = versionBQuery.data;



  // 查詢流線
  const { data: flows, isLoading: flowsLoading } = trpc.vsm.listFlows.useQuery(
    { vsmDiagramId: selectedDiagramId || 0 },
    { enabled: (selectedDiagramId || 0) > 0 }
  );

  // 查詢圖表詳細資訊
  const diagramQuery = trpc.vsm.getDiagramById.useQuery(
    { id: selectedDiagramId || 0 },
    { enabled: !!selectedDiagramId }
  );
  const diagram = diagramQuery.data;

  // 查詢版本
  const versionsQuery = trpc.vsm.listVersions.useQuery(
    { vsmDiagramId: selectedDiagramId || 0 },
    { enabled: !!selectedDiagramId }
  );
  const versions = versionsQuery.data || [];

  // 建立圖表 mutation
  const createDiagramMutation = trpc.vsm.createDiagram.useMutation({
    onSuccess: (data) => {
      setSelectedDiagramId(data.diagram?.id || null);
      setShowNewDiagramDialog(false);
    },
  });

  // 建立工序 mutation
  const createProcessMutation = trpc.vsm.createProcess.useMutation({
    onSuccess: () => {
      setShowNewProcessDialog(false);
    },
  });

  // 建立流線 mutation
  const createFlowMutation = trpc.vsm.createFlow.useMutation({
    onSuccess: () => {
      setShowNewFlowDialog(false);
    },
  });

  // 更新工序位置
  const updateProcessMutation = trpc.vsm.updateProcess.useMutation();
  const svgRef = React.useRef<SVGSVGElement>(null);

  const handleProcessMove = (processId: number, x: number, y: number) => {
    updateProcessMutation.mutate({ id: processId, positionX: x, positionY: y });
  };

  const handleExportJSON = () => {
    if (!selectedDiagramId) return;
    const diagram = diagrams?.find(d => d.id === selectedDiagramId);
    if (diagram && processes && flows) {
      exportVSMAsJSON(diagram, processes, flows);
    }
  };

  const handleExportProcessesCSV = () => {
    if (!selectedDiagramId) return;
    const diagram = diagrams?.find(d => d.id === selectedDiagramId);
    if (diagram && processes) {
      exportVSMProcessesAsCSV(diagram, processes);
    }
  };

  const handleExportFlowsCSV = () => {
    if (!selectedDiagramId) return;
    const diagram = diagrams?.find(d => d.id === selectedDiagramId);
    if (diagram && flows && processes) {
      const processMap = new Map(processes.map(p => [p.id, p.name]));
      exportVSMFlowsAsCSV(diagram, flows, processMap);
    }
  };

  const handleExportPNG = async () => {
    if (!selectedDiagramId) return;
    const diagram = diagrams?.find(d => d.id === selectedDiagramId);
    if (diagram && svgRef.current) {
      try {
        await exportVSMAsPNG(diagram, svgRef.current);
      } catch (error) {
        console.error('匯出 PNG 失敗:', error);
      }
    }
  };

  const handleCreateDiagram = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createDiagramMutation.mutate({
      productionLineId: lineIdNum,
      name: formData.get('name') as string,
      description: formData.get('description') as string || undefined,
      status: 'draft',
    });
  };

  const handleCreateProcess = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDiagramId) return;
    const formData = new FormData(e.currentTarget);
    createProcessMutation.mutate({
      vsmDiagramId: selectedDiagramId,
      name: formData.get('name') as string,
      type: formData.get('type') as any,
      cycleTime: formData.get('cycleTime') ? parseFloat(formData.get('cycleTime') as string) : null,
      manpower: formData.get('manpower') ? parseFloat(formData.get('manpower') as string) : null,
      positionX: 100,
      positionY: 100,
    });
  };

  const handleCreateFlow = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDiagramId) return;
    const formData = new FormData(e.currentTarget);
    createFlowMutation.mutate({
      vsmDiagramId: selectedDiagramId,
      fromProcessId: parseInt(formData.get('fromProcessId') as string),
      toProcessId: parseInt(formData.get('toProcessId') as string),
      flowType: formData.get('flowType') as any,
      cycleTime: formData.get('cycleTime') ? parseFloat(formData.get('cycleTime') as string) : null,
      quantity: formData.get('quantity') ? parseInt(formData.get('quantity') as string) : null,
    });
  };

  if (diagramsLoading) {
    return <div className="p-6 text-slate-400">載入中...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-950">
      {/* 左側面板 - 圖表列表 */}
      <div className="w-64 border-r border-slate-700 bg-slate-900 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold text-white mb-4">VSM 圖表</h2>
          <Dialog open={showNewDiagramDialog} onOpenChange={setShowNewDiagramDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                新增圖表
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>建立新 VSM 圖表</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateDiagram} className="space-y-4">
                <div>
                  <Label htmlFor="name">圖表名稱</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="description">描述</Label>
                  <Textarea id="description" name="description" />
                </div>
                <Button type="submit" className="w-full">建立</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* 圖表列表 */}
        <div className="flex-1 overflow-y-auto">
          {diagrams?.map((diagram: VSMDiagram) => (
            <div
              key={diagram.id}
              onClick={() => setSelectedDiagramId(diagram.id)}
              className={`p-3 border-b border-slate-700 cursor-pointer transition ${
                selectedDiagramId === diagram.id
                  ? 'bg-blue-900 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <p className="font-medium text-sm">{diagram.name}</p>
              <p className="text-xs text-slate-400 mt-1">v{diagram.versionNumber}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 中央編輯區 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedDiagramId ? (
          <>
            {/* 工具列 */}
            <div className="h-16 border-b border-slate-700 bg-slate-900 px-4 flex items-center gap-2">
              <Dialog open={showNewProcessDialog} onOpenChange={setShowNewProcessDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    新增工序
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增工序</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateProcess} className="space-y-4">
                    <div>
                      <Label htmlFor="name">工序名稱</Label>
                      <Input id="name" name="name" required />
                    </div>
                    <div>
                      <Label htmlFor="type">工序類型</Label>
                      <Select name="type" defaultValue="process">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="process">工序</SelectItem>
                          <SelectItem value="supplier">供應商</SelectItem>
                          <SelectItem value="customer">客戶</SelectItem>
                          <SelectItem value="inventory">庫存</SelectItem>
                          <SelectItem value="transport">運輸</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cycleTime">週期時間（秒）</Label>
                      <Input id="cycleTime" name="cycleTime" type="number" step="0.1" />
                    </div>
                    <div>
                      <Label htmlFor="manpower">人力數</Label>
                      <Input id="manpower" name="manpower" type="number" step="0.25" />
                    </div>
                    <Button type="submit" className="w-full">新增</Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={showNewFlowDialog} onOpenChange={setShowNewFlowDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    新增流線
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增流線</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateFlow} className="space-y-4">
                    <div>
                      <Label htmlFor="fromProcessId">來源工序</Label>
                      <Select name="fromProcessId">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {processes?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="toProcessId">目標工序</Label>
                      <Select name="toProcessId">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {processes?.map((p: any) => (
                            <SelectItem key={p.id} value={p.id.toString()}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="flowType">流線類型</Label>
                      <Select name="flowType" defaultValue="material">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="material">物流</SelectItem>
                          <SelectItem value="information">資訊流</SelectItem>
                          <SelectItem value="kanban">看板</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" className="w-full">新增</Button>
                  </form>
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="outline">
                <Save className="w-4 h-4 mr-2" />
                儲存
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    匯出
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPNG}>
                    匯出為 PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportJSON}>
                    <FileJson className="w-4 h-4 mr-2" />
                    匯出為 JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportProcessesCSV}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    匯出工序 CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportFlowsCSV}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    匯出流線 CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCompareDialog(true)}
              >
                <Clock className="w-4 h-4 mr-2" />
                版本
              </Button>
            </div>

            {/* VSM 畫布 */}
            <div className="flex-1 overflow-hidden">
              <VSMCanvas
                processes={(processes || []).map((p: any) => ({ id: p.id, name: p.name, type: p.type, cycleTime: p.cycleTime ? parseFloat(p.cycleTime) : undefined, manpower: p.manpower, valueAddedRate: p.valueAddedRate ? parseFloat(p.valueAddedRate) : undefined, positionX: p.positionX, positionY: p.positionY, width: p.width, height: p.height }))}
                flows={(flows || []).map((f: any) => ({ id: f.id, fromProcessId: f.fromProcessId, toProcessId: f.toProcessId, flowType: f.flowType, cycleTime: f.cycleTime ? (typeof f.cycleTime === 'string' ? parseFloat(f.cycleTime) : f.cycleTime) : undefined, quantity: f.quantity }))}
                onProcessSelect={(process) => {
                  if (process) {
                    setSelectedProcess({
                      id: process.id,
                      name: process.name,
                      type: process.type as any,
                      cycleTime: typeof process.cycleTime === 'string' ? parseFloat(process.cycleTime) : process.cycleTime,
                      manpower: process.manpower,
                      valueAddedRate: typeof process.valueAddedRate === 'string' ? parseFloat(process.valueAddedRate) : process.valueAddedRate,
                      positionX: process.positionX,
                      positionY: process.positionY,
                      width: process.width,
                      height: process.height,
                    });
                  } else {
                    setSelectedProcess(null);
                  }
                }}
                onFlowSelect={(flow) => {
                  if (flow) {
                    setSelectedFlow({
                      id: flow.id,
                      fromProcessId: flow.fromProcessId,
                      toProcessId: flow.toProcessId,
                      flowType: flow.flowType as any,
                      cycleTime: typeof flow.cycleTime === 'string' ? parseFloat(flow.cycleTime) : flow.cycleTime,
                      quantity: flow.quantity,
                    });
                  } else {
                    setSelectedFlow(null);
                  }
                }}
                onProcessMove={handleProcessMove}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-slate-400 text-lg">尚未選擇圖表</p>
              <p className="text-slate-500 text-sm mt-2">從左側列表選擇或建立新圖表</p>
            </div>
          </div>
        )}
      </div>

      {/* 右側面板 - 屬性編輯 / 分析 */}
      <div className="w-80 border-l border-slate-700 bg-slate-900 flex flex-col overflow-hidden">
        {/* 切換按鈕 */}
        <div className="flex gap-2 p-2 border-b border-slate-700 bg-slate-800">
          <Button
            size="sm"
            variant={!showAnalysis ? 'default' : 'outline'}
            onClick={() => setShowAnalysis(false)}
            className="flex-1 text-xs"
          >
            屬性
          </Button>
          <Button
            size="sm"
            variant={showAnalysis ? 'default' : 'outline'}
            onClick={() => setShowAnalysis(true)}
            className="flex-1 text-xs"
          >
            分析
          </Button>
        </div>
        {showAnalysis ? (
          <div className="p-4 overflow-y-auto flex-1">
            {processesLoading || flowsLoading ? (
              <VSMSkeleton />
            ) : (
              <VSMAnalysis
                processes={(processes || []).map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  type: p.type,
                  cycleTime: p.cycleTime ? parseFloat(p.cycleTime) : undefined,
                  manpower: p.manpower,
                  valueAddedRate: p.valueAddedRate ? parseFloat(p.valueAddedRate) : undefined,
                }))}
                flows={(flows || []).map((f: any) => ({
                  id: f.id,
                  fromProcessId: f.fromProcessId,
                  toProcessId: f.toProcessId,
                  flowType: f.flowType,
                  cycleTime: f.cycleTime ? parseFloat(f.cycleTime) : undefined,
                  quantity: f.quantity,
                }))}
                onAddProcess={() => {
                  setShowNewProcessDialog(true);
                }}
              />
            )}
          </div>
        ) : selectedProcess ? (
          <div className="p-4 overflow-y-auto flex-1">
            <h3 className="text-lg font-bold text-white mb-4">工序屬性</h3>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-slate-300 text-sm">名稱</Label>
                  <p className="text-white font-medium">{selectedProcess.name}</p>
                </div>
                <div>
                  <Label className="text-slate-300 text-sm">類型</Label>
                  <p className="text-white font-medium">{selectedProcess.type}</p>
                </div>
                {selectedProcess.cycleTime && (
                  <div>
                    <Label className="text-slate-300 text-sm">週期時間</Label>
                    <p className="text-white font-medium">{selectedProcess.cycleTime}s</p>
                  </div>
                )}
                {selectedProcess.manpower && (
                  <div>
                    <Label className="text-slate-300 text-sm">人力數</Label>
                    <p className="text-white font-medium">{selectedProcess.manpower}</p>
                  </div>
                )}
                {selectedProcess.valueAddedRate && (
                  <div>
                    <Label className="text-slate-300 text-sm">增值率</Label>
                    <p className="text-white font-medium">{selectedProcess.valueAddedRate}%</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : selectedFlow ? (
          <div className="p-4 overflow-y-auto flex-1">
            <h3 className="text-lg font-bold text-white mb-4">流線屬性</h3>
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="pt-4 space-y-3">
                <div>
                  <Label className="text-slate-300 text-sm">流線類型</Label>
                  <p className="text-white font-medium">{selectedFlow?.flowType}</p>
                </div>
                {selectedFlow?.cycleTime && (
                  <div>
                    <Label className="text-slate-300 text-sm">週期時間</Label>
                    <p className="text-white font-medium">{selectedFlow.cycleTime}s</p>
                  </div>
                )}
                {selectedFlow?.quantity && (
                  <div>
                    <Label className="text-slate-300 text-sm">流量</Label>
                    <p className="text-white font-medium">{selectedFlow.quantity}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="p-4 flex items-center justify-center h-full">
            <p className="text-slate-400 text-sm text-center">選擇工序或流線以查看屬性</p>
          </div>
        )}
      </div>

      {/* 版本比較對話框 */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-w-4xl max-h-96 bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle>版本比較</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-slate-300 text-sm">版本 A</Label>
                <Select
                  value={compareVersions?.[0]?.toString() || ''}
                  onValueChange={(val) =>
                    setCompareVersions([parseInt(val), compareVersions?.[1] || 0])
                  }
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="選擇版本" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {versions.map((v: any) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300 text-sm">版本 B</Label>
                <Select
                  value={compareVersions?.[1]?.toString() || ''}
                  onValueChange={(val) =>
                    setCompareVersions([compareVersions?.[0] || 0, parseInt(val)])
                  }
                >
                  <SelectTrigger className="bg-slate-800 border-slate-700">
                    <SelectValue placeholder="選擇版本" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {versions.map((v: any) => (
                      <SelectItem key={v.id} value={v.id.toString()}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {versionA && versionB && (
              <div className="max-h-64 overflow-y-auto">
                <VSMVersionCompare versionA={versionA} versionB={versionB} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
