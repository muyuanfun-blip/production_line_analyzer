import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen, ChevronRight, BarChart3, Camera, GitCompare, Lightbulb,
  TrendingUp, Clock, Target, Zap, ArrowRight, Play, HelpCircle,
  AlertTriangle, Wrench, ScanBarcode, GitBranch, Download,
  PenLine, Activity, Users,
} from "lucide-react";
import { Link } from "wouter";

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
  category: "balance" | "upph" | "takt" | "general" | "product" | "export";
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
  {
    category: "product",
    icon: <ScanBarcode className="w-4 h-4 text-teal-400" />,
    q: "產品追蹤與產線分析有什麼不同？",
    a: "產線分析關注的是「工站設計」層面（工站時間、平衡率、人力配置），屬於靜態的標準設計分析。產品追蹤關注的是「個別產品實際流動」層面（每個序號在哪個工站、花了多少時間、目前狀態），屬於動態的實際生產追蹤。兩者互補：先用產線分析設計最佳工站佈局，再用產品追蹤監控實際生產是否符合設計標準。",
  },
  {
    category: "product",
    icon: <GitBranch className="w-4 h-4 text-teal-400" />,
    q: "時間軸視圖與甘特比較有什麼差異？",
    a: "時間軸視圖（在產品追蹤頁面）專注於「單一序號」的完整流程，橫向顯示該序號依序流過各工站的時間分佈，適合深入分析單一產品的 Lead Time 組成。甘特比較（獨立頁面）則是「多序號並排」，橫軸為時間、縱軸為序號，適合比較不同產品的流程差異、找出異常序號，或分析批次生產的節奏。",
  },
  {
    category: "export",
    icon: <Download className="w-4 h-4 text-orange-400" />,
    q: "CSV 匯出的欄位有哪些？",
    a: "快照 CSV 包含：快照名稱、產線、備註、建立時間、平衡率、瓶頸時間、UPPH、Takt Time，以及各工站的週期時間、人力、增值率明細。動作分析全工站 CSV 包含：工站名稱、CT、人力、步驟序號、步驟名稱、步驟類型、步驟時間，以及左手/右手動作的名稱、類型、時間。所有 CSV 均使用 BOM 標頭，確保 Excel 正確顯示中文。",
  },
  {
    category: "export",
    icon: <Download className="w-4 h-4 text-orange-400" />,
    q: "JSON 匯出的用途是什麼？",
    a: "JSON 匯出提供完整的結構化資料，適合：①程式化處理（匯入其他系統或資料庫）；②備份完整快照資料（包含所有工站動作步驟與雙手動作）；③與其他 IE 工具整合（如 ERP、MES 系統）。JSON 格式保留所有欄位，包含 CSV 中未包含的巢狀資料（如雙手動作的詳細分類）。",
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
  { key: "balance", label: "平衡率相關",    color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  { key: "upph",    label: "UPPH 相關",     color: "text-cyan-400",  bg: "bg-cyan-500/10 border-cyan-500/20" },
  { key: "takt",    label: "Takt Time 相關", color: "text-blue-400",  bg: "bg-blue-500/10 border-blue-500/20" },
  { key: "general", label: "一般操作",       color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  { key: "product", label: "產品追蹤",       color: "text-teal-400",  bg: "bg-teal-500/10 border-teal-500/20" },
  { key: "export",  label: "匯出功能",       color: "text-orange-400",bg: "bg-orange-500/10 border-orange-500/20" },
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
        desc: "儲存每次改善前後的分析結果，透過快照比較量化 IE 活動成效，支援 CSV/JSON 匯出",
        link: "/lines",
      },
      {
        icon: <Zap className="w-5 h-5 text-yellow-400" />,
        title: "動作拆解分析",
        desc: "將工站作業拆解為增值 / 非增值 / 必要非增值動作，支援雙手動作記錄與全工站匯出",
        link: "/lines",
      },
      {
        icon: <Lightbulb className="w-5 h-5 text-green-400" />,
        title: "AI 優化建議",
        desc: "根據平衡分析結果，AI 自動生成工站重組、人員調配的具體改善建議",
        link: "/lines",
      },
      {
        icon: <ScanBarcode className="w-5 h-5 text-teal-400" />,
        title: "產品序號追蹤",
        desc: "追蹤每個產品序號在各工站的實際流動，記錄進出時間與作業員，計算 Lead Time",
        link: "/product-tracking",
      },
      {
        icon: <GitBranch className="w-5 h-5 text-indigo-400" />,
        title: "甘特比較視圖",
        desc: "多序號並排甘特圖，支援縮放（30%–800%）、拖曳平移、Hover 詳情，比較批次生產節奏",
        link: "/gantt",
      },
      {
        icon: <PenLine className="w-5 h-5 text-rose-400" />,
        title: "數據修整",
        desc: "直接編輯快照的工站資料與雙手動作，儲存後自動重算 KPI，支援多工站同時編輯",
        link: "/data-refinement",
      },
      {
        icon: <Activity className="w-5 h-5 text-amber-400" />,
        title: "配置模擬",
        desc: "在不影響正式資料的情況下模擬不同工站配置，預覽平衡率與 UPPH 的變化",
        link: "/simulation",
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
        tip: "平衡率 ≥ 90% 為優秀，80–90% 為良好，70–80% 為待改善，< 70% 需立即優化。",
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
      {
        name: "Lead Time（產品追蹤）",
        formula: "Lead Time = 最後工站離開時間 − 第一工站進入時間",
        example: "09:00 進入第一站，11:30 離開最後站 → Lead Time = 150 分鐘",
        meaning: "單一產品從投入到完成的總時間，包含加工時間與等待時間",
        color: "text-teal-400",
      },
      {
        name: "產品增值率（產品追蹤）",
        formula: "產品增值率 = 各工站加工時間總和 ÷ Lead Time × 100%",
        example: "各站加工合計 60 分鐘，Lead Time 150 分鐘 → 增值率 = 40%",
        meaning: "實際加工時間佔總 Lead Time 的比例，等待時間越少則增值率越高",
        color: "text-teal-400",
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
      {
        title: "匯出快照資料",
        desc: "在快照歷史頁面，點擊單一快照卡片的「匯出」按鈕，可選擇匯出「KPI 摘要 CSV」或「完整 JSON」；點擊頁首「匯出全部」可一次匯出所有快照。",
        tip: "CSV 適合匯入 Excel 製作報告；JSON 適合備份或與其他系統整合。",
      },
    ],
  },
  {
    id: "action",
    icon: <Zap className="w-5 h-5" />,
    title: "動作拆解與 AI 建議",
    subtitle: "第四步：深入分析作業動作，獲取 AI 改善建議",
    color: "from-rose-500/20 to-rose-600/5",
    badge: "步驟 4",
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
        title: "記錄雙手動作",
        desc: "點擊步驟右側「雙手」按鈕，可分別記錄左手與右手的動作名稱、類型與時間。左手以藍色標示，右手以紫色標示，方便區分。",
        tip: "雙手動作記錄有助於識別單手等待（浪費），是動作改善的重要依據。",
      },
      {
        title: "同步至工站 CT",
        desc: "動作拆解完成後，若合計秒數與工站設定的 CT 不同，可點擊「同步至工站 CT」按鈕，自動更新工站時間，確保平衡分析數據準確。",
      },
      {
        title: "匯出動作分析資料",
        desc: "點擊頁面右上角「匯出」下拉選單，可選擇「此工站 CSV」（單站）或「全工站 CSV / JSON」（整條產線所有工站）。",
        tip: "全工站 CSV 一次匯出所有工站的步驟與雙手動作，適合製作完整的動作分析報告。",
      },
      {
        title: "獲取 AI 改善建議",
        desc: "前往「AI 優化建議」頁面，點擊「開始 AI 分析」，系統會根據平衡率、UPPH、增值率等數據，生成具體的工站重組與人員調配建議。",
        tip: "AI 建議僅供參考，實際改善方案需結合現場實際情況評估可行性。",
      },
    ],
  },
  {
    id: "product",
    icon: <ScanBarcode className="w-5 h-5" />,
    title: "產品序號追蹤",
    subtitle: "追蹤每個產品序號在各工站的實際流動與時間",
    color: "from-teal-500/20 to-teal-600/5",
    badge: "進階功能",
    steps: [
      {
        title: "前往「產品追蹤」",
        desc: "點擊側邊欄「資料管理」分組下的「產品追蹤」，進入產品序號管理頁面。",
      },
      {
        title: "選擇產線並新增序號",
        desc: "在左側下拉選單選擇目標產線，點擊「新增序號」輸入產品序號（如批號、流水號），並設定狀態（進行中 / 完成 / 待處理）。",
        tip: "序號支援任意格式，建議使用與實際生產系統一致的編碼規則。",
      },
      {
        title: "記錄工站流程",
        desc: "選取序號後，右側顯示流程記錄表格。點擊「新增記錄」，選擇工站、輸入進入/離開時間（可選）、作業員姓名、備註，以及加工時間與等待時間。",
        tip: "若未填寫進入/離開時間，系統會以累積時間模式顯示時間軸（以加工+等待時間推算）。",
      },
      {
        title: "查看時間軸視圖",
        desc: "在右側頁首點擊「時間軸」Tab，切換至甘特圖式時間軸。綠色條為加工時間，橘色條為等待時間。懸停可查看工站詳細資訊。",
        tip: "時間軸底部顯示 Lead Time、增值率進度條，以及各工站的加工/等待時間小卡片。",
      },
      {
        title: "管理序號狀態",
        desc: "在左側序號列表，可快速切換序號狀態（進行中 / 完成 / 待處理），或點擊編輯/刪除按鈕管理序號資料。",
      },
    ],
  },
  {
    id: "gantt",
    icon: <GitBranch className="w-5 h-5" />,
    title: "甘特比較視圖",
    subtitle: "多序號並排比較，視覺化分析批次生產節奏",
    color: "from-indigo-500/20 to-indigo-600/5",
    badge: "進階功能",
    steps: [
      {
        title: "前往「甘特比較」",
        desc: "點擊側邊欄「分析工具」分組下的「甘特比較」，進入甘特圖頁面。",
      },
      {
        title: "選擇產線與序號",
        desc: "在頁面頂部選擇目標產線，左側面板會列出該產線所有序號。勾選要比較的序號（支援全選/取消全選），右側甘特圖即時更新。",
        tip: "可使用左側的搜尋框或狀態篩選（進行中/完成/待處理）快速縮小序號範圍。",
      },
      {
        title: "縮放與平移",
        desc: "使用右上角「+」「-」按鈕或滑鼠滾輪縮放甘特圖（30%–800%）；按住滑鼠左鍵拖曳可橫向平移。點擊「重置」按鈕恢復預設縮放。",
        tip: "建議先縮小到 30–50% 查看全局，再放大到 200% 以上查看細節。",
      },
      {
        title: "切換顏色模式",
        desc: "點擊右上角「按工站著色」/「按狀態著色」按鈕切換顏色模式。按工站著色方便識別各工站的時間佔比；按狀態著色方便識別完成/進行中/待處理的序號。",
      },
      {
        title: "查看 Hover 詳情",
        desc: "將滑鼠懸停在任意甘特條上，Tooltip 顯示：工站名稱、加工時間、等待時間、進入/離開時間、作業員、狀態。",
      },
    ],
  },
  {
    id: "refinement",
    icon: <PenLine className="w-5 h-5" />,
    title: "數據修整",
    subtitle: "直接編輯快照資料，修正量測誤差或補充雙手動作",
    color: "from-rose-500/20 to-rose-600/5",
    badge: "進階功能",
    steps: [
      {
        title: "前往「數據修整」",
        desc: "點擊側邊欄「資料管理」分組下的「數據修整」，進入快照編輯頁面。",
      },
      {
        title: "選擇快照",
        desc: "在左側下拉選單選擇目標快照，右側表格顯示該快照的所有工站資料（名稱、CT、人力、增值率）。",
        tip: "數據修整不會影響原始工站資料，只修改快照的儲存值。",
      },
      {
        title: "編輯工站基本資料",
        desc: "直接在表格中點擊工站名稱、CT（秒）、人力欄位進行修改。修改後欄位以橘色標示，表示有未儲存的變更。",
      },
      {
        title: "展開動作步驟",
        desc: "點擊工站列左側的展開箭頭（▶），顯示該工站的動作步驟清單。可新增步驟、修改步驟名稱/類型/時間、刪除步驟。",
        tip: "可同時展開多個工站進行編輯，儲存後所有展開的工站維持展開狀態。",
      },
      {
        title: "編輯雙手動作",
        desc: "點擊步驟右側「雙手」按鈕展開雙手動作清單。可分別新增左手（藍色）/右手（紫色）動作，填寫動作名稱、類型、時間（秒）、是否空手。",
      },
      {
        title: "儲存變更",
        desc: "點擊右上角「儲存變更」按鈕，系統顯示儲存中動畫，完成後頂部出現綠色成功 Banner。儲存後自動重算增值率、totalStepSec 等 KPI。",
        tip: "若發生網路異常或資料格式錯誤，頂部會顯示紅色錯誤 Banner，可點擊「重試」重新儲存。",
      },
    ],
  },
  {
    id: "export",
    icon: <Download className="w-5 h-5" />,
    title: "資料匯出",
    subtitle: "將分析結果匯出為 CSV 或 JSON，用於報告製作與系統整合",
    color: "from-orange-500/20 to-orange-600/5",
    badge: "匯出功能",
    steps: [
      {
        title: "快照歷史頁 — 單一快照匯出",
        desc: "在「快照歷史」頁面，點擊任一快照卡片右上角的「匯出」下拉選單，選擇「KPI 摘要 CSV」或「完整 JSON」。",
        tip: "CSV 包含快照 KPI + 各工站明細；JSON 包含完整資料（含動作步驟與雙手動作）。",
      },
      {
        title: "快照歷史頁 — 匯出全部快照",
        desc: "點擊頁首右上角「匯出全部」下拉選單，選擇「所有快照 KPI 摘要 CSV」或「所有快照完整 JSON」，一次匯出所有快照資料。",
      },
      {
        title: "動作分析頁 — 單站匯出",
        desc: "在「動作分析」頁面，點擊右上角「匯出」下拉選單，選擇「此工站 CSV」，匯出目前選取工站的動作步驟資料。",
      },
      {
        title: "動作分析頁 — 全工站匯出",
        desc: "在「動作分析」頁面，點擊「匯出」下拉選單，選擇「全工站 CSV」或「全工站 JSON」，一次匯出整條產線所有工站的動作步驟與雙手動作。",
        tip: "全工站 CSV 適合製作完整的動作分析報告；全工站 JSON 適合與 ERP/MES 系統整合。",
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

  const currentSection = sections.find((s) => s.id === activeSection)!;

  return (
    <div className="flex gap-0 min-h-screen">
      {/* 側邊章節導覽 */}
      <aside className="w-60 shrink-0 border-r border-border/40 bg-card/30 sticky top-0 h-screen overflow-y-auto p-3">
        <div className="flex items-center gap-2 mb-4 px-2">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-xs text-foreground uppercase tracking-wider">使用指南</span>
        </div>
        <nav className="space-y-0.5">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left transition-all text-xs ${
                activeSection === section.id
                  ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className={`shrink-0 ${activeSection === section.id ? "text-cyan-400" : "text-muted-foreground"}`}>
                {section.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{section.title}</div>
                <div className="text-[0.625rem] text-muted-foreground truncate">{section.badge}</div>
              </div>
              {activeSection === section.id && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
            </button>
          ))}
        </nav>

        {/* 快速連結 */}
        <div className="mt-6 pt-4 border-t border-border/40">
          <p className="text-[0.625rem] text-muted-foreground px-2 mb-2 font-medium uppercase tracking-wide">快速前往</p>
          <div className="space-y-0.5">
            {[
              { href: "/lines",            label: "生產線管理" },
              { href: "/product-tracking", label: "產品追蹤" },
              { href: "/gantt",            label: "甘特比較" },
              { href: "/data-refinement",  label: "數據修整" },
              { href: "/",                 label: "首頁儀表板" },
            ].map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 px-3 py-1.5 rounded text-[0.6875rem] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <ArrowRight className="w-3 h-3 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      {/* 主要內容區 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {/* 章節標題 */}
          <div className={`rounded-xl bg-gradient-to-br ${currentSection.color} border border-border/40 p-5 mb-6`}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-background/60 border border-border/40 flex items-center justify-center text-cyan-400 shrink-0">
                {currentSection.icon}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary" className="text-xs">
                    {currentSection.badge}
                  </Badge>
                </div>
                <h1 className="text-xl font-bold text-foreground mb-1">{currentSection.title}</h1>
                <p className="text-sm text-muted-foreground">{currentSection.subtitle}</p>
              </div>
            </div>
          </div>

          {/* 功能亮點卡片（overview） */}
          {currentSection.features && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {currentSection.features.map((feature, i) => (
                <Card
                  key={i}
                  className="bg-card/60 border-border/40 hover:border-border/70 transition-colors cursor-pointer"
                  onClick={() => feature.link && (window.location.href = feature.link)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded bg-muted/50 flex items-center justify-center shrink-0">
                        {feature.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-foreground mb-0.5">{feature.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    </div>
                    {feature.link && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-cyan-400">
                        <Play className="w-3 h-3" />
                        <span>前往操作</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 步驟列表 */}
          {currentSection.steps && (
            <div className="space-y-3">
              {currentSection.steps.map((step, i) => (
                <div
                  key={i}
                  className="flex gap-4 p-4 rounded-xl border border-border/40 bg-card/40 hover:bg-card/60 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-cyan-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground mb-1">{step.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                    {step.tip && (
                      <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="text-amber-400 shrink-0 mt-px">💡</span>
                        <p className="text-xs text-amber-300/90 leading-relaxed">{step.tip}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 公式卡片 */}
          {currentSection.formulas && (
            <div className="space-y-3">
              {currentSection.formulas.map((formula, i) => (
                <div key={i} className="p-4 rounded-xl border border-border/40 bg-card/40">
                  <div className="flex items-start gap-3">
                    <div className={`w-1.5 h-full min-h-[3rem] rounded-full shrink-0 ${formula.color.replace("text-", "bg-")}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-sm mb-1.5 ${formula.color}`}>{formula.name}</h3>
                      <div className="font-mono text-xs bg-background/60 border border-border/40 rounded px-3 py-2 mb-2">
                        {formula.formula}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1.5 leading-relaxed">
                        <span className="text-foreground/70 font-medium">範例：</span>{formula.example}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="text-foreground/70 font-medium">意義：</span>{formula.meaning}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FAQ */}
          {currentSection.isFaq && (
            <div className="space-y-6">
              {faqCategories.map((cat) => {
                const items = faqItems.filter((f) => f.category === cat.key);
                if (items.length === 0) return null;
                return (
                  <div key={cat.key}>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold mb-3 ${cat.bg} ${cat.color}`}>
                      {cat.label}
                    </div>
                    <Accordion type="multiple" className="space-y-2">
                      {items.map((item, i) => (
                        <AccordionItem
                          key={i}
                          value={`${cat.key}-${i}`}
                          className="border border-border/40 rounded-xl bg-card/40 px-4 overflow-hidden"
                        >
                          <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline py-3">
                            <div className="flex items-center gap-2 text-left">
                              {item.icon}
                              <span>{item.q}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                            {item.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
