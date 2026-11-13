// OpenRouter client, browser only. The user signs in with their own OpenRouter account (OAuth PKCE);
// the resulting key is kept in this browser and every request is billed to / limited by that account.
// Docs: https://openrouter.ai/docs/guides/overview/auth/oauth
import { storage } from "./api";

const OR = "https://openrouter.ai";
const KEY = "or_key";
const VERIFIER = "pb_or_verifier"; // sessionStorage: survives the redirect, not the tab

export const getOrKey = (): string => storage.get(KEY, "");
export const setOrKey = (k: string) => storage.set(KEY, k);

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Redirects to OpenRouter's consent page; it comes back to callbackUrl with ?code=... */
export async function startOrLogin(callbackUrl: string) {
  if (!crypto?.subtle) throw new Error("Trình duyệt cần HTTPS (hoặc localhost) để đăng nhập.");
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  sessionStorage.setItem(VERIFIER, verifier);
  const u = new URL(OR + "/auth");
  u.searchParams.set("callback_url", callbackUrl);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  u.searchParams.set("key_label", "PhaiBay Analytics");
  location.href = u.toString();
}

/** If the URL carries ?code= from the OAuth redirect, exchange it for a key. Returns true when signed in. */
export async function finishOrLogin(): Promise<boolean> {
  const p = new URLSearchParams(location.search);
  const code = p.get("code");
  if (!code) return false;
  // drop ?code from the address bar whatever happens
  p.delete("code");
  p.delete("state");
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  const verifier = sessionStorage.getItem(VERIFIER);
  sessionStorage.removeItem(VERIFIER);
  if (!verifier) throw new Error("Phiên đăng nhập OpenRouter đã hết hạn, hãy đăng nhập lại.");
  const r = await fetch(OR + "/api/v1/auth/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.key) throw new Error(j?.error?.message || `Đăng nhập OpenRouter lỗi (${r.status})`);
  setOrKey(j.key);
  return true;
}

export function orLogout() {
  setOrKey("");
}

async function orFetch<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const key = getOrKey();
  const r = await fetch(OR + "/api/v1" + path, {
    ...init,
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
      "X-Title": "PhaiBay Analytics",
      ...(init.headers || {}),
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) setOrKey(""); // revoked / invalid key: sign in again
    const msg = j?.error?.message || r.statusText;
    throw new Error(
      r.status === 402 ? `Tài khoản OpenRouter hết credit / vượt giới hạn: ${msg}` :
      r.status === 429 ? `OpenRouter đang giới hạn tốc độ, thử lại sau: ${msg}` :
      r.status === 401 ? "Phiên OpenRouter hết hạn, hãy đăng nhập lại." : `OpenRouter lỗi ${r.status}: ${msg}`,
    );
  }
  return j as T;
}

export interface KeyInfo {
  label: string;
  limit: number | null;
  limit_remaining: number | null;
  limit_reset: string | null;
  usage: number;
  usage_daily: number;
  usage_monthly: number;
  is_free_tier: boolean;
  free_model_daily_requests?: { used: number; limit: number; remaining: number };
}
export const keyInfo = () => orFetch<{ data: KeyInfo }>("/key").then((r) => r.data);

export interface OrModel {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt: string; completion: string };
  supported_parameters: string[];
}
let modelCache: OrModel[] | null = null;
/** Models able to call tools (needed to read PhaiBay data). */
export async function toolModels(): Promise<OrModel[]> {
  if (modelCache) return modelCache;
  const r = await orFetch<{ data: OrModel[] }>("/models?supported_parameters=tools");
  // ":batch" variants are for the async batch API, not interactive chat
  modelCache = r.data.filter((m) => m.supported_parameters?.includes("tools") && !m.id.endsWith(":batch"));
  return modelCache;
}

/** USD per 1M tokens, from OpenRouter's per-token string price. */
export const perMillion = (p: string) => Number(p) * 1e6;

// ---------- chat completions (OpenAI format) ----------

export interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
export type ChatMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export interface ToolDef { type: "function"; function: { name: string; description: string; parameters: object } }

interface Completion {
  choices: { message: { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }; finish_reason: string }[];
  usage?: { prompt_tokens: number; completion_tokens: number; cost?: number };
}

export function complete(model: string, messages: ChatMsg[], tools: ToolDef[], signal?: AbortSignal) {
  return orFetch<Completion>("/chat/completions", {
    method: "POST",
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", usage: { include: true } }),
  }, signal);
}
