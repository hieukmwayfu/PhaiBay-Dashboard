import { useNavigate } from "react-router-dom";
import { api, type BreakdownRow, type Overview as OV } from "../lib/api";
import { fmt, useChartTheme } from "../lib/format";
import { useDash, useLoad, type Dim } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { Icon } from "../components/Icon";
import { Card, DataTable, delta, ErrorBox, Kpi } from "../components/ui";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Same-length window right before [from, to]. */
function prevRange(from: string, to: string) {
  const f = new Date(from + "T00:00:00Z"), t = new Date(to + "T00:00:00Z");
  const days = Math.round((t.getTime() - f.getTime()) / 864e5) + 1;
  const pt = new Date(f.getTime() - 864e5);
  const pf = new Date(pt.getTime() - (days - 1) * 864e5);
  return { from: iso(pf), to: iso(pt) };
}

export function Overview() {
  const { q, addFilter, dates, appId } = useDash();
  const nav = useNavigate();
  const { palette } = useChartTheme();
  const ov = useLoad(() => api<OV>("/api/overview", q()), [q]);
  const prev = useLoad(() => api<OV>("/api/overview", { ...q(), ...prevRange(dates.from, dates.to) }), [q]);
  const t = ov.data?.totals;
  const p = prev.data?.totals;
  const s = ov.data?.series ?? [];
  const labels = s.map((x) => x.day);
  const loading = ov.loading && !ov.data;
  const epu = t?.users ? t.events / t.users : undefined;
  const epuPrev = p?.users ? p.events / p.users : undefined;

  return (
    <div className="space-y-4">
      <ErrorBox error={ov.error} />

      {ov.data && t && t.events === 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-raised/60 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Chưa có event trong khoảng này</div>
            <div className="text-xs muted">Gắn SDK vào game rồi xem event realtime ở DebugView.</div>
          </div>
          <button className="btn" onClick={() => nav(`/app/${appId}/setup`)}>Hướng dẫn tích hợp <Icon name="arrowRight" size={14} /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Người dùng" icon="users" iconColor="#6366f1" value={fmt(t?.users)} change={delta(t?.users, p?.users)} spark={s.map((x) => x.users)} color={palette[0]} loading={loading} />
        <Kpi label="User mới" icon="userPlus" iconColor="#ec4899" value={fmt(t?.new_users)} change={delta(t?.new_users, p?.new_users)} spark={s.map((x) => x.new_users)} color={palette[0]} loading={loading} />
        <Kpi label="Sessions" icon="layers" iconColor="#8b5cf6" value={fmt(t?.sessions)} change={delta(t?.sessions, p?.sessions)} spark={s.map((x) => x.sessions)} color={palette[0]} loading={loading} />
        <Kpi label="Events" icon="bolt" iconColor="#f59e0b" value={fmt(t?.events)} change={delta(t?.events, p?.events)} spark={s.map((x) => x.events)} color={palette[0]} loading={loading} />
        <Kpi label="Events / user" icon="ratio" iconColor="#10b981" value={epu != null ? epu.toFixed(1) : "–"} change={delta(epu, epuPrev)} color={palette[0]} loading={loading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Người dùng theo ngày" subtitle="Active users và user mới">
          <TimeChart loading={ov.loading} labels={labels} series={[
            { name: "Active users", values: s.map((x) => x.users) },
            { name: "User mới", values: s.map((x) => x.new_users) },
          ]} />
        </Card>
        <Card title="Events theo ngày" subtitle="Tổng số event được ghi nhận">
          <TimeChart bars loading={ov.loading} labels={labels} series={[{ name: "Events", values: s.map((x) => x.events) }]} />
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {(["event", "country", "version", "platform"] as Dim[]).map((dim) => (
          <TopCard key={dim} dim={dim} onPick={(v) => addFilter({ dim, op: "eq", val: v })} />
        ))}
      </div>
    </div>
  );
}

const TITLES: Record<string, { t: string; icon: "bolt" | "globe" | "box" | "server" }> = {
  event: { t: "Top events", icon: "bolt" }, country: { t: "Quốc gia", icon: "globe" }, version: { t: "Version", icon: "box" }, platform: { t: "Platform", icon: "server" },
};

function TopCard({ dim, onPick }: { dim: Dim; onPick: (v: string) => void }) {
  const { q } = useDash();
  const r = useLoad(() => api<BreakdownRow[]>("/api/breakdown", q({ dim, metric: dim === "event" ? "count" : "users", limit: 8 })), [q, dim]);
  const meta = TITLES[dim];
  return (
    <Card title={meta.t} subtitle="Bấm 1 dòng để lọc">
      <ErrorBox error={r.error} />
      <DataTable rows={r.data} loading={r.loading} onRow={(x) => onPick(x.value)} cols={[
        { key: "value", title: dim === "event" ? "Event" : "Giá trị", render: (x) => <span className="block max-w-[12rem] truncate" title={x.value}>{x.value}</span> },
        dim === "event"
          ? { key: "count", title: "Số lần", num: true, bar: true, render: (x) => fmt(x.count) }
          : { key: "users", title: "Users", num: true, bar: true, render: (x) => fmt(x.users) },
      ]} />
    </Card>
  );
}
