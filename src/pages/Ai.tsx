import { useEffect, useMemo, useRef, useState } from "react";
import { storage } from "../lib/api";
import { useDash } from "../lib/state";
import {
  complete, finishOrLogin, getOrKey, keyInfo, orLogout, perMillion, startOrLogin, toolModels,
  type ChatMsg, type KeyInfo, type OrModel,
} from "../lib/openrouter";
import { runTool, systemPrompt, TOOL_DEFS, type ToolCtx } from "../lib/aiTools";
import { Icon } from "../components/Icon";
import { Markdown } from "../components/Markdown";
import { Card, ErrorBox, Loading } from "../components/ui";

interface ToolRun { name: string; args: string; ok?: boolean; size?: number }
interface UiMsg { role: "user" | "assistant"; content: string; tools?: ToolRun[]; cost?: number; error?: boolean }

const PREFERRED = ["openai/gpt-5-mini", "openai/gpt-5", "openai/gpt-4.1-mini", "openai/gpt-4o-mini", "anthropic/claude-sonnet-4.5", "google/gemini-2.5-flash"];
const MAX_ROUNDS = 10;

const ANALYZE = `Hãy phân tích toàn diện app này trong khoảng ngày đang chọn:
1. Tổng quan users, user mới, sessions, events và xu hướng theo ngày; so sánh với kỳ trước cùng độ dài.
2. Top events và event nào bất thường (tăng/giảm mạnh).
3. Phân bố theo quốc gia, platform, version: nhóm nào nổi bật hoặc có vấn đề.
4. Nếu có event level_start / level_end: tỉ lệ thắng và level nào người chơi hay thua / bỏ cuộc.
5. Kết luận 3–5 insight quan trọng nhất và đề xuất hành động cụ thể.`;

const QUICK = [
  { icon: "chart" as const, label: "Xu hướng user 2 tuần", text: "Xu hướng active users và user mới theo ngày thế nào? So với kỳ trước ra sao?" },
  { icon: "funnel" as const, label: "Người chơi rơi ở đâu", text: "Người chơi bỏ cuộc ở level / bước nào nhiều nhất? Dùng funnel và phân bố level_end để phân tích." },
  { icon: "globe" as const, label: "So sánh quốc gia", text: "So sánh các quốc gia: users, events / user, tỉ lệ thắng level. Quốc gia nào đáng đầu tư?" },
  { icon: "box" as const, label: "Version mới có tốt hơn?", text: "So sánh các app version: version mới nhất có chỉ số tốt hơn hay tệ hơn các version trước?" },
  { icon: "bolt" as const, label: "Quảng cáo & IAP", text: "Phân tích ad_impression và purchase: số lần, theo định dạng quảng cáo / item, theo quốc gia." },
];

function usd(n?: number | null) {
  if (n == null) return "–";
  return "$" + (n < 1 ? n.toFixed(4) : n.toFixed(2));
}

export function Ai() {
  const { apps, appId, dates, q } = useDash();
  const app = apps.find((a) => a.id === appId)!;
  const [key, setKey] = useState(getOrKey());
  const [err, setErr] = useState("");
  const [info, setInfo] = useState<KeyInfo | null>(null);
  const [models, setModels] = useState<OrModel[]>([]);
  const [model, setModelS] = useState<string>(storage.get("or_model", ""));
  const histKey = `ai_chat_${appId}`;
  const [msgs, setMsgs] = useState<UiMsg[]>(() => storage.get(histKey, [] as UiMsg[]));
  const history = useRef<ChatMsg[]>(storage.get(histKey + "_llm", [] as ChatMsg[]));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [input, setInput] = useState("");
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const setModel = (m: string) => { setModelS(m); storage.set("or_model", m); };

  // OAuth redirect back with ?code=
  useEffect(() => {
    finishOrLogin().then((ok) => ok && setKey(getOrKey())).catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!key) { setInfo(null); return; }
    keyInfo().then(setInfo).catch((e: Error) => { setErr(e.message); setKey(getOrKey()); });
    toolModels().then((ms) => {
      setModels(ms);
      if (!ms.some((m) => m.id === model)) setModel(PREFERRED.find((p) => ms.some((m) => m.id === p)) ?? ms[0]?.id ?? "");
    }).catch((e: Error) => setErr(e.message));
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, status]);

  const persist = (ui: UiMsg[]) => {
    storage.set(histKey, ui.slice(-40));
    storage.set(histKey + "_llm", history.current.slice(-60));
  };

  const ctx: ToolCtx = useMemo(() => {
    const full = q();
    const filters = Object.fromEntries(Object.entries(full).filter(([k]) => !["app", "from", "to"].includes(k)));
    return { appId: app.id, appName: app.name, appKey: app.app_key, from: dates.from, to: dates.to, filters };
  }, [q, app, dates]);

  const send = async (text: string) => {
    text = text.trim();
    if (!text || busy || !model) return;
    setErr("");
    setInput("");
    const ui: UiMsg[] = [...msgs, { role: "user", content: text }];
    const reply: UiMsg = { role: "assistant", content: "", tools: [], cost: 0 };
    setMsgs([...ui, reply]);
    history.current.push({ role: "user", content: text });
    setBusy(true);
    const ac = new AbortController();
    abort.current = ac;
    try {
      for (let round = 0; round < MAX_ROUNDS; round++) {
        setStatus(round === 0 ? "Đang suy nghĩ…" : "Đang phân tích dữ liệu…");
        // keep the conversation bounded: system + last turns
        const res = await complete(model, [{ role: "system", content: systemPrompt(ctx) }, ...history.current.slice(-40)], TOOL_DEFS, ac.signal);
        reply.cost = (reply.cost ?? 0) + (res.usage?.cost ?? 0);
        const m = res.choices?.[0]?.message;
        if (!m) throw new Error("Model không trả lời.");
        if (m.tool_calls?.length) {
          history.current.push({ role: "assistant", content: m.content ?? null, tool_calls: m.tool_calls });
          for (const tc of m.tool_calls) {
            const run: ToolRun = { name: tc.function.name, args: tc.function.arguments };
            reply.tools = [...(reply.tools ?? []), run];
            setMsgs([...ui, { ...reply }]);
            setStatus(`Đang lấy dữ liệu: ${tc.function.name}`);
            const r = await runTool(tc.function.name, tc.function.arguments, ctx);
            run.ok = r.ok;
            run.size = r.text.length;
            history.current.push({ role: "tool", tool_call_id: tc.id, content: r.text });
            setMsgs([...ui, { ...reply }]);
          }
          continue;
        }
        reply.content = m.content ?? "";
        history.current.push({ role: "assistant", content: reply.content });
        break;
      }
      if (!reply.content) reply.content = "_Dừng lại vì đã gọi quá nhiều tool. Hãy hỏi cụ thể hơn._";
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      reply.content = aborted ? "_Đã dừng._" : (e as Error).message;
      reply.error = !aborted;
      // drop the unanswered user turn so the next request stays valid
      while (history.current.length && history.current[history.current.length - 1].role !== "assistant") history.current.pop();
      if (!getOrKey()) setKey("");
    } finally {
      const final = [...ui, { ...reply }];
      setMsgs(final);
      persist(final);
      setBusy(false);
      setStatus("");
      abort.current = null;
      if (getOrKey()) keyInfo().then(setInfo).catch(() => {});
    }
  };

  const clear = () => { history.current = []; setMsgs([]); persist([]); };
  const login = () => startOrLogin(location.origin + location.pathname).catch((e: Error) => setErr(e.message));
  const logout = () => { orLogout(); setKey(""); setInfo(null); };
  const cur = models.find((m) => m.id === model);

  if (!key) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorBox error={err} />
        <Card>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-lg">
              <Icon name="sparkles" size={30} />
            </span>
            <div>
              <h2 className="text-xl font-bold">AI phân tích dữ liệu</h2>
              <p className="mx-auto mt-2 max-w-md text-sm muted">
                Hỏi bằng tiếng Việt, AI tự lấy số liệu của <b className="text-fg">{app.name}</b> (overview, events, funnel, quốc gia, version…) rồi phân tích và đề xuất.
              </p>
            </div>
            <button className="btn-primary h-11 px-5 text-[15px]" onClick={login}>
              <Icon name="key" size={18} /> Đăng nhập OpenRouter
            </button>
            <ul className="mt-2 space-y-1.5 text-left text-xs muted">
              <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 text-good" />Dùng credit và giới hạn của chính tài khoản OpenRouter bạn đăng nhập (chọn được GPT, Claude, Gemini…).</li>
              <li className="flex gap-2"><Icon name="check" size={14} className="mt-0.5 text-good" />Key chỉ lưu trong trình duyệt này, không gửi lên server PhaiBay.</li>
              <li className="flex gap-2"><Icon name="lock" size={14} className="mt-0.5 text-warn" />Số liệu AI đọc sẽ được gửi tới OpenRouter và nhà cung cấp model bạn chọn.</li>
            </ul>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      {/* chat */}
      <Card pad={false} className="flex min-h-[calc(100vh-150px)] flex-col">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><Icon name="sparkles" size={16} /></span>
          <div className="min-w-0">
            <div className="text-sm font-semibold">AI phân tích · {app.name}</div>
            <div className="truncate text-xs muted">{dates.from} → {dates.to}{Object.keys(ctx.filters).length ? ` · ${Object.keys(ctx.filters).length} bộ lọc` : ""}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {msgs.length > 0 && <button className="btn-ghost text-xs" onClick={clear} disabled={busy}><Icon name="x" size={14} /> Chat mới</button>}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-auto px-5 py-5">
          {msgs.length === 0 && (
            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <div>
                <div className="text-lg font-semibold">Hỏi gì về dữ liệu game?</div>
                <p className="mt-1 text-sm muted">Hoặc bấm <b className="text-fg">Phân tích</b> để AI tự soi toàn bộ app.</p>
              </div>
              <button className="btn-primary h-11 px-6" onClick={() => send(ANALYZE)} disabled={!model}>
                <Icon name="sparkles" size={17} /> Phân tích ngay
              </button>
              <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
                {QUICK.map((s) => (
                  <button key={s.label} onClick={() => send(s.text)} disabled={!model}
                    className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Icon name={s.icon} size={16} /></span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-accent-fg shadow-sm">{m.content}</div>
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><Icon name="sparkles" size={14} /></span>
              <div className="min-w-0 flex-1">
                {m.tools && m.tools.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {m.tools.map((t, j) => (
                      <span key={j} title={t.args} className={`chip font-mono text-[11px] ${t.ok === false ? "border-bad/40 text-bad" : ""}`}>
                        {t.ok === undefined ? <Loading on /> : <Icon name={t.ok ? "check" : "x"} size={12} className={t.ok ? "text-good" : ""} />}
                        {t.name}
                        {t.size != null && <span className="muted">{(t.size / 1000).toFixed(1)}k</span>}
                      </span>
                    ))}
                  </div>
                )}
                {m.content ? (
                  m.error ? <ErrorBox error={m.content} /> : <Markdown text={m.content} />
                ) : busy && i === msgs.length - 1 ? (
                  <div className="flex items-center gap-2 text-sm muted"><Loading on /> {status}</div>
                ) : null}
                {!!m.cost && <div className="mt-1.5 text-[11px] muted">Chi phí ≈ {usd(m.cost)}</div>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line p-3">
          {msgs.length > 0 && !busy && (
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
              <button className="chip shrink-0 hover:border-accent/50" onClick={() => send(ANALYZE)}><Icon name="sparkles" size={12} className="text-accent" /> Phân tích lại</button>
              {QUICK.map((s) => <button key={s.label} className="chip shrink-0 hover:border-accent/50" onClick={() => send(s.text)}>{s.label}</button>)}
            </div>
          )}
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <textarea className="input min-h-[44px] flex-1 resize-none py-2.5 leading-snug" rows={1} value={input} placeholder="Hỏi về dữ liệu… (Enter để gửi, Shift+Enter xuống dòng)"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
            {busy
              ? <button type="button" className="btn h-11" onClick={() => abort.current?.abort()}><Icon name="x" size={16} /> Dừng</button>
              : <button className="btn-primary h-11 px-4" disabled={!input.trim() || !model}><Icon name="arrowUp" size={18} strokeWidth={2.2} /></button>}
          </form>
          <ErrorBox error={err} />
        </div>
      </Card>

      {/* account + model */}
      <div className="space-y-4">
        <Card title="Tài khoản OpenRouter" right={<button className="btn-ghost !h-8 text-xs" onClick={logout}><Icon name="logout" size={14} /> Thoát</button>}>
          {!info ? <Loading on /> : (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised"><Icon name="key" size={16} /></span>
                <div className="min-w-0">
                  <div className="truncate font-medium">{info.label || "API key"}</div>
                  <div className="text-xs muted">{info.is_free_tier ? "Free tier" : "Đã nạp credit"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-raised/70 p-3">
                  <div className="text-[11px] muted">Còn lại</div>
                  <div className="text-base font-semibold">{info.limit_remaining == null ? "Không giới hạn" : usd(info.limit_remaining)}</div>
                </div>
                <div className="rounded-xl bg-raised/70 p-3">
                  <div className="text-[11px] muted">Đã dùng tháng này</div>
                  <div className="text-base font-semibold">{usd(info.usage_monthly)}</div>
                </div>
              </div>
              {info.limit != null && (
                <div>
                  <div className="h-2 overflow-hidden rounded-full bg-raised">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (100 * (info.limit - (info.limit_remaining ?? 0))) / Math.max(info.limit, 1e-9))}%` }} />
                  </div>
                  <div className="mt-1 text-[11px] muted">Giới hạn key {usd(info.limit)}{info.limit_reset ? ` · reset ${info.limit_reset}` : ""}</div>
                </div>
              )}
              {info.free_model_daily_requests && (
                <div className="text-xs muted">Model miễn phí hôm nay: {info.free_model_daily_requests.used}/{info.free_model_daily_requests.limit} request</div>
              )}
            </div>
          )}
        </Card>

        <Card title="Model" subtitle="Chỉ hiện model hỗ trợ gọi tool">
          <ModelPicker models={models} value={model} onChange={setModel} />
          {cur && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-raised/70 p-2"><div className="muted">Input / 1M token</div><b>${perMillion(cur.pricing.prompt).toFixed(2)}</b></div>
              <div className="rounded-lg bg-raised/70 p-2"><div className="muted">Output / 1M token</div><b>${perMillion(cur.pricing.completion).toFixed(2)}</b></div>
            </div>
          )}
        </Card>

        <Card title="AI đọc được gì?">
          <ul className="space-y-1.5 text-xs muted">
            {["Tổng quan & xu hướng theo ngày", "Danh sách event, param, user property", "Breakdown theo quốc gia / version / platform / param", "Funnel nhiều bước", "Event thô gần nhất (DebugView)", "Tổng hợp mọi app"].map((t) => (
              <li key={t} className="flex gap-2"><Icon name="check" size={13} className="mt-0.5 text-good" />{t}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] muted">Chỉ đọc, không sửa được gì. Mặc định theo khoảng ngày và bộ lọc đang chọn.</p>
        </Card>
      </div>
    </div>
  );
}

function ModelPicker({ models, value, onChange }: { models: OrModel[]; value: string; onChange: (id: string) => void }) {
  const [qText, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const cur = models.find((m) => m.id === value);
  const list = models
    .filter((m) => !qText || (m.id + " " + m.name).toLowerCase().includes(qText.toLowerCase()))
    .sort((a, b) => (PREFERRED.indexOf(a.id) + 1 || 99) - (PREFERRED.indexOf(b.id) + 1 || 99) || a.name.localeCompare(b.name))
    .slice(0, 80);
  return (
    <div className="relative">
      <button className="input flex w-full items-center gap-2 text-left" onClick={() => setOpen(!open)}>
        <span className="min-w-0 flex-1 truncate">{cur ? cur.name : models.length ? "Chọn model" : "Đang tải…"}</span>
        <Icon name="chevron" size={14} className="rotate-90 muted" />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-line bg-surface p-1 shadow-pop">
          <input className="input mb-1 w-full" autoFocus placeholder="Tìm model (gpt, claude, gemini…)" value={qText} onChange={(e) => setQ(e.target.value)} />
          <div className="max-h-72 overflow-auto">
            {list.map((m) => (
              <button key={m.id} onClick={() => { onChange(m.id); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-raised ${m.id === value ? "bg-accent/10" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.name}</span>
                  <span className="block truncate font-mono text-[10px] muted">{m.id}</span>
                </span>
                <span className="shrink-0 text-[10px] tabular muted">${perMillion(m.pricing.prompt).toFixed(2)}</span>
              </button>
            ))}
            {list.length === 0 && <div className="p-3 text-center text-xs muted">Không tìm thấy</div>}
          </div>
        </div>
      )}
    </div>
  );
}
