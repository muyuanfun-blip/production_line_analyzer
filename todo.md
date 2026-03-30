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
