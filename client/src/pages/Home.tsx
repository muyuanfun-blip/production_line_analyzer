import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Activity, BarChart3, Brain, Factory, TrendingUp, Zap, ArrowRight, Clock, Users, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: lines } = trpc.productionLine.list.useQuery();

  const totalLines = lines?.length ?? 0;
  const activeLines = lines?.filter(l => l.status === "active").length ?? 0;

  const features = [
    {
      icon: Factory,
      title: "工站資料管理",
      description: "新增、編輯、刪除工站資料，支援批量匯入 Excel/CSV",
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      border: "border-cyan-400/20",
    },
    {
      icon: BarChart3,
      title: "產線平衡分析",
      description: "計算平衡率、識別瓶頸工站，視覺化呈現時間分佈",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
    {
      icon: Activity,
      title: "動作分析記錄",
      description: "詳細記錄每個工站的操作步驟與時間分配",
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/20",
    },
    {
      icon: Brain,
      title: "AI 優化建議",
      description: "智能分析產線數據，自動生成平衡優化與改善方案",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
  ];

  return (
    <div className="min-h-full p-6 space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-accent/20 p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              生產效率優化平台
            </span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            <span className="gradient-text">產線平衡分析系統</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed">
            整合工站時間統計、產線平衡分析、動作分析與 AI 優化建議，
            幫助您精確識別瓶頸、提升生產效率、實現精實生產目標。
          </p>
          <div className="flex items-center gap-4 mt-6">
            <Button
              size="lg"
              className="glow-primary"
              onClick={() => setLocation("/lines")}
            >
              開始分析
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{activeLines} 條產線運行中</span>
              </div>
              <div className="flex items-center gap-2">
                <Factory className="h-4 w-4" />
                <span>共 {totalLines} 條產線</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Factory, label: "生產線總數", value: totalLines, color: "text-cyan-400", sub: "條產線" },
          { icon: TrendingUp, label: "運行中", value: activeLines, color: "text-emerald-400", sub: "條產線" },
          { icon: Clock, label: "分析功能", value: 4, color: "text-violet-400", sub: "項核心功能" },
          { icon: Target, label: "優化目標", value: "AI", color: "text-amber-400", sub: "智能建議" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border bg-card hover:border-primary/30 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${stat.color} bg-current/10`}
                  style={{ background: `color-mix(in oklch, currentColor 10%, transparent)` }}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feature Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4 text-foreground">核心功能</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className={`border bg-card hover:bg-accent/30 transition-all cursor-pointer group ${feature.border}`}
              onClick={() => setLocation("/lines")}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`h-12 w-12 rounded-xl ${feature.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Start */}
      {totalLines === 0 && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-8 text-center">
            <Factory className="h-12 w-12 text-primary/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">開始您的第一條產線分析</h3>
            <p className="text-muted-foreground mb-4 text-sm">建立生產線，新增工站資料，即可開始分析產線平衡與效率</p>
            <Button onClick={() => setLocation("/lines")}>
              建立生產線
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
