import { useEffect, useState } from "react";
import { api, type BreakdownRow, type EventRow, type ParamKey, type Timeseries } from "../lib/api";
import { fmt } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { Card, DataTable, Empty, ErrorBox, Segmented } from "../components/ui";
import { Icon } from "../components/Icon";

export function Events() {
  const { q } = useDash();
  const [sel, setSel] = useState<string>("");
  const ev = useLoad(() => api<EventRow[]>("/api/events", q()), [q]);
  useEffect(() => {
    if (!sel && ev.data?.length) setSel(ev.data[0].name);
  }, [ev.data, sel]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Card title="Tất cả events" subtitle={ev.data ? `${ev.data.length} loại event` : undefined}>
        <ErrorBox error={ev.error} />
        <DataTable rows={ev.data} loading={ev.loading} onRow={(r) => setSel(r.name)} active={(r) => r.name === sel} maxHeight={680} cols={[
          { key: "name", title: "Event", render: (r) => <span className={`font-mono text-[13px] ${r.name === sel ? "font-semibold" : ""}`}>{r.name}</span> },
          { key: "count", title: "Số lần", num: true, bar: true, render: (r) => fmt(r.count) },
          { key: "users", title: "Users", num: true, render: (r) => fmt(r.users) },
          { key: "per", title: "/ user", num: true, render: (r) => (r.users ? (r.count / r.users).toFixed(2) : "–") },
        ]} />
      </Card>
      {sel ? <EventDetail name={sel} /> : <Card><Empty icon="list">Chọn 1 event</Empty></Card>}
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
    return { labels: c.labels, series: [{ name: "Số lần", values: c.series[0]?.values ?? [] }, { name: "Users", values: u.series[0]?.values ?? [] }],
      total: c.series[0]?.total ?? 0, users: u.series[0]?.total ?? 0 };
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
    <Card title={<span className="font-mono">{name}</span>} subtitle={ts.data ? `${fmt(ts.data.total)} lần · ${fmt(ts.data.users)} users` : " "}
      right={<button className="btn" onClick={() => addFilter({ dim: "event", op: "eq", val: name })}><Icon name="filter" size={15} className="muted" /> Lọc theo event này</button>}>
      <ErrorBox error={ts.error || keys.error || rows.error} />
      <TimeChart loading={ts.loading} labels={ts.data?.labels ?? []} series={ts.data?.series ?? []} height={230} />
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <span className="text-sm font-semibold">Param</span>
        <select className="input" value={param} onChange={(e) => setParam(e.target.value)}>
          {(keys.data ?? []).map((k) => <option key={k.key} value={k.key}>{k.key}{k.numeric ? " (số)" : ""}</option>)}
          {!keys.data?.length && <option value="">(không có param)</option>}
        </select>
        <Segmented value={metric} onChange={setMetric} options={[{ v: "count", label: "Số lần" }, { v: "users", label: "Users" }]} />
        {stats.data && (
          <span className="ml-auto flex gap-2">
            <span className="chip">Tổng <b className="tabular">{fmt(stats.data.sum)}</b></span>
            <span className="chip">TB <b className="tabular">{fmt(stats.data.avg)}</b></span>
          </span>
        )}
      </div>
      <div className="mt-3">
        <DataTable rows={rows.data} loading={rows.loading} maxHeight={420} onRow={(r) => addFilter({ dim: "p", key: param, op: "eq", val: r.value })} cols={[
          { key: "value", title: param || "value" },
          { key: "metric", title: metric === "users" ? "Users" : "Số lần", num: true, bar: true, render: (r) => fmt(r.metric) },
          metric === "users"
            ? { key: "count", title: "Số lần", num: true, render: (r) => fmt(r.count) }
            : { key: "users", title: "Users", num: true, render: (r) => fmt(r.users) },
        ]} />
      </div>
    </Card>
  );
}
