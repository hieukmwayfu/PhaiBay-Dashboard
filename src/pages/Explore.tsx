import { useState } from "react";
import { api, type BreakdownRow, type EventRow, type ParamKey, type Timeseries } from "../lib/api";
import { fmt, NAME_RE } from "../lib/format";
import { DIM_LABEL, useDash, useLoad } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { Card, DataTable, ErrorBox, Loading, Segmented } from "../components/ui";

export function Explore() {
  const { q } = useDash();
  const [event, setEvent] = useState("");
  const [metric, setMetric] = useState("count");
  const [dimSel, setDimSel] = useState("country");
  const [dimKey, setDimKey] = useState("");
  const [limit, setLimit] = useState(5);

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
    <div className="space-y-4">
      <Card>
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <label><span className="label">Event</span>
            <select className="input block min-w-[160px]" value={event} onChange={(e) => { setEvent(e.target.value); setMetric("count"); }}>
              <option value="">(tất cả)</option>
              {(events.data ?? []).map((e) => <option key={e.name}>{e.name}</option>)}
            </select>
          </label>
          <label><span className="label">Metric</span>
            <select className="input block" value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="count">Số event</option>
              <option value="users">Users</option>
              <option value="sessions">Sessions</option>
              {(keys.data ?? []).filter((k) => k.numeric).flatMap((k) => [
                <option key={"s" + k.key} value={"sum:" + k.key}>Tổng {k.key}</option>,
                <option key={"a" + k.key} value={"avg:" + k.key}>TB {k.key}</option>,
              ])}
            </select>
          </label>
          <label><span className="label">Breakdown</span>
            <select className="input block" value={dimSel} onChange={(e) => { setDimSel(e.target.value); setDimKey(""); }}>
              <option value="">(không)</option>
              {Object.entries(DIM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              <option value="p">Event param…</option>
              <option value="u">User property…</option>
            </select>
          </label>
          {kv && (
            <label><span className="label">Key</span>
              <select className="input block" value={dimKey} onChange={(e) => setDimKey(e.target.value)}>
                <option value="">(chọn)</option>
                {((dimSel === "p" ? keys.data : ukeys.data) ?? []).map((k) => <option key={k.key}>{k.key}</option>)}
              </select>
            </label>
          )}
          <div><span className="label">Top</span>
            {/* palette has 8 fixed slots: never more series than that */}
            <Segmented value={limit} onChange={setLimit} options={[3, 5, 8].map((n) => ({ v: n, label: n }))} />
          </div>
          <Loading on={ts.loading || table.loading} />
        </div>
        <ErrorBox error={ts.error || table.error} />
        <TimeChart height={340} loading={ts.loading} labels={ts.data?.labels ?? []} series={ts.data?.series ?? []} />
      </Card>
      <Card title="Bảng số liệu" subtitle={dim ? `Theo ${dim}` : "Theo series"}>
        {dim ? (
          <DataTable rows={table.data} loading={table.loading} maxHeight={600} cols={[
            { key: "value", title: dim },
            { key: "metric", title: metricLabel, num: true, bar: true, render: (r) => fmt(r.metric) },
            ...(metric === "count" ? [] : [{ key: "count", title: "Events", num: true, render: (r: BreakdownRow) => fmt(r.count) }]),
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
