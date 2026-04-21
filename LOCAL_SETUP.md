# 生產工站分析系統 — 本地部署指南

## 系統需求

| 工具 | 最低版本 | 說明 |
|------|---------|------|
| Node.js | 18.x 以上 | 建議使用 LTS 版本（20.x） |
| pnpm | 8.x 以上 | `npm install -g pnpm` |
| MySQL | 8.0 以上 | 或使用 Docker（見下方） |

---

## 快速啟動（5 步驟）

### 步驟 1：安裝依賴

```bash
pnpm install
```

### 步驟 2：設定環境變數

複製範本並編輯：

```bash
cp env.local.example .env
```

用文字編輯器開啟 `.env`，至少填入以下必填項目：

```env
DATABASE_URL=mysql://root:password@localhost:3306/production_line_db
JWT_SECRET=請填入任意隨機字串（建議32字元以上）
```

> 其他選填項目請參考下方「環境變數說明」。

### 步驟 3：建立資料庫

**方案 A：使用 Docker（推薦，最簡單）**

```bash
docker run -d \
  --name prod-line-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=production_line_db \
  -p 3306:3306 \
  mysql:8.0
```

**方案 B：使用本機 MySQL**

```sql
CREATE DATABASE production_line_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 步驟 4：執行資料庫遷移

**方法一：使用 drizzle-kit（推薦）**

```bash
pnpm drizzle-kit migrate
```

**方法二：手動執行 SQL（若 drizzle-kit 無法連線）**

依序執行 `drizzle/` 目錄下的所有 `.sql` 檔案：

```bash
mysql -u root -p production_line_db < drizzle/0000_giant_night_thrasher.sql
mysql -u root -p production_line_db < drizzle/0001_loud_killer_shrike.sql
mysql -u root -p production_line_db < drizzle/0002_deep_bromley.sql
mysql -u root -p production_line_db < drizzle/0003_optimal_ultragirl.sql
mysql -u root -p production_line_db < drizzle/0004_cooing_robbie_robertson.sql
mysql -u root -p production_line_db < drizzle/0005_fine_lucky_pierre.sql
mysql -u root -p production_line_db < drizzle/0006_cultured_golden_guardian.sql
mysql -u root -p production_line_db < drizzle/0007_funny_hellion.sql
mysql -u root -p production_line_db < drizzle/0008_easy_king_cobra.sql
```

### 步驟 5：啟動開發伺服器

```bash
pnpm dev
```

瀏覽器開啟 **http://localhost:3000**

---

## 正式環境部署（Production Build）

```bash
# 1. 建置前端與後端
pnpm build

# 2. 啟動正式版本（需先設定好 .env）
pnpm start
```

正式版本預設監聽 `PORT` 環境變數（預設 3000）。

---

## 環境變數說明

建立 `.env` 檔案（參考 `env.local.example`）：

```env
# ── 必填 ──────────────────────────────────────────────────────
DATABASE_URL=mysql://root:password@localhost:3306/production_line_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ── Manus OAuth（使用 Manus 帳號登入時需要）──────────────────
# 若不使用 Manus OAuth，可留空（系統核心功能仍可正常使用）
VITE_APP_ID=
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://manus.im
OWNER_OPEN_ID=
OWNER_NAME=

# ── AI 分析功能（選填）────────────────────────────────────────
# 若要使用 AI 優化建議功能，需填入 Ollama API Key
OLLAMA_API_KEY=

# ── 檔案儲存（選填，用於底圖等檔案上傳）──────────────────────
# 若不設定，底圖功能將無法儲存至雲端
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_KEY=
VITE_FRONTEND_FORGE_API_URL=

# ── 應用程式標題 ──────────────────────────────────────────────
VITE_APP_TITLE=生產工站分析系統
```

---

## 常用指令

```bash
# 開發模式（含熱重載）
pnpm dev

# 建置正式版本
pnpm build

# 啟動正式版本（需先 build）
pnpm start

# 執行測試（133 項）
pnpm test

# TypeScript 型別檢查
pnpm check

# 資料庫 Schema 同步（修改 drizzle/schema.ts 後執行）
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

---

## 專案結構說明

```
production_line_analyzer/
├── client/                  # React 19 前端（Vite + Tailwind 4）
│   └── src/
│       ├── pages/           # 頁面元件
│       │   ├── Home.tsx          # 首頁總覽
│       │   ├── ProductionLine.tsx # 生產線管理
│       │   ├── DataAdjust.tsx    # 數據修整
│       │   ├── FloorPlanSimulator.tsx # 配置模擬（含 DXF 底圖）
│       │   └── Guide.tsx         # 使用指南
│       ├── components/      # 共用元件（shadcn/ui）
│       └── lib/
│           ├── trpc.ts      # tRPC 客戶端
│           └── dxfToSvg.ts  # DXF 解析工具
├── server/                  # Express + tRPC 後端
│   ├── _core/               # 框架核心（OAuth、DB 連線、LLM 等）
│   ├── routers.ts           # API 路由定義
│   ├── db.ts                # 資料庫查詢 Helper
│   └── *.test.ts            # Vitest 測試（133 項）
├── drizzle/                 # 資料庫 Schema 與遷移 SQL
│   ├── schema.ts            # 資料表定義
│   └── 0000_*.sql ~ 0008_*.sql  # 遷移 SQL（依序執行）
├── shared/                  # 前後端共用型別
├── env.local.example        # 環境變數範本
└── LOCAL_SETUP.md           # 本說明文件
```

---

## 主要功能說明

| 功能 | 說明 |
|------|------|
| 生產線管理 | 建立/編輯生產線、工站、工序時間 |
| 數據修整 | 批次修改工站 CT、人力配置 |
| 配置模擬 | 拖曳式平面圖配置，支援輸送帶、物流連線 |
| DXF 底圖匯入 | 匯入 AutoCAD DXF 廠房圖作為底圖，支援圖層顯示/隱藏 |
| 比例尺校正 | 點選底圖兩點輸入實際距離，自動校正畫布比例 |
| AI 優化建議 | 基於 Ollama API 的產線平衡優化建議 |
| 快照比較 | 儲存並比較不同時期的產線數據 |

---

## 常見問題

**Q：啟動後出現 `DATABASE_URL is required` 錯誤？**
A：確認 `.env` 檔案存在且 `DATABASE_URL` 已正確填入。

**Q：資料庫連線失敗？**
A：確認 MySQL 服務已啟動，且帳號密碼與 `DATABASE_URL` 一致。若使用 Docker，確認容器已啟動（`docker ps`）。

**Q：AI 分析功能無回應？**
A：AI 功能需要 `OLLAMA_API_KEY`，若無此金鑰，其他核心功能（工站管理、平衡分析、快照比較、配置模擬）仍可正常使用。

**Q：DXF 底圖匯入後無法儲存？**
A：底圖儲存需要 `BUILT_IN_FORGE_API_URL` 和 `BUILT_IN_FORGE_API_KEY`（S3 相容儲存服務）。若無此設定，底圖仍可在當前工作階段中使用，但重新整理後會消失。

**Q：登入後跳轉失敗？**
A：Manus OAuth 需要在 Manus 平台上設定應用程式。本地開發若不需要 OAuth，可直接在 `server/_core/context.ts` 中設定預設用戶，或聯絡管理員取得 `VITE_APP_ID`。

**Q：`pnpm drizzle-kit migrate` 失敗？**
A：請改用手動 SQL 方式（步驟 4 方法二），依序執行 `drizzle/` 目錄下的 9 個 `.sql` 檔案。
