import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_KEY_RE, appsSummary, createApp, listApps } from "../lib/api";
import { fmt } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { Initials, Page } from "../components/Layout";
import { Icon } from "../components/Icon";
import { Badge, ErrorBox, Kpi, Modal, SecretKey, Skeleton } from "../components/ui";

function ago(ms: number) {
  if (!ms) return "—";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s} giây trước`;
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

/** Home: every app at a glance (Stripe-like list). Pick one to drill in. */
export function Home() {
  const { dates } = useDash();
  const nav = useNavigate();
  const [creating, setCreating] = useState(false);
  const r = useLoad(() => appsSummary(dates.from, dates.to), [dates.from, dates.to]);
  const apps = r.data?.apps ?? [];
  const tot = apps.reduce((t, a) => ({ users: t.users + a.users, events: t.events + a.events, new_users: t.new_users + a.new_users, sessions: t.sessions + a.sessions }),
    { users: 0, events: 0, new_users: 0, sessions: 0 });
  const loading = r.loading && !r.data;

  return (
    <Page>
      <ErrorBox error={r.error} />

      <h2 className="mb-2 text-[15px] font-semibold">Tổng quan</h2>
      <div className="stagger mb-8 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
        <Kpi label="Người dùng" icon="users" value={fmt(tot.users)} loading={loading} />
        <Kpi label="User mới" icon="userPlus" value={fmt(tot.new_users)} loading={loading} />
        <Kpi label="Sessions" icon="layers" value={fmt(tot.sessions)} loading={loading} />
        <Kpi label="Events" icon="bolt" value={fmt(tot.events)} loading={loading} />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">Apps</h2>
        <span className="text-[13px] muted">{apps.length}</span>
        <button className="btn-primary ml-auto" onClick={() => setCreating(true)}><Icon name="plus" size={14} strokeWidth={2.2} /> Tạo app</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-xs muted">
              <th className="py-2 pr-3 font-medium">App</th>
              <th className="px-3 py-2 font-medium">App key</th>
              <th className="px-3 py-2 text-right font-medium">Users</th>
              <th className="px-3 py-2 text-right font-medium">User mới</th>
              <th className="px-3 py-2 text-right font-medium">Sessions</th>
              <th className="px-3 py-2 text-right font-medium">Events</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="py-2 pl-3 text-right font-medium">Event gần nhất</th>
            </tr>
          </thead>
          <tbody>
            {loading && [0, 1, 2].map((i) => (
              <tr key={i} className="border-b border-line/70"><td colSpan={8} className="py-2.5"><Skeleton className="h-5 w-full" /></td></tr>
            ))}
            {apps.map((a) => {
              const live = a.last_event_at > 0 && Date.now() - a.last_event_at < 10 * 60_000;
              return (
                <tr key={a.id} onClick={() => nav(`/app/${a.id}`)} className="animate-fade-in cursor-pointer border-b border-line/70 transition-colors hover:bg-raised">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2.5">
                      <Initials name={a.name} size={24} />
                      <span className="font-medium">{a.name}</span>
                    </span>
                  </td>
                  <td className="max-w-[260px] px-3 py-1.5 muted"><SecretKey value={a.app_key} /></td>
                  <td className="px-3 py-2.5 text-right tabular">{fmt(a.users)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{fmt(a.new_users)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{fmt(a.sessions)}</td>
                  <td className="px-3 py-2.5 text-right tabular">{fmt(a.events)}</td>
                  <td className="px-3 py-2.5">
                    {live ? <Badge tone="good">Đang nhận event</Badge> : a.last_event_at ? <Badge>Không hoạt động</Badge> : <Badge tone="warn">Chưa có event</Badge>}
                  </td>
                  <td className="py-2.5 pl-3 text-right muted">{ago(a.last_event_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {r.data && apps.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-[13px] muted">Chưa có app nào. Tạo app để lấy App Key gắn vào Unity SDK.</p>
            <button className="btn mt-3" onClick={() => setCreating(true)}><Icon name="plus" size={14} /> Tạo app đầu tiên</button>
          </div>
        )}
        {r.data && apps.length > 0 && <p className="mt-2 text-xs muted">{apps.length} app · {dates.from} → {dates.to}</p>}
      </div>

      {creating && <CreateAppDialog onClose={() => setCreating(false)} onCreated={(id) => nav(`/app/${id}`)} />}
    </Page>
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
    <Modal title="Tạo app" onClose={onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block">
          <span className="label">Tên app</span>
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Housify" autoFocus required />
        </label>
        <label className="block">
          <span className="label">App key</span>
          <input className={`input w-full font-mono ${keyBad ? "!border-bad" : ""}`} value={key} onChange={(e) => setKey(e.target.value)}
            placeholder="com.company.game" />
          <span className={`mt-1 block text-xs ${keyBad ? "text-bad" : "muted"}`}>
            {keyBad ? "3–100 ký tự: chữ, số, . _ -" : "Nên dùng package name / bundle id. Để trống thì server tự sinh. Không đổi được sau khi tạo."}
          </span>
        </label>
        {err && <ErrorBox error={err} />}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button className="btn-primary" disabled={busy || !name.trim() || keyBad}>{busy ? "Đang tạo…" : "Tạo app"}</button>
        </div>
      </form>
    </Modal>
  );
}
