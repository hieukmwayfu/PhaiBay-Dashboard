import { useEffect, useState } from "react";
import { api, type RawEvent } from "../lib/api";
import { useDash, useLoad } from "../lib/state";
import { Icon } from "../components/Icon";
import { Card, Empty, ErrorBox, Skeleton } from "../components/ui";

function KV({ obj }: { obj?: Record<string, unknown> }) {
  if (!obj) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(obj).map(([k, v]) => (
        <span key={k} className="inline-flex max-w-full items-center overflow-hidden rounded-md border border-line font-mono text-[11px]">
          <span className="bg-raised px-1.5 py-0.5 muted">{k}</span>
          <span className="truncate px-1.5 py-0.5">{String(v)}</span>
        </span>
      ))}
    </div>
  );
}

export function Debug() {
  const { q, refresh } = useDash();
  const [user, setUser] = useState("");
  const [applied, setApplied] = useState("");
  const [auto, setAuto] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const r = useLoad(() => api<RawEvent[]>("/api/stream", q({ limit: 200, user: applied })), [q, applied]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => !document.hidden && refresh(), 5000);
    return () => clearInterval(t);
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (u: string) => { setUser(u); setApplied(u); };

  return (
    <Card pad={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 muted" />
          <input className="input w-full !pl-9 font-mono text-[13px]" placeholder="user_id hoặc uid (Enter để lọc)" value={user}
            onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setApplied(user.trim())} />
        </div>
        {applied && <button className="chip hover:border-bad/40" onClick={() => pick("")}>user: <b className="font-mono">{applied.slice(0, 12)}</b> <Icon name="x" size={11} /></button>}
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => setAuto(!auto)}
            className={`inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[13px] transition-colors ${auto ? "border-line text-fg" : "border-line muted hover:bg-raised"}`}>
            <span className={`h-2 w-2 rounded-full ${auto ? "bg-good animate-pulse2" : "bg-dim/50"}`} />
            {auto ? "Live · 5s" : "Tạm dừng"}
          </button>
        </div>
      </div>

      <div className="p-4 pt-2">
        <ErrorBox error={r.error} />
        {!r.data && r.loading && <div className="space-y-2 pt-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>}
        {r.data && r.data.length === 0 && <Empty icon="pulse">Chưa có event nào. Bắn thử từ game rồi đợi vài giây.</Empty>}
        <div className="max-h-[calc(100vh-240px)] overflow-auto">
          {r.data?.map((e) => {
            const isOpen = open === e.id;
            return (
              <div key={e.id} className="border-b border-line/60 last:border-0">
                <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-raised/70" onClick={() => setOpen(isOpen ? null : e.id)}>
                  <span className="w-[72px] shrink-0 font-mono text-xs tabular muted">{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className="w-40 shrink-0 truncate font-mono font-semibold sm:w-56" title={e.name}>{e.name}</span>
                  <span className="hidden min-w-0 flex-1 truncate font-mono text-xs muted md:block">
                    {e.params ? Object.entries(e.params).map(([k, v]) => `${k}=${v}`).join("  ") : ""}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {e.platform && <span className="chip !py-0 text-[11px]">{e.platform}</span>}
                    {e.country && <span className="chip !py-0 text-[11px]">{e.country}</span>}
                    {e.app_version && <span className="chip hidden !py-0 text-[11px] sm:inline-flex">v{e.app_version}</span>}
                  </span>
                  <Icon name="chevron" size={14} className={`shrink-0 muted transition ${isOpen ? "rotate-90" : ""}`} />
                </button>
                {isOpen && (
                  <div className="mb-3 ml-2 grid gap-3 rounded-md border border-line bg-raised/40 p-3 text-xs sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="font-semibold">Params</div>
                      {e.params ? <KV obj={e.params} /> : <span className="muted">—</span>}
                      <div className="pt-2 font-semibold">User properties</div>
                      {e.uprops ? <KV obj={e.uprops} /> : <span className="muted">—</span>}
                    </div>
                    <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1">
                      <dt className="muted">Thời gian</dt><dd className="font-mono">{new Date(e.ts).toLocaleString()}</dd>
                      <dt className="muted">User</dt>
                      <dd className="min-w-0"><button className="max-w-full truncate font-mono text-accent hover:underline" onClick={() => pick(e.user_id)}>{e.user_id}</button></dd>
                      {e.uid && <><dt className="muted">UID</dt><dd className="truncate font-mono">{e.uid}</dd></>}
                      {e.session_id && <><dt className="muted">Session</dt><dd className="truncate font-mono">{e.session_id}</dd></>}
                      <dt className="muted">Thiết bị</dt><dd className="truncate">{e.device || "—"} · {e.os || "—"}</dd>
                      <dt className="muted">Ngôn ngữ</dt><dd>{e.lang || "—"}</dd>
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
