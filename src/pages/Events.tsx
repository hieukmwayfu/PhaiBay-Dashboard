import { useEffect, useState } from "react";
import { api, type BreakdownRow, type EventRow, type ParamKey, type Timeseries } from "../lib/api";
import { fmt } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { Card, DataTable, Empty, ErrorBox } from "../components/ui";

export function Events() {
  const { q } = useDash();
  const [sel, setSel] = useState<string>("");
  const ev = useLoad(() => api<EventRow[]>("/api/events", q()), [q]);
  useEffect(() => {
    if (!sel && ev.data?.length) setSel(ev.data[0].name);
  }, [ev.data, sel]);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card title="Tất cả events">
        <ErrorBox error={ev.error} />
        <DataTable rows={ev.data} onRow={(r) => setSel(r.name)} maxHeight={640} cols={[
          { key: "name", title: "Event", render: (r) => <span className={r.name === sel ? "font-semibold text-brand" : ""}>{r.name}</span> },
          { key: "count", title: "Số lần", num: true, bar: true, render: (r) => fmt(r.count) },
          { key: "users", title: "Users", num: true, render: (r) => fmt(r.users) },
          { key: "per", title: "/ user", num: true, render: (r) => (r.users ? (r.count / r.users).toFixed(2) : "–") },
        ]} />
      </Card>
      {sel ? <EventDetail name={sel} /> : <Card><Empty>Chọn 1 event</Empty></Card>}
    </div>
  );
}

function EventDetail({ name }: { name: string }) {
  const { q, addFilter } = useDash();
  const [param, setParam] = useState("");
  const [metric, setMetric] = useState("count");
  const ts = useLoad(async () => {
    const [c, u] = await Promise.all([
      api<Timeseries>("/api/timeseries", q({ event: name, metric: "count" }, ["event"])),
      api<Timeseries>("/api/timeseries", q({ event: name, metric: "users" }, ["event"])),
    ]);
    return { labels: c.labels, series: [{ name: "Số lần", values: c.series[0]?.values ?? [] }, { name: "Users", values: u.series[0]?.values ?? [] }] };
  }, [q, name]);
  const keys = useLoad(() => api<ParamKey[]>("/api/params", q({ event: name }, ["event"])), [q, name]);
  useEffect(() => {
    if (keys.data && !keys.data.some((k) => k.key === param)) setParam(keys.data[0]?.key ?? "");
  }, [keys.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const numeric = keys.data?.find((k) => k.key === param)?.numeric;
  const rows = useLoad(
    () => (param ? api<BreakdownRow[]>("/api/breakdown", q({ event: name, dim: "p." + param, metric, limit: 100 }, ["event"])) : Promise.resolve([])),
    [q, name, param, metric],
  );
  const stats = useLoad(async () => {
    if (!param || !numeric) return null;
    const [s, a] = await Promise.all([
      api<BreakdownRow[]>("/api/breakdown", q({ event: name, dim: "event", metric: "sum:" + param }, ["event"])),
      api<BreakdownRow[]>("/api/breakdown", q({ event: name, dim: "event", metric: "avg:" + param }, ["event"])),
    ]);
    return { sum: s[0]?.metric ?? 0, avg: a[0]?.metric ?? 0 };
  }, [q, name, param, numeric]);

  return (
    <Card title={name} right={<button className="btn" onClick={() => addFilter({ dim: "event", op: "eq", val: name })}>Lọc theo event này</button>}>
      <ErrorBox error={ts.error || keys.error || rows.error} />
      <TimeChart labels={ts.data?.labels ?? []} series={ts.data?.series ?? []} height={230} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm muted">Param</span>
        <select className="input" value={param} onChange={(e) => setParam(e.target.value)}>
          {(keys.data ?? []).map((k) => <option key={k.key} value={k.key}>{k.key}{k.numeric ? " (số)" : ""}</option>)}
          {!keys.data?.length && <option value="">(không có param)</option>}
        </select>
        <select className="input" value={metric} onChange={(e) => setMetric(e.target.value)}>
          <option value="count">Số lần</option>
          <option value="users">Users</option>
        </select>
        {stats.data && (
          <span className="text-sm muted">Tổng <b className="text-zinc-900 dark:text-zinc-100">{fmt(stats.data.sum)}</b> · TB <b className="text-zinc-900 dark:text-zinc-100">{fmt(stats.data.avg)}</b></span>
        )}
      </div>
      <div className="mt-3">
        <DataTable rows={rows.data} maxHeight={420} onRow={(r) => addFilter({ dim: "p", key: param, op: "eq", val: r.value })} cols={[
          { key: "value", title: param || "value" },
          { key: "metric", title: metric === "users" ? "Users" : "Số lần", num: true, bar: true, render: (r) => fmt(r.metric) },
          { key: "count", title: "Số lần", num: true, render: (r) => fmt(r.count) },
          { key: "users", title: "Users", num: true, render: (r) => fmt(r.users) },
        ]} />
      </div>
    </Card>
  );
}
