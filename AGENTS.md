# AGENTS.md — 生產工站分析系統 Agent 規則

## 積分暫停規則（Credit Pause Rule）

**每個實作階段消耗約 150 積分時，必須暫停並向使用者回報，等待使用者明確指示「繼續」後才可進行下一階段。**

暫停時需回報：
1. 本階段已完成的功能摘要
2. 下一階段的預計實作內容
3. 明確詢問使用者是否繼續

---

## 產品追蹤系統實作計畫

依以下六個階段依序實作，每階段完成後暫停等待確認：

| 階段 | 功能模組 | 狀態 |
|------|----------|------|
| 1 | `product_models` 資料表 + 型號管理頁面 | 待實作 |
| 2 | `product_instances` + `product_flow_records` 資料表 + 手動輸入流程記錄 | 待實作 |
| 3 | 產品流程時間軸視圖（單一序號追蹤） | 待實作 |
| 4 | 產品追蹤甘特圖（多序號並排） | 待實作 |
| 5 | 配置模擬整合模擬執行模式 | 待實作 |
| 6 | 工站效率熱圖 | 待實作 |

---

## 資料架構設計

### 整體邏輯

```
產品型號（product_models）
    └── 綁定產線（production_lines）
            └── 工站序列（workstations）
                    └── 產品個體（product_instances）
                            └── 工站流程記錄（product_flow_records）
```

### product_models（產品型號）
- `id`, `productionLineId`, `modelCode`, `modelName`
- `targetCycleTime`（此型號的目標節拍，覆蓋產線預設）
- `batchSize`（標準批量大小）
- `description`

### product_instances（產品個體）
- `id`, `serialNumber`（如 SN-20260502-001）
- `productModelId`, `productionLineId`
- `status`：`in_progress` / `completed` / `rework` / `scrapped`
- `startedAt`, `completedAt`, `totalLeadTime`

### product_flow_records（工站流程記錄）
- `id`, `productInstanceId`, `workstationId`, `workstationName`
- `sequenceOrder`, `enteredAt`, `exitedAt`
- `actualCycleTime`, `standardCycleTime`, `waitTime`
- `status`：`normal` / `rework` / `waiting` / `skipped`
- `operatorId`（可選）, `notes`

---

## 專案通用規則

- 所有靜態資源（圖片/影片）必須上傳至 S3，不可放在 `client/public/` 或 `client/src/assets/`
- 資料庫 schema 變更必須先在 `drizzle/schema.ts` 修改，執行 `pnpm drizzle-kit generate` 產生 migration SQL，再透過 `webdev_execute_sql` 套用
- 所有後端邏輯必須在 tRPC procedures 中實作，禁止在前端直接操作資料庫
- TypeScript 0 errors 與 Vitest 全通過是每個 Checkpoint 的必要條件
