/**
 * seed-admin.mjs
 * 建立初始管理員帳號（本機部署使用）
 *
 * 使用方式：
 *   node seed-admin.mjs
 *   node seed-admin.mjs --username admin --password mypassword --name "系統管理員"
 *
 * 環境變數：
 *   DATABASE_URL  MySQL 連線字串（必填）
 */

import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// ─── 解析命令列參數 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};

const username = getArg("--username") ?? "admin";
const password = getArg("--password") ?? "admin123";
const name = getArg("--name") ?? "系統管理員";

// ─── 資料庫連線 ────────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ 請設定 DATABASE_URL 環境變數");
  console.error("   範例：DATABASE_URL=mysql://root:password@localhost:3306/production_line_db node seed-admin.mjs");
  process.exit(1);
}

async function main() {
  const conn = await mysql.createConnection(DATABASE_URL);

  try {
    // 檢查帳號是否已存在
    const [rows] = await conn.execute(
      "SELECT id, username FROM users WHERE username = ?",
      [username]
    );

    if (rows.length > 0) {
      console.log(`⚠️  帳號 "${username}" 已存在（id: ${rows[0].id}），跳過建立`);
      console.log("   若要重設密碼，請登入後至「帳號管理」頁面操作");
      return;
    }

    // 建立管理員帳號
    const passwordHash = await bcrypt.hash(password, 12);
    const openId = `local_${crypto.randomUUID()}`;
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");

    await conn.execute(
      `INSERT INTO users (openId, username, passwordHash, name, role, isActive, loginMethod, createdAt, updatedAt, lastSignedIn)
       VALUES (?, ?, ?, ?, 'admin', 1, 'local', ?, ?, ?)`,
      [openId, username, passwordHash, name, now, now, now]
    );

    console.log("✅ 管理員帳號建立成功！");
    console.log(`   帳號：${username}`);
    console.log(`   密碼：${password}`);
    console.log(`   姓名：${name}`);
    console.log("");
    console.log("⚠️  請登入後立即至「帳號管理」頁面修改密碼！");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("❌ 建立失敗：", err.message);
  process.exit(1);
});
