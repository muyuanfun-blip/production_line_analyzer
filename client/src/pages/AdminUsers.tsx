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
import { Plus, KeyRound, UserCheck, UserX, ShieldCheck, User } from "lucide-react";

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
};

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

  const createMutation = trpc.admin.createUser.useMutation({
    onSuccess: () => {
      toast.success("帳號建立成功");
      utils.admin.listUsers.invalidate();
      setCreateOpen(false);
      setNewUsername(""); setNewPassword(""); setNewName(""); setNewRole("user");
    },
    onError: (e) => toast.error("建立失敗：" + e.message),
  });

  const resetMutation = trpc.admin.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("密碼重設成功");
      setResetOpen(false);
      setNewPwd("");
    },
    onError: (e) => toast.error("重設失敗：" + e.message),
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
            <p className="text-sm text-muted-foreground mt-1">管理系統使用者帳號與權限</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            新增帳號
          </Button>
        </div>

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
                    <TableHead>最後登入</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userList.map((u) => (
                    <TableRow key={u.id}>
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
                        <Badge variant={u.isActive ? "outline" : "destructive"}>
                          {u.isActive ? "啟用中" : "已停用"}
                        </Badge>
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
                          {u.id !== user.id && (
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
                          {u.id !== user.id && (
                            <Button
                              size="sm"
                              variant={u.isActive ? "destructive" : "outline"}
                              onClick={() => toggleMutation.mutate({
                                userId: u.id,
                                isActive: !u.isActive,
                              })}
                            >
                              {u.isActive ? (
                                <><UserX className="w-3 h-3 mr-1" />停用</>
                              ) : (
                                <><UserCheck className="w-3 h-3 mr-1" />啟用</>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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
                placeholder="英文字母或數字，至少 2 字元"
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
              <Label>初始密碼</Label>
              <Input
                type="password"
                placeholder="至少 6 個字元"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
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
              disabled={createMutation.isPending}
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
              <Label>新密碼</Label>
              <Input
                type="password"
                placeholder="至少 6 個字元"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>取消</Button>
            <Button
              onClick={() => resetTarget && resetMutation.mutate({
                userId: resetTarget.id,
                newPassword: newPwd,
              })}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? "重設中..." : "確認重設"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
