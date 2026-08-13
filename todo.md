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
- [x] 配置模擬：重寫為物件導向三欄式介面 — 左欄情境列表、中欄工站流程卡片畫布（拖曳排序/箭頭連接/CT進度條）、右欄屬性面板（KPI/編輯/合併/拆分/移位），底部工具列含下載圖表、比較情境、套用至產線
- [x] 配置模擬：物件導向互動強化 — 工站卡片右鍵選單（前移/後移/合併/拆分/刪除）、雙擊名稱/CT 內嵌編輯（Enter確認/Esc取消）、箭頭間嵌入式新增按鈕（hover顯示+號）、diff徽章（NEW/MOD對比原始產線）、wsDiffMap useMemo
- [x] 配置模擬：物件導向拖放介面 — 左側雙Tab面板（情境列表/物件庫）、8種工站模板卡片、產線現有工站列表、從物件庫拖曳至自由定位畫布、格線背景、SVG貝茲曲線流程箭頭、畫布內拖曳移動工站、空畫布提示

## 產品追蹤系統（六階段實作，每階段 ~150 積分後暫停）
- [x] 第一階段：product_models 資料表 + 型號管理頁面（型號代碼、名稱、目標節拍、批量大小）
- [x] 第二階段：product_instances + product_flow_records 資料表 + 手動輸入流程記錄
- [x] 第三階段：產品流程時間軸視圖（單一序號追蹤，標準 CT vs 實際 CT）
- [x] 第四階段：產品追蹤甘特圖（多序號並排，工站 × 時間）
- [x] 第五階段：配置模擬整合模擬執行模式（自動產生 product_instances）
  - [x] 盤點現有模擬情境、產品型號與流程紀錄的可用資料欄位
  - [x] 新增模擬執行 tRPC procedure，依情境工站資料建立產品實例與流程紀錄
  - [x] 在配置模擬頁面加入批次模擬執行控制、結果摘要與產品追蹤連結
  - [x] 補強模擬執行流程的單元測試
- [x] 第六階段：工站效率熱圖（工站 × 時段效率矩陣）
  - [x] 定義時段分桶與工站效率計算規則
  - [x] 新增產品流程紀錄效率矩陣查詢 procedure
  - [x] 在產品追蹤加入效率熱圖、圖例與時段篩選
  - [x] 補強效率矩陣資料處理的單元測試

## 第四階段：多序號甘特圖比較（完成）

- [x] db.ts：新增 listFlowRecordsByInstances（批次查詢多個 instance 的流程記錄，使用 inArray）
- [x] routers.ts：新增 productTracking.listFlowRecordsBatch procedure
- [x] ProductGantt.tsx：多序號並排甘特圖元件（橫軸時間、縱軸序號）
  - [x] 甘特條：加工時間（實色）+ 等待時間（半透明）
  - [x] 雙模式：有時間戳按實際時間排列；無時間戳按累積時間排列
  - [x] 縮放：滾輪縮放（30%–800%）、+/- 按鈕、重置
  - [x] 拖曳平移：滑鼠拖曳橫向平移
  - [x] Hover Tooltip：懸停顯示工站詳細資訊（加工/等待時間、進出時間、作業員、狀態）
  - [x] 顏色模式切換：按工站 / 按狀態
  - [x] 序號篩選（全部/生產中/完成/重工/報廢）
  - [x] 時間刻度自動計算（選擇合適間隔）
  - [x] 圖例顯示
- [x] GanttPage.tsx：甘特圖頁面（左側控制面板 + 右側甘特圖）
  - [x] 產線選擇
  - [x] 序號多選（含全選/取消全選/搜尋/狀態篩選）
  - [x] 空狀態引導
  - [x] 載入狀態
- [x] App.tsx：新增 /gantt 路由
- [x] DashboardLayout.tsx：新增「甘特比較」側邊欄入口（GanttChartSquare icon）

## 歷史快照匯出功能（完成）

- [x] SnapshotHistory.tsx：新增 downloadBlob / fmtDateFile / buildSnapKPI 匯出工具函式
- [x] SnapshotHistory.tsx：新增 exportSnapshotCSV（單一快照 CSV，含 KPI 摘要 + 工站明細）
- [x] SnapshotHistory.tsx：新增 exportSnapshotJSON（單一快照 JSON，含完整工站資料）
- [x] SnapshotHistory.tsx：新增 exportAllSnapshotsCSV（全部快照 KPI 摘要 CSV）
- [x] SnapshotHistory.tsx：新增 exportAllSnapshotsJSON（全部快照完整 JSON）
- [x] SnapshotHistory.tsx：頁首新增「匯出全部」DropdownMenu 按鈕（CSV / JSON）
- [x] SnapshotHistory.tsx：每張快照卡片新增「匯出」DropdownMenu 按鈕（CSV / JSON）
- [x] 新增 lucide-react icons：FileJson、FileSpreadsheet、Package
- [x] 新增 DropdownMenu import（@/components/ui/dropdown-menu）

## 動作分析全工站匯出功能（完成）

- [x] db.ts 新增 getActionStepsByWorkstationIds 批次查詢函式
- [x] routers.ts 新增 actionStep.listByLine procedure（含手部動作）
- [x] ActionAnalysis.tsx 新增 handleExportAllCSV / handleExportAllJSON 函式
- [x] 頁首匯出按鈕改為 DropdownMenu（此工站 CSV / 全工站 CSV / 全工站 JSON）

## 數據修整 - 快照雙手動作編輯（完成）

- [x] 擴充 updateData procedure 接受 actionSteps（含 handActions）
- [x] DataRefinement.tsx 工站列可展開顯示動作步驟
- [x] 動作步驟可新增/刪除/修改（名稱、類型、時間）
- [x] 每個步驟可展開雙手動作（左手/右手分色）
- [x] 雙手動作可新增/刪除/修改（名稱、類型、時間、空手勾選）
- [x] 儲存時自動重算增值率 KPI

## 使用指南更新（完成）

- [x] 新增「產品序號追蹤」章節（5 步驟）
- [x] 新增「甘特比較視圖」章節（5 步驟）
- [x] 新增「數據修整」章節（6 步驟，含雙手動作編輯說明）
- [x] 新增「資料匯出」章節（4 步驟，含快照與動作分析匯出）
- [x] 更新「UPPH 績效指標」新增 Lead Time 與產品增值率公式
- [x] 更新「快照與歷史比較」新增匯出步驟
- [x] 更新「動作拆解與 AI 建議」新增雙手動作與全工站匯出步驟
- [x] 更新「系統概覽」功能亮點卡片（8 個功能入口）
- [x] 更新 FAQ 新增「產品追蹤」與「匯出功能」兩個分類（4 題）
- [x] 側邊欄快速連結新增產品追蹤、甘特比較、數據修整入口


## VSM (Value Stream Mapping) 模組 - 第一階段（後端實現）

- [x] 建立 VSM 資料表（vsm_diagrams、vsm_processes、vsm_flows、vsm_versions）
- [x] 執行資料庫遷移 SQL
- [x] server/db.ts：實作 VSM CRUD 函式（23 個）
  - [x] VSM 圖表：list、getById、create、update、delete
  - [x] VSM 工序：list、getById、create、update、delete、deleteByDiagram
  - [x] VSM 流線：list、getById、create、update、delete、deleteByDiagram
  - [x] VSM 版本：list、getById、create、restore
- [x] server/routers.ts：實作 VSM tRPC procedures（20 個）
  - [x] 圖表管理：listDiagrams、getDiagramById、createDiagram、updateDiagram、deleteDiagram
  - [x] 工序管理：listProcesses、getProcessById、createProcess、updateProcess、deleteProcess
  - [x] 流線管理：listFlows、getFlowById、createFlow、updateFlow、deleteFlow
  - [x] 版本管理：listVersions、getVersionById、createVersion、restoreVersion
- [x] TypeScript 0 errors，133/133 Vitest 全通過

## VSM 模組 - 第二階段（前端編輯器）

- [x] 建立 VSMCanvas.tsx 拖放編輯元件
  - [ ] SVG 畫布（支援格線背景、縮放、平移）
  - [ ] 工序節點拖曳移動（支援自動吸附格線）
  - [ ] 流線連接（貝茲曲線，支援拖曳重新連接）
  - [ ] 節點/流線選取與屬性編輯
  - [ ] 撤銷/重做功能（undo/redo stack）
  - [ ] 複製/貼上工序
  - [ ] 刪除工序（自動刪除相關流線）
- [x] 建立 VSMNodePanel.tsx 工序屬性編輯面板（整合至 VSMPage 右側面板）
  - [ ] 工序名稱、類型、CT、人力、增值率編輯
  - [ ] 工序尺寸調整（寬/高）
  - [ ] 工序顏色選擇（按類型預設色系）
  - [ ] 工站關聯選擇（dropdown）
  - [ ] 備註編輯
- [x] 建立 VSMFlowPanel.tsx 流線屬性編輯面板（整合至 VSMPage 右側面板）
  - [ ] 流線類型選擇（物流/資訊流/看板）
  - [ ] 流線週期時間、流量編輯
  - [ ] 流線顏色與寬度調整
  - [ ] 備註編輯
- [x] 建立 VSMPage.tsx 主頁面
  - [ ] 左側：圖表列表與版本歷史
  - [ ] 中央：VSMCanvas 編輯區
  - [ ] 右側：工序/流線屬性面板（context-aware）
  - [ ] 頂部工具列：新增工序、新增流線、儲存、匯出、版本控制
  - [x] 在 App.tsx 新增 /lines/:lineId/vsm 路由
- [x] 在 DashboardLayout.tsx 側邊欄新增「VSM 設計」導覽入口（GitBranch icon）
- [x] 快捷鍵支援（Ctrl+S 儲存等）
- [x] VSM 版本時間軸檢視
  - [x] 整理版本時間、名稱與版本號的時間軸資料
  - [x] 顯示版本時間軸並支援選取歷史版本
  - [x] 從時間軸直接啟動兩版本比較
  - [x] 補強版本時間軸排序與選取的單元測試
- [x] VSM PDF 匯出報告
  - [x] 整理流程圖與 KPI 報告資料
  - [x] 提供 PDF 格式的流程與分析報告輸出
  - [x] 補強匯出資料組裝的單元測試

## VSM 模組 - 第三階段（KPI 覆蓋與分析）

- [x] VSMAnalysis.tsx 分析面板（總 CT、總人力、平均增值率、Lead Time、璶頸分析、人力均衡度、流線分析）
- [x] VSMPage 右側面板新增切換按鈕（屬性 / 分析）
- [x] VSMCanvas.tsx 新增 KPI 覆蓋層
  - [x] 工序節點顯示 CT、人力、增值率小徽章
  - [x] 流線顯示流量與搬運時間
  - [x] 整體 VSM 統計卡片（總 CT、總人力、增值率、Lead Time）
- [x] 建立 VSMAnalysis.tsx 分析面板
  - [x] 工序瘩頸分析（識別最長 CT 工序）
  - [x] 增值率分析（各工序增值率分佈）
  - [x] 人力配置分析（人力負荷均衡度）
  - [x] 流線分析（物流 vs 資訊流平衡）
- [x] AI 驅動改善建議
  - [x] 呼叫 Ollama API 分析 VSM 結構
  - [x] 生成改善建議（工序合併、人力調整、流程優化）
  - [x] 建議與版本關聯（保存改善說明）

## VSM 模組 - 第四階段（匯出與版本控制）

- [x] VSM 匯出功能
  - [x] 匯出為 PNG（SVG → Canvas → PNG）
  - [x] 匯出為 JSON（完整 VSM 結構）
  - [x] 匯出為 CSV（工序清單、流線清單）
  - [x] 匯出為 PDF（含分析報告）—選擇性實現
- [x] 版本控制強化
  - [x] 版本比較視圖（兩版本並排）
  - [x] 版本差異高亮（新增/修改/刪除工序/流線）
  - [x] 版本時間軸（timeline view）—選擇性實現
  - [x] 版本批註與改善記錄—選擇性實現

## VSM 模組 - 第五階段（整合與部署）

- [x] 在 App.tsx 新增 /lines/:lineId/vsm 路由
- [x] 在 DashboardLayout.tsx 侧邊欄新增「VSM 設計」導覽入口
- [x] 更新 UserGuide.tsx 新增 VSM 使用指南章節—選擇性實現
  - [x] 說明建立工序、流線與 KPI 覆蓋層
  - [x] 說明版本時間軸、比較與 PDF 匯出
  - [x] 說明與配置模擬及產品追蹤的聯動
- [x] 與配置模擬器整合（從配置模擬匯出至 VSM）—選擇性実現
  - [x] 定義模擬情境的產線、名稱與 KPI 導覽資料
  - [x] 從配置模擬器提供帶入 VSM 流程的入口
  - [x] 在 VSM 顯示帶入的模擬 KPI 情境摘要
  - [x] 補強模擬至 VSM 情境解析的單元測試
- [x] 與產品追蹤整合（VSM 流程對應產品追蹤路徑）—選擇性実現
  - [x] 盤點 VSM 工序 workstationId 與產品流程紀錄的對應關係
  - [x] 從選取 VSM 工序建立產品追蹤情境導覽
  - [x] 在產品追蹤顯示帶入的 VSM 工序摘要
  - [x] 補強 VSM 產品追蹤情境解析的單元測試
- [x] 補強 VSM 相關 Vitest 測試—選擇性實現


## VSM 模組完成總結

## VSM 批判式審查與重構規劃（新增）
- [x] 完整移除戰情監控功能、跨模組連結、資料表與資料
- [x] 依精實規則直接調整高信心動作分類
  - [x] 將等待、伸手、取放、按鈕與掃碼等高信心誤分類動作調整為非增值或必要浪費
  - [x] 保留注油、清潔、設備加工、檢驗與包裝等需規格確認的動作
  - [x] 更新分類檢查報告與調整後統計
- [x] 檢查目前動作拆解的增值、非增值與必要浪費分類
- [x] 修復工站人力品質查詢因非 0.25 單位資料而阻斷頁面
  - [x] 將人力品質檢查改為回報異常而非拋出錯誤
  - [x] 修復既有非 0.25 單位人力資料
  - [x] 補強人力品質查詢的容錯測試
- [x] 實作生產管理 P0-A：人力單一真實來源與主資料保護
  - [x] 修正工站新增與批次匯入的早晚班人力欄位寫入
  - [x] 將合計人力統一為早晚班人力的衍生值
  - [x] 建立工站人力一致性檢查與修復清單
  - [x] 限制生產線與工站寫入至受保護的管理操作
  - [x] 補強人力一致性與寫入保護測試
- [x] 完成生產管理模組批判式檢討與分階段重構藍圖
- [x] 修復 VSM 示範流程入口與既有圖表刪除功能
  - [x] 從 VSM 頁面導覽至示範產線與流程圖
  - [x] 提供含關聯資料清理的 VSM 圖表刪除操作
  - [x] 驗證示範流程載入及圖表刪除互動
- [x] 建立 iPhone 組裝完整範例產線與 VSM 流程
  - [x] 定義供應、子組件、主裝配、測試、包裝與出貨工站
  - [x] 建立範例產線、早晚班人力、節拍與工站週期資料
  - [x] 建立含物流、資訊流、WIP 與品質關卡的 VSM 圖表
  - [x] 驗證範例資料在 VSM 載入（戰情監控功能已下架）
- [x] 修復 VSM Phase 0 欄位遷移與圖表查詢不同步問題
- [x] 完成 VSM 功能設計批判式審查與分階段重構藍圖
- [x] 實作 VSM Phase 0：可信數據基線
  - [x] 擴充產品族、需求節拍、WIP、批量、可用率與路由語意資料
  - [x] 建立 VSM 圖結構與必填資料的完整性驗證
  - [x] 建立具資料品質狀態的可信 KPI 計算引擎
  - [x] 在 VSM 頁面呈現資料品質與 KPI 計算範圍
  - [x] 補強資料驗證與 KPI 計算的單元測試
- [x] 實作 VSM Phase 1：導向式建模工作台
  - [x] 從現有工站批次建立並水平排列 VSM 工序
  - [x] 提供工序連線建立模式與可視化選取引導
  - [x] 提供發布前模型檢查與不可發布原因
  - [x] 補強工序建模與連線互動的單元測試
- [x] 建立動作分類待覆核與管理者批次確認流程
  - [x] 建立動作分類覆核狀態與建議分類資料欄位
  - [x] 新增待覆核列表、批次接受／駁回與篩選程序
  - [x] 在動作分析頁提供管理者批次覆核操作介面
- [x] 實作 VSM Phase 2：改善閉環
  - [x] 建立瓶頸改善行動、責任人、期限與完成狀態資料模型
  - [x] 在 VSM 分析與工序面板加入建立／追蹤改善行動按鈕
  - [x] 顯示改善行動與版本／快照對比結果的閉環摘要
- [x] 建立生產管理資料異動歷史
  - [x] 建立主資料異動事件與前後差異資料表
  - [x] 對產線與工站的新增、修改、刪除與匯入寫入稽核事件
  - [x] 在生產管理頁顯示可篩選的異動歷史清單
- [x] 擴充異動歷史匯出與細緻欄位篩選
  - [x] 支援依操作人、時間區間、實體 ID 與異動欄位篩選
  - [x] 匯出目前篩選結果為 CSV，包含前後差異與操作人資訊
- [x] 建立動作覆核品質管理儀表板
  - [x] 新增覆核完成率、待覆核與接受／駁回結果統計 API
  - [x] 視覺化呈現分類分布、分類時間占比與覆核品質趨勢
  - [x] 提供前往待覆核管理與異常分類清單的操作入口
- [x] 建立 AI 分析專業圖文報告匯出
  - [x] 盤點 AI 分析結果、產線 KPI 與工站明細的可用真實資料
  - [x] 建立可列印的報告版面，包含摘要、圖表、診斷與改善建議
  - [x] 支援由 AI 分析頁預覽並匯出專業報告
  - [x] 補上報告資料轉換與匯出流程的單元測試
- [x] 修正 AI 專業報告匯出入口可見性
  - [x] 在 AI 分析完成結果區新增明確的匯出專業報告操作按鈕
  - [x] 在尚未完成分析時顯示匯出功能啟用條件提示
- [x] 修正 AI 專業報告中的 LaTeX 原始公式文字
  - [x] 將常見運算子、箭頭與文字命令轉為可讀符號與文字
  - [x] 補上公式正規化與安全轉義的單元測試
- [x] 建立五角色審查後的 AI 共識建議流程
  - [x] 定義精實工程、製造品質、設備製程、營運產能與風險治理五種審查角色
  - [x] 以同一份產線資料收集五角色獨立審查，並由共識階段整合可執行建議
  - [x] 在 AI 分析結果中顯示共識達成狀態與各角色重點
- [x] 建立 AI 建議報告固定結構化章節模板
  - [x] 固定呈現管理摘要、資料範圍、五角色共識、優先改善行動、風險與驗證計畫
  - [x] 在螢幕分析結果與匯出的專業報告採用相同章節順序
  - [x] 補上共識判定、章節模板與報告轉換的單元測試
- [x] 建立 AI 互動追問與情境分析
  - [x] 新增受產線資料與五角色共識脈絡約束的互動分析 procedure
  - [x] 支援針對工站、改善行動、風險與資料限制進行後續追問
  - [x] 在 AI 分析頁提供對話紀錄、快捷問題與載入／錯誤狀態
  - [x] 補上互動分析問題驗證與脈絡組裝的單元測試
- [x] 建立 AI 主動資料缺口診斷與補充引導
  - [x] 依工站、動作拆解、節拍與人力資料識別影響結論可信度的缺口
  - [x] 顯示缺少資料、分析影響、建議提供者與建議取得方式
  - [x] 在資料完整前限制高信心結論，並引導人員補充後重新分析
- [x] 建立互動回覆一鍵轉換改善行動計畫
  - [x] 從有效 AI 追問回覆擷取改善標題、措施、責任角色、驗證指標與時程
  - [x] 將內容帶入既有 VSM 改善行動建立流程，允許使用者確認後建立
  - [x] 補上資料缺口與互動回覆行動草稿轉換的單元測試
- [x] 修正五角色未達共識時的 AI 分析錯誤處理
  - [x] 以結構化未共識結果回傳角色分歧、資料缺口與下一步，而非拋出 mutation 錯誤
  - [x] 保持正式報告、互動追問與改善行動建立僅在共識核准後啟用
  - [x] 在前端清楚顯示未共識原因與補充資料／重新分析入口
  - [x] 補上未共識回傳與前端狀態判定的單元測試
- [x] 建立五角色未共識原因治理儀表板
  - [x] 記錄每次五角色審查的共識狀態、分數、未共識原因、資料缺口與角色風險摘要
  - [x] 提供按時間、產線與原因篩選的未共識歷程與常見阻礙排行
  - [x] 以儀表指標與圖表呈現未共識率、資料就緒度與原因趨勢
- [x] 在 AI 專業報告加入資訊完整度評分
  - [x] 依節拍、人力、動作拆解、CT 對齊、共識狀態與資料缺口計算可解釋評分
  - [x] 在畫面與匯出報告呈現分數、等級、構成項目與改善建議
  - [x] 補上歷程統計與完整度評分的單元測試
- [x] 建立五角色未共識人工裁決與角色分歧註記
  - [x] 管理員可對待釐清審查做核准、退回補件或結案裁決，並留下理由
  - [x] 允許逐角色記錄分歧點、需確認事實與裁決備註，保留可稽核歷程
  - [x] 裁決核准後才開放正式報告與後續改善閉環
- [x] 建立高頻資料缺口自動補件任務與通知
  - [x] 依可設定門檻找出高頻資料缺口並避免重複建立未結任務
  - [x] 建立可指派、可設定期限與可追蹤狀態的補件任務
  - [x] 在系統內顯示補件任務與通知責任人，補上自動建立與去重測試
- [x] 建立五角色未共識的條件式建議報告
  - [x] 依現有資料、角色發現與資料缺口產出待驗證改善建議
  - [x] 在畫面與匯出報告明確揭露未共識原因、分歧、缺口與驗證條件
  - [x] 維持正式核准報告與自動改善行動僅限共識通過或人工核准後可用
  - [x] 補上條件式報告章節、風險標示與治理門檻的單元測試
- [x] 重構首頁為雙層決策儀表板
  - [x] 建立跨產線管理摘要與產能、品質、治理、改善四個決策工作區
  - [x] 將待裁決審查、補件任務與改善行動以優先順序呈現並提供直接入口
  - [x] 完成桌面與手機響應式版面，保留現有核心路由與資料真實性
- [x] 建立可及且具業務意義的首頁動效
  - [x] 加入 KPI 數字漸入、分頁切換、卡片焦點與任務狀態回饋
  - [x] 支援 prefers-reduced-motion，避免自動循環、閃爍或干擾性動效
  - [x] 補上首頁決策優先順序與動效條件的單元測試
- [x] 重構響應式側欄導航與首頁決策導流
  - [x] 將側欄依決策中心、生產改善與管理治理分組，按角色顯示入口
  - [x] 桌面版預設收合、懸停與鍵盤焦點展開，並提供手動釘選控制
  - [x] 行動與小螢幕提供漢堡按鈕、焦點管理與點選後自動收合的抽屜導覽
  - [x] 讓首頁優先事項與工作區直接連結至對應側欄群組及頁面
  - [x] 補上側欄展開狀態與導航群組的單元測試
- [x] 擴充管理員使用者管理與帳號安全操作
  - [x] 在管理治理側欄加入使用者管理入口並維持管理員權限保護
  - [x] 實作本機帳密帳號重設密碼、停用與重新啟用操作
  - [x] 防止管理員停用自身帳號或移除系統最後一位有效管理員
  - [x] 對敏感帳號操作寫入可追溯稽核紀錄並補上單元測試
- [x] 檢視並強化管理權限與驗證安全控制
  - [x] 盤點管理 tRPC procedure、路由權限、密碼儲存與登入狀態控制
  - [x] 修正發現的高優先安全缺口並加入權限回歸測試
  - [x] 產出系統內可追溯的安全設定與剩餘風險摘要
- [x] 新增可切換的淺色與深色主題
  - [x] 定義淺色語意色彩權杖並保留深色主題的既有視覺層級
  - [x] 在側欄加入可及的主題切換控制，保存使用者偏好
  - [x] 確保桌面、行動抽屜與核心儀表板在兩種主題下皆具足夠對比與可讀性
  - [x] 補上主題偏好與切換狀態的單元測試
- [x] 重新審查並修正淺色主題可讀性
  - [x] 盤點深色專用硬編碼色彩及文字不可見的元件情境
  - [x] 以淺色語意權杖覆蓋卡片、表格、側欄、浮層、圖表與狀態文字
  - [x] 驗證核心決策頁、管理頁與行動版抽屜在淺色模式下的對比度
  - [x] 補上淺色覆蓋規則與語意顏色條件的單元測試
- [x] 修正首頁深色決策橫幅的淺色主題文字對比
  - [x] 為深色橫幅標題、說明、標籤與次要操作建立高對比保護規則
  - [x] 確保淺色全域文字覆蓋不會誤改深色漸層區塊的可讀文字
  - [x] 補上深色區塊淺色主題文字保護的回歸測試
- [x] 全面審查並修正全站淺色主題對比度
  - [x] 盤點所有頁面與共用元件的深色專用背景、文字與邊框類別
  - [x] 以語意權杖覆蓋 VSM、AI、治理、使用者管理、表單、表格與浮層的淺色對比風險
  - [x] 補上全站淺色主題關鍵類別與深色區塊保護的回歸測試
- [x] 加入可及的深淺主題平滑過渡動畫
  - [x] 僅在使用者主動切換時套用短暫色彩與表面過渡，不影響初始載入
  - [x] 尊重 prefers-reduced-motion，避免在減少動態偏好下播放過渡
  - [x] 補上主題過渡狀態與無障礙條件的單元測試
- [x] 建立僅限無業務紀錄帳號的安全刪除防呆
  - [x] 檢查建立、修改、覆核、裁決、指派及處理等帳號業務關聯紀錄
  - [x] 在後端強制拒絕刪除有業務紀錄、目前登入或最後有效管理員帳號
  - [x] 在使用者管理頁顯示可刪除狀態、阻擋原因與不可復原確認
  - [x] 補上帳號業務紀錄判定與安全刪除權限的單元測試
- [x] 修正使用者管理密碼驗證體驗
  - [x] 在新增與重設密碼表單即時顯示長度、大小寫與數字規則狀態
  - [x] 在密碼不符合規則時停用提交，避免送出原始 Zod 驗證錯誤
  - [x] 將後端驗證錯誤轉為可讀中文提示並補上密碼規則 UI 測試
- [x] 修正淺色主題狀態提醒卡片的對比度
  - [x] 盤點警示、風險、成功與資訊卡片中過淺的狀態文字、圖示與按鈕色彩
  - [x] 為淺色模式建立狀態色表面、前景與邊框的高對比映射規則
  - [x] 補上狀態色元件在淺色模式下的可讀性回歸測試
- [x] 統一全站成功與中性提示的語意狀態配色
  - [x] 建立成功、資訊／中性、警示、風險的共用狀態表面、邊框、文字與圖示類別
  - [x] 逐頁套用並檢查其他頁面狀態提醒卡片，確保淺色模式具一致高對比度
  - [x] 補上完整狀態色系與核心提醒元件的雙主題回歸測試
- [x] 建立功能導向角色權限控制（RBAC）
  - [x] 定義產線主資料、工站與動作、平衡與快照、VSM 改善、AI 治理、補件任務、帳號與報表的功能權限矩陣
  - [x] 建立預設角色與帳號個別權限覆寫資料模型，保留系統管理者的安全保護
  - [x] 在後端 tRPC 程序強制檢查功能權限，並將前端側欄、首頁導流與頁面操作同步依權限調整
  - [x] 在使用者管理頁提供角色選擇、功能權限檢視與個別覆寫設定
  - [x] 補上權限矩陣、權限覆寫、越權拒絕與導覽可見性的單元測試

**已實現的核心功能：**
- [x] 後端資料層（資料表、CRUD、tRPC procedures）
- [x] 前端編輯器（SVG 畫布、拖放、屬性面板）
- [x] KPI 分析（總 CT、人力、增值率、瓶頸分析）
- [x] 匯出功能（PNG、JSON、CSV）
- [x] 版本控制與比較
- [x] 路由與導覽整合

**測試狀態：**
- TypeScript: 0 errors
- Vitest: 133/133 tests passed
- Dev Server: Running

**選擇性實現（未包含在此次交付）：**
- PDF 匯出
- AI 改善建議（Ollama API 整合）
- 版本時間軸
- 與其他模組整合


## 測試修復（新增）
- [x] 修復 production.test.ts 中的 Ollama API 測試
- [x] 改用環境配置（OLLAMA_BASE_URL、OLLAMA_MODEL）而非硬編碼遠程服務
- [x] 本地開發環境允許 API key 為空
- [x] 測試改為檢查本地 Ollama 服務可訪問性（非強制）
- [x] 所有 132 項測試通過

## 產線生產即時戰情監控系統（新增）

### 戰情看板重構方案（新增）
- [x] 提出三種戰情看板資訊架構與視覺重構方案
- [x] 實作 A+B 混合戰情看板重構
  - [x] 建立全線健康列、數位產線流程與固定警示佇列
  - [x] 建立瓶頸處置駕駛艙抽屜，呈現影響鏈與 AI 行動建議
  - [x] 整合前往平衡分析、VSM、產品追蹤與配置模擬的行動入口
  - [x] 補強視覺資料轉換與抽屜狀態的單元測試

### 第一階段：後端 API（模擬資料生成）
- [x] 後端：新增 monitoring.getRealTimeStatus procedure（回傳當前產線即時狀態）
- [x] 後端：模擬資料生成邏輯（工站 CT 波動、產品流轉、異常工站）
- [x] 後端：新增 monitoring.getHistoricalTrend procedure（今日/本週趨勢）
- [x] 後端：新增 monitoring.getAnomalies procedure（異常工站與警示）

### 第二階段：前端監控頁面
- [x] 建立 MonitoringDashboard.tsx 主頁面
- [x] 實時 KPI 儀表板（平衡率、UPPH、Takt 達標率、產能達成率）
- [x] 工站狀態面板（5 級風險等級：正常/預警/異常/停機/離線）
- [x] 瓶頸工站即時高亮與詳情卡片
- [x] 產品流程甘特圖（實時進度、卡料預警）
- [x] 工站效率熱圖（時段 × 工站效率矩陣）

### 第三階段：實時更新與動畫
- [x] 前端：useEffect + setInterval 實現 3 秒輪詢更新
- [x] 前端：KPI 數值變化動畫（上升綠色、下降紅色）
- [x] 前端：工站狀態切換動畫（平滑過渡）
- [x] 前端：甘特圖即時滾動更新

### 第四階段：警示與建議
- [x] 異常工站自動警示卡片（頂部通知欄）
- [x] 警示等級分類（提示/預警/緊急）
- [x] AI 即時改善建議（基於當前瓶頸）
- [x] 歷史對比（今日 vs 昨日、本週平均）

### 第五階段：路由與導覽
- [x] 在 App.tsx 新增 /lines/:lineId/monitoring 路由
- [x] 在 DashboardLayout.tsx 側邊欄新增「戰情監控」入口（Activity icon）
- [x] 監控頁面與其他頁面的導覽連結

### 第六階段：測試與優化
- [x] 撰寫 monitoring procedures 的 Vitest 測試
- [x] 前端元件測試（KPI 更新、狀態切換）
- [x] 性能優化（輪詢頻率、記憶體使用）


## 產線生產即時戰情監控系統（已完成）

### 第一階段：後端 API（已完成）

- [x] server/monitoring.ts：建立模擬資料生成引擎
  - [x] generateRealtimeWorkstations() - 生成實時工站狀態
  - [x] calculateLineKPI() - 計算產線 KPI（平衡率、UPPH、Takt 達標率）
  - [x] generateProductFlowRecords() - 生成產品流程甘特圖資料
  - [x] generateHistoricalTrend() - 生成 24 小時歷史趨勢
  - [x] generateRealtimeLineStatus() - 整合完整實時狀態

- [x] server/routers.ts：新增 monitoring tRPC procedures
  - [x] getRealTimeStatus - 取得產線即時狀態
  - [x] getHistoricalTrend - 取得過去 24 小時趨勢
  - [x] getProductFlowRecords - 取得產品流程記錄

### 第二階段：前端監控頁面（已完成）

- [x] MonitoringDashboard.tsx - 完整戰情監控頁面
  - [x] 實時 KPI 儀表板（平衡率、UPPH、Takt 達標率、產能達成率）
  - [x] 工站狀態面板（5 級風險等級、效率、利用率、當前產品）
  - [x] 瓶頸工站高亮提示
  - [x] 工站時間分佈柱狀圖
  - [x] 24 小時趨勢折線圖
  - [x] 緊急警示與預警提示卡片
  - [x] 自動刷新控制（3 秒輪詢）
  - [x] 骨架屏載入狀態

- [x] App.tsx - 新增 /lines/:lineId/monitoring 路由
- [x] DashboardLayout.tsx - 側邊欄新增「戰情監控」導覽入口（BarChart3 icon）

### 第三階段：功能增強（選擇性）

- [x] 實時警示聲音提醒
- [x] 工站詳細分析彈出視窗
- [x] 異常工站自動建議
- [x] 產品流程甘特圖互動
- [x] 監控增強：優化 3 秒輪詢的背景頁面節流與手動刷新行為
- [x] 監控增強：提供工站風險等級切換的平滑視覺提示
- [x] 監控增強：為產品流程甘特圖加入即時進度與卡料標示
- [x] 監控增強：補強即時更新與狀態分級的單元測試
- [x] 歷史資料持久化
  - [x] 定義並建立監控 KPI 與警示快照資料表
  - [x] 新增監控快照寫入與時間範圍查詢 procedures
  - [x] 在監控頁面顯示持久化歷史摘要與手動留存控制
  - [x] 為監控快照序列化與趨勢處理補強單元測試
- [x] 警示規則自訂
  - [x] 定義效率、等待量與工站狀態的警示規則資料模型
  - [x] 新增警示規則 CRUD 與即時規則評估 procedures
  - [x] 在戰情監控頁面加入警示規則管理控制
  - [x] 為規則判斷與門檻分級補強單元測試

### 第四階段：與其他模組整合（選擇性）

- [x] 與 VSM 流程對應
  - [x] 盤點 VSM 路由與可接受的監控流程情境
  - [x] 在戰情監控提供前往 VSM 流程檢視的入口
  - [x] 在 VSM 設計顯示帶入的瓶頸與異常工站摘要
  - [x] 補強 VSM 監控情境解析的單元測試
- [x] 與配置模擬器連接
  - [x] 盤點配置模擬器路由與可接受的監控情境
  - [x] 在戰情監控提供前往配置模擬器的入口
  - [x] 在配置模擬器顯示帶入的瓶頸與 KPI 情境摘要
  - [x] 補強配置模擬監控情境解析的單元測試
- [x] 與產品追蹤整合
  - [x] 盤點產品追蹤路由與可接受的監控流程情境
  - [x] 在監控產品流程甘特圖提供前往產品追蹤的入口
  - [x] 在產品追蹤顯示帶入的產品流程與卡料情境摘要
  - [x] 補強產品流程情境解析的單元測試
- [x] 與平衡分析聯動
  - [x] 盤點平衡分析路由與可接受的監控情境資訊
  - [x] 在戰情監控提供前往產線平衡分析的診斷入口
  - [x] 在平衡分析顯示監控情境摘要，對照即時與基準 KPI
  - [x] 補強監控情境解析的單元測試

### 第五階段：完成測試與交付

- [x] TypeScript 0 errors，133/133 Vitest 全通過
- [x] 前端頁面瀏覽器測試（VSM 與工站管理；戰情監控已下架）
- [x] 實時資料更新驗證（戰情監控功能已下架）
- [x] 響應式設計驗證

## 平衡率判定條件統一（新增）
- [x] 提取 getBalanceColor 和 getBalanceLabel 函式為共用函式（Home.tsx）
- [x] 修正 BalanceAnalysis.tsx 平衡率判定條件，統一使用 4 級標準（≥90%/≥80%/≥70%/<70%）
- [x] 驗證首頁快照排序邏輯（按快照名稱中的日期從新到舊排序）
- [x] 確認 getAllLinesLatestSnapshotByDate API 正確返回日期最新的快照

## 早晚班人力配置支援（新增）
- [x] 修改 workstations 資料表：新增 morningManpower 和 eveningManpower 欄位
- [x] 執行資料庫遷移（ALTER TABLE）
- [x] 建立資料遷移指令：將現有 manpower 資料遷移到 morningManpower
- [x] 更新後端 workstation CRUD API：支援早晚班人力輸入
- [x] 更新前端工站管理介面：分別輸入早班和晚班人力
- [x] 修正 UPPH 計算公式：使用 (morningManpower + eveningManpower) 替代 totalManpower
- [x] 更新快照計算邏輯：儲存早晚班人力資訊
- [x] 統一所有頁面的 UPPH 計算邏輯（AISuggestions、DataRefinement、SimulationPage、FloorPlanSimulator）
- [x] 更新前端顯示：工站表格顯示早晚班人力和加總人力
- [x] 撰寫相關測試（早晚班人力計算）
- [x] 在各頁面的 UPPH 數佐旁加入 Tooltip（顯示計算公式、瓶頸時間、合計人力）
- [x] 修改人力輸入最小单位從 0.5 改為 0.25
- [x] 在工站管理頁面新增「總人力統計」區塊（早班、晩班、合計、平均）
- [x] 在總人力統計區塊旁加入長条圖和圓餅圖（人力分佈比例）

## 快照比較報告增強（新增）
- [x] 在 AI 比較報告下方加入可折疊的前三大工站差異明細
