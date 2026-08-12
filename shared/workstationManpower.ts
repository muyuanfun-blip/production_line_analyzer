export type ManpowerInput = {
  manpower?: number | string | null;
  morningManpower?: number | string | null;
  eveningManpower?: number | string | null;
};

export type NormalizedManpower = {
  morningManpower: number;
  eveningManpower: number;
  totalManpower: number;
  source: "shifts" | "legacy";
};

const toNumber = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isQuarterUnit = (value: number) => Math.abs(value * 4 - Math.round(value * 4)) < 1e-8;

/**
 * 早晚班人力是主資料的唯一真實來源；legacy manpower 僅用於舊資料相容。
 */
export function normalizeManpower(input: ManpowerInput, fallback?: ManpowerInput): NormalizedManpower {
  const requestedMorning = toNumber(input.morningManpower);
  const requestedEvening = toNumber(input.eveningManpower);
  const requestedLegacy = toNumber(input.manpower);
  const fallbackMorning = toNumber(fallback?.morningManpower);
  const fallbackEvening = toNumber(fallback?.eveningManpower);
  const fallbackLegacy = toNumber(fallback?.manpower);

  const hasShiftInput = requestedMorning !== undefined || requestedEvening !== undefined;
  const hasFallbackShift = fallbackMorning !== undefined || fallbackEvening !== undefined;

  const morningManpower = hasShiftInput
    ? (requestedMorning ?? fallbackMorning ?? 0)
    : hasFallbackShift
      ? fallbackMorning ?? 0
      : requestedLegacy ?? fallbackLegacy ?? 0;
  const eveningManpower = hasShiftInput
    ? (requestedEvening ?? fallbackEvening ?? 0)
    : hasFallbackShift
      ? fallbackEvening ?? 0
      : 0;

  if (morningManpower < 0 || eveningManpower < 0) {
    throw new Error("早晚班人力不可為負數");
  }
  if (!isQuarterUnit(morningManpower) || !isQuarterUnit(eveningManpower)) {
    throw new Error("早晚班人力必須以 0.25 為單位");
  }

  return {
    morningManpower,
    eveningManpower,
    totalManpower: morningManpower + eveningManpower,
    source: hasShiftInput || hasFallbackShift ? "shifts" : "legacy",
  };
}

export function getManpowerQuality(input: ManpowerInput) {
  const legacy = toNumber(input.manpower);
  let normalized: NormalizedManpower;
  const issues: string[] = [];

  try {
    normalized = normalizeManpower(input);
  } catch (error) {
    const morningManpower = toNumber(input.morningManpower) ?? 0;
    const eveningManpower = toNumber(input.eveningManpower) ?? 0;
    normalized = {
      morningManpower,
      eveningManpower,
      totalManpower: morningManpower + eveningManpower,
      source: input.morningManpower !== undefined || input.eveningManpower !== undefined ? "shifts" : "legacy",
    };
    issues.push(error instanceof Error ? error.message : "人力資料格式無效");
  }

  if (normalized.totalManpower <= 0) issues.push("早晚班合計人力必須大於 0");
  if (legacy !== undefined && Math.abs(legacy - normalized.totalManpower) > 1e-8) {
    issues.push("既有人力欄位與早晚班合計不一致");
  }

  return { ...normalized, issues, isValid: issues.length === 0 };
}
