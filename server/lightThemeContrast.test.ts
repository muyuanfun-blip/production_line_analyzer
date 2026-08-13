import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("淺色主題可讀性覆蓋", () => {
  it("為深色專用 slate 表面、文字及邊框提供淺色模式映射", () => {
    [".bg-slate-900", ".bg-slate-800", ".bg-slate-700", ".text-slate-100", ".text-slate-400", ".border-slate-700"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
  });

  it("將淺色模式的青綠、琥珀、紫與紅色文字降至可讀對比", () => {
    [".text-cyan-300", ".text-emerald-300", ".text-amber-300", ".text-violet-300", ".text-red-300"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
  });

  it("保護首頁深色決策橫幅的標題、說明、標籤與次要操作文字", () => {
    [".decision-hero-title", ".decision-hero-copy", ".decision-hero-eyebrow", ".decision-hero-secondary-action"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
  });

  it("將首頁第二層工作區的深色分頁與內容卡改為淺色高對比表面", () => {
    [".workspace-tabs", ".workspace-tab", ".workspace-tab-active", ".decision-workspace-card"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
    expect(stylesheet).toContain(".decision-workspace-card .text-muted-foreground");
  });

  it("保護同一元件中 slate 背景與白色文字的表單控制，並提供主題切換過渡與減少動態效果條件", () => {
    expect(stylesheet).toContain(".bg-slate-700.text-white");
    expect(stylesheet).toContain("html.theme-transitioning");
    expect(stylesheet).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("為首頁風險、警示與資訊提醒卡片提供淺色模式高對比前景", () => {
    [".decision-priority-critical", ".decision-priority-high", ".decision-priority-normal"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
  });

  it("為完整成功、資訊、中性、警示與風險狀態色系提供淺色模式高對比前景", () => {
    [".status-success", ".status-info", ".status-neutral", ".status-warning", ".status-risk"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
    [".status-text-success", ".status-text-info", ".status-text-neutral", ".status-text-warning", ".status-text-risk"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
  });

  it("為其他頁面常用的淡色狀態文字類別提供全域淺色映射", () => {
    [".text-red-100", ".text-emerald-100", ".text-cyan-100", ".text-amber-100", ".text-violet-100", ".text-rose-100", ".text-sky-100", ".text-yellow-100"].forEach((selector) => {
      expect(stylesheet).toContain(`html:not(.dark) ${selector}`);
    });
  });
});
