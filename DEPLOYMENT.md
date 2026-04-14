# 生產工站分析系統 — 安裝部署說明

> 版本：2026-04  
> 技術棧：Node.js 20 + React 19 + Express 4 + tRPC 11 + MySQL 8 + Drizzle ORM

---

## 目錄

1. [系統需求](#1-系統需求)
2. [快速部署（建議）](#2-快速部署建議)
3. [手動部署](#3-手動部署)
4. [環境變數說明](#4-環境變數說明)
5. [資料庫初始化](#5-資料庫初始化)
6. [S3 檔案儲存設定](#6-s3-檔案儲存設定)
7. [首次登入與管理員設定](#7-首次登入與管理員設定)
8. [Nginx 反向代理設定](#8-nginx-反向代理設定)
9. [常見問題](#9-常見問題)

---

## 1. 系統需求

| 項目 | 最低需求 | 建議 |
|------|----------|------|
| 作業系統 | Ubuntu 20.04 / Debian 11 / CentOS 8 | Ubuntu 22.04 LTS |
| Node.js | 18.x | **20.x LTS** |
| pnpm | 8.x | 9.x |
| MySQL | 8.0 | 8.0 或 TiDB |
| RAM | 512 MB | 2 GB |
| 磁碟空間 | 1 GB | 5 GB |
| 網路 | 可對外開放 HTTP/HTTPS | HTTPS（建議） |

---

## 2. 快速部署（建議）

使用 Docker Compose 一鍵部署（需安裝 Docker 與 Docker Compose）。

### 2.1 建立 `docker-compose.yml`

```yaml
version: "3.9"

services:
  app:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
      - /app/node_modules
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mysql://root:yourpassword@db:3306/production_line_analyzer
      - JWT_SECRET=your-super-secret-key-change-this
      - PORT=3000
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    command: sh -c "pnpm install --frozen-lockfile && pnpm build && pnpm start"
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: yourpassword
      MYSQL_DATABASE: production_line_analyzer
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  mysql_data:
```

### 2.2 啟動

```bash
# 1. 解壓縮系統原始碼
unzip production_line_analyzer.zip
cd production_line_analyzer

# 2. 修改 docker-compose.yml 中的密碼與 JWT_SECRET

# 3. 啟動（首次需要幾分鐘安裝依賴與建置）
docker compose up -d

# 4. 查看啟動日誌
docker compose logs -f app
```

啟動成功後，開啟瀏覽器前往 `http://your-server-ip:3000`。

---

## 3. 手動部署

### 3.1 安裝 Node.js 20

```bash
# 使用 nvm（推薦）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 安裝 pnpm
npm install -g pnpm
```

### 3.2 安裝 MySQL 8.0

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y mysql-server

# 啟動並設定 root 密碼
sudo systemctl start mysql
sudo mysql_secure_installation

# 建立資料庫
sudo mysql -u root -p -e "CREATE DATABASE production_line_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3.3 部署應用程式

```bash
# 1. 解壓縮
unzip production_line_analyzer.zip
cd production_line_analyzer

# 2. 建立環境變數檔案
cp .env.example .env
nano .env   # 填入必要的環境變數（見第 4 節）

# 3. 安裝依賴
pnpm install --frozen-lockfile

# 4. 執行資料庫遷移
pnpm drizzle-kit migrate

# 5. 建置前端與後端
pnpm build

# 6. 啟動（測試）
pnpm start
```

### 3.4 使用 PM2 持久化運行

```bash
# 安裝 PM2
npm install -g pm2

# 啟動應用
pm2 start dist/index.js --name production-line-analyzer

# 設定開機自動啟動
pm2 startup
pm2 save

# 查看狀態
pm2 status
pm2 logs production-line-analyzer
```

---

## 4. 環境變數說明

在專案根目錄建立 `.env` 檔案（參考 `.env.example`）：

```bash
# ===== 必要設定 =====

# MySQL 連線字串
DATABASE_URL=mysql://root:yourpassword@localhost:3306/production_line_analyzer

# JWT Session 密鑰（請使用隨機長字串，至少 32 字元）
# 生成方式：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-super-secret-key-at-least-32-characters

# 伺服器 Port（預設 3000）
PORT=3000

# ===== 選用設定 =====

# S3 相容儲存（用於圖表下載功能，若不需要可留空）
# 支援 AWS S3、MinIO、Cloudflare R2 等 S3 相容服務
BUILT_IN_FORGE_API_URL=https://your-s3-proxy-url
BUILT_IN_FORGE_API_KEY=your-s3-api-key

# 應用程式 ID（可自訂任意字串）
VITE_APP_ID=production-line-analyzer

# OAuth 伺服器（已移除 OAuth 登入，此項可留空）
OAUTH_SERVER_URL=
```

### 生成 JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. 資料庫初始化

### 5.1 執行 Schema 遷移

```bash
# 方法一：使用 drizzle-kit（推薦）
pnpm drizzle-kit migrate

# 方法二：手動執行 SQL
mysql -u root -p production_line_analyzer < drizzle/migrations/0000_initial.sql
```

### 5.2 建立初始管理員帳號

遷移完成後，執行以下指令建立預設管理員帳號：

```bash
node -e "
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const hash = await bcrypt.hash('Admin@1234', 12);
  const openId = 'local_admin_' + Date.now();
  await conn.execute(
    'INSERT INTO users (openId, username, passwordHash, name, role, isActive, loginMethod, lastSignedIn) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
    [openId, 'admin', hash, '系統管理員', 'admin', 1, 'local']
  );
  console.log('管理員帳號建立成功！帳號: admin，密碼: Admin@1234');
  await conn.end();
}
main().catch(console.error);
"
```

> **重要**：首次登入後請立即至「帳號管理」頁面修改管理員密碼。

---

## 6. S3 檔案儲存設定

系統的「下載圖表」功能需要 S3 相容儲存服務。若不需要此功能，可跳過此節。

### 選項 A：使用 AWS S3

```bash
# 在 .env 中設定
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-northeast-1
AWS_BUCKET_NAME=your-bucket-name
```

### 選項 B：使用 MinIO（自架，免費）

```bash
# 使用 Docker 啟動 MinIO
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  -v minio_data:/data \
  minio/minio server /data --console-address ":9001"
```

> **注意**：若暫時不設定 S3，「下載圖表」按鈕會顯示錯誤，但不影響其他功能。

---

## 7. 首次登入與管理員設定

1. 開啟瀏覽器前往 `http://your-server-ip:3000`
2. 使用預設帳號登入：
   - **帳號**：`admin`
   - **密碼**：`Admin@1234`
3. 登入後點擊左側側邊欄「**帳號管理**」
4. 點擊管理員帳號旁的「**重設密碼**」，立即修改為安全密碼
5. 依需求新增其他使用者帳號

### 帳號角色說明

| 角色 | 權限 |
|------|------|
| `admin`（管理員） | 可存取所有功能，包含帳號管理 |
| `user`（一般使用者） | 可使用生產線管理、平衡分析、動作分析、快照等功能 |

---

## 8. Nginx 反向代理設定

建議使用 Nginx 作為反向代理，支援 HTTPS。

### 8.1 安裝 Nginx

```bash
sudo apt install -y nginx
```

### 8.2 設定檔（`/etc/nginx/sites-available/production-line-analyzer`）

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替換為你的網域

    # 將 HTTP 重導向至 HTTPS（設定 SSL 後啟用）
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }
}
```

```bash
# 啟用設定
sudo ln -s /etc/nginx/sites-available/production-line-analyzer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8.3 設定 HTTPS（使用 Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 9. 常見問題

### Q: 啟動後出現 `DATABASE_URL is required` 錯誤

確認 `.env` 檔案存在且 `DATABASE_URL` 格式正確：
```
DATABASE_URL=mysql://username:password@host:3306/database_name
```

### Q: 資料庫連線失敗

```bash
# 測試連線
mysql -u root -p -h localhost -e "SHOW DATABASES;"

# 確認 MySQL 服務狀態
sudo systemctl status mysql
```

### Q: 登入後顯示「帳號或密碼錯誤」

確認資料庫遷移已完成，且管理員帳號已建立（見第 5.2 節）。

### Q: 前端頁面空白或 404

確認 `pnpm build` 已成功執行，`dist/` 目錄存在。

### Q: 如何備份資料庫

```bash
# 備份
mysqldump -u root -p production_line_analyzer > backup_$(date +%Y%m%d).sql

# 還原
mysql -u root -p production_line_analyzer < backup_20260401.sql
```

### Q: 如何更新系統

```bash
# 1. 備份資料庫
mysqldump -u root -p production_line_analyzer > backup_before_update.sql

# 2. 解壓縮新版本（覆蓋舊檔案，保留 .env）
unzip -o production_line_analyzer_new.zip

# 3. 安裝依賴
pnpm install --frozen-lockfile

# 4. 執行資料庫遷移
pnpm drizzle-kit migrate

# 5. 重新建置
pnpm build

# 6. 重啟服務
pm2 restart production-line-analyzer
```

---

## 技術支援

如遇到部署問題，請提供以下資訊：
- 作業系統版本：`uname -a`
- Node.js 版本：`node -v`
- 錯誤日誌：`pm2 logs production-line-analyzer --lines 50`
