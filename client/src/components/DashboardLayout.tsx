import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BookOpen,
  Factory,
  Home,
  LogOut,
  PencilLine,
  ShieldCheck,
  Users,
  FlaskConical,
  Package,
  ScanBarcode,
  GanttChartSquare,
  ChevronRight,
  Activity,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  GitBranch,
  BarChart3,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

// ── Navigation structure ───────────────────────────────────────────────────
const navGroups = [
  {
    label: "分析工具",
    items: [
      { icon: Home,             label: "首頁總覽",   path: "/" },
      { icon: Factory,          label: "生產線管理", path: "/lines" },
    ],
  },
  {
    label: "資料管理",
    items: [
      { icon: GitBranch,   label: "VSM 設計", path: "/lines/1/vsm" },
      { icon: BarChart3,   label: "戰情監控", path: "/lines/1/monitoring" },
    ],
  },
];

const adminNavItems: typeof navGroups[0]["items"] = [];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 360;

// ── Root component ─────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

// ── Inner layout ───────────────────────────────────────────────────────────
function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const allItems = navGroups.flatMap(g => g.items);
  const activeItem = allItems.find(i => i.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const w = e.clientX - left;
      if (w >= MIN_WIDTH && w <= MAX_WIDTH) setSidebarWidth(w);
    };
    const onUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  return (
    <>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>

          {/* Brand header */}
          <SidebarHeader className="h-[44px] border-b border-sidebar-border/60 px-0 justify-center">
            <div className="sidebar-brand">
              <div className="sidebar-brand-icon shrink-0">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="sidebar-brand-text">PLA System</div>
                  <div className="sidebar-brand-version">v2.0 · Production</div>
                </div>
              )}
              <button
                onClick={toggleSidebar}
                className="ml-auto h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors shrink-0 focus:outline-none"
                aria-label="Toggle sidebar"
              >
                {isCollapsed
                  ? <PanelLeftOpen className="h-3.5 w-3.5" />
                  : <PanelLeftClose className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </SidebarHeader>

          {/* Navigation groups */}
          <SidebarContent className="gap-0 py-2 overflow-x-hidden">
            {navGroups.map((group) => (
              <div key={group.label} className="mb-1">
                {!isCollapsed && (
                  <div className="nav-group-label">{group.label}</div>
                )}
                <SidebarMenu className="px-1.5 gap-0.5">
                  {group.items.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={[
                            "h-8 text-[0.8125rem] rounded transition-all",
                            isActive
                              ? "nav-item-active font-medium"
                              : "font-normal text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                          ].join(" ")}
                        >
                          <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/70"}`} />
                          <span>{item.label}</span>
                          {isActive && !isCollapsed && (
                            <ChevronRight className="ml-auto h-3 w-3 text-primary/50" />
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            ))}

            {/* Admin section */}
            {user?.role === "admin" && (
              <div className="mt-1">
                {!isCollapsed && (
                  <div className="nav-group-label flex items-center gap-1">
                    <ShieldCheck className="h-2.5 w-2.5" />管理員
                  </div>
                )}
                <SidebarMenu className="px-1.5 gap-0.5">
                  {adminNavItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={[
                            "h-8 text-[0.8125rem] rounded transition-all",
                            isActive
                              ? "nav-item-active font-medium"
                              : "font-normal text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                          ].join(" ")}
                        >
                          <item.icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/70"}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </div>
            )}
          </SidebarContent>

          {/* Footer: user profile */}
          <SidebarFooter className="border-t border-sidebar-border/60 p-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-sidebar-accent/60 transition-colors w-full text-left focus:outline-none group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-6 w-6 border border-border/60 shrink-0">
                    <AvatarFallback className="text-[0.5625rem] font-semibold bg-primary/20 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.75rem] font-medium truncate leading-none text-foreground">
                          {user?.name || "—"}
                        </p>
                        <p className="text-[0.625rem] text-muted-foreground truncate mt-0.5">
                          {user?.role === "admin" ? "管理員" : "一般使用者"}
                        </p>
                      </div>
                      <Settings className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>登出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/25 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            style={{ zIndex: 50 }}
          />
        )}
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <SidebarInset>
        {/* Topbar – always visible */}
        <div className="topbar">
          {isMobile && (
            <button
              onClick={toggleSidebar}
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-[0.75rem]">
            <span className="text-muted-foreground/40 font-mono">PLA</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/25" />
            <span className="text-foreground/80 font-medium">
              {activeItem?.label ?? "儀表板"}
            </span>
          </div>

          <div className="flex-1" />

          {/* System clock */}
          <SystemClock />

          {/* System status pill */}
          <div className="flex items-center gap-1.5 text-[0.625rem] text-muted-foreground border border-border/40 rounded px-2 py-1 font-mono">
            <span className="status-dot status-dot-ok" />
            系統正常
          </div>
        </div>

        <main className="flex-1 p-5">{children}</main>
      </SidebarInset>
    </>
  );
}

// ── System clock ───────────────────────────────────────────────────────────
function SystemClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
  const dateStr = `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
  return (
    <div className="flex items-center gap-2 text-[0.625rem] text-muted-foreground font-mono">
      <span>{dateStr}</span>
      <span className="text-foreground/70 font-medium">{timeStr}</span>
    </div>
  );
}
