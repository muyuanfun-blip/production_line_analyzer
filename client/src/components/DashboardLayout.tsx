import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { Activity, BarChart3, ChevronRight, ClipboardCheck, Factory, GitBranch, Home, LogOut, Moon, PanelLeftClose, PanelLeftOpen, ScanSearch, Settings, ShieldCheck, Sun, Users } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { getSidebarGroups, shouldCloseNavigationAfterSelect } from "../../../shared/sidebarNavigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";

const navIcons = {
  "/": Home,
  "/data-completion-inbox": ClipboardCheck,
  "/lines": Factory,
  "/lines/1/vsm": GitBranch,
  "/admin/users": Users,
  "/admin/action-review-quality": ScanSearch,
  "/admin/ai-consensus-governance": BarChart3,
} as const;
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const SIDEBAR_PINNED_KEY = "sidebar-pinned";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  useEffect(() => { localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()); }, [sidebarWidth]);
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;
  return <SidebarProvider defaultOpen={false} style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}><DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent></SidebarProvider>;
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { state, setOpen, setOpenMobile, isMobile } = useSidebar();
  const { data: access } = trpc.auth.access.useQuery(undefined, { enabled: Boolean(user) });
  const [isPinned, setIsPinned] = useState(() => localStorage.getItem(SIDEBAR_PINNED_KEY) === "true");
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isCollapsed = state === "collapsed";
  const navGroups = getSidebarGroups(user?.role, access?.permissions ?? []);
  const allItems = navGroups.flatMap((group) => group.items);
  const activeItem = allItems.find((item) => location === item.path || (item.path !== "/" && location.startsWith(`${item.path}/`)));

  useEffect(() => { if (!isMobile) setOpen(isPinned); }, [isPinned, isMobile, setOpen]);
  useEffect(() => { localStorage.setItem(SIDEBAR_PINNED_KEY, String(isPinned)); }, [isPinned]);
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - left;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const onUp = () => setIsResizing(false);
    if (isResizing) { document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp); document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
  }, [isResizing, setSidebarWidth]);

  const navigate = (path: string) => { setLocation(path); if (shouldCloseNavigationAfterSelect(isMobile)) setOpenMobile(false); };
  const handleLogout = async () => { await logout(); setLocation("/login"); };
  const expandOnIntent = () => { if (!isMobile && !isPinned) setOpen(true); };
  const collapseOnLeave = () => { if (!isMobile && !isPinned) setOpen(false); };
  const collapseOnBlur = () => { if (isMobile || isPinned) return; window.setTimeout(() => { if (!sidebarRef.current?.contains(document.activeElement)) setOpen(false); }, 0); };
  const togglePin = () => { const next = !isPinned; setIsPinned(next); if (!isMobile) setOpen(next); };

  return <>
    <div ref={sidebarRef} className="relative" onMouseEnter={expandOnIntent} onMouseLeave={collapseOnLeave} onFocusCapture={expandOnIntent} onBlurCapture={collapseOnBlur}>
      <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
        <SidebarHeader className="h-[44px] justify-center border-b border-sidebar-border/60 px-0">
          <div className="sidebar-brand"><div className="sidebar-brand-icon shrink-0"><Activity className="h-3.5 w-3.5 text-white" /></div>{!isCollapsed && <div className="min-w-0 flex-1"><div className="sidebar-brand-text">PLA System</div><div className="sidebar-brand-version">v2.0 · Decision Center</div></div>}<button onClick={togglePin} className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus:outline-none" aria-label={isPinned ? "解除固定並收合側欄" : "固定並展開側欄"} title={isPinned ? "解除固定側欄" : "固定展開側欄"}>{isCollapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}</button></div>
        </SidebarHeader>
        <SidebarContent className="gap-0 overflow-x-hidden py-2">
          {navGroups.map((group) => <div key={group.key} className="mb-1">{!isCollapsed && <div className="nav-group-label flex items-center gap-1">{group.key === "governance" && <ShieldCheck className="h-2.5 w-2.5" />}{group.label}</div>}<SidebarMenu className="gap-0.5 px-1.5">{group.items.map((item) => { const Icon = navIcons[item.path as keyof typeof navIcons]; const isActive = location === item.path || (item.path !== "/" && location.startsWith(`${item.path}/`)); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => navigate(item.path)} tooltip={item.label} className={`h-8 rounded text-[0.8125rem] transition-all ${isActive ? "nav-item-active font-medium" : "font-normal text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}><Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/70"}`} /><span>{item.label}</span>{isActive && !isCollapsed && <ChevronRight className="ml-auto h-3 w-3 text-primary/50" />}</SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></div>)}
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/60 p-1.5"><DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/60 focus:outline-none group-data-[collapsible=icon]:justify-center"><Avatar className="h-6 w-6 shrink-0 border border-border/60"><AvatarFallback className="bg-primary/20 text-[0.5625rem] font-semibold text-primary">{user?.name?.charAt(0).toUpperCase()}</AvatarFallback></Avatar>{!isCollapsed && <><div className="min-w-0 flex-1"><p className="truncate text-[0.75rem] font-medium leading-none text-foreground">{user?.name || "—"}</p><p className="mt-0.5 truncate text-[0.625rem] text-muted-foreground">{user?.role === "admin" ? "管理員" : "一般使用者"}</p></div><Settings className="h-3 w-3 shrink-0 text-muted-foreground/40" /></>}</button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem onClick={toggleTheme} className="cursor-pointer"><span className="mr-2">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</span><span>切換為{theme === "dark" ? "淺色" : "深色"}主題</span></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" /><span>登出</span></DropdownMenuItem></DropdownMenuContent></DropdownMenu></SidebarFooter>
      </Sidebar>
      {!isCollapsed && isPinned && <div className="absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-primary/25" onMouseDown={() => setIsResizing(true)} />}
    </div>
    <SidebarInset><div className="topbar">{isMobile && <button onClick={() => setOpenMobile(true)} className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none" aria-label="開啟導覽選單"><PanelLeftOpen className="h-4 w-4" /></button>}<div className="flex items-center gap-1 text-[0.75rem]"><span className="font-mono text-muted-foreground/40">PLA</span><ChevronRight className="h-3 w-3 text-muted-foreground/25" /><span className="font-medium text-foreground/80">{activeItem?.label ?? "決策中心"}</span></div><div className="flex-1" /><SystemClock /><button onClick={toggleTheme} className="flex h-7 w-7 items-center justify-center rounded border border-border/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none" aria-label={theme === "dark" ? "切換為淺色主題" : "切換為深色主題"} title={theme === "dark" ? "切換為淺色主題" : "切換為深色主題"}>{theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}</button><div className="flex items-center gap-1.5 rounded border border-border/40 px-2 py-1 font-mono text-[0.625rem] text-muted-foreground"><span className="status-dot status-dot-ok" />系統正常</div></div><main className="flex-1 p-4 sm:p-5">{children}</main></SidebarInset>
  </>;
}

function SystemClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(timer); }, []);
  const pad = (value: number) => String(value).padStart(2, "0");
  return <div className="flex items-center gap-2 font-mono text-[0.625rem] text-muted-foreground"><span>{`${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`}</span><span className="font-medium text-foreground/70">{`${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`}</span></div>;
}
