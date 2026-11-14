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

const IS_LOCAL_PAGE = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
// Build-time default. On a deployed dashboard without VITE_API_URL there is no sensible default:
// "localhost" would point at the viewer's own machine.
// VITE_API_URL=same-origin: the dashboard is served by the same host as the API (VPS behind Caddy).
const RAW_ENV_URL = import.meta.env.VITE_API_URL as string | undefined;
const ENV_URL = RAW_ENV_URL === "same-origin" ? location.origin : RAW_ENV_URL || (IS_LOCAL_PAGE ? "http://localhost:8080" : "");

/** "abc.trycloudflare.com/" -> "https://abc.trycloudflare.com" */
export function normalizeServerUrl(u: string): string {
  let s = u.trim().replace(/\/+$/, "");
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = (/^(localhost|127\.|192\.168\.|10\.)/.test(s) ? "http://" : "https://") + s;
  return s;
}

// ?server=https://xyz lets you share a link that is preconfigured for a server.
(() => {
  try {
    const p = new URLSearchParams(location.search);
    const s = p.get("server");
    if (s) {
      LS.set("server", normalizeServerUrl(s));
      p.delete("server");
      const qs = p.toString();
      history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
    }
  } catch {
    /* ignore */
  }
})();

export function getServerUrl(): string {
  // A deployed dashboard always talks to the server it was built for. An URL saved in the browser
  // (old tunnel / localhost from testing) would silently show another database to this one person.
  if (ENV_URL && !IS_LOCAL_PAGE) return ENV_URL;
  return LS.get("server", ENV_URL) || ENV_URL;
}
export function setServerUrl(u: string) {
  LS.set("server", normalizeServerUrl(u) || ENV_URL);
}

/** Explains why the browser cannot reach the server (returns "" when the URL looks fine). */
export function serverUrlProblem(u: string): string {
  if (!u) return "Chưa nhập địa chỉ server.";
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return `Địa chỉ server không hợp lệ: ${u}`;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (location.protocol === "https:" && url.protocol === "http:" && !local)
    return "Dashboard chạy HTTPS nên trình duyệt chặn server HTTP. Hãy dùng địa chỉ HTTPS (vd: link Cloudflare tunnel).";
  return "";
}

function networkErrorMessage(u: string): string {
  const p = serverUrlProblem(u);
  if (p) return p;
  let host = "";
  try {
    host = new URL(u).hostname;
  } catch {
    /* ignore */
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  return local && !IS_LOCAL_PAGE
    ? `Không kết nối được ${u}. "localhost" là máy đang mở trình duyệt — nếu server ở máy khác hãy dùng link HTTPS của server (vd: Cloudflare tunnel). Nếu trình duyệt hỏi quyền truy cập mạng cục bộ, hãy cho phép.`
    : "Không kết nối được server. Kiểm tra mạng rồi thử lại.";
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
  const base = getServerUrl();
  const problem = serverUrlProblem(base);
  if (problem) throw new ApiError(0, problem);
  const u = new URL(path, base);
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
    throw new ApiError(0, networkErrorMessage(base));
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && !path.startsWith("/api/auth/login")) {
    onUnauthorized();
  }
  if (!r.ok) throw new ApiError(r.status, (j as { error?: string }).error || r.statusText);
  return j as T;
}

// ---------- types ----------
export interface App { id: number; name: string; app_key: string; created_at: number }
export interface AppSummary extends App { events: number; users: number; new_users: number; sessions: number; last_event_at: number; daily_users: number[] }
export interface AppsSummary { from: string; to: string; labels: string[]; apps: AppSummary[] }
export interface OverviewPoint { day: string; events: number; users: number; new_users: number; sessions: number }
export interface Overview { totals: OverviewPoint; series: OverviewPoint[]; from: string; to: string }
export interface EventRow { name: string; count: number; users: number }
export interface Series { name: string; total: number; values: number[] }
export interface Timeseries { labels: string[]; series: Series[] }
export interface BreakdownRow { value: string; metric: number; count: number; users: number }
export interface ValueRow { value: string; count: number }
export interface ParamKey { key: string; count: number; numeric: boolean }
export interface FunnelStep { name: string; users: number; conversion: number; step_conversion: number }
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

// ---------- apps ----------
export const APP_KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$/;
export const listApps = () => api<App[]>("/api/apps");
/** appKey empty = server generates one. The key can never be changed afterwards. */
export const createApp = (name: string, appKey: string) =>
  api<App>("/api/apps", {}, { method: "POST", body: JSON.stringify({ name, app_key: appKey }) });
export interface DeleteEventsResult { dry_run: boolean; total: number; names: { name: string; count: number }[] }
/** dry_run = only count. from/to both empty = all time. */
export const deleteEvents = (body: { app_id: number; names: string[]; from?: string; to?: string; dry_run?: boolean }) =>
  api<DeleteEventsResult>("/api/events/delete", {}, { method: "POST", body: JSON.stringify(body) });
export const appsSummary = (from: string, to: string) => api<AppsSummary>("/api/apps/summary", { from, to });
