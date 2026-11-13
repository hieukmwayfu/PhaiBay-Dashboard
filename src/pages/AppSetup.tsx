import { useState } from "react";
import { getServerUrl } from "../lib/api";
import { useDash } from "../lib/state";
import { Card } from "../components/ui";

const SDK_GIT = "https://github.com/hieukmwayfu/PhaiBay-UnitySDK.git?path=/Assets/PhaiBaySDK";

function Copy({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="text-xs muted hover:text-brand" onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}>
      {ok ? "đã copy" : "copy"}
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs muted">{label}</div>
      <div className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-800">
        <code className="min-w-0 flex-1 truncate text-sm">{value}</code>
        <Copy text={value} />
      </div>
    </div>
  );
}

export function AppSetup() {
  const { apps, appId } = useDash();
  const app = apps.find((a) => a.id === appId);
  if (!app) return null;
  const server = getServerUrl();
  const code = `// Cách 1: menu PhaiBay > Settings trong Unity, điền App Key + Server URL (tự khởi tạo)
// Cách 2: bằng code
PhaiBay.Initialize("${app.app_key}", "${server}");

PhaiBay.LogEvent("level_start", "level", 5);
PhaiBay.LogEvent("level_end",
    new PhaiBay.Parameter("level", 5),
    new PhaiBay.Parameter("success", true));
PhaiBay.SetUserProperty("vip", "gold");`;

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="Thông tin app">
        <div className="space-y-3">
          <Field label="App key (không đổi được)" value={app.app_key} />
          <Field label="Server URL" value={server} />
          <div className="text-xs muted">Tạo lúc {new Date(app.created_at * 1000).toLocaleString()}</div>
        </div>
      </Card>
      <Card title="1. Cài Unity SDK">
        <p className="mb-2 text-sm">Window › Package Manager › + › <b>Add package from git URL…</b></p>
        <Field label="Git URL" value={SDK_GIT} />
      </Card>
      <Card title="2. Khởi tạo & bắn event" className="lg:col-span-2">
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs dark:bg-zinc-800">{code}</pre>
          <div className="absolute right-2 top-2"><Copy text={code} /></div>
        </div>
        <p className="mt-2 text-xs muted">Sau khi bắn event, xem realtime ở tab <b>DebugView</b>.</p>
      </Card>
    </div>
  );
}
