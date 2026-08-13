import { createContext, useContext, useEffect, useState } from "react";
import { getNextTheme, normalizeThemePreference, THEME_STORAGE_KEY, type AppTheme } from "../../../shared/themePreference";

type Theme = AppTheme;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  switchable = true,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => normalizeThemePreference(localStorage.getItem(THEME_STORAGE_KEY), defaultTheme));

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    if (switchable) localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme, switchable]);

  const toggleTheme = () => {
    if (!switchable) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
      document.documentElement.classList.add("theme-transitioning");
      window.setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 280);
    }
    setTheme(previousTheme => getNextTheme(previousTheme));
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
