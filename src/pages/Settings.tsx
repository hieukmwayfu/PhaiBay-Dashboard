import { Link } from "react-router-dom";
import { getServerUrl } from "../lib/api";
import { useDash } from "../lib/state";
import { Icon } from "../components/Icon";
import { CopyButton, SecretKey } from "../components/ui";

/** Per-app settings: identity, App key (hidden until the eye is clicked), SDK connection, data tools. */
export function Settings() {
  const { appId, apps } = useDash();
  const app = apps.find((a) => a.id === appId);
  if (!app) return null;
  const server = getServerUrl();

  return (
    <div className="max-w-3xl space-y-8">
      <Section title="App" desc="Thông tin cơ bản của app.">
        <Row label="Tên">{app.name}</Row>
        <Row label="App ID"><span className="font-mono text-xs">{app.id}</span></Row>
        <Row label="Ngày tạo">{app.created_at ? new Date(app.created_at * 1000).toLocaleString() : "—"}</Row>
      </Section>

      <Section title="App key" desc="Gắn vào Unity SDK để gửi event về app này. Không đổi được sau khi tạo.">
        <Row label="App key"><SecretKey value={app.app_key} /></Row>
        <Row label="Server">
          <span className="inline-flex min-w-0 items-center gap-0.5">
            <code className="truncate font-mono text-xs">{server}</code>
            <CopyButton text={server} />
          </span>
        </Row>
        <p className="pt-1 text-xs muted">Trong Unity: <b className="text-fg">menu PhaiBay › Settings</b>, dán App key. Server mặc định đã đúng, không cần nhập.</p>
      </Section>

      <Section title="Dữ liệu" desc="Xóa event rác / event test.">
        <div className="flex flex-wrap items-center gap-3 py-2">
          <p className="min-w-0 flex-1 text-[13px] muted">Vào tab Events, tick chọn các event cần xóa rồi bấm <b className="text-fg">Xóa</b>. Có bước xác nhận và 10 giây để hủy.</p>
          <Link to={`/app/${app.id}/events`} className="btn"><Icon name="list" size={14} className="muted" /> Mở Events</Link>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-8 gap-y-3 border-b border-line pb-8 last:border-0 md:grid-cols-[220px_1fr]">
      <div>
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs muted">{desc}</p>
      </div>
      <div className="min-w-0 divide-y divide-line/70">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[40px] items-center gap-4 py-1.5 text-[13px]">
      <span className="w-24 shrink-0 muted">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
