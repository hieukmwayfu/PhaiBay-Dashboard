import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { APP_KEY_RE, appsSummary, createApp, listApps, type AppSummary } from "../lib/api";
import { fmt, useChartTheme } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { Page } from "../components/Layout";
import { Icon } from "../components/Icon";
import { Card, ErrorBox, Kpi, Modal, PageHeader, Skeleton } from "../components/ui";

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
  const { palette } = useChartTheme();
  const [creating, setCreating] = useState(false);
  const r = useLoad(() => appsSummary(dates.from, dates.to), [dates.from, dates.to]);
  const apps = r.data?.apps ?? [];
  const tot = apps.reduce((t, a) => ({ users: t.users + a.users, events: t.events + a.events, new_users: t.new_users + a.new_users, sessions: t.sessions + a.sessions }),
    { users: 0, events: 0, new_users: 0, sessions: 0 });
  const daily = (r.data?.labels ?? []).map((_, i) => apps.reduce((s, a) => s + (a.daily_users[i] ?? 0), 0));
  const loading = r.loading && !r.data;

  return (
    <Page>
      <PageHeader title="Tất cả app" subtitle={`${dates.from} → ${dates.to}`}
        right={<button className="btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} strokeWidth={2.2} /> Tạo app</button>} />
      <ErrorBox error={r.error} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Người dùng" icon="users" iconColor="#6366f1" value={fmt(tot.users)} spark={daily} color={palette[0]} loading={loading} />
        <Kpi label="User mới" icon="userPlus" iconColor="#ec4899" value={fmt(tot.new_users)} color={palette[0]} loading={loading} />
        <Kpi label="Sessions" icon="layers" iconColor="#8b5cf6" value={fmt(tot.sessions)} color={palette[0]} loading={loading} />
        <Kpi label="Events" icon="bolt" iconColor="#f59e0b" value={fmt(tot.events)} color={palette[0]} loading={loading} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Apps</h2>
        <span className="chip">{apps.length}</span>
      </div>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[214px] rounded-2xl" />)}
        </div>
      )}

      {r.data && apps.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent"><Icon name="box" size={26} /></span>
            <div>
              <div className="text-base font-semibold">Chưa có app nào</div>
              <p className="mt-1 text-sm muted">Tạo app để lấy App Key, rồi gắn vào Unity SDK.</p>
            </div>
            <button className="btn-primary mt-1" onClick={() => setCreating(true)}><Icon name="plus" size={16} strokeWidth={2.2} /> Tạo app đầu tiên</button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {apps.map((a) => <AppCard key={a.id} a={a} onOpen={() => nav(`/app/${a.id}`)} />)}
      </div>

      {creating && <CreateAppDialog onClose={() => setCreating(false)} onCreated={(id) => nav(`/app/${id}/setup`)} />}
    </Page>
  );
}

function AppCard({ a, onOpen }: { a: AppSummary; onOpen: () => void }) {
  const { palette } = useChartTheme();
  const live = a.last_event_at > 0 && Date.now() - a.last_event_at < 10 * 60_000;
  const hue = [...a.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const color = palette[0];
  return (
    <button onClick={onOpen}
      className="card group relative overflow-hidden !p-0 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-pop animate-fade-in">
      <div className="p-5 pb-0">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 70% 46%))` }}>
            {a.name.trim().slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{a.name}</div>
            <code className="block truncate font-mono text-xs muted">{a.app_key}</code>
          </div>
          <Icon name="arrowRight" size={18} className="mt-1 text-dim opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {([["Users", a.users], ["Mới", a.new_users], ["Sessions", a.sessions], ["Events", a.events]] as const).map(([l, v]) => (
            <div key={l}>
              <div className="text-lg font-bold leading-tight tracking-tight">{fmt(v)}</div>
              <div className="text-[11px] muted">{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={a.daily_users.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
            <defs>
              <linearGradient id={`app-${a.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={color} stopOpacity={0.3} />
                <stop offset="1" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#app-${a.id})`} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-xs">
        <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-good animate-pulse2" : "bg-dim/50"}`} />
        <span className={live ? "font-medium text-good" : "muted"}>{live ? "Đang nhận event" : "Event gần nhất"}</span>
        <span className="ml-auto muted">{ago(a.last_event_at)}</span>
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
    <Modal title="Tạo app mới" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="label">Tên app</span>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Housify" autoFocus required />
        </label>
        <label className="block">
          <span className="label">App key</span>
          <input className={`input w-full font-mono ${keyBad ? "!border-bad focus:!ring-bad/15" : ""}`} value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="com.company.game  (trống = tự sinh)" />
          {keyBad && <span className="mt-1.5 block text-xs text-bad">3–100 ký tự: chữ, số, . _ -</span>}
        </label>
        <div className="flex gap-2.5 rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs">
          <Icon name="lock" size={16} className="mt-0.5 text-warn" />
          <p className="muted">SDK dùng key này để biết event thuộc app nào; nên đặt bằng package name / bundle id. <b className="text-fg">Không thể đổi sau khi tạo.</b></p>
        </div>
        {err && <ErrorBox error={err} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button className="btn-primary" disabled={busy || !name.trim() || keyBad}>{busy ? "Đang tạo…" : "Tạo app"}</button>
        </div>
      </form>
    </Modal>
  );
}
