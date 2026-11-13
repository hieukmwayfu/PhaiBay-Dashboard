export const fmt = (n: number | null | undefined): string => {
  if (n == null || Number.isNaN(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return (Math.round(n * 100) / 100).toLocaleString();
};

export const pct = (x: number) => (x * 100).toFixed(1) + "%";

export const dur = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

export const PALETTE = [
  "#3b82f6", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#64748b",
  "#14b8a6", "#a855f7", "#eab308", "#0ea5e9", "#22c55e", "#f43f5e", "#6366f1", "#d946ef", "#78716c", "#0891b2",
];

export const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
