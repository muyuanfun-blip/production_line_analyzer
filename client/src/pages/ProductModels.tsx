import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type ProductModel = {
  id: number;
  productionLineId: number;
  modelCode: string;
  modelName: string;
  targetCycleTime: string | null;
  batchSize: number | null;
  description: string | null;
  isActive: number;
  createdAt: Date;
  updatedAt: Date;
};

const EMPTY_FORM = {
  modelCode: "",
  modelName: "",
  targetCycleTime: "",
  batchSize: "1",
  description: "",
};

export default function ProductModels() {
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingModel, setEditingModel] = useState<ProductModel | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ProductModel | null>(null);

  // 查詢產線列表
  const { data: lines = [] } = trpc.productionLine.list.useQuery();

  // 查詢型號列表
  const { data: models = [], refetch: refetchModels, isLoading } = trpc.productModel.listByLine.useQuery(
    { productionLineId: selectedLineId! },
    { enabled: selectedLineId !== null }
  );

  const utils = trpc.useUtils();

  const createMutation = trpc.productModel.create.useMutation({
    onSuccess: () => {
      toast.success("型號建立成功");
      setShowCreateDialog(false);
      setForm(EMPTY_FORM);
      utils.productModel.listByLine.invalidate({ productionLineId: selectedLineId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.productModel.update.useMutation({
    onSuccess: () => {
      toast.success("型號更新成功");
      setEditingModel(null);
      utils.productModel.listByLine.invalidate({ productionLineId: selectedLineId! });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.productModel.delete.useMutation({
    onSuccess: () => {
      toast.success("型號已刪除");
      setDeleteTarget(null);
      utils.productModel.listByLine.invalidate({ productionLineId: selectedLineId! });
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setShowCreateDialog(true);
  }

  function openEdit(model: ProductModel) {
    setForm({
      modelCode: model.modelCode,
      modelName: model.modelName,
      targetCycleTime: model.targetCycleTime ?? "",
      batchSize: String(model.batchSize ?? 1),
      description: model.description ?? "",
    });
    setEditingModel(model);
  }

  function handleSubmitCreate() {
    if (!selectedLineId) return;
    if (!form.modelCode.trim() || !form.modelName.trim()) {
      toast.error("型號代碼與名稱為必填");
      return;
    }
    createMutation.mutate({
      productionLineId: selectedLineId,
      modelCode: form.modelCode.trim(),
      modelName: form.modelName.trim(),
      targetCycleTime: form.targetCycleTime ? parseFloat(form.targetCycleTime) : null,
      batchSize: form.batchSize ? parseInt(form.batchSize) : 1,
      description: form.description || null,
    });
  }

  function handleSubmitEdit() {
    if (!editingModel) return;
    if (!form.modelCode.trim() || !form.modelName.trim()) {
      toast.error("型號代碼與名稱為必填");
      return;
    }
    updateMutation.mutate({
      id: editingModel.id,
      modelCode: form.modelCode.trim(),
      modelName: form.modelName.trim(),
      targetCycleTime: form.targetCycleTime ? parseFloat(form.targetCycleTime) : null,
      batchSize: form.batchSize ? parseInt(form.batchSize) : 1,
      description: form.description || null,
    });
  }

  const activeModels = models.filter((m) => m.isActive);
  const inactiveModels = models.filter((m) => !m.isActive);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        {/* 頁首 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6 text-primary" />
              產品型號管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              管理各產線的產品型號，設定型號代碼、目標節拍與批量大小
            </p>
          </div>
          <Button onClick={openCreate} disabled={!selectedLineId} className="gap-2">
            <Plus className="w-4 h-4" />新增型號
          </Button>
        </div>

        {/* 產線選擇 */}
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium whitespace-nowrap">選擇產線</Label>
          <Select
            value={selectedLineId?.toString() ?? ""}
            onValueChange={(v) => setSelectedLineId(parseInt(v))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="請選擇產線..." />
            </SelectTrigger>
            <SelectContent>
              {lines.map((l) => (
                <SelectItem key={l.id} value={l.id.toString()}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedLineId && (
            <Button variant="ghost" size="icon" onClick={() => refetchModels()} title="重新整理">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* 未選擇產線提示 */}
        {!selectedLineId && (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Package className="w-12 h-12 opacity-30" />
            <p className="text-sm">請先選擇產線以查看型號列表</p>
          </div>
        )}

        {/* 型號列表 */}
        {selectedLineId && (
          <div className="space-y-4">
            {/* 統計卡片 */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "總型號數", value: models.length, color: "text-foreground" },
                { label: "啟用中", value: activeModels.length, color: "text-emerald-500" },
                { label: "已停用", value: inactiveModels.length, color: "text-muted-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-3xl font-bold font-mono mt-1 ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* 表格 */}
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground text-sm">載入中...</div>
            ) : models.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 border border-dashed border-border rounded-xl">
                <Package className="w-10 h-10 opacity-30" />
                <p className="text-sm">此產線尚無型號，點擊「新增型號」開始建立</p>
                <Button variant="outline" size="sm" onClick={openCreate} className="gap-2">
                  <Plus className="w-4 h-4" />新增第一個型號
                </Button>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-32">型號代碼</TableHead>
                      <TableHead>型號名稱</TableHead>
                      <TableHead className="w-32 text-right">目標節拍（s）</TableHead>
                      <TableHead className="w-24 text-right">批量大小</TableHead>
                      <TableHead className="w-24 text-center">狀態</TableHead>
                      <TableHead className="w-28 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.map((model) => (
                      <TableRow key={model.id} className="group">
                        <TableCell className="font-mono font-semibold text-primary">
                          {model.modelCode}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{model.modelName}</p>
                            {model.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {model.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {model.targetCycleTime ? (
                            <span className="text-violet-400">{parseFloat(model.targetCycleTime).toFixed(1)}s</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {model.batchSize ?? 1}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={model.isActive ? "default" : "secondary"}>
                            {model.isActive ? "啟用" : "停用"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEdit(model as ProductModel)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(model as ProductModel)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {/* Dialog: 新增型號 */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-4 h-4" />新增產品型號
              </DialogTitle>
            </DialogHeader>
            <ModelForm form={form} setForm={setForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>取消</Button>
              <Button onClick={handleSubmitCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "建立中..." : "建立型號"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: 編輯型號 */}
        <Dialog open={!!editingModel} onOpenChange={(o) => !o && setEditingModel(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-4 h-4" />編輯型號
                {editingModel && (
                  <span className="text-muted-foreground font-normal text-sm">
                    <ChevronRight className="w-3.5 h-3.5 inline" />{editingModel.modelCode}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <ModelForm form={form} setForm={setForm} />
            {editingModel && (
              <div className="flex items-center gap-2 text-sm">
                <Label>狀態</Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() =>
                    updateMutation.mutate({ id: editingModel.id, isActive: editingModel.isActive ? 0 : 1 })
                  }
                >
                  {editingModel.isActive ? "停用此型號" : "重新啟用"}
                </Button>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingModel(null)}>取消</Button>
              <Button onClick={handleSubmitEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "儲存中..." : "儲存變更"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: 刪除確認 */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-4 h-4" />確認刪除
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              確定要刪除型號 <span className="font-semibold text-foreground">{deleteTarget?.modelCode}</span>（{deleteTarget?.modelName}）嗎？此操作無法復原。
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
              <Button
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate({ id: deleteTarget.id })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "刪除中..." : "確認刪除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// ─── 共用表單元件 ─────────────────────────────────────────────────────────────

function ModelForm({
  form,
  setForm,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>型號代碼 <span className="text-destructive">*</span></Label>
          <Input
            className="mt-1"
            placeholder="如：X3082-A"
            value={form.modelCode}
            onChange={(e) => setForm((f) => ({ ...f, modelCode: e.target.value }))}
          />
        </div>
        <div>
          <Label>型號名稱 <span className="text-destructive">*</span></Label>
          <Input
            className="mt-1"
            placeholder="如：主板組裝型"
            value={form.modelName}
            onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>目標節拍（秒）</Label>
          <Input
            className="mt-1"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="選填，覆蓋產線預設"
            value={form.targetCycleTime}
            onChange={(e) => setForm((f) => ({ ...f, targetCycleTime: e.target.value }))}
          />
        </div>
        <div>
          <Label>批量大小</Label>
          <Input
            className="mt-1"
            type="number"
            min="1"
            step="1"
            placeholder="預設 1"
            value={form.batchSize}
            onChange={(e) => setForm((f) => ({ ...f, batchSize: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <Label>說明</Label>
        <Textarea
          className="mt-1 resize-none"
          rows={2}
          placeholder="型號說明、換線注意事項等..."
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
    </div>
  );
}
