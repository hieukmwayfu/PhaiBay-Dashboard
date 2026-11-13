import { useEffect, useRef, useState } from "react";
import { storage } from "../lib/api";
import { useDash } from "../lib/state";
import {
  agentLogin, agentLogout, agentStatus, deleteReport, getReport, listReports, runAgent, setClaudeKey,
  type AgentEvent, type AgentStatus, type Provider, type Report,
} from "../lib/agent";
import { Icon } from "./Icon";
import { Markdown } from "./Markdown";
import { CopyButton, ErrorBox, Loading, Segmented } from "./ui";

interface ToolStep { id: string; name: string; args?: unknown; done: boolean; ok: boolean }
interface Msg { role: "user" | "assistant"; text: string; tools: ToolStep[]; error?: string; report?: { id: number; title: string } }

const QUICK = [
  "Xu hướng user 2 tuần qua thế nào?",
  "Người chơi bỏ cuộc ở level nào nhiều nhất?",
  "So sánh các quốc gia: nước nào đáng đầu tư?",
  "Version mới nhất tốt hơn hay tệ hơn?",
];

const ANALYZE_PROMPT = "Phân tích toàn diện app trong khoảng ngày đang xem.";

/** Right-side AI agent panel: Codex / Claude Code with PhaiBay MCP tools, chat (not stored) + saved analyses. */
export function AgentPanel({ onClose }: { onClose: () => void }) {
  const { apps, appId, dates, q } = useDash();
  const app = apps.find((a) => a.id === appId);
  const [provider, setProviderS] = useState<Provider>(storage.get("agent_provider", "codex"));
  const setProvider = (p: Provider) => { setProviderS(p); storage.set("agent_provider", p); };
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [tab, setTab] = useState<"chat" | "reports">("chat");
  const [err, setErr] = useState("");

  const refresh = () => agentStatus().then(setStatus).catch((e: Error) => setErr(e.message));
  useEffect(() => { refresh(); }, []);

  // poll while a Codex device login is pending
  const pending = status?.codex.login_pending;
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [pending?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = provider === "codex" ? !!status?.codex.logged_in : !!(status?.claude.installed && status.claude.has_key);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-3">
        <Icon name="sparkles" size={16} className="text-dim" />
        <span className="text-[13px] font-semibold">AI agent</span>
        <div className="ml-2">
          <Segmented<Provider> value={provider} onChange={setProvider} options={[{ v: "codex", label: "Codex" }, { v: "claude", label: "Claude" }]} />
        </div>
        <button className="btn-ghost ml-auto !h-7 !px-1.5" onClick={onClose} aria-label="Đóng"><Icon name="x" size={16} /></button>
      </div>

      {err && <div className="px-3 pt-3"><ErrorBox error={err} /></div>}
      {!status && <div className="p-4"><Loading on /></div>}

      {status && !ready && (
        provider === "codex"
          ? <CodexLogin status={status} onChange={refresh} />
          : <ClaudeSetup status={status} onChange={refresh} />
      )}

      {status && ready && !app && (
        <div className="p-4 text-[13px] muted">Mở một app để AI phân tích dữ liệu của app đó.</div>
      )}

      {status && ready && app && (
        <>
          <div className="flex shrink-0 items-center gap-4 border-b border-line px-3">
            {(["chat", "reports"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`-mb-px border-b-2 py-2 text-[13px] ${tab === t ? "border-accent font-medium text-fg" : "border-transparent muted hover:text-fg"}`}>
                {t === "chat" ? "Chat" : "Bản phân tích"}
              </button>
            ))}
            <span className="ml-auto truncate text-xs muted" title={provider === "codex" ? status.codex.detail : "Anthropic API key"}>
              {provider === "codex" ? "ChatGPT" : "API key"} · {app.name}
            </span>
          </div>
          {/* keep the chat mounted when looking at reports */}
          <div className={tab === "chat" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
            <Chat key={`${provider}-${app.id}`} provider={provider} appId={app.id} dates={dates} filters={q()} onReport={() => setTab("reports")} />
          </div>
          {tab === "reports" && <Reports appId={app.id} />}
          <div className="shrink-0 border-t border-line px-3 py-1.5 text-[11px] muted">
            {provider === "codex"
              ? <>Codex · {status.codex.detail} · <button className="hover:text-fg" onClick={() => agentLogout("codex").then(refresh)}>Đăng xuất</button></>
              : <>Claude Code · API key · <button className="hover:text-fg" onClick={() => setClaudeKey("").then(refresh)}>Xoá key</button></>}
          </div>
        </>
      )}
    </div>
  );
}

function CodexLogin({ status, onChange }: { status: AgentStatus; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const p = status.codex.login_pending;
  if (!status.codex.installed) {
    return <div className="p-4 text-[13px] muted">Codex CLI chưa được cài trên máy chạy server PhaiBay. Cài Codex rồi khởi động lại server.</div>;
  }
  const start = async () => {
    setBusy(true); setErr("");
    try { await agentLogin("codex"); onChange(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="text-[15px] font-semibold">Đăng nhập Codex</div>
        <p className="mt-1 text-[13px] muted">Dùng tài khoản ChatGPT của bạn. Agent chạy trên máy chủ PhaiBay và chỉ đọc được dữ liệu analytics.</p>
      </div>
      {err && <ErrorBox error={err} />}
      {status.codex.login_error && <ErrorBox error={status.codex.login_error} />}
      {!p ? (
        <button className="btn-primary w-full" onClick={start} disabled={busy}>{busy ? "Đang lấy mã…" : "Đăng nhập bằng ChatGPT"}</button>
      ) : (
        <div className="space-y-3 rounded-lg border border-line p-3 text-[13px]">
          <div>
            <div className="label">1. Mở trang đăng nhập</div>
            <a href={p.url} target="_blank" rel="noreferrer" className="btn w-full">Mở {new URL(p.url).host} <Icon name="arrowRight" size={14} /></a>
          </div>
          <div>
            <div className="label">2. Nhập mã (hết hạn sau 15 phút)</div>
            <div className="flex items-center gap-2 rounded-md border border-line px-3 py-2">
              <code className="flex-1 font-mono text-[17px] font-semibold tracking-widest">{p.code}</code>
              <CopyButton text={p.code} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs muted"><Loading on /> Đang chờ bạn đăng nhập…</div>
          <p className="text-[11px] muted">Chỉ nhập mã này nếu chính bạn vừa bấm đăng nhập ở đây.</p>
        </div>
      )}
    </div>
  );
}

function ClaudeSetup({ status, onChange }: { status: AgentStatus; onChange: () => void }) {
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  if (!status.claude.installed) {
    return (
      <div className="space-y-2 p-4 text-[13px]">
        <div className="text-[15px] font-semibold">Claude Code chưa được cài</div>
        <p className="muted">Cài Claude Code trên máy chạy server PhaiBay, rồi khởi động lại server:</p>
        <pre className="code p-2">npm install -g @anthropic-ai/claude-code</pre>
        <p className="text-xs muted">Claude dùng Anthropic API key (Anthropic không cho web bên thứ ba đăng nhập bằng tài khoản Claude.ai).</p>
      </div>
    );
  }
  const save = async () => {
    setErr("");
    try { await setClaudeKey(key.trim()); setKey(""); onChange(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="space-y-3 p-4 text-[13px]">
      <div className="text-[15px] font-semibold">Anthropic API key</div>
      <p className="muted">Lấy ở console.anthropic.com. Key lưu trên server PhaiBay, chỉ dùng để chạy Claude Code.</p>
      <input className="input w-full font-mono" type="password" placeholder="sk-ant-…" value={key} onChange={(e) => setKey(e.target.value)} />
      {err && <ErrorBox error={err} />}
      <button className="btn-primary w-full" onClick={save} disabled={!key.trim()}>Lưu key</button>
    </div>
  );
}

function Chat({ provider, appId, dates, filters, onReport }: {
  provider: Provider; appId: number; dates: { from: string; to: string }; filters: Record<string, unknown>; onReport: () => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thread, setThread] = useState<string | undefined>();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  const send = async (text: string, mode: "chat" | "analyze") => {
    text = text.trim();
    if (!text || busy) return;
    setInput("");
    const reply: Msg = { role: "assistant", text: "", tools: [] };
    const base: Msg[] = [...msgs, { role: "user", text: mode === "analyze" ? "Tạo bản phân tích" : text, tools: [] }];
    setMsgs([...base, reply]);
    setBusy(true);
    const ac = new AbortController();
    abort.current = ac;
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(filters)) if (!["app", "from", "to"].includes(k) && v != null) f[k] = String(v);
    const texts: string[] = [];
    const update = () => setMsgs([...base, { ...reply, tools: [...reply.tools] }]);
    try {
      await runAgent({
        provider, app_id: appId, prompt: text, thread_id: mode === "chat" ? thread : undefined, mode,
        from: dates.from, to: dates.to, filters: f,
      }, (e: AgentEvent) => {
        switch (e.type) {
          case "thread": if (mode === "chat" && e.thread_id) setThread(e.thread_id); break;
          case "text": texts.push(e.text ?? ""); reply.text = texts.join("\n\n"); update(); break;
          case "tool": {
            const i = reply.tools.findIndex((t) => t.id === e.id);
            const step = { id: e.id ?? String(reply.tools.length), name: e.name ?? "tool", args: e.args, done: !!e.done, ok: e.status !== "failed" };
            if (i >= 0) reply.tools[i] = step; else reply.tools.push(step);
            update();
            break;
          }
          case "report": reply.report = { id: Number((e as { id?: unknown }).id), title: e.title ?? "" }; update(); break;
          case "error": reply.error = e.message; update(); break;
        }
      }, ac.signal);
    } catch (e) {
      if ((e as Error).name !== "AbortError") reply.error = (e as Error).message;
      else reply.error = "Đã dừng.";
      update();
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <>
      <div className="min-h-0 flex-1 space-y-5 overflow-auto px-3 py-4">
        {msgs.length === 0 && (
          <div className="space-y-4">
            <p className="text-[13px] muted">Hỏi về dữ liệu của app. AI tự lấy số liệu qua công cụ đọc dữ liệu của PhaiBay. Cuộc chat không được lưu.</p>
            <button className="btn w-full justify-start" onClick={() => send(ANALYZE_PROMPT, "analyze")}>
              <Icon name="sparkles" size={14} className="muted" /> Tạo bản phân tích (lưu lại)
            </button>
            <div className="space-y-1.5">
              {QUICK.map((qq) => (
                <button key={qq} onClick={() => send(qq, "chat")} className="block w-full rounded-md border border-line px-3 py-2 text-left text-[13px] hover:bg-raised">{qq}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="max-w-[88%] whitespace-pre-wrap rounded-lg bg-raised px-3 py-2 text-[13px]">{m.text}</div>
          </div>
        ) : (
          <div key={i} className="space-y-2">
            {m.tools.length > 0 && (
              <div className="space-y-1">
                {m.tools.map((t) => (
                  <div key={t.id} className="flex items-center gap-1.5 text-xs muted" title={JSON.stringify(t.args)}>
                    {!t.done ? <Loading on /> : <Icon name={t.ok ? "check" : "x"} size={12} className={t.ok ? "text-good" : "text-bad"} />}
                    <span className="font-mono">{t.name}</span>
                    <span className="truncate">{argSummary(t.args)}</span>
                  </div>
                ))}
              </div>
            )}
            {m.text && <Markdown text={m.text} />}
            {!m.text && !m.error && busy && i === msgs.length - 1 && <div className="flex items-center gap-2 text-xs muted"><Loading on /> Đang làm việc…</div>}
            {m.error && <ErrorBox error={m.error} />}
            {m.report && (
              <button className="btn" onClick={onReport}><Icon name="check" size={14} className="text-good" /> Đã lưu: {m.report.title}</button>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="shrink-0 border-t border-line p-3">
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(input, "chat"); }}>
          <textarea className="input min-h-[36px] flex-1 resize-none py-2 leading-snug" rows={2} value={input}
            placeholder="Hỏi về dữ liệu… (Enter gửi)" onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input, "chat"); } }} />
          {busy
            ? <button type="button" className="btn" onClick={() => abort.current?.abort()}>Dừng</button>
            : <button className="btn-primary !px-2.5" disabled={!input.trim()} aria-label="Gửi"><Icon name="arrowUp" size={16} strokeWidth={2.2} /></button>}
        </form>
        <div className="mt-2 flex items-center gap-3 text-xs">
          <button className="muted hover:text-fg disabled:opacity-40" disabled={busy} onClick={() => send(ANALYZE_PROMPT, "analyze")}>
            <Icon name="sparkles" size={12} className="mr-1 inline" />Phân tích
          </button>
          {msgs.length > 0 && <button className="muted hover:text-fg disabled:opacity-40" disabled={busy} onClick={() => { setMsgs([]); setThread(undefined); }}>Chat mới</button>}
        </div>
      </div>
    </>
  );
}

function argSummary(a: unknown) {
  if (!a || typeof a !== "object") return "";
  return Object.entries(a as Record<string, unknown>)
    .filter(([k]) => !["app_id", "from", "to"].includes(k))
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" ");
}

function Reports({ appId }: { appId: number }) {
  const [list, setList] = useState<Report[] | null>(null);
  const [open, setOpen] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const load = () => listReports(appId).then(setList).catch((e: Error) => setErr(e.message));
  useEffect(() => { load(); }, [appId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (open) {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
        <button className="mb-2 inline-flex items-center gap-1 text-[13px] muted hover:text-fg" onClick={() => setOpen(null)}><Icon name="back" size={14} /> Bản phân tích</button>
        <div className="mb-1 text-[15px] font-semibold">{open.title}</div>
        <div className="mb-4 text-xs muted">{new Date(open.created_at * 1000).toLocaleString()} · {open.provider}{open.from ? ` · ${open.from} → ${open.to}` : ""}</div>
        <Markdown text={open.content ?? ""} />
        <div className="mt-6 flex gap-2 border-t border-line pt-3">
          <CopyButton text={open.content ?? ""} label="Copy markdown" />
          <button className="btn-ghost !h-7 text-xs hover:text-bad" onClick={async () => { await deleteReport(open.id); setOpen(null); load(); }}>
            <Icon name="x" size={13} /> Xoá
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <ErrorBox error={err} />
      {!list && <div className="p-3"><Loading on /></div>}
      {list && list.length === 0 && <p className="p-4 text-[13px] muted">Chưa có bản phân tích nào. Bấm "Phân tích" ở tab Chat để tạo.</p>}
      {list?.map((r) => (
        <button key={r.id} onClick={() => getReport(r.id).then(setOpen).catch((e: Error) => setErr(e.message))}
          className="block w-full border-b border-line px-3 py-2.5 text-left hover:bg-raised">
          <div className="truncate text-[13px] font-medium">{r.title}</div>
          <div className="text-xs muted">{new Date(r.created_at * 1000).toLocaleString()} · {r.provider}{r.from ? ` · ${r.from} → ${r.to}` : ""}</div>
        </button>
      ))}
    </div>
  );
}
