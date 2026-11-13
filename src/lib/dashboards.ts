// Custom dashboards: JSON spec (metrics, formulas, widgets) stored and evaluated by the server.
import { api, type Query } from "./api";

export type Agg = "count" | "users" | "sum" | "avg" | "min" | "max";
export interface DashMetric { id: string; label?: string; event: string; agg?: Agg; param?: string; filters?: Record<string, string> }
export interface DashFormula { id: string; label?: string; expr: string; format?: "number" | "percent" | "decimal" }
export type WidgetType = "kpi" | "line" | "bar" | "table" | "text";
export interface DashWidget { type: WidgetType; title?: string; series?: string[]; dim?: string; limit?: number; width?: number; markdown?: string }
export interface DashSpec { version: number; metrics: DashMetric[]; formulas: DashFormula[]; widgets: DashWidget[] }

export interface Dashboard { id: number; app_id: number; name: string; spec: DashSpec; created_at: number; updated_at: number; updated_by: string }

export interface SeriesData {
  id: string; label: string; kind: "metric" | "formula"; format: "number" | "percent" | "decimal";
  total: number | null; prev: number | null; values: (number | null)[];
}
export interface DashData {
  from: string; to: string; labels: string[];
  series: Record<string, SeriesData>;
  tables: { widget: number; dim: string; rows: Record<string, string | number | null>[] }[];
}

export const emptySpec = (): DashSpec => ({ version: 1, metrics: [], formulas: [], widgets: [] });

export const listDashboards = (app: number) => api<Dashboard[]>("/api/dashboards", { app });
export const saveDashboard = (d: { id?: number; app_id: number; name: string; spec: DashSpec }) =>
  api<Dashboard>(d.id ? `/api/dashboards/${d.id}` : "/api/dashboards", {}, {
    method: d.id ? "PUT" : "POST",
    body: JSON.stringify({ app_id: d.app_id, name: d.name, spec: d.spec }),
  });
export const deleteDashboard = (id: number) => api(`/api/dashboards/${id}`, {}, { method: "DELETE" });
export const evalDashboard = (spec: DashSpec, q: Query) =>
  api<{ spec: DashSpec; data: DashData }>("/api/dashboards/eval", q, { method: "POST", body: JSON.stringify({ spec }) });

export function formatValue(v: number | null | undefined, format: string): string {
  if (v == null) return "—";
  if (format === "percent") return v.toFixed(1) + "%";
  if (format === "decimal") return v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(1) + "K";
  return (Math.round(v * 100) / 100).toLocaleString();
}

/** Ask the AI side panel to do something (opens it and pre-fills the prompt). */
export function askAgent(prompt: string) {
  window.dispatchEvent(new CustomEvent("pb-agent-ask", { detail: prompt }));
}
export const DASHBOARDS_CHANGED = "pb-dashboards-changed";
