import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';

interface VSMNodePanelProps {
  process: {
    id: number;
    name: string;
    type: 'process' | 'supplier' | 'customer' | 'inventory' | 'transport';
    cycleTime?: number | null;
    manpower?: number | null;
    valueAddedRate?: number | null;
    width: number;
    height: number;
    notes?: string | null;
  };
  onUpdate?: (updates: Partial<VSMNodePanelProps['process']>) => void;
  onDelete?: () => void;
}

const PROCESS_TYPE_LABELS: Record<string, string> = {
  process: '工序',
  supplier: '供應商',
  customer: '客戶',
  inventory: '庫存',
  transport: '運輸',
};

const PROCESS_COLORS: Record<string, string> = {
  process: '#3b82f6',
  supplier: '#10b981',
  customer: '#f59e0b',
  inventory: '#8b5cf6',
  transport: '#ec4899',
};

export const VSMNodePanel: React.FC<VSMNodePanelProps> = ({
  process,
  onUpdate,
  onDelete,
}) => {
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate?.({ ...process, name: e.target.value });
  };

  const handleTypeChange = (type: string) => {
    onUpdate?.({ ...process, type: type as any });
  };

  const handleCycleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    onUpdate?.({ ...process, cycleTime: value });
  };

  const handleManpowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    onUpdate?.({ ...process, manpower: value });
  };

  const handleValueAddedRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    onUpdate?.({ ...process, valueAddedRate: value });
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || process.width;
    onUpdate?.({ ...process, width: value });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || process.height;
    onUpdate?.({ ...process, height: value });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate?.({ ...process, notes: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-slate-300 text-sm">工序名稱</Label>
        <Input
          value={process.name}
          onChange={handleNameChange}
          placeholder="輸入工序名稱"
          className="bg-slate-700 border-slate-600 text-white mt-1"
        />
      </div>

      <div>
        <Label className="text-slate-300 text-sm">工序類型</Label>
        <Select value={process.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-slate-300 text-sm">週期時間（秒）</Label>
          <Input
            type="number"
            step="0.1"
            value={process.cycleTime || ''}
            onChange={handleCycleTimeChange}
            placeholder="0"
            className="bg-slate-700 border-slate-600 text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-slate-300 text-sm">人力數</Label>
          <Input
            type="number"
            step="0.5"
            value={process.manpower || ''}
            onChange={handleManpowerChange}
            placeholder="0"
            className="bg-slate-700 border-slate-600 text-white mt-1"
          />
        </div>
      </div>

      <div>
        <Label className="text-slate-300 text-sm">增值率（%）</Label>
        <Input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={process.valueAddedRate || ''}
          onChange={handleValueAddedRateChange}
          placeholder="0"
          className="bg-slate-700 border-slate-600 text-white mt-1"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-slate-300 text-sm">寬度（px）</Label>
          <Input
            type="number"
            value={process.width}
            onChange={handleWidthChange}
            className="bg-slate-700 border-slate-600 text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-slate-300 text-sm">高度（px）</Label>
          <Input
            type="number"
            value={process.height}
            onChange={handleHeightChange}
            className="bg-slate-700 border-slate-600 text-white mt-1"
          />
        </div>
      </div>

      <div>
        <Label className="text-slate-300 text-sm">備註</Label>
        <Textarea
          value={process.notes || ''}
          onChange={handleNotesChange}
          placeholder="新增備註..."
          className="bg-slate-700 border-slate-600 text-white mt-1 resize-none"
          rows={3}
        />
      </div>

      <div className="pt-4 border-t border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded"
            style={{ backgroundColor: PROCESS_COLORS[process.type] || '#6b7280' }}
          />
          <span className="text-slate-300 text-sm">
            {PROCESS_TYPE_LABELS[process.type] || process.type}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          className="w-full"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          刪除工序
        </Button>
      </div>
    </div>
  );
};
