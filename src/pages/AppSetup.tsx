import type { ReactNode } from "react";
import { getServerUrl } from "../lib/api";
import { useDash } from "../lib/state";
import { Icon } from "../components/Icon";
import { Card, CopyButton } from "../components/ui";

const SDK_GIT = "https://github.com/hieukmwayfu/PhaiBay-UnitySDK.git?path=/Assets/PhaiBaySDK";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="code flex items-center gap-2 py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 truncate py-1">{value}</code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="relative pl-11">
      <span className="absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-lg bg-accent text-xs font-bold text-accent-fg shadow-glow">{n}</span>
      <h3 className="mb-2 pt-0.5 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function AppSetup() {
  const { apps, appId } = useDash();
  const app = apps.find((a) => a.id === appId);
  if (!app) return null;
  const server = getServerUrl();
  const code = `// Cách 1 (khuyên dùng): menu PhaiBay › Settings trong Unity,
// điền App Key + Server URL, SDK tự khởi tạo khi chạy game.

// Cách 2: bằng code
PhaiBay.Initialize("${app.app_key}", "${server}");

PhaiBay.LogEvent("level_start", "level", 5);
PhaiBay.LogEvent("level_end",
    new PhaiBay.Parameter("level", 5),
    new PhaiBay.Parameter("success", true));
PhaiBay.SetUserProperty("vip", "gold");`;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title="Tích hợp Unity SDK" subtitle="3 bước để bắt đầu nhận event">
        <div className="space-y-7">
          <Step n={1} title="Cài package">
            <p className="mb-2 text-sm muted">Window › Package Manager › <b className="text-fg">+</b> › Add package from git URL…</p>
            <Field label="Git URL" value={SDK_GIT} />
          </Step>
          <Step n={2} title="Cấu hình & bắn event">
            <div className="code relative overflow-hidden">
              <div className="absolute right-1.5 top-1.5"><CopyButton text={code} label="Copy" /></div>
              <pre className="overflow-x-auto p-4 pr-20 leading-relaxed">{code}</pre>
            </div>
          </Step>
          <Step n={3} title="Kiểm tra">
            <p className="text-sm muted">Mở tab <b className="text-fg">DebugView</b> để xem event realtime (chỉ bản build Android ghi dữ liệu thật).</p>
          </Step>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Thông tin app">
          <div className="space-y-3">
            <Field label="App key (không đổi được)" value={app.app_key} />
            <Field label="Server URL" value={server} />
            <div className="flex items-center gap-2 pt-1 text-xs muted">
              <Icon name="calendar" size={14} /> Tạo lúc {new Date(app.created_at * 1000).toLocaleString()}
            </div>
          </div>
        </Card>
        <Card title="Chế độ test">
          <div className="space-y-2 text-sm">
            <p className="muted">Khi chạy trong <b className="text-fg">Unity Editor</b> hoặc bản build <b className="text-fg">Windows / Mac / Linux</b>, SDK gửi event ở chế độ <b className="text-fg">dry-run</b>:</p>
            <ul className="space-y-1.5">
              {["Server kiểm tra App Key, kết nối và định dạng event", "Không ghi vào database, dashboard không bị lẫn data test", "Kết quả hiện ở PhaiBay.LastUploadStatus / console"].map((t) => (
                <li key={t} className="flex gap-2"><Icon name="check" size={16} className="mt-0.5 text-good" strokeWidth={2.2} /><span>{t}</span></li>
              ))}
            </ul>
            <p className="pt-1 text-xs muted">Chỉ bản build <b className="text-fg">Android</b> mới ghi dữ liệu thật.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
