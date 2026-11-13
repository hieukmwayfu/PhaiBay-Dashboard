import { useState } from "react";
import { createApp, getServerUrl, listApps, rotateKey } from "../lib/api";
import { useDash } from "../lib/state";
import { Card, DataTable, ErrorBox } from "../components/ui";

export function Apps() {
  const { apps, setApps, setAppId } = useDash();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const reload = async () => setApps(await listApps());
  const create = async () => {
    if (!name.trim()) return;
    try {
      const a = await createApp(name.trim());
      setName("");
      await reload();
      setAppId(a.id);
    } catch (e) { setErr((e as Error).message); }
  };
  const rotate = async (id: number) => {
    if (!confirm("Đổi API key? Các bản build đang dùng key cũ sẽ không gửi được nữa.")) return;
    try { await rotateKey(id); await reload(); } catch (e) { setErr((e as Error).message); }
  };
  const copy = (s: string) => navigator.clipboard?.writeText(s);

  return (
    <div className="space-y-3">
      <Card title="Apps">
        <ErrorBox error={err} />
        <div className="mb-4 flex gap-2">
          <input className="input" placeholder="Tên app mới" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
          <button className="btn-primary" onClick={create}>Tạo app</button>
        </div>
        <DataTable rows={apps} cols={[
          { key: "id", title: "ID" },
          { key: "name", title: "Tên" },
          { key: "api_key", title: "API key", render: (a) => <span className="inline-flex items-center gap-2"><code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{a.api_key}</code><button className="text-xs muted hover:text-brand" onClick={() => copy(a.api_key)}>copy</button></span> },
          { key: "created_at", title: "Tạo lúc", render: (a) => new Date(a.created_at * 1000).toLocaleString() },
          { key: "act", title: "", render: (a) => <button className="btn" onClick={() => rotate(a.id)}>Đổi key</button> },
        ]} />
      </Card>
      <Card title="Tích hợp Unity">
        <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800">{`// Package Manager > Add package from git URL:
//   https://github.com/hieukmwayfu/PhaiBay-UnitySDK.git

PhaiBay.Initialize("${apps[0]?.api_key ?? "pb_..."}", "${getServerUrl()}");
PhaiBay.LogEvent("level_start", "level", 5);
PhaiBay.LogEvent("level_end",
    new PhaiBay.Parameter("level", 5),
    new PhaiBay.Parameter("success", true));
PhaiBay.SetUserProperty("vip", "gold");`}</pre>
      </Card>
    </div>
  );
}
