export type AppTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "pla-theme";

export function normalizeThemePreference(value: unknown, fallback: AppTheme = "dark"): AppTheme {
  return value === "light" || value === "dark" ? value : fallback;
}

export function getNextTheme(theme: AppTheme): AppTheme {
  return theme === "dark" ? "light" : "dark";
}
