// PhaiBay server API client. Token comes from POST /api/auth/login.

const LS = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem("pb_" + k);
      return v == null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem("pb_" + k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};
export const storage = LS;

const ENV_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8080";

export function getServerUrl(): string {
  return LS.get("server", ENV_URL);
}
export function setServerUrl(u: string) {
  LS.set("server", u.trim().replace(/\/+$/, "") || ENV_URL);
}
export function getToken(): string {
  return LS.get("token", "");
}
export function setToken(t: string) {
  LS.set("token", t);
}

export class ApiError extends Error {
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export type Query = Record<string, string | number | undefined | null | (string | number)[]>;

export async function api<T>(path: string, query: Query = {}, init: RequestInit = {}): Promise<T> {
  const u = new URL(path, getServerUrl());
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    for (const x of Array.isArray(v) ? v : [v]) u.searchParams.append(k, String(x));
  }
  let r: Response;
  try {
    r = await fetch(u, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken(), ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError(0, `Không kết nối được server ${getServerUrl()}`);
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith("/api/auth/login")) {
    onUnauthorized();
  }
  if (!r.ok) throw new ApiError(r.status, (j as { error?: string }).error || r.statusText);
  return j as T;
}

// ---------- types ----------
export interface App { id: number; name: string; api_key: string; created_at: number }
export interface OverviewPoint { day: string; events: number; users: number; new_users: number; sessions: number; engagement_ms_per_user: number }
export interface Overview { totals: OverviewPoint; series: OverviewPoint[]; from: string; to: string }
export interface EventRow { name: string; count: number; users: number }
export interface Series { name: string; total: number; values: number[] }
export interface Timeseries { labels: string[]; series: Series[] }
export interface BreakdownRow { value: string; metric: number; count: number; users: number }
export interface ValueRow { value: string; count: number }
export interface ParamKey { key: string; count: number; numeric: boolean }
export interface FunnelStep { name: string; users: number; conversion: number; step_conversion: number }
export interface Cohort { day: string; size: number; retained: number[]; counts: number[] }
export interface Retention { days: number; cohorts: Cohort[] }
export interface RawEvent {
  id: number; ts: number; name: string; user_id: string; uid?: string; session_id?: string;
  app_version: string; platform: string; os: string; device: string; country: string; lang: string;
  params?: Record<string, unknown>; uprops?: Record<string, unknown>;
}

// ---------- auth ----------
export async function login(username: string, password: string) {
  const r = await api<{ token: string; expires_at: number; username: string }>("/api/auth/login", {}, {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  setToken(r.token);
  return r;
}
export async function logout() {
  await api("/api/auth/logout", {}, { method: "POST" }).catch(() => {});
  setToken("");
}
export const me = () => api<{ username: string }>("/api/auth/me");
export const changePassword = (old_password: string, new_password: string, new_username?: string) =>
  api("/api/auth/password", {}, { method: "POST", body: JSON.stringify({ old_password, new_password, new_username }) });

// ---------- apps ----------
export const listApps = () => api<App[]>("/api/apps");
export const createApp = (name: string) => api<App>("/api/apps", {}, { method: "POST", body: JSON.stringify({ name }) });
export const rotateKey = (id: number) => api<{ api_key: string }>(`/api/apps/${id}/rotate`, {}, { method: "POST" });
