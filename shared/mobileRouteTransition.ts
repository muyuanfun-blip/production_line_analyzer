export const MOBILE_ROUTE_TRANSITION_MS = 220;

export function isMobileDeepRoute(path: string) {
  return /^\/mobile\/lines\/\d+(?:\/(?:balance|time-study|ai))?$/.test(path);
}

export function getMobileRouteLoadingLabel(path: string) {
  if (path.endsWith("/time-study")) return "正在開啟工時觀測…";
  if (path.endsWith("/balance")) return "正在計算平衡摘要…";
  if (path.endsWith("/ai")) return "正在準備 AI 分析…";
  return "正在載入產線與工站…";
}
