import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpen,
  ChevronRight,
  CheckCircle2,
  Calculator,
  BarChart3,
  Camera,
  GitCompare,
  Lightbulb,
  Info,
  TrendingUp,
  Users,
  Clock,
  Target,
  Zap,
  ArrowRight,
  Play,
  Star,
  HelpCircle,
  AlertTriangle,
  Wrench,
} from "lucide-react";;
import { Link, useLocation } from "wouter";

interface Step {
  title: string;
  desc: string;
  tip?: string;
}

interface FormulaItem {
  name: string;
  formula: string;
  example: string;
  meaning: string;
  color: string;
}

interface FaqItem {
  q: string;
  a: string;
  category: "balance" | "upph" | "takt" | "general";
  icon: React.ReactNode;
}

const faqItems: FaqItem[] = [
  {
    category: "balance",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    q: "為何平衡率會低於 70%？",
    a: "平衡率低於 70% 通常代表工站間的工作量分配嚴重不均。常見原因包括：①瓶頸工站（最長週期時間）與最短工站的時間差距過大；②工站合併或拆分設計不合理，導致某些工站長時間等待；③作業員技能差異造成實際週期時間偏離標準。建議先找出瓶頸工站，透過動作分析拆解其作業步驟，將部分動作移轉至輕負荷工站，以縮小工站間的時間差距。",
  },
  {
    category: "balance",
    icon: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    q: "平衡率計算時，為何結果與預期不同？",
    a: "平衡率 = (所有工站週期時間總和) ÷ (工站數 × 最長週期時間) × 100%。若結果偏低，請確認：①所有工站的週期時間是否已正確輸入（包含等待時間）；②是否有工站的週期時間異常偏高（可能是量測誤差）；③工站數量是否正確（包含輔助工站）。建議在平衡分析頁的工站表格中逐一核對每個工站的時間數值。",
  },
  {
    category: "upph",
    icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,
    q: "如何有效提升 UPPH？",
    a: "UPPH（每人每小時產出）= 3600 ÷ 瓶頸週期時間 ÷ 總人數。提升 UPPH 有兩個主要方向：①縮短瓶頸工站的週期時間——透過動作分析找出非增值動作（等待、搬運、重工），消除或縮短這些動作；②優化人力配置——在不影響品質的前提下，合理減少人員或將人員調配至更需要的工站。建議先使用 AI 建議功能，系統會自動識別最具改善潛力的工站。",
  },
  {
    category: "upph",
    icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,
    q: "UPPH 與平衡率的關係是什麼？",
    a: "UPPH 反映的是整條產線的人力效率，而平衡率反映的是工站間負荷的均衡程度。兩者相輔相成：高平衡率（工站負荷均衡）通常有助於提升 UPPH，因為減少了等待浪費；但即使平衡率高，若瓶頸工站的絕對時間過長，UPPH 仍會偏低。IE 工程師應同時追蹤兩個指標：先提升平衡率（消除不均衡），再縮短瓶頸時間（提升整體效率）。",
  },
  {
    category: "takt",
    icon: <Clock className="w-4 h-4 text-blue-400" />,
    q: "Takt Time 達標率低於 100% 代表什麼？",
    a: "Takt Time 達標率 = 週期時間 ≤ Takt Time 的工站數 ÷ 總工站數 × 100%。達標率低於 100% 代表有工站的週期時間超過客戶需求節拍，意味著這些工站在正常生產速度下無法滿足出貨需求，將導致生產延誤。超標工站（紅色標示）是最優先的改善對象，必須在下一次改善活動中優先處理。",
  },
  {
    category: "takt",
    icon: <Clock className="w-4 h-4 text-blue-400" />,
    q: "如何設定合理的目標節拍時間（Takt Time）？",
    a: "Takt Time = 每班可用時間（秒）÷ 每班需求數量。例如：每班 480 分鐘（扣除休息後實際可用 450 分鐘），每班需求 150 件，則 Takt Time = 450 × 60 ÷ 150 = 180 秒。在產線管理頁的目標節拍時間欄位旁，有內建計算輔助工具，輸入可用時間與需求數量即可自動計算並帶入。建議每季依訂單量重新檢視 Takt Time 設定。",
  },
  {
    category: "general",
    icon: <Camera className="w-4 h-4 text-green-400" />,
    q: "何時應該儲存快照？",
    a: "快照是記錄產線某一時間點狀態的重要工具。建議在以下時機儲存：①改善活動開始前（記錄基準值）；②每次重大改善完成後（記錄改善成果）；③定期（如每週或每月）定期記錄，建立趨勢資料。儲存快照時，系統會自動計算並儲存平衡率、UPPH、瓶頸時間等 KPI，方便後續在快照比較頁追蹤改善幅度。",
  },
  {
    category: "general",
    icon: <Wrench className="w-4 h-4 text-purple-400" />,
    q: "AI 建議功能的分析結果準確嗎？",
    a: "AI 建議功能基於您輸入的工站時間與動作資料進行分析，準確性取決於資料的完整性與正確性。建議在使用 AI 建議前，確保：①所有工站的週期時間已正確輸入；②動作分析頁的各工站步驟已完整填寫（特別是增值/非增值的分類）；③產線的 Takt Time 已正確設定。AI 建議提供的是方向性參考，實際改善方案仍需 IE 工程師結合現場實際情況判斷。",
  },
];

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  badge: string;
  steps?: Step[];
  formulas?: FormulaItem[];
  features?: { icon: React.ReactNode; title: string; desc: string; link?: string }[];
  isFaq?: boolean;
}

const faqCategories = [
  { key: "balance", label: "平衡率相關", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { key: "upph", label: "UPPH 相關", color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
  { key: "takt", label: "Takt Time 相關", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  { key: "general", label: "一般操作", color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
] as const;

const sections: Section[] = [
  {
    id: "overview",
    icon: <BookOpen className="w-5 h-5" />,
    title: "系統概覽",
    subtitle: "了解產線平衡分析系統的核心功能與操作流程",
    color: "from-cyan-500/20 to-cyan-600/5",
    badge: "入門必讀",
    features: [
      {
        icon: <BarChart3 className="w-5 h-5 text-cyan-400" />,
        title: "產線平衡分析",
        desc: "輸入各工站週期時間，系統自動計算平衡率、瓶頸工站、UPPH 等 IE 核心指標",
        link: "/lines",
      },
      {
        icon: <Camera className="w-5 h-5 text-purple-400" />,
        title: "歷史快照比較",
        desc: "儲存每次改善前後的分析結果，透過快照比較量化 IE 活動成效",
        link: "/lines",
      },
      {
        icon: <Zap className="w-5 h-5 text-yellow-400" />,
        title: "動作拆解分析",
        desc: "將工站作業拆解為增值 / 非增值 / 必要非增值動作，精準找出改善機會",
        link: "/lines",
      },
      {
        icon: <Lightbulb className="w-5 h-5 text-green-400" />,
        title: "AI 優化建議",
        desc: "根據平衡分析結果，AI 自動生成工站重組、人員調配的具體改善建議",
        link: "/lines",
      },
    ],
  },
  {
    id: "setup",
    icon: <Target className="w-5 h-5" />,
    title: "建立產線與工站",
    subtitle: "第一步：設定產線基本資料與 Takt Time",
    color: "from-blue-500/20 to-blue-600/5",
    badge: "步驟 1",
    steps: [
      {
        title: "前往「生產線管理」",
        desc: "點擊左側側邊欄的「生產線管理」，進入產線列表頁面。",
        tip: "首次使用時，頁面會顯示空白狀態，點擊「新增產線」按鈕開始。",
      },
      {
        title: "填寫產線基本資料",
        desc: "輸入產線名稱、描述，以及最重要的「目標節拍時間（Takt Time）」。",
        tip: "不知道 Takt Time 怎麼算？點擊輸入框右側的計算機圖示，輸入「可用時間（分鐘）」與「需求數量」，系統會自動計算並帶入。",
      },
      {
        title: "進入工站管理",
        desc: "產線建立後，點擊卡片上的「工站管理」按鈕，進入該產線的工站列表。",
      },
      {
        title: "新增工站資料",
        desc: "為每個工站輸入：工站名稱、週期時間（秒）、人員數量。可逐筆新增，也可使用「批量匯入」上傳 Excel/CSV 檔案。",
        tip: "週期時間建議使用碼錶實測的平均值，人員數量填寫該工站實際配置人數。",
      },
    ],
  },
  {
    id: "balance",
    icon: <BarChart3 className="w-5 h-5" />,
    title: "執行平衡分析",
    subtitle: "第二步：查看 KPI 指標並識別瓶頸工站",
    color: "from-emerald-500/20 to-emerald-600/5",
    badge: "步驟 2",
    steps: [
      {
        title: "進入「平衡分析」頁面",
        desc: "在工站管理頁面，點擊右上角「平衡分析」按鈕，系統立即計算所有 KPI 指標。",
      },
      {
        title: "解讀 KPI 卡片",
        desc: "頁面頂部顯示 5 個核心指標：平衡率、瓶頸時間、Takt 達標率、總人數、UPPH。將滑鼠懸停在任意數字上，可查看詳細的計算公式與說明。",
        tip: "平衡率 ≥ 90% 為優秀，80-90% 為良好，70-80% 為待改善，< 70% 需立即優化。",
      },
      {
        title: "查看工站時間分佈圖",
        desc: "柱狀圖中，紫色虛線為 Takt Time 參考線。超過虛線的工站（橘色/紅色）為瓶頸工站，是改善的優先目標。",
      },
      {
        title: "查看工站詳細表格",
        desc: "表格下方列出每個工站的週期時間、人員、vs Takt Time 差距、人均產能（工站級 UPPH）。",
        tip: "「人均產能」欄位顯示該工站每人每小時可產出的件數，數值越高代表效率越好。",
      },
    ],
  },
  {
    id: "upph",
    icon: <TrendingUp className="w-5 h-5" />,
    title: "UPPH 績效指標",
    subtitle: "凸顯 IE 工程師改善成效的核心量化指標",
    color: "from-amber-500/20 to-amber-600/5",
    badge: "IE 核心",
    formulas: [
      {
        name: "UPPH（整線）",
        formula: "UPPH = 3600 ÷ 瓶頸工站週期時間（秒）÷ 總人數",
        example: "瓶頸時間 120 秒，總人數 10 人 → UPPH = 3600 ÷ 120 ÷ 10 = 3.0 件/人/時",
        meaning: "每位作業員每小時可產出的件數，數值越高代表人力效率越好",
        color: "text-amber-400",
      },
      {
        name: "平衡率",
        formula: "平衡率 = Σ(各工站 CT × 人數) ÷ (瓶頸 CT × 總人數) × 100%",
        example: "各站合計 900 秒人，瓶頸 120 秒 × 10 人 = 1200 → 平衡率 = 75%",
        meaning: "衡量產線人力利用效率，100% 為完美平衡，實際目標 ≥ 85%",
        color: "text-cyan-400",
      },
      {
        name: "平衡損失率",
        formula: "平衡損失率 = 1 − 平衡率",
        example: "平衡率 75% → 平衡損失率 = 25%（25% 的人力時間被浪費）",
        meaning: "代表因工站不平衡造成的人力浪費比例，IE 改善目標是降低此值",
        color: "text-red-400",
      },
      {
        name: "Takt Time 達標率",
        formula: "達標率 = 未超過 Takt Time 的工站數 ÷ 總工站數 × 100%",
        example: "10 個工站中 8 個未超標 → 達標率 = 80%",
        meaning: "100% 代表所有工站都能在節拍時間內完成，是準時交貨的基本條件",
        color: "text-purple-400",
      },
      {
        name: "增值率",
        formula: "增值率 = 增值動作時間 ÷ 工站總時間 × 100%",
        example: "增值 60 秒，總時間 100 秒 → 增值率 = 60%",
        meaning: "衡量作業中真正創造價值的比例，目標是提高此值（減少非增值動作）",
        color: "text-green-400",
      },
      {
        name: "工站人均產能",
        formula: "工站 UPPH = 3600 ÷ 工站週期時間（秒）÷ 工站人數",
        example: "工站 CT 90 秒，2 人 → 工站 UPPH = 3600 ÷ 90 ÷ 2 = 20 件/人/時",
        meaning: "該工站每位作業員每小時的產出能力，用於跨工站效率比較",
        color: "text-amber-400",
      },
    ],
  },
  {
    id: "snapshot",
    icon: <Camera className="w-5 h-5" />,
    title: "快照與歷史比較",
    subtitle: "第三步：儲存改善前後的分析結果，量化 IE 成效",
    color: "from-purple-500/20 to-purple-600/5",
    badge: "步驟 3",
    steps: [
      {
        title: "儲存改善前快照",
        desc: "在平衡分析頁面，點擊右上角「儲存快照」按鈕，輸入快照名稱（如「改善前-2024Q1」），系統會記錄當前所有 KPI 指標與工站資料。",
        tip: "建議在每次 IE 改善活動前後各儲存一次快照，方便後續比較。",
      },
      {
        title: "執行改善並儲存改善後快照",
        desc: "完成工站重組、人員調配等改善後，更新工站資料，再次儲存快照（如「改善後-2024Q1」）。",
      },
      {
        title: "查看快照歷史",
        desc: "前往「快照歷史」頁面，可看到所有已儲存的快照列表，每張卡片顯示平衡率、UPPH、瓶頸時間等關鍵指標。",
      },
      {
        title: "執行快照比較",
        desc: "在快照歷史頁面勾選兩個快照，點擊「比較」按鈕，進入比較頁面查看：KPI 前後對比、工站時間對比圖、增值率比較、UPPH 改善幅度。",
        tip: "UPPH 提升代表人力效率改善，平衡率提升代表產線更均衡，兩者都是 IE 績效的直接證明。",
      },
    ],
  },
  {
    id: "action",
    icon: <Zap className="w-5 h-5" />,
    title: "動作拆解與 AI 建議",
    subtitle: "第四步：深入分析作業動作，獲取 AI 改善建議",
    color: "from-rose-500/20 to-rose-600/5",
    badge: "進階功能",
    steps: [
      {
        title: "進入動作分析頁面",
        desc: "在工站管理頁面，點擊工站右側的「動作分析」按鈕（或從平衡分析頁工站表格的連結進入）。",
      },
      {
        title: "拆解工站動作",
        desc: "為每個動作輸入：動作名稱、類型（增值 / 非增值 / 必要非增值）、時間（秒）。系統即時顯示各類型佔比圓餅圖。",
        tip: "增值動作：直接改變產品形狀/性質的動作。非增值：搬運、等待、尋找等浪費。必要非增值：換料、點檢等必要但不增值的動作。",
      },
      {
        title: "同步至工站 CT",
        desc: "動作拆解完成後，若合計秒數與工站設定的 CT 不同，可點擊「同步至工站 CT」按鈕，自動更新工站時間，確保平衡分析數據準確。",
      },
      {
        title: "獲取 AI 改善建議",
        desc: "前往「AI 優化建議」頁面，點擊「開始 AI 分析」，系統會根據平衡率、UPPH、增值率等數據，生成具體的工站重組與人員調配建議。",
        tip: "AI 建議僅供參考，實際改善方案需結合現場實際情況評估可行性。",
      },
    ],
  },
  {
    id: "faq",
    icon: <HelpCircle className="w-5 h-5" />,
    title: "常見問題 FAQ",
    subtitle: "新進工程師最常遇到的問題與解答，快速解決疑惑",
    color: "from-violet-500/10 to-purple-500/5",
    badge: "FAQ",
    isFaq: true,
  },
];

export default function UserGuide() {
  const [activeSection, setActiveSection] = useState("overview");
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});
  const [, navigate] = useLocation();

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentSection = sections.find((s) => s.id === activeSection)!;

  return (
    <div className="flex gap-0 min-h-screen">
      {/* 側邊章節導覽 */}
      <aside className="w-64 shrink-0 border-r border-border/40 bg-card/30 sticky top-0 h-screen overflow-y-auto p-4">
        <div className="flex items-center gap-2 mb-6 px-2">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <span className="font-semibold text-sm text-foreground">使用指南</span>
        </div>
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm ${
                activeSection === section.id
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className={activeSection === section.id ? "text-cyan-400" : "text-muted-foreground"}>
                {section.icon}
              </span>
              <div className="min-w-0">
                <div className="font-medium truncate">{section.title}</div>
                <div className="text-xs text-muted-foreground truncate">{section.badge}</div>
              </div>
              {activeSection === section.id && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
            </button>
          ))}
        </nav>

        {/* 快速連結 */}
        <div className="mt-8 pt-6 border-t border-border/40">
          <p className="text-xs text-muted-foreground px-2 mb-3 font-medium uppercase tracking-wide">快速前往</p>
          <div className="space-y-1">
            <Link
              href="/lines"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              生產線管理
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              首頁儀表板
            </Link>
          </div>
        </div>
      </aside>

      {/* 主要內容區 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* 章節標題 */}
          <div className={`rounded-2xl bg-gradient-to-br ${currentSection.color} border border-border/40 p-6 mb-8`}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-background/60 border border-border/40 flex items-center justify-center text-cyan-400 shrink-0">
                {currentSection.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    {currentSection.badge}
                  </Badge>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-1">{currentSection.title}</h1>
                <p className="text-muted-foreground">{currentSection.subtitle}</p>
              </div>
            </div>
          </div>

          {/* 功能亮點卡片（overview） */}
          {currentSection.features && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {currentSection.features.map((feature, i) => (
                <Card
                  key={i}
                  className="bg-card/60 border-border/40 hover:border-border/70 transition-colors cursor-pointer"
                  onClick={() => feature.link && (window.location.href = feature.link)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground mb-1">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                    {feature.link && (
                      <div className="mt-3 flex items-center gap-1 text-xs text-cyan-400">
                        <Play className="w-3 h-3" />
                        <span>前往操作</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 系統概覽額外說明 */}
          {currentSection.id === "overview" && (
            <Card className="bg-card/60 border-border/40 mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-400" />
                  建議操作順序
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
                  {[
                    "建立產線 & 設定 Takt Time",
                    "新增工站資料",
                    "執行平衡分析",
                    "儲存改善前快照",
                    "動作拆解分析",
                    "AI 優化建議",
                    "執行改善",
                    "儲存改善後快照",
                    "比較前後成效",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-foreground text-xs">{step}</span>
                      {i < 8 && <ChevronRight className="w-3 h-3 text-muted-foreground/50" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 步驟卡片 */}
          {currentSection.steps && (
            <div className="space-y-4 mb-8">
              {currentSection.steps.map((step, i) => {
                const key = `${currentSection.id}-${i}`;
                const isExpanded = expandedSteps[key] !== false; // 預設展開
                return (
                  <Card key={i} className="bg-card/60 border-border/40 overflow-hidden">
                    <button
                      className="w-full text-left"
                      onClick={() => toggleStep(key)}
                    >
                      <CardHeader className="pb-3 pt-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-sm font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </div>
                          <CardTitle className="text-sm font-semibold text-foreground flex-1">
                            {step.title}
                          </CardTitle>
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${isExpanded ? "text-cyan-400" : "text-muted-foreground/30"}`} />
                        </div>
                      </CardHeader>
                    </button>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4">
                        <p className="text-sm text-muted-foreground leading-relaxed ml-11 mb-3">
                          {step.desc}
                        </p>
                        {step.tip && (
                          <div className="ml-11 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300/80 leading-relaxed">{step.tip}</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* 公式卡片（UPPH 章節） */}
          {currentSection.formulas && (
            <div className="space-y-4 mb-8">
              {currentSection.formulas.map((formula, i) => (
                <Card key={i} className="bg-card/60 border-border/40 overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                        <Calculator className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className={`font-bold text-sm mb-1 ${formula.color}`}>{formula.name}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{formula.meaning}</p>
                      </div>
                    </div>
                    {/* 公式 */}
                    <div className="bg-muted/30 rounded-lg p-3 mb-3 font-mono text-xs text-foreground/90 border border-border/30">
                      {formula.formula}
                    </div>
                    {/* 範例 */}
                    <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-300/80 leading-relaxed">{formula.example}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* FAQ 問答區塊 */}
          {currentSection.isFaq && (
            <div className="space-y-8 mb-8">
              {faqCategories.map((cat) => {
                const items = faqItems.filter((f) => f.category === cat.key);
                if (!items.length) return null;
                return (
                  <div key={cat.key}>
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-4 ${cat.bg} ${cat.color}`}>
                      {cat.label}
                    </div>
                    <Accordion type="single" collapsible className="space-y-3">
                      {items.map((item, i) => (
                        <AccordionItem
                          key={i}
                          value={`${cat.key}-${i}`}
                          className="bg-card/60 border border-border/40 rounded-xl overflow-hidden px-0"
                        >
                          <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/20 transition-colors">
                            <div className="flex items-center gap-3 text-left">
                              <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                {item.icon}
                              </div>
                              <span className="text-sm font-semibold text-foreground">{item.q}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-5 pb-5">
                            <div className="ml-10 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                              {item.a}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                );
              })}
            </div>
          )}

          {/* 章節底部提示 */}
          {currentSection.id !== "overview" && (
            <Card className="bg-card/40 border-border/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                    <Lightbulb className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground mb-0.5">小提示</p>
                    <p className="text-xs text-muted-foreground">
                      將滑鼠懸停在任意 KPI 數字上，可查看該指標的計算公式與說明。這個功能在所有頁面都有效。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 章節導覽按鈕 */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border/30">
            {sections.findIndex((s) => s.id === activeSection) > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = sections.findIndex((s) => s.id === activeSection);
                  setActiveSection(sections[idx - 1].id);
                }}
                className="gap-2"
              >
                ← 上一章節
              </Button>
            ) : (
              <div />
            )}
            {sections.findIndex((s) => s.id === activeSection) < sections.length - 1 ? (
              <Button
                size="sm"
                onClick={() => {
                  const idx = sections.findIndex((s) => s.id === activeSection);
                  setActiveSection(sections[idx + 1].id);
                }}
                className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                下一章節 →
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white"
                onClick={() => navigate("/lines")}
              >
                開始使用系統 <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
