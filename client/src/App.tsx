import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import ProductionLines from "./pages/ProductionLines";
import WorkstationManager from "./pages/WorkstationManager";
import BalanceAnalysis from "./pages/BalanceAnalysis";
import ActionAnalysis from "./pages/ActionAnalysis";
import AISuggestions from "./pages/AISuggestions";
import SnapshotHistory from "./pages/SnapshotHistory";
import SnapshotCompare from "./pages/SnapshotCompare";
import UserGuide from "./pages/UserGuide";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import DataRefinement from "./pages/DataRefinement";
import SimulationPage from "./pages/SimulationPage";
import FloorPlanSimulator from "./pages/FloorPlanSimulator";
import ProductModels from "./pages/ProductModels";
import ProductTracking from "./pages/ProductTracking";
import GanttPage from "./pages/GanttPage";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user && location !== "/login") {
      navigate("/login");
    }
  }, [user, isLoading, location, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">載入中...</div>
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/floor-simulator">
        <AuthGuard>
          <FloorPlanSimulator />
        </AuthGuard>
      </Route>
      <Route>
        <AuthGuard>
          <DashboardLayout>
            <Switch>
              <Route path={"/"} component={Home} />
              <Route path={"/lines"} component={ProductionLines} />
              <Route path={"/lines/:id/workstations"} component={WorkstationManager} />
              <Route path={"/lines/:id/balance"} component={BalanceAnalysis} />
              <Route path={"/lines/:id/actions"} component={ActionAnalysis} />
              <Route path={"/lines/:id/ai"} component={AISuggestions} />
              <Route path={"/lines/:id/snapshots/compare"} component={SnapshotCompare} />
              <Route path={"/lines/:id/snapshots"} component={SnapshotHistory} />
              <Route path={"/guide"} component={UserGuide} />
              <Route path={"/admin/users"} component={AdminUsers} />
              <Route path={"/data-refinement"} component={DataRefinement} />
              <Route path={"/simulator"} component={SimulationPage} />
              <Route path={"/product-models"} component={ProductModels} />
              <Route path={"/product-tracking"} component={ProductTracking} />
              <Route path={"/gantt"} component={GanttPage} />
              <Route path={"/404"} component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </DashboardLayout>
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
