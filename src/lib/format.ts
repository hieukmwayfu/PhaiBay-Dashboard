import { useEffect, useState } from "react";

export const fmt = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return (Math.round(n * 100) / 100).toLocaleString();
};

export const pct = (x: number) => (x * 100).toFixed(1) + "%";

export const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/**
 * Categorical chart palette, fixed order (never cycled past 8: extra series fold into "Other").
 * Validated with the dataviz skill's validator against this dashboard's surfaces:
 * light #ffffff / dark #121218 — adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.3.
 * Light slots 3–5 sit below 3:1 on white, so every chart ships with a table view.
 */
export const PALETTE_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const PALETTE_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const OTHER_COLOR = { light: "#a1a1aa", dark: "#5b5b66" };

/** Chart chrome per theme (gridlines, axis ink, tooltip). */
export const CHROME = {
  light: { grid: "#ebebef", axis: "#8b8b96", baseline: "#d4d4dc", cursor: "#c7c7d1" },
  dark: { grid: "#25252f", axis: "#7c7c8a", baseline: "#34343f", cursor: "#3d3d4a" },
};

const isDark = () => document.documentElement.classList.contains("dark");

/** Re-renders when the html.dark class flips, so charts pick the mode's own palette steps. */
export function useDarkMode() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(isDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export function useChartTheme() {
  const dark = useDarkMode();
  return {
    dark,
    palette: dark ? PALETTE_DARK : PALETTE_LIGHT,
    other: dark ? OTHER_COLOR.dark : OTHER_COLOR.light,
    chrome: dark ? CHROME.dark : CHROME.light,
  };
}
