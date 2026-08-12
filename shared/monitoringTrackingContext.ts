export type MonitoringTrackingContext = {
  lineId: number;
  waitingCount: number;
  activeCount: number;
  productIds: string[];
};

function safeNumber(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function buildMonitoringTrackingUrl(context: MonitoringTrackingContext) {
  const params = new URLSearchParams({
    source: "monitoring",
    lineId: String(context.lineId),
    waitingCount: String(context.waitingCount),
    activeCount: String(context.activeCount),
    products: context.productIds.slice(0, 8).join(","),
  });
  return `/product-tracking?${params.toString()}`;
}

export function parseMonitoringTrackingContext(search: string): MonitoringTrackingContext | null {
  const params = new URLSearchParams(search);
  if (params.get("source") !== "monitoring") return null;
  const lineId = safeNumber(params.get("lineId"));
  if (!lineId) return null;
  return {
    lineId,
    waitingCount: safeNumber(params.get("waitingCount")),
    activeCount: safeNumber(params.get("activeCount")),
    productIds: (params.get("products") || "").split(",").map((value) => value.trim()).filter(Boolean).slice(0, 8),
  };
}
