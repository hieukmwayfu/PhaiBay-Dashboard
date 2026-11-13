// Client for the server-side AI agent (Codex / Claude Code running next to the PhaiBay server).
import { api, getServerUrl, getToken } from "./api";

export type Provider = "codex" | "claude";

export interface CodexLimit { name: "primary" | "secondary"; used_percent: number; window_mins: number; resets_at: number }
export interface CodexAccount {
  type: string; email?: string; plan?: string; workspace?: string; limits: CodexLimit[];
  credits?: { hasCredits: boolean; unlimited: boolean; balance?: string | null }; limit_reached?: string | null; fetched_at: number;
}
export interface AgentStatus {
  codex: { installed: boolean; logged_in?: boolean; detail?: string; account?: CodexAccount; login_pending?: { url: string; code: string }; login_error?: string };
  claude: { installed: boolean; has_key: boolean; key_hint?: string; spent_usd?: number; version?: string };
}

export interface AgentEvent {
  type: "thread" | "text" | "thinking" | "tool" | "usage" | "report" | "warn" | "error" | "done";
  thread_id?: string;
  id?: string;
  text?: string;
  name?: string;
  args?: unknown;
  status?: string;
  done?: boolean;
  message?: string;
  title?: string;
  usage?: Record<string, number>;
}

export interface Report {
  id: number; app_id: number; title: string; provider: string; model: string;
  prompt?: string; content?: string; from: string; to: string; created_at: number;
}

export const agentStatus = (fresh = false) => api<AgentStatus>("/api/agent/status", fresh ? { fresh: 1 } : {});
export const agentLogin = (provider: Provider) => api<{ url: string; code: string }>("/api/agent/login", {}, { method: "POST", body: JSON.stringify({ provider }) });
export const agentLogout = (provider: Provider) => api("/api/agent/logout", {}, { method: "POST", body: JSON.stringify({ provider }) });
export const setClaudeKey = (key: string) => api("/api/agent/claude-key", {}, { method: "POST", body: JSON.stringify({ key }) });
export const listReports = (app: number) => api<Report[]>("/api/reports", { app });
export const getReport = (id: number) => api<Report>(`/api/reports/${id}`);
export const deleteReport = (id: number) => api(`/api/reports/${id}`, {}, { method: "DELETE" });

export interface RunBody {
  provider: Provider; app_id: number; prompt: string; thread_id?: string; mode: "chat" | "analyze";
  title?: string; from: string; to: string; filters: Record<string, string>; model?: string;
}

/** POST /api/agent/run and feed every server-sent event to onEvent until the stream ends. */
export async function runAgent(body: RunBody, onEvent: (e: AgentEvent) => void, signal: AbortSignal) {
  const r = await fetch(new URL("/api/agent/run", getServerUrl()), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error || `HTTP ${r.status}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try { onEvent(JSON.parse(line.slice(5).trim()) as AgentEvent); } catch { /* ignore partial */ }
      }
    }
  }
}
