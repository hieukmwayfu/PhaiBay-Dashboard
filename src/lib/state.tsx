import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { storage, type App, type Query } from "./api";

export type Dim = "event" | "version" | "country" | "platform" | "os" | "device" | "lang" | "p" | "u";
export type Op = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";
export interface Filter { dim: Dim; key?: string; op: Op; val: string }

export const DIM_LABEL: Record<string, string> = {
  event: "Event", version: "Version", country: "Country", platform: "Platform", os: "OS", device: "Device", lang: "Language",
};
export const OP_LABEL: Record<Op, string> = { eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", contains: "∋" };

export type RangeKey = "0" | "1" | "7" | "14" | "28" | "90" | "custom";
export const RANGES: { k: RangeKey; label: string }[] = [
  { k: "0", label: "Hôm nay" }, { k: "1", label: "Hôm qua" }, { k: "7", label: "7 ngày" }, { k: "14", label: "14 ngày" },
  { k: "28", label: "28 ngày" }, { k: "90", label: "90 ngày" }, { k: "custom", label: "Tùy chọn" },
];

const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

function rangeDates(r: RangeKey, from: string, to: string) {
  if (r === "custom") return { from, to };
  const now = new Date();
  const n = Number(r);
  if (n === 1) {
    const y = new Date(now.getTime() - 864e5);
    return { from: iso(y), to: iso(y) };
  }
  return { from: iso(new Date(now.getTime() - Math.max(0, n - 1) * 864e5)), to: iso(now) };
}

interface Ctx {
  apps: App[];
  setApps: (a: App[]) => void;
  appId: number | null;
  setAppId: (id: number | null) => void;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  custom: { from: string; to: string };
  setCustom: (c: { from: string; to: string }) => void;
  dates: { from: string; to: string };
  filters: Filter[];
  setFilters: (f: Filter[]) => void;
  addFilter: (f: Filter) => void;
  /** query params for API calls: app + dates + filters (skip = dims to ignore, e.g. "event") */
  q: (extra?: Query, skip?: Dim[]) => Query;
  version: number; // bump to force refresh
  refresh: () => void;
}

const C = createContext<Ctx>(null as unknown as Ctx);
export const useDash = () => useContext(C);

export function DashProvider({ children }: { children: ReactNode }) {
  const [apps, setApps] = useState<App[]>([]);
  const [appId, setAppIdS] = useState<number | null>(null); // driven by the /app/:appId route
  const [range, setRangeS] = useState<RangeKey>(storage.get("range", "7"));
  const [custom, setCustomS] = useState(storage.get("custom", rangeDates("7", "", "")));
  const [filters, setFiltersS] = useState<Filter[]>(storage.get("filters", []));
  const [version, setVersion] = useState(0);

  // filters (version, params, ...) are app specific: reset them when switching app
  const setAppId = (id: number | null) => {
    if (appId !== null && id !== null && appId !== id) setFilters([]);
    setAppIdS(id);
  };
  const setRange = (r: RangeKey) => { setRangeS(r); storage.set("range", r); };
  const setCustom = (c: { from: string; to: string }) => { setCustomS(c); storage.set("custom", c); };
  const setFilters = (f: Filter[]) => { setFiltersS(f); storage.set("filters", f); };
  const addFilter = (f: Filter) => {
    // column filters: one chip per dim (multi value via comma); param filters can stack
    const rest = f.dim === "p" || f.dim === "u" ? filters : filters.filter((x) => x.dim !== f.dim);
    setFilters([...rest, f]);
  };

  const dates = useMemo(() => rangeDates(range, custom.from, custom.to), [range, custom]);

  const q = useCallback(
    (extra: Query = {}, skip: Dim[] = []): Query => {
      const out: Query = { app: appId ?? undefined, from: dates.from, to: dates.to };
      for (const f of filters) {
        if (skip.includes(f.dim)) continue;
        if (f.dim === "p" || f.dim === "u") {
          const k = `${f.dim}.${f.key}`;
          const v = (f.op === "eq" ? "" : f.op + ":") + f.val;
          const prev = out[k];
          out[k] = prev === undefined ? v : ([] as (string | number)[]).concat(prev as string, v);
        } else out[f.dim] = f.val;
      }
      for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== "") out[k] = v;
      return out;
    },
    [appId, dates, filters],
  );

  const value: Ctx = {
    apps, setApps, appId, setAppId, range, setRange, custom, setCustom, dates, filters, setFilters, addFilter, q,
    version, refresh: () => setVersion((v) => v + 1),
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}

/** Load data whenever deps (or the global refresh version) change. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const { version } = useDash();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    fn()
      .then((d) => alive && setData(d))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { data, error, loading, setData };
}
