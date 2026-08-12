import { describe, expect, it } from "vitest";
import { getNextTheme, normalizeThemePreference } from "../shared/themePreference";

describe("主題偏好", () => {
  it("僅接受淺色或深色偏好，無效值回退至深色", () => {
    expect(normalizeThemePreference("light")).toBe("light");
    expect(normalizeThemePreference("dark")).toBe("dark");
    expect(normalizeThemePreference("system")).toBe("dark");
  });

  it("可在淺色與深色間切換", () => {
    expect(getNextTheme("dark")).toBe("light");
    expect(getNextTheme("light")).toBe("dark");
  });
});
