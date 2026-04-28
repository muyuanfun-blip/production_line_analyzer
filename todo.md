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

## 數據修整：新增工站插入位置（新增）
- [x] 新增工站表單加入「插入位置」下拉選單（加在最後 / 加在第 N 站之後）
- [x] 確認後按照選擇的位置插入，並重新排列後續工站的 sequenceOrder

## 生產線配置模擬頁面（新增）
- [x] 資料庫：新增 simulation_scenarios 表（id, name, productionLineId, baseSnapshotId, workstationsData JSON, notes, createdBy, createdAt, updatedAt）
- [x] 資料庫：執行 migration
- [x] 後端：新增 simulation.list / getById / create / update / delete / applyToLine procedures
- [x] 後端：新增 DB helpers（listSimulations, getSimulation, createSimulation, updateSimulation, deleteSimulation）
- [x] 前端：建立 LineSimulator.tsx 頁面
- [x] 前端：情境管理面板（建立、複製、删除、命名情境）
- [x] 前端：工站配置編輯器（行內編輯 CT、人力、新增、删除工站）
- [x] 前端：合併工站功能（選取兩相鄰工站，自動加總 CT 與人力）
- [x] 前端：拆分工站功能（輸入比例，自動分配 CT）
- [x] 前端：即時 KPI 儀表板（平衡率、瓶頃工站、UPPH、Takt 達標率、總人力、預估產能）
- [x] 前端：平衡圖視覺化（橫條圖 + Takt Time 紅線 + 瓶頃高亮）
- [x] 前端：情境並排比較圖（模擬 vs 基準，顏色標示改善/惡化工站）
- [x] 前端：套用至產線功能（確認 Dialog + 寫回實際工站資料）
- [x] 前端：在 App.tsx 注冊 /simulator 路由
- [x] 前端：在側邊欄新增「配置模擬」導覽項目
- [x] 撰寫 simulation procedures 的 Vitest 測試（17 項全通過）

## 視覺化產線平面圖模擬器（重新設計）
- [x] 後端：擴充 simulation_scenarios workstationsData JSON 結構，新增 x/y 座標、operatorTime、machineTime、connections（物流連線陣列）
- [x] 後端：更新 simulation create/update/applyToLine procedures 支援 FloorLayout 格式
- [x] 前端：建立 FloorPlanSimulator.tsx 核心頁面
- [x] 前端：SVG 平面圖畫布（可縮放、平移、格線背景）
- [x] 前端：工站節點元件（可拖曳、顯示名稱/CT/人力、顏色依狀態）
- [x] 前端：物流動線箭頭（依 connections 繪製 SVG 路徑，顯示搜運距離/時間）
- [x] 前端：物流動線即時動畫（小圓點沿箭頭移動，速度依 CT 比例）
- [x] 前端：工站屬性面板（點擊工站後展開，分別設定人員作業時間/設備作業時間）
- [x] 前端：CT 自動計算（max(operatorTime, machineTime) 為工序時間）
- [x] 前端：拖曳工站後即時更新物流動線位置
- [x] 前端：即時 KPI 儀表板（平衡率、瓶頃、UPPH、Takt 達標率）
- [x] 前端：套用現有產線參數按鈕（載入 workstations 並自動排列到畫布）
- [x] 前端：儲存佈局按鈕（儲存座標與連線至情境）
- [x] 前端：在 App.tsx 新增 /floor-simulator 路由，側邊欄連結對準
- [x] 撰寫 FloorPlanSimulator 相關 Vitest 測試（100 項全## 搜運距離設定與輸送帶搜配（FloorPlanSimulator 擴充）

### 資料結構擴充
- [x] 後端：連線（connection）屬性新增 conveyorType（manual / conveyor / agv）、speed（公尺/分鐘）
- [x] 後端：搜運時間自動計算公式 = distance / speed xd7 60（單位：秒）

### 前端：連線屬性編輯面板
- [x] 點擊連線箭頭（SVG path）可選取，選取後展開連線屬性 Dialog
- [x] 連線屬性 Dialog：輸送帶類型選擇（人工搬運 / 輸送帶 / AGV）
- [x] 連線屬性 Dialog：速度輸入（公尺/分鐘，依類型預設：人工 30、輸送帶 20、AGV 60）
- [x] 連線屬性 Dialog：距離與搜運時間唯讀顯示（由座標自動計算）
- [x] 連線箭頭中段顯示距離/時間標籤（如「5.0m / 10.0s」）
- [x] 不同輸送帶類型以不同顏色/線條樣式區分（人工=虛線灰、輸送帶=實線藍、AGV=虛線橘）
- [x] 物流動線動畫速度依輸送帶速度比例調整

### 前端：KPI 擴充
- [x] 新增「平均搜運時間」 KPI 指標（所有連線搜運時間的平均）
- [x] 新增「物流等待佔比」 = 總搜運時間 / (總 CT + 總搜運時間) xd7 100%
- [x] 工站屬性面板顯示「上游搜運時間」（從上一工站到此工站的搜運時間）
- [x] 平衡圖柱狀圖以不同顏色區塊疊加顯示搜運時間（CT 區塊 + 搜運時間區塊）
## 拖曳即時計算搬運距離與工時差異（FloorPlanSimulator 擴充）### 核心機制
- [x] 畫布設定比例尺（像素/公尺），預設 10px = 1m，可在工具列調整
- [x] 連線資料格式新增：distance（公尺，由座標自動計算）、speed（公尺/分鐘）、conveyorType（manual/conveyor/agv）、conveyorName
- [x] 拖曳工站時，即時重算所有相關連線的 distance（歐氏距離 × 比例尺）
- [x] 搜運時間 = distance / speed × 60（秒），拖曳過程中即時更新

### 視覺化
- [x] 連線筭頭中段顯示「Xm / Ys」標籤（距離/搜運時間），拖曳時即時更新
- [x] 不同輸送帶類型以不同顏色/線條樣式區分（人工=虛線灰、輸送帶=實線藍、AGV=實線橘）
- [x] 點擊連線筭頭可選取，右側展開連線屬性面板（類型、速度、距離唯讀、搜運時間）
- [x] 物流動線動畫速度依輸送帶速度比例調整

### KPI 即時更新
- [x] 新增「平均搜運時間」 KPI 卡片（所有連線搜運時間平均）
- [x] 新增「物流等待佔比」 KPI 卡片（總搜運時間 / (總CT + 總搜運時間））
- [x] 工站屬性面板顯示「上游搜運時間」
- [x] 平衡圖柱狀圖疊加搜運時間區塊（不同顏色，顯示 CT + 搜運時間的合計）
- [x] 拖曳工站後，KPI 儀表板與平衡圖立即反映新的搜運時間 工站人力與設備數量配置視覺化（FloorPlanSimulator 擴充）

### 資料結構擴充
- [x] FloorWs 型別新增 operatorCount（人員數量，預設 1）、machineCount（設備數量，預設 1）
- [x] 套用產線參數時，從 workstation.manpower 帶入 operatorCount，machineCount 預設 1
- [x] 建立情境時，operatorCount/machineCount 帶入預設値

### 工站屬性面板
- [x] 工站屬性面板新增「人員數量」輸入欄位（整數，min 1）
- [x] 工站屬性面板新增「設備數量」輸入欄位（整數，min 0，0 表示純人工）
- [x] 工站屬性面板顯示「人均作業時間」（operatorTime / operatorCount）
- [x] 工站屬性面板顯示「設備利用率」（machineTime / (operatorTime × machineCount)）

### 工站節點視覺化
- [x] 工站節點底部顯示人員圖示列（圓形圖示，最多顯示 5 個，超過顯示 +N）
- [x] 工站節點底部顯示設備圖示列（方形圖示，最多顯示 3 個，超過顯示 +N）
- [x] 人員圖示顏色依負載狀態（人均 CT 超過 Takt → 紅色，正常 → 綠色）
- [x] 設備圖示顏色依利用率（>90% → 紅色，>70% → 黃色，正常 → 藍色）
- [x] 工站節點高度自動調整以容納人員/設備圖示列

### KPI 擴充
- [x] KPI 面板新增「總人員數」（所有工站 operatorCount 加總）
- [x] KPI 面板新增「總設備數」（所有工站 machineCount 加總）
- [x] KPI 面板新增「人均產能」（UPPH = 3600 / maxCT / totalOperatorCount）
- [x] KPI 面板新增「設備利用率」（平均設備利用率）

## 平面圖距離計算與連線標籤修正（Bug Fix）
- [x] 距離計算改為「每格 = 0.5m」：工站相鄰（靠在一起）= 0m，每移動一格（GRID_SIZE px）= 0.5m
- [x] 連線中段搜運資訊標籤（距離/時間）移至 SVG 最上層，避免被工站節點這住

## 搬運標籤層級調整（Bug Fix）
- [x] 搜運資訊標籤移至連線路徑（虛線）與動畫小點的下方，但仍在工站節點的上方（避免這蔽動畫）

## 右側面板 UX 改善
- [x] KPI 儀表板區塊加上收起/展開按鈕（預設展開）
- [x] 平衡圖區塊加上收起/展開按鈕（預設展開）
- [x] 右側面板整體可拖曳調整寬度（最小 200px，最大 480px）

## 輸送帶視覺化功能
- [x] 當連線類型為「輸送帶」時，沿連線路徑渲染寬矩形帶（帶寬 12px，深色背景 + 淡色邊框）
- [x] 輸送帶上顯示等間距的滾輪紋路（短垂直線段，以 SVG pattern 實作）
- [x] 輸送帶方向以動畫小點或移動紋路表示（速度越快動畫越快）
- [x] 連線屬性面板中輸送帶速度欄位更醒目，並顯示即時搶運時間預覽
- [x] 速度設定確認已正確影響 computeConnMetrics 的搶運時間計算

## 輸送帶獨立物件（重構）
- [x] 定義 ConveyorObject 資料結構（id, x, y, length, angle, speed, name, color）
- [x] 在 FloorLayout 中新增 conveyors 陣列，並更新儲存/載入邏輯
- [x] SVG 渲染輸送帶物件（寬帶 + 滾輪動畫 + 方向筭頭 + 名稱標籤）
- [x] 工具列新增「新增輸送帶」按鈕，點擊後在畫布中央放置一條預設輸送帶
- [x] 輸送帶可拖曳移動（整體拖曳）
- [x] 輸送帶兩端有調整把手，可拖曳改變長度與角度
- [x] 點擊輸送帶可選取，右側面板顯示屬性（名稱、速度、長度、角度）
- [x] 輸送帶屬性面板可刪除輸送帶
- [x] 工站連接到輸送帶端點時，搶運速度自動採用輸送帶速度
- [x] 移除舊的「連線類型為輸送帶時的 ConveyorBelt 渲染」（改由獨立物件取代）

## 輸送帶端點吸附與連線標示
- [x] 拖曳輸送帶端點靠近工站（距離 < 30px）時自動吸附至工站中心，並顯示吸附提示（高亮工站）
- [x] ConveyorObject 新增 snapFrom/snapTo 欄位，記錄吸附的工站 id
- [x] 連線屬性面板當類型為「輸送帶」時，顯示「使用輸送帶：XXX（速度 Xm/min）」標示
- [x] 若畫布上有多條輸送帶，連線屬性面板提供下拉選單選擇使用哪條輸送帶，並自動套用其速度

## 輸送帶吸附工站修正（Bug Fix）
- [x] 診斷輸送帶端點拖曳吸附工站失效的原因（端點把手被工站節點這住）
- [x] 修正吸附邏輯：將端點把手移至最上層（工站節點之後），確保可點擊並正確吸附

## 輸送帶吸附側邊與自動連線（新增）
- [x] ConveyorObject 型別新增 snapFromPt / snapToPt（吸附點在工站上的相對座標 {rx, ry}）
- [x] 修改吸附邏輯：端點靠近工站時，吸附到工站邊緣最近點（非中心），記錄絕對座標
- [x] 工站拖曳時，已吸附的輸送帶端點跟隨工站側邊位置更新
- [x] 輸送帶兩端都吸附工站後，自動建立/更新 FloorConnection（類型=輸送帶，綁定該輸送帶）
- [x] 輸送帶端點離開工站（取消吸附）時，自動刪除對應的自動建立連線
- [x] 連線的距離計算改為：兩吸附點之間的直線距離（反映輸送帶實際路徑長度）
- [x] 畫布標簽顯示：吸附點在工站側邊用小圓點標示，連線從吸附點出發
- [x] 補強相關 Vitest 測試（吸附點距離計算、搬運時間計算）

## 連線路徑視覺化改進
- [x] makePath 新增 snapEdgeDir 函式：判斷吸附點在工站的哪個邊緣（上/下/左/右）
- [x] 自動連線從吸附點出發，貝茲曲線控制點沿邊緣法線方向延伸，路徑更自然
- [x] 到達端同樣根據吸附邊緣決定控制點方向，使路徑平滑進入工站側邊
- [x] 無吸附點的普通連線保持原有水平控制點行為（不影響既有功能）

## DXF 廠房底圖匯入（方案 A：dxf-parser + SVG）
- [x] 安裝 dxf-parser npm 套件
- [x] drizzle/schema.ts：simulation_scenarios 新增 backgroundSvg、backgroundLayers、backgroundOpacity、backgroundOffsetX/Y、backgroundScale、backgroundFileName 欄位
- [x] 執行資料庫遷移
- [x] server/db.ts：新增 updateScenarioBackground query helper
- [x] server/routers.ts：新增 simulation.updateBackground protectedProcedure
- [x] 前端：實作 parseDxfToSvg 函式（dxf-parser → LINE/ARC/CIRCLE/POLYLINE/SPLINE → SVG path）
- [x] 前端：配置模擬畫布 SVG 底圖渲染層（pointer-events:none）
- [x] 前端：工具列新增「匯入 DXF」按鈕，點擊後開啟上傳 Dialog（支援點擊選擇與拖曳上傳）
- [x] 前端：底圖透明度滑桿（0–100%）
- [x] 前端：底圖對齊模式（拖曳底圖對齊工站位置）
- [x] 前端：底圖縮放、偏移 X/Y 手動輸入
- [x] 前端：比例尺校正工具（點選底圖兩點 A/B → 輸入實際距離 → 自動更新 scalePxPerM）
- [x] 前端：底圖可清除（恢復空白畫布）
- [x] 前端：底圖設定儲存至資料庫（場景切換時自動載入）
- [x] 前端：圖層清單 UI，列出所有 DXF 圖層並可逐一顯示/隱藏，切換後即時更新底圖渲染
- [x] 撰寫 DXF 解析相關 Vitest 測試（server/dxf.test.ts，20 項：LINE/ARC/CIRCLE/POLYLINE/SPLINE 轉 SVG、容錯處理、viewBox 計算）— 總計 133 項測試全通過

## 登入機制簡化（移除 OAuth 依賴，改為純帳號密碼）
- [x] 後端：routers.ts 新增 auth.localLogin（帳號+密碼驗證 + 寫入 JWT session cookie）
- [x] 後端：routers.ts 新增 admin.createUser（管理員建立新帳號）
- [x] 後端：密碼使用 bcryptjs 雜湊儲存（users.passwordHash 欄位）
- [x] 後端：context.ts 透過 JWT cookie 直接解析 session，不依賴 Manus OAuth
- [x] 前端：LoginPage.tsx（帳號密碼表單，取代 OAuth 跳轉）
- [x] 前端：const.ts getLoginUrl() 改為回傳 /login，移除 Manus OAuth URL 建構
- [x] 前端：main.tsx 全域 unauthorized 錯誤改為重導向至 /login（非 OAuth portal）
- [x] 前端：useAuth.ts 預設 redirectPath 改為 /login（移除 getLoginUrl 依賴）
- [x] 前端：AdminUsers.tsx 管理員帳號管理頁面（新增/停用/重設密碼/角色）
- [x] 前端：App.tsx AuthGuard 未登入跳轉至 /login
- [x] 後端：cookies.ts 修正本機 HTTP 環境 cookie 設定（sameSite=lax，避免 sameSite=none+HTTP 衝突）
- [x] 新增初始管理員帳號建立腳本（seed-admin.mjs）
- [x] 更新 LOCAL_SETUP.md：說明初始管理員帳號建立方式
- [x] 全部 133 項 Vitest 測試通過

## 地端部署問題修正（全面簡化）
- [x] sdk.ts verifySession：appId 改為選填驗證，為空時填入 "local"，解決本地登入失敗問題
- [x] sdk.ts authenticateRequest：移除 OAuth 同步邏輯，DB 找不到用戶時直接拋 ForbiddenError
- [x] env.ts：ollamaBaseUrl 改為從 OLLAMA_BASE_URL 環境變數讀取，預設 http://localhost:11434
- [x] env.ts：ollamaModel 改為從 OLLAMA_MODEL 環境變數讀取，預設 llama3.2
- [x] routers.ts aiSuggest：加入 ollamaApiKey 空值保護，回傳友善錯誤訊息
- [x] AdminUsers.tsx：「OAuth 帳號」文字改為「外部登入帳號」
- [x] env.local.example：所有 Manus OAuth 欄位預設留空，新增 OLLAMA_BASE_URL/OLLAMA_MODEL 說明
- [x] 全部 133 項 Vitest 測試通過

## 平衡分析：工作時間設定與產能計算（新增）
- [x] 前端：BalanceAnalysis.tsx 新增「工作時間設定」區塊（每日工作時間 h/天、每月工作日數 天/月）
- [x] 前端：依據設定值即時計算日產能（件/日）與月產能（件/月）
- [x] 前端：在 KPI 卡片區新增「日產能」與「月產能」卡片
- [x] 前端：設定值儲存至 localStorage，頁面重整後保留
- [x] 前端：工作時間設定支援班制快速選擇（單班 8h、雙班 16h、三班 24h）
- [x] 平面圖模擬器：新增功能區標示（Zone Annotation）物件 — 拖曳繪製矩形區域、8色預設色票、透明度調整、名稱編輯、面積顯示、右側清單、刪除，儲存至 FloorLayout.zones
- [x] 平面圖模擬器：新增緩衝區（Buffer Zone）功能 — ZoneObject 擴充 isBuffer/maxWip/linkedWsIds/wipNote 欄位、WIP 積料速率估算（30分鐘模型）、SVG 進度條+警示邊框（ok/warn/alert 三級）、屬性面板 Buffer 開關+工站多選、KPI 面板 WIP 風險統計卡片
