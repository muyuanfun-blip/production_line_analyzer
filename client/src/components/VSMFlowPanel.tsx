import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Trash2 } from 'lucide-react';

interface VSMFlowPanelProps {
  flow: {
    id: number;
    fromProcessId: number;
    toProcessId: number;
    flowType: 'material' | 'information' | 'kanban';
    cycleTime?: number | null;
    quantity?: number | null;
    notes?: string | null;
  };
  onUpdate?: (updates: Partial<VSMFlowPanelProps['flow']>) => void;
  onDelete?: () => void;
}

const FLOW_TYPE_LABELS: Record<string, string> = {
  material: '物流',
  information: '資訊流',
  kanban: '看板',
};

const FLOW_COLORS: Record<string, string> = {
  material: '#3b82f6',
  information: '#10b981',
  kanban: '#f59e0b',
};

export const VSMFlowPanel: React.FC<VSMFlowPanelProps> = ({
  flow,
  onUpdate,
  onDelete,
}) => {
  const handleFlowTypeChange = (flowType: string) => {
    onUpdate?.({ ...flow, flowType: flowType as any });
  };

  const handleCycleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseFloat(e.target.value) : null;
    onUpdate?.({ ...flow, cycleTime: value });
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? parseInt(e.target.value) : null;
    onUpdate?.({ ...flow, quantity: value });
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate?.({ ...flow, notes: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-slate-300 text-sm">流線類型</Label>
        <Select value={flow.flowType} onValueChange={handleFlowTypeChange}>
          <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="material">物流</SelectItem>
            <SelectItem value="information">資訊流</SelectItem>
            <SelectItem value="kanban">看板</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-slate-300 text-sm">週期時間（秒）</Label>
          <Input
            type="number"
            step="0.1"
            value={flow.cycleTime || ''}
            onChange={handleCycleTimeChange}
            placeholder="0"
            className="bg-slate-700 border-slate-600 text-white mt-1"
          />
        </div>
        <div>
          <Label className="text-slate-300 text-sm">流量</Label>
          <Input
            type="number"
            value={flow.quantity || ''}
            onChange={handleQuantityChange}
            placeholder="0"
            className="bg-slate-700 border-slate-600 text-white mt-1"
          />
        </div>
      </div>

      <div>
        <Label className="text-slate-300 text-sm">備註</Label>
        <Textarea
          value={flow.notes || ''}
          onChange={handleNotesChange}
          placeholder="新增備註..."
          className="bg-slate-700 border-slate-600 text-white mt-1 resize-none"
          rows={3}
        />
      </div>

      <div className="pt-4 border-t border-slate-700">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-2 rounded"
            style={{ backgroundColor: FLOW_COLORS[flow.flowType] || '#6b7280' }}
          />
          <span className="text-slate-300 text-sm">
            {FLOW_TYPE_LABELS[flow.flowType] || flow.flowType}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          className="w-full"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          刪除流線
        </Button>
      </div>
    </div>
  );
};
