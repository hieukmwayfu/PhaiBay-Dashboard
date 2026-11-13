import { api, type BreakdownRow, type Overview as OV } from "../lib/api";
import { dur, fmt } from "../lib/format";
import { useDash, useLoad, type Dim } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { Card, DataTable, ErrorBox, Kpi } from "../components/ui";

export function Overview() {
  const { q, addFilter } = useDash();
  const ov = useLoad(() => api<OV>("/api/overview", q()), [q]);
  const t = ov.data?.totals;
  const labels = ov.data?.series.map((p) => p.day) ?? [];

  return (
    <div className="space-y-3">
      <ErrorBox error={ov.error} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Người dùng" value={fmt(t?.users)} />
        <Kpi label="User mới" value={fmt(t?.new_users)} />
        <Kpi label="Sessions" value={fmt(t?.sessions)} />
        <Kpi label="Events" value={fmt(t?.events)} />
        <Kpi label="Events / user" value={t?.users ? (t.events / t.users).toFixed(1) : "–"} />
        <Kpi label="Engagement TB / user" value={t?.engagement_ms_per_user ? dur(t.engagement_ms_per_user) : "–"} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Người dùng theo ngày">
          <TimeChart labels={labels} series={[
            { name: "Active users", values: ov.data?.series.map((p) => p.users) ?? [] },
            { name: "New users", values: ov.data?.series.map((p) => p.new_users) ?? [] },
          ]} />
        </Card>
        <Card title="Events & Sessions">
          <TimeChart bars labels={labels} series={[
            { name: "Events", values: ov.data?.series.map((p) => p.events) ?? [] },
            { name: "Sessions", values: ov.data?.series.map((p) => p.sessions) ?? [] },
          ]} />
        </Card>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(["country", "version", "platform", "event"] as Dim[]).map((dim) => (
          <TopCard key={dim} dim={dim} onPick={(v) => addFilter({ dim, op: "eq", val: v })} />
        ))}
      </div>
    </div>
  );
}

const TITLES: Record<string, string> = { country: "Quốc gia", version: "Version", platform: "Platform", event: "Top events" };

function TopCard({ dim, onPick }: { dim: Dim; onPick: (v: string) => void }) {
  const { q } = useDash();
  const r = useLoad(() => api<BreakdownRow[]>("/api/breakdown", q({ dim, metric: dim === "event" ? "count" : "users", limit: 10 })), [q, dim]);
  return (
    <Card title={TITLES[dim]}>
      <ErrorBox error={r.error} />
      <DataTable rows={r.data} onRow={(x) => onPick(x.value)} cols={[
        { key: "value", title: "Giá trị" },
        dim === "event"
          ? { key: "count", title: "Số lần", num: true, bar: true, render: (x) => fmt(x.count) }
          : { key: "users", title: "Users", num: true, bar: true, render: (x) => fmt(x.users) },
        dim === "event"
          ? { key: "users", title: "Users", num: true, render: (x) => fmt(x.users) }
          : { key: "count", title: "Events", num: true, render: (x) => fmt(x.count) },
      ]} />
    </Card>
  );
}
