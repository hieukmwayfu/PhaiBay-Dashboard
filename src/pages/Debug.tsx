import { useEffect, useState } from "react";
import { api, type RawEvent } from "../lib/api";
import { useDash, useLoad } from "../lib/state";
import { Card, DataTable, ErrorBox, Loading } from "../components/ui";

export function Debug() {
  const { q, refresh } = useDash();
  const [user, setUser] = useState("");
  const [applied, setApplied] = useState("");
  const [auto, setAuto] = useState(true);
  const r = useLoad(() => api<RawEvent[]>("/api/stream", q({ limit: 200, user: applied })), [q, applied]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => !document.hidden && refresh(), 5000);
    return () => clearInterval(t);
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input min-w-[280px]" placeholder="user_id hoặc uid (trống = tất cả)" value={user}
          onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setApplied(user.trim())} />
        <button className="btn" onClick={() => setApplied(user.trim())}>Lọc</button>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> tự làm mới 5s</label>
        <Loading on={r.loading} />
      </div>
      <ErrorBox error={r.error} />
      <DataTable rows={r.data} maxHeight={700} onRow={(e) => { setUser(e.user_id); setApplied(e.user_id); }} cols={[
        { key: "ts", title: "Thời gian", render: (e) => new Date(e.ts).toLocaleString() },
        { key: "name", title: "Event", render: (e) => <b>{e.name}</b> },
        { key: "params", title: "Params", render: (e) => e.params ? <code className="whitespace-pre-wrap break-all text-xs muted">{JSON.stringify(e.params)}</code> : null },
        { key: "user_id", title: "User", render: (e) => <span title={e.user_id}><span className="muted">{e.user_id.slice(0, 8)}</span>{e.uid ? ` · ${e.uid}` : ""}</span> },
        { key: "app_version", title: "Ver" },
        { key: "platform", title: "Platform" },
        { key: "country", title: "Ctry" },
        { key: "device", title: "Device" },
        { key: "uprops", title: "User props", render: (e) => e.uprops ? <code className="whitespace-pre-wrap break-all text-xs muted">{JSON.stringify(e.uprops)}</code> : null },
      ]} />
    </Card>
  );
}
