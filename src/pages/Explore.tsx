import { useState } from "react";
import { api, type BreakdownRow, type EventRow, type ParamKey, type Timeseries } from "../lib/api";
import { fmt, NAME_RE } from "../lib/format";
import { DIM_LABEL, useDash, useLoad } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { Card, DataTable, ErrorBox, Loading } from "../components/ui";

export function Explore() {
  const { q } = useDash();
  const [event, setEvent] = useState("");
  const [metric, setMetric] = useState("count");
  const [dimSel, setDimSel] = useState("country");
  const [dimKey, setDimKey] = useState("");
  const [limit, setLimit] = useState(10);

  const events = useLoad(() => api<EventRow[]>("/api/events", q({}, ["event"])), [q]);
  const keys = useLoad(() => api<ParamKey[]>("/api/params", q({ event }, event ? ["event"] : [])), [q, event]);
  const ukeys = useLoad(() => api<ParamKey[]>("/api/params", q({ event, kind: "user" }, event ? ["event"] : [])), [q, event]);

  const kv = dimSel === "p" || dimSel === "u";
  const dim = kv ? (NAME_RE.test(dimKey) ? `${dimSel}.${dimKey}` : null) : dimSel;
  const skip = event ? (["event"] as const) : [];

  const ts = useLoad(
    () => (dim === null ? Promise.resolve(null) : api<Timeseries>("/api/timeseries", q({ event, metric, breakdown: dim, limit }, [...skip]))),
    [q, event, metric, dim, limit],
  );
  const table = useLoad(
    () => (dim ? api<BreakdownRow[]>("/api/breakdown", q({ event, metric, dim, limit: 500 }, [...skip])) : Promise.resolve(null)),
    [q, event, metric, dim],
  );
  const metricLabel = metric === "count" ? "Số event" : metric === "users" ? "Users" : metric === "sessions" ? "Sessions" : metric.replace("sum:", "Tổng ").replace("avg:", "TB ");

  return (
    <div className="space-y-3">
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs muted">Event
            <select className="input mt-1 block" value={event} onChange={(e) => { setEvent(e.target.value); setMetric("count"); }}>
              <option value="">(tất cả)</option>
              {(events.data ?? []).map((e) => <option key={e.name}>{e.name}</option>)}
            </select>
          </label>
          <label className="text-xs muted">Metric
            <select className="input mt-1 block" value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="count">Số event</option>
              <option value="users">Users</option>
              <option value="sessions">Sessions</option>
              {(keys.data ?? []).filter((k) => k.numeric).flatMap((k) => [
                <option key={"s" + k.key} value={"sum:" + k.key}>Tổng {k.key}</option>,
                <option key={"a" + k.key} value={"avg:" + k.key}>TB {k.key}</option>,
              ])}
            </select>
          </label>
          <label className="text-xs muted">Breakdown
            <select className="input mt-1 block" value={dimSel} onChange={(e) => { setDimSel(e.target.value); setDimKey(""); }}>
              <option value="">(không)</option>
              {Object.entries(DIM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              <option value="p">Event param…</option>
              <option value="u">User property…</option>
            </select>
          </label>
          {kv && (
            <label className="text-xs muted">Key
              <select className="input mt-1 block" value={dimKey} onChange={(e) => setDimKey(e.target.value)}>
                <option value="">(chọn)</option>
                {((dimSel === "p" ? keys.data : ukeys.data) ?? []).map((k) => <option key={k.key}>{k.key}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs muted">Top
            <select className="input mt-1 block" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
              {[5, 10, 20].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <Loading on={ts.loading || table.loading} />
        </div>
        <ErrorBox error={ts.error || table.error} />
        <TimeChart height={340} labels={ts.data?.labels ?? []} series={ts.data?.series ?? []} />
      </Card>
      <Card title="Bảng">
        {dim ? (
          <DataTable rows={table.data} maxHeight={600} cols={[
            { key: "value", title: dim },
            { key: "metric", title: metricLabel, num: true, bar: true, render: (r) => fmt(r.metric) },
            { key: "count", title: "Events", num: true, render: (r) => fmt(r.count) },
            { key: "users", title: "Users", num: true, render: (r) => fmt(r.users) },
          ]} />
        ) : (
          <DataTable rows={ts.data?.series} cols={[
            { key: "name", title: "Series" },
            { key: "total", title: metricLabel, num: true, render: (r) => fmt(r.total) },
          ]} />
        )}
      </Card>
    </div>
  );
}
