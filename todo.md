# 生產工站分析系統 TODO

## 資料庫與後端 API
- [x] 建立 production_lines 資料表（生產線）
- [x] 建立 workstations 資料表（工站）
- [x] 建立 action_steps 資料表（動作步驟）
- [x] 執行資料庫遷移
- [x] 實作生產線 CRUD API（tRPC）
- [x] 實作工站 CRUD API（tRPC）
- [x] 實作動作步驟 CRUD API（tRPC）
- [x] 實作平衡分析計算 API
- [x] 實作 AI 優化建議 API
- [x] 實作 CSV/JSON 報表導出 API
- [x] 實作 Excel/CSV 批量匯入 API

## 前端框架與設計系統
- [x] 設定全域 CSS 主題（優雅深色設計）
- [x] 建立 DashboardLayout 側邊欄導航
- [x] 建立路由結構（首頁、工站管理、平衡分析、動作分析、AI建議）
- [x] 設定全域字體樣式

## 工站資料管理模組
- [x] 生產線列表頁（新增/編輯/刪除）
- [x] 工站資料輸入表單（工站名稱、工序時間、人員配置）
- [x] 工站列表與管理介面
- [x] Excel/CSV 批量匯入介面（拖曳上傳）

## 產線平衡分析與可視化
- [x] 平衡分析頁面（平衡率、瓶頃工站、效率指標）
- [x] 工站時間分佈柱狀圖（Recharts）
- [x] 平衡率儀表板卡片
- [x] 瓶頃工站高亮顯示
- [x] 動作分析記錄介面（步驟時間分配）

## AI 優化建議與報表導出
- [x] AI 分析按鈕與結果展示（Streamdown 渲染）
- [x] CSV 導出功能
- [x] JSON 導出功能
- [x] 列印/PDF 報表樣式

## 測試
- [x] 後端 API 單元測試（vitest）
- [x] 平衡計算邏輯測試

## Takt Time 功能（新增）
- [x] 確認 production_lines 資料表是否已有 targetCycleTime 欄位
- [x] 更新生產線新增/編輯表單，加入 Takt Time 輸入欄位
- [x] 在平衡分析圖表加入 Takt Time 參考線（紫色虛線）
- [x] 在工站時間柱狀圖上標示每個工站的達標/超標狀態
- [x] 在 KPI 卡片區加入 Takt Time 達標率指標
- [x] 在工站詳細分析表格加入 vs Takt Time 欄位
- [x] 更新 AI 分析 prompt 納入 Takt Time 資訊
- [x] 補強 Takt Time 相關測試

## 歷史快照比較功能（新增）
- [x] 建立 analysis_snapshots 資料表
- [x] 執行資料庫遷移（CREATE TABLE）
- [x] 實作快照 CRUD API（listByLine, getById, create, delete）
- [x] 在 BalanceAnalysis.tsx 加入「儲存快照」按鈕與 Dialog
- [x] 建立快照歷史列表頁面（SnapshotHistory.tsx）
- [x] 建立快照比較頁面（SnapshotCompare.tsx）
- [x] 工站時間對比柱狀圖（兩快照並排）
- [x] 平衡率歷史趨勢折線圖
- [x] 工站差異明細表（改善/退步/新增/移除）
- [x] KPI 對比卡片（平衡率、瓶頸時間、平均時間、Takt 達標率）
- [x] 在路由加入快照頁面路由
- [x] 補強快照比較相關測試（5 項）

## 首頁產線平衡率比較圖表（新增）
- [x] 新增後端 API：getAllLinesLatestSnapshot（取得各產線最新快照摘要）
- [x] 首頁加入產線平衡率並排比較橫條圖（Recharts）
- [x] 圖表顯示 Takt Time 達標率、瓶頸時間等輔助指標
- [x] 無快照時顯示空白提示引導用戶操作
- [x] 補強相關測試（5 項）

## 首頁歷史平衡率趨勢圖（新增）
- [x] 新增後端 API：getAllLinesSnapshotHistory（各產線所有快照的平衡率時間序列）
- [x] 首頁加入多產線歷史平衡率趨勢折線圖（Recharts LineChart，每條產線一條折線）
- [x] 圖表支援 Tooltip 顯示快照名稱、平衡率、Takt 達標率
- [x] 加入 80%/90% 基準參考線（ReferenceLine）
- [x] 無歷史資料時顯示引導空狀態
- [x] 補強相關測試（5 項）

## AI 改用 Ollama API（新增）
- [x] 設定 OLLAMA_API_KEY secret
- [x] 更新後端 AI 分析路由，改用 Ollama API（api/chat）
- [x] 確認模型名稱（預設 qwen3-coder:480b）
- [x] 測試 AI 分析功能是否正常回應（33 項測試全通過）

## 動作拆解強化功能（新增）
- [x] 確認 action_steps 資料表欄位（name, type, duration, order）
- [x] 確認後端 action_steps CRUD API 完整性
- [x] 重寫 ActionAnalysis.tsx：工站選擇後顯示動作拆解輸入介面
- [x] 每列輸入：動作名稱、類型（增値/非增値/必要浪費）、秒數
- [x] 支援新增/刪除動作列、上下移動按鈕
- [x] 即時計算：合計秒數、各類型佔比、與工站設定時間的差異
- [x] 圓餅圖即時更新（依動作類型分佈）
- [x] 工站時間自動同步（動作合計秒數可回寫至工站 cycleTime）
- [x] 補強相關測試（7 項）

## 動作拆解整合快照（新增）
- [x] 確認 analysis_snapshots.snapshotData JSON 結構
- [x] 擴充快照 snapshotData：加入各工站 actionSteps 摘要（valueAddedSec, nonValueAddedSec, necessaryWasteSec, totalStepSec, valueAddedRate）
- [x] 更新後端 snapshot.create API：建立快照時同步查詢各工站的動作拆解資料
- [x] 更新 BalanceAnalysis.tsx 儲存快照 Dialog：顯示「將同步記錄各工站動作拆解資料」提示
- [x] 更新 SnapshotCompare.tsx：新增「增值率比較」區塊（各工站增值率並排柱狀圖）
- [x] 更新 SnapshotCompare.tsx：在工站差異明細表加入增值率欄位（前後對比 + 差異箭頭）
- [x] 補強相關測試（增值率快照計算邏輯，6 項）

## 資料同步完善（新增）
- [x] 審查 WorkstationManager、ActionAnalysis、BalanceAnalysis 三頁面的資料同步缺口
- [x] 動作拆解合計秒數「同步至工站 CT」按鈕：確認 mutation invalidate 正確刷新平衡分析數據
- [x] 工站 CT 更新後，平衡分析頁面自動重新計算（確認 query invalidation 正確）
- [x] 加入工站快速批量編輯介面（表格內嵌編輯，點擊 CT/人員欄位即可編輯，Enter 儲存）
- [x] 快照儲存前加入「資料一致性提示」：顯示 CT 與動作拆解同步狀態、儀表板即時同步提示
- [x] 補強同步邏輯相關測試（46 項全通過）

## UPPH 顯示功能（新增）
- [x] 擴充 analysis_snapshots 資料表加入 upph 欄位
- [x] 執行資料庫遷移（ALTER TABLE）
- [x] 更新 snapshot.create API 計算並儲存 UPPH
- [x] 更新 snapshot.listByLine / getById / getAllLinesLatest / getAllLinesHistory 回傳 upph
- [x] BalanceAnalysis.tsx：useMemo 加入 UPPH 計算（3600 ÷ maxTime ÷ totalManpower）
- [x] BalanceAnalysis.tsx：KPI 卡片區加入 UPPH 卡片（amber 色系，凸顯 IE 績效）
- [x] BalanceAnalysis.tsx：工站詳細表格加入「人均產能」欄位（工站級 UPPH）
- [x] BalanceAnalysis.tsx：快照儲存 Dialog 加入 UPPH 預覽與傳遞
- [x] Home.tsx：chartData 加入 upph 欄位
- [x] Home.tsx：summaryStats 加入 bestUpph / avgUpph 統計
- [x] Home.tsx：摘要統計卡片加入 UPPH 最高產線卡片
- [x] Home.tsx：各產線卡片加入 UPPH 顯示
- [x] Home.tsx：CustomTooltip 加入 UPPH 欄位
- [x] Home.tsx：歷史趨勢加入 UPPH 趨勢折線圖（獨立區塊）
- [x] SnapshotCompare.tsx：KPI 對比卡片加入 UPPH 前後比較
- [x] SnapshotHistory.tsx：快照卡片加入 UPPH 顯示
- [x] 補強 UPPH 相關測試（20 項全通過）
- [x] AISuggestions.tsx：KPI 卡片加入 UPPH、導出報告（TXT/JSON）加入 UPPH

## Takt Time 計算輔助工具（新增）
- [x] ProductionLines.tsx：在目標節拍時間欄位旁加入計算機圖示按鈕
- [x] ProductionLines.tsx：實作 Popover 展開式計算工具（可用時間分鐘數 + 需求數量 → 自動計算 Takt Time）
- [x] ProductionLines.tsx：計算結果一鍵帶入目標節拍時間欄位

## KPI 公式說明 Tooltip（新增）
- [x] 建立共用 FormulaTooltip 元件（懸停顯示公式、說明、計算範例）
- [x] BalanceAnalysis.tsx：5 個 KPI 卡片數字套用 FormulaTooltip
- [x] Home.tsx：摘要統計卡片與各產線卡片數字套用 FormulaTooltip
- [x] SnapshotCompare.tsx：KPI 對比卡片數字套用 FormulaTooltip
- [x] SnapshotHistory.tsx：快照卡片 KPI 數字套用 FormulaTooltip
- [x] AISuggestions.tsx：KPI 卡片數字套用 FormulaTooltip

## 互動式使用指南頁面（新增）
- [x] 建立 client/src/pages/UserGuide.tsx 互動式使用指南頁面
- [x] 實作章節導覽（側邊目錄）：6 大章節可快速跳轉
- [x] 實作步驟卡片：每個功能以編號步驟呈現操作流程
- [x] 實作公式卡片：6 種 KPI 指標的公式說明（含範例計算）
- [x] 實作功能亮點卡片：UPPH、FormulaTooltip、Takt Time 計算機等新功能說明
- [x] 在 App.tsx 加入 /guide 路由
- [x] 在 DashboardLayout.tsx 側邊欄加入「使用指南」連結（BookOpen 圖示）

## 使用指南 FAQ 章節（新增）
- [x] UserGuide.tsx：新增 FAQ Section 型別（faqs 陣列）
- [x] UserGuide.tsx：加入 8 個常見問題（平衡率低於 70%、UPPH 提升方法等）
- [x] UserGuide.tsx：實作可展開/收合的問答卡片 UI（Accordion 樣式）
- [x] UserGuide.tsx：在側邊欄導覽加入 FAQ 章節連結

## 快照工站明細展示（新增）
- [x] SnapshotHistory.tsx：每張快照卡片新增「展開工站明細」按鈕（Collapsible）
- [x] SnapshotHistory.tsx：展開後顯示快照當時所有站別（名稱、週期時間、人員數、是否為瓶頸）
- [x] SnapshotHistory.tsx：工站列表標示瓶頸工站（橘色高亮）與增值率（若有資料）

## 快照工序時間分佈圖（新增）
- [x] SnapshotHistory.tsx：每張快照卡片新增「查看分佈圖」按鈕
- [x] SnapshotHistory.tsx：實作 Dialog 彈窗顯示該快照的工站時間分佈柱狀圖（Recharts）
- [x] SnapshotHistory.tsx：柱狀圖標示瓶頸工站（橘色）、Takt Time 參考線（紫色虛線）

## 工序時間分佈圖人員數顯示（新增）
- [x] SnapshotHistory.tsx：柱狀圖每根柱子內顯示人員數（柱內標籤，格式「👤N人」）
- [x] SnapshotHistory.tsx：Tooltip 已有人員數，確認顯示正確

## 工序時間分佈圖下載功能（新增）
- [x] 安裝 html2canvas
- [x] SnapshotHistory.tsx：Dialog 右上角新增「下載圖表」按鈕，匯出圖表區塊為 PNG
- [x] 下載檔名格式：「工序時間分佈圖_快照名稱_日期.png」

## 工序時間分佈圖風險等級配色（新增）
- [x] SnapshotHistory.tsx：柱狀圖套用與 BalanceAnalysis 相同的 COLORS + getBarStatus 邏輯
- [x] SnapshotHistory.tsx：圖例說明更新為五種風險等級色塊
- [x] SnapshotHistory.tsx：Tooltip 顯示風險等級標籤

## 快照比較頁雙快照並排分佈圖（新增）
- [x] SnapshotCompare.tsx：工站差異表上方新增雙快照並排柱狀圖區塊
- [x] SnapshotCompare.tsx：兩張圖共用相同 Y 軸最大值，方便視覺對比
- [x] SnapshotCompare.tsx：套用與 BalanceAnalysis 相同的五級風險等級配色
- [x] SnapshotCompare.tsx：標示 Takt Time 參考線（若有）

## 修復圖表下載功能（Bug）
- [x] 改用 Recharts SVG 直接轉 PNG 方式，取代 html2canvas（html2canvas 對 SVG 渲染有相容性問題）

## 快照圖表與分析頁一致化（新增）
- [x] SnapshotHistory.tsx：彈框改為 max-w-5xl 大尺寸
- [x] SnapshotHistory.tsx：圖表高度改為 h-80（320px），與分析頁一致
- [x] SnapshotHistory.tsx：使用與分析頁相同的 StatusLabel 圖示標記（×、△、✓、⚡）
- [x] SnapshotHistory.tsx：使用與分析頁相同的 CustomTooltip 格式
- [x] SnapshotHistory.tsx：圖例改為與分析頁完全一致（含 Takt Time 有無兩種版本）
- [x] SnapshotHistory.tsx：CartesianGrid 改為 vertical={false}，XAxis/YAxis 無 axisLine/tickLine

## 舊快照 UPPH 補算顯示（新增）
- [x] SnapshotHistory.tsx：UPPH 為 null 時，用 maxTime 與 totalManpower 在前端補算（3600 ÷ maxTime ÷ totalManpower）
- [x] SnapshotHistory.tsx：補算的 UPPH 同樣顯示在快照卡片 KPI 區與圖表 Dialog KPI 摘要列
- [x] SnapshotHistory.tsx：補算的 UPPH 顯示時加上「*」標記或 tooltip 說明「由快照資料補算」

## 快照圖表 Dialog 寬度加寬（新增）
- [x] SnapshotHistory.tsx：Dialog 改為 max-w-[95vw] 全寬，圖表高度改為 h-[480px]

## 快照圖表寬度 900px（新增）
- [x] SnapshotHistory.tsx：圖表容器改為 overflow-x-auto，內部 div 固定 min-w-[900px]，ResponsiveContainer 改為固定 width={900}

## 快照圖表 Dialog 固定 900px 寬度（新增）
- [x] SnapshotHistory.tsx：DialogContent 改為 w-[900px]，移除 overflow-x-auto 與 min-w，圖表直接填滿 900px

## 快照圖表 Dialog 強制 1024px（新增）
- [x] SnapshotHistory.tsx：DialogContent 改用 style={{ width: '1024px', maxWidth: '98vw' }} 覆蓋 shadcn 預設 sm:max-w-lg 限制

## 雙手作業統計 — 方案 B（新增）
- [x] drizzle/schema.ts：新增 handActions 子表（id, actionStepId, hand, actionName, duration, handActionType, isIdle, note）
- [x] 執行 pnpm drizzle-kit generate 並套用遷移 SQL
- [x] server/db.ts：新增 getHandActionsByStep、upsertHandActions 查詢函式
- [x] server/routers.ts：新增 handAction.listByStep、handAction.upsert procedures
- [x] ActionAnalysis.tsx：動作步驟卡片新增「展開雙手輸入」區塊（左手/右手各自動作名稱、時間、類型、空手標記）
- [x] ActionAnalysis.tsx：右側分析面板新增「雙手統計」區塊（雙手同步率、左手空閒、右手空閒、工具作業時間）
- [x] ActionAnalysis.tsx：新增雙手甘特圖（左右手時間軸並排）
- [x] 撰寫 handAction vitest 測試

## 內部帳號密碼管理系統（移除 OAuth）
- [x] drizzle/schema.ts：users 表新增 username、passwordHash 欄位
- [x] 執行 schema 遷移 SQL
- [x] server/routers.ts：新增 auth.localLogin（帳密驗證 + session cookie）
- [x] server/routers.ts：新增管理員帳號 CRUD（admin.createUser、admin.listUsers、admin.resetPassword、admin.toggleActive）
- [x] 初始化預設管理員帳號（admin / 初始密碼）
- [x] client/src/pages/Login.tsx：本地帳密登入頁面（取代 OAuth 跳轉）
- [x] client/src/pages/AdminUsers.tsx：管理員帳號管理頁面
- [x] client/src/App.tsx：更新路由與登入流程

## 雙手作業甘特圖（新增）
- [x] 建立 HandGanttChart.tsx 元件（SVG 時間軸並排）
- [x] 甘特圖支援：左右手行並排、各動作區塊依類型配色、空手等待灰色顯示
- [x] 甘特圖支援：Hover Tooltip（動作名稱/類型/開始/持續/結束秒數）
- [x] 甘特圖支援：步驟分隔線、步驟名稱標籤
- [x] 甘特圖支援：Takt Time 紫色虛線參考線
- [x] 甘特圖支援：縮放（+/-/重置）、下載 PNG
- [x] 甘特圖底部統計摘要（總週期時間、左右手作業時間、空手時間、雙手同步率）
- [x] 整合至 ActionAnalysis.tsx 右側分析面板（雙手統計卡片上方）
- [x] ActionAnalysis.tsx：todo 中原有「ActionAnalysis.tsx：新增雙手甘特圖」標記為完成

## 圖片下載修復（新增）
- [x] 修復歷史快照下載問題（無法下載）
- [x] 所有圖片下載功能改為白色背景（含：甘特圖、歷史快照圖）

## 工站人力小數支援（新增）
- [x] 前端工站管理頁面：人力輸入欄位改為支援小數（step=0.5，min=0.5）
- [x] 後端 tRPC schema：manpower 驗證改為 z.number().min(0.5)
- [x] 資料庫 schema：manpower 欄位改為 decimal(5,1) 並已執行 migration

## 歷史快照下載 oklch 修復（新增）
- [x] 修復 html2canvas 無法解析 oklch 色彩導致下載失敗的問題

## 數據修整頁面（新增）
- [x] 後端：新增 snapshot.updateData tRPC procedure（更新快照工站數據並重算 KPI）
- [x] 後端：新增 updateSnapshotData DB helper
- [x] 前端：建立 DataRefinement.tsx 頁面（選取產線 → 選取快照 → 編輯工站表格 → 儲存）
- [x] 前端：在 App.tsx 注冊 /data-refinement 路由
- [x] 前端：在側邊欄新增「數據修整」導覽項目

## 平衡分析頁面 API 錯誤修復（新增）
- [x] 修復 /lines/:id/balance 頁面 mutation 回傳 HTML 而非 JSON 的錯誤（snapshot.create totalManpower 移除 .int() 限制）

## 動作分析甘特圖版面重構（新增）
- [x] 右側面板甘特圖改為入口按鈕（方案二 Modal）
- [x] 新增全螢幕 Dialog Modal 顯示甘特圖

## 數據修整：新增工站功能（新增）
- [x] 後端：沿用 snapshot.updateData 支援新增工站（前端暫存新列後一次儲存）
- [x] 前端：DataRefinement.tsx 新增「+ 新增工站」按鈕與表單（工站名稱、CT、人力）
- [x] 前端：儲存後即時更新表格並重算 KPI 摘要
