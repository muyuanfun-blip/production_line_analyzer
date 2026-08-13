import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Plus, KeyRound, UserCheck, UserX, ShieldCheck, User, Trash2 } from "lucide-react";
import { getLocalPasswordPolicyIssues } from "../../../shared/accountSecurity";

type UserRow = {
  id: number;
  openId: string;
  username: string | null;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  isActive: number;
  createdAt: Date;
  lastSignedIn: Date;
  businessRecordSummary: {
    total: number;
    records: Array<{ key: string; label: string; count: number }>;
  };
};

function passwordValidationMessage(password: string) {
  const issues = getLocalPasswordPolicyIssues(password);
  return issues.length === 0 ? "密碼符合安全規則" : `尚需符合：${issues.join("、")}`;
}

function friendlyPasswordError(message: string) {
  return message.includes("newPassword") || message.includes("密碼至少") || message.includes("密碼需包含")
    ? "密碼不符合安全規則：至少 12 個字元，且需包含英文大小寫與數字。"
    : message;
}

export default function AdminUsers() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: userList = [], isLoading } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const newPasswordIssues = getLocalPasswordPolicyIssues(newPassword);
  const resetPasswordIssues = getLocalPasswordPolicyIssues(newPwd);

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("帳號建立成功");
      utils.admin.listUsers.invalidate();
      setCreateOpen(false);
      setNewUsername(""); setNewPassword(""); setNewName(""); setNewRole("user");
    },
    onError: (e) => toast.error("建立失敗：" + friendlyPasswordError(e.message)),
  });

  const resetMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("密碼重設成功");
      setResetOpen(false);
      setNewPwd("");
    },
    onError: (e) => toast.error("重設失敗：" + friendlyPasswordError(e.message)),
  });

  const toggleMutation = trpc.admin.toggleActive.useMutation({
    onSuccess: (_, vars) => {
      toast.success(vars.isActive ? "帳號已啟用" : "帳號已停用");
      utils.admin.listUsers.invalidate();
    },
    onError: (e) => toast.error("操作失敗：" + e.message),
  });

  const roleMutation = trpc.admin.updateRole.useMutation({
    onSuccess: () => {
      toast.success("角色已更新");
      utils.admin.listUsers.invalidate();
    },
    onError: (e) => toast.error("更新失敗：" + e.message),
  });

  const deleteMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("帳號已永久刪除");
      utils.admin.listUsers.invalidate();
      setDeleteTarget(null);
    },
    onError: (e) => toast.error("無法刪除帳號：" + e.message),
  });

  const activeAdminCount = userList.filter((account) => account.role === "admin" && account.isActive).length;

  if (user?.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          您沒有管理員權限
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">帳號管理</h1>
            <p className="text-sm text-muted-foreground mt-1">管理本機帳密、角色、帳號狀態與受保護操作</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新增帳號
          </Button>
        </div>

        <Card className="status-info border">
          <CardContent className="status-detail p-4 text-sm">
            <span className="font-medium">帳號安全控制：</span>本機密碼需至少 12 字元並包含英文大小寫與數字。重設密碼、停用帳號或調整角色會立即撤銷該帳號既有登入狀態；系統也會防止停用或降級最後一位有效管理員。
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">使用者列表（共 {userList.length} 個帳號）</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>帳號</TableHead>
                    <TableHead>顯示名稱</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>刪除資格</TableHead>
                    <TableHead>最後登入</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userList.map((u) => {
                    const isSelf = u.id === user.id;
                    const isLastActiveAdmin = u.role === "admin" && Boolean(u.isActive) && activeAdminCount <= 1;
                    const deletionBlocked = isSelf || isLastActiveAdmin || u.businessRecordSummary.total > 0;
                    const deletionReason = isSelf
                      ? "目前登入帳號不可刪除"
                      : isLastActiveAdmin
                        ? "最後一位有效管理員不可刪除"
                        : u.businessRecordSummary.total > 0
                          ? `已有 ${u.businessRecordSummary.total} 筆業務紀錄：${u.businessRecordSummary.records.map((record) => record.label).join("、")}`
                          : "無業務紀錄，可永久刪除";
                    return <TableRow key={u.id}>
                      <TableCell className="font-mono text-sm">
                        {u.username ?? <span className="text-muted-foreground italic">（外部登入帳號）</span>}
                      </TableCell>
                      <TableCell>{u.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role === "admin" ? (
                            <><ShieldCheck className="w-3 h-3 mr-1" />管理員</>
                          ) : (
                            <><User className="w-3 h-3 mr-1" />一般使用者</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border ${u.isActive ? "status-success" : "status-risk"}`} variant="outline">
                          {u.isActive ? "啟用中" : "已停用"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={deletionBlocked ? "text-xs text-muted-foreground" : "status-text-success text-xs font-medium"}>
                          {deletionReason}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.lastSignedIn).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* 重設密碼（僅本地帳號） */}
                          {u.username && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setResetTarget(u as UserRow); setResetOpen(true); }}
                            >
                              <KeyRound className="w-3 h-3 mr-1" />
                              重設密碼
                            </Button>
                          )}
                          {/* 切換角色 */}
                          {!isSelf && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => roleMutation.mutate({
                                userId: u.id,
                                role: u.role === "admin" ? "user" : "admin",
                              })}
                            >
                              {u.role === "admin" ? "降為一般" : "升為管理員"}
                            </Button>
                          )}
                          {/* 啟用/停用 */}
                          {!isSelf && (
                            <Button
                              size="sm"
                              variant={u.isActive ? "destructive" : "outline"}
                              onClick={() => {
                                const action = u.isActive ? "停用" : "啟用";
                                if (window.confirm(`確定要${action}「${u.name ?? u.username}」嗎？${u.isActive ? "此操作會立即撤銷該帳號既有登入狀態。" : ""}`)) {
                                  toggleMutation.mutate({ userId: u.id, isActive: !u.isActive });
                                }
                              }}
                            >
                              {u.isActive ? (
                                <><UserX className="w-3 h-3 mr-1" />停用</>
                              ) : (
                                <><UserCheck className="w-3 h-3 mr-1" />啟用</>
                              )}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={deletionBlocked}
                            title={deletionBlocked ? `${deletionReason}，請改用停用帳號。` : "永久刪除且不可復原"}
                            onClick={() => setDeleteTarget(u as UserRow)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" />刪除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 新增帳號 Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增使用者帳號</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>帳號名稱</Label>
              <Input
                placeholder="英數字、點、底線或連字號，至少 2 字元"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>顯示名稱</Label>
              <Input
                placeholder="使用者的中文姓名"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>初始密碼（至少 12 字元，含英文大小寫與數字）</Label>
              <Input
                type="password"
                placeholder="例如 SecurePass2026"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={12}
                aria-invalid={newPassword.length > 0 && newPasswordIssues.length > 0}
              />
              <p className={newPassword.length === 0 || newPasswordIssues.length > 0 ? "text-xs text-muted-foreground" : "status-text-success text-xs"}>{newPassword.length === 0 ? "至少 12 個字元，含英文大小寫與數字" : passwordValidationMessage(newPassword)}</p>
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "user" | "admin")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">一般使用者</SelectItem>
                  <SelectItem value="admin">管理員</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button
              onClick={() => createMutation.mutate({
                username: newUsername,
                password: newPassword,
                name: newName,
                role: newRole,
              })}
              disabled={createMutation.isPending || newPasswordIssues.length > 0 || !newUsername.trim() || !newName.trim()}
            >
              {createMutation.isPending ? "建立中..." : "建立帳號"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重設密碼 Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重設密碼 — {resetTarget?.name ?? resetTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>新密碼（至少 12 字元，含英文大小寫與數字）</Label>
              <Input
                type="password"
                placeholder="重設後會撤銷該帳號既有登入狀態"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                minLength={12}
                aria-invalid={newPwd.length > 0 && resetPasswordIssues.length > 0}
              />
              <p className={newPwd.length === 0 || resetPasswordIssues.length > 0 ? "text-xs text-muted-foreground" : "status-text-success text-xs"}>{newPwd.length === 0 ? "至少 12 個字元，含英文大小寫與數字" : passwordValidationMessage(newPwd)}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>取消</Button>
            <Button
              onClick={() => resetTarget && resetMutation.mutate({
                userId: resetTarget.id,
                newPassword: newPwd,
              })}
              disabled={resetMutation.isPending || resetPasswordIssues.length > 0 || newPwd.length === 0}
            >
              {resetMutation.isPending ? "重設中..." : "確認重設"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>永久刪除帳號</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>您即將永久刪除「<span className="font-semibold">{deleteTarget?.name ?? deleteTarget?.username}</span>」。此操作不可復原。</p>
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">系統已確認此帳號沒有可追溯的業務紀錄。若帳號已有建立、覆核、裁決、指派或處理資料，請改用「停用」以保留歷程。</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={() => deleteTarget && deleteMutation.mutate({ userId: deleteTarget.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "刪除中..." : "確認永久刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
