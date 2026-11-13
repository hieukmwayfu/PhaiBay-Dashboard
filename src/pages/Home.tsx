import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { APP_KEY_RE, appsSummary, createApp, listApps, type AppSummary } from "../lib/api";
import { fmt } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { Card, ErrorBox, Loading } from "../components/ui";

function ago(ms: number) {
  if (!ms) return "chưa có event";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s trước`;
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

/** Home: every app at a glance. Pick one to drill in. */
export function Home() {
  const { dates } = useDash();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const r = useLoad(() => appsSummary(dates.from, dates.to), [dates.from, dates.to]);
  const apps = r.data?.apps ?? [];
  const tot = apps.reduce((t, a) => ({ users: t.users + a.users, events: t.events + a.events, new_users: t.new_users + a.new_users }), { users: 0, events: 0, new_users: 0 });

  return (
    <main className="mx-auto max-w-[1400px] space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">Tất cả app</h1>
        <Loading on={r.loading} />
        <span className="text-sm muted">{apps.length} app · {fmt(tot.users)} users · {fmt(tot.new_users)} user mới · {fmt(tot.events)} events</span>
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Tạo app</button>
      </div>
      <ErrorBox error={r.error} />

      {r.data && apps.length === 0 && (
        <Card>
          <div className="py-10 text-center">
            <p className="mb-3 muted">Chưa có app nào.</p>
            <button className="btn-primary" onClick={() => setCreating(true)}>+ Tạo app đầu tiên</button>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {apps.map((a) => <AppCard key={a.id} a={a} onOpen={() => nav(`/app/${a.id}`)} />)}
      </div>

      {creating && <CreateAppDialog onClose={() => setCreating(false)} onCreated={(id) => nav(`/app/${id}/setup`)} />}
    </main>
  );
}

function AppCard({ a, onOpen }: { a: AppSummary; onOpen: () => void }) {
  const live = a.last_event_at && Date.now() - a.last_event_at < 10 * 60_000;
  return (
    <button onClick={onOpen} className="card text-left transition hover:border-brand">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{a.name}</div>
          <code className="block truncate text-xs muted">{a.app_key}</code>
        </div>
        <span className={`mt-1 inline-flex items-center gap-1 text-xs ${live ? "text-emerald-500" : "muted"}`}>
          <span className={`inline-block h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-zinc-400"}`} />
          {ago(a.last_event_at)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[["Users", a.users], ["Mới", a.new_users], ["Sessions", a.sessions], ["Events", a.events]].map(([l, v]) => (
          <div key={l as string}>
            <div className="text-lg font-bold tabular-nums">{fmt(v as number)}</div>
            <div className="text-xs muted">{l}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={a.daily_users.map((v, i) => ({ i, v }))}>
            <Line type="monotone" dataKey="v" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </button>
  );
}

function CreateAppDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { setApps } = useDash();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const keyBad = key.trim() !== "" && !APP_KEY_RE.test(key.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || keyBad) return;
    setBusy(true);
    setErr("");
    try {
      const a = await createApp(name.trim(), key.trim());
      setApps(await listApps());
      onCreated(a.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form className="card w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3 className="card-title">Tạo app</h3>
        <label className="block text-xs muted">Tên app
          <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Housify" autoFocus required />
        </label>
        <label className="block text-xs muted">App key
          <input className="input mt-1 w-full font-mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder="vd: com.company.game (để trống = tự sinh)" />
        </label>
        <p className="text-xs muted">
          SDK dùng key này để biết event thuộc app nào. Có thể đặt bằng package name / bundle id.
          3–100 ký tự: chữ, số, <code>.</code> <code>_</code> <code>-</code>.{" "}
          <b className="text-amber-600 dark:text-amber-400">Không thể đổi sau khi tạo.</b>
        </p>
        {keyBad && <div className="text-xs text-red-500">App key không hợp lệ.</div>}
        {err && <div className="text-sm text-red-500">{err}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button className="btn-primary" disabled={busy || !name.trim() || keyBad}>{busy ? "Đang tạo…" : "Tạo"}</button>
        </div>
      </form>
    </div>
  );
}
