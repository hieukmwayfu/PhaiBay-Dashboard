import { useEffect, useState } from "react";
import { api, storage, type BreakdownRow, type ParamKey, type Timeseries } from "../lib/api";
import { fmt } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { Card, DataTable, Empty, ErrorBox, Segmented } from "../components/ui";
import { Icon } from "../components/Icon";
import { PagedTable, type PCol } from "../components/PagedTable";

interface EventPageRow { name: string; count: number; users: number; last_seen: number }
interface EventPage { total: number; rows: EventPageRow[] }

function ago(ms: number) {
  if (!ms) return "–";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s} giây`;
  if (s < 3600) return `${Math.floor(s / 60)} phút`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ`;
  return `${Math.floor(s / 86400)} ngày`;
}

/** Debounced copy of a value (search box). */
function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

export function Events() {
  const { q } = useDash();
  const [sel, setSel] = useState<string>("");
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());
  const [sort, setSort] = useState("count");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [size, setSizeS] = useState<number>(storage.get("events_page_size", 20));
  const setSize = (n: number) => { setSizeS(n); storage.set("events_page_size", n); setPage(1); };

  // back to page 1 whenever the result set changes
  useEffect(() => setPage(1), [q, term, sort, dir]);

  const ev = useLoad(
    () => api<EventPage>("/api/events/page", q({ q: term, sort, dir, offset: (page - 1) * size, limit: size })),
    [q, term, sort, dir, page, size],
  );
  useEffect(() => {
    if (!sel && ev.data?.rows.length) setSel(ev.data.rows[0].name);
  }, [ev.data, sel]);

  const onSort = (k: string) => {
    if (k === sort) setDir(dir === "desc" ? "asc" : "desc");
    else { setSort(k); setDir(k === "name" ? "asc" : "desc"); }
  };

  const cols: PCol<EventPageRow>[] = [
    { key: "name", title: "Event", sortable: true, render: (r) => <span className="block truncate text-[13.5px] font-medium text-fg" title={r.name}>{r.name}</span> },
    { key: "count", title: "Số lần", sortable: true, num: true, bar: true, width: "104px", render: (r) => fmt(r.count) },
    { key: "users", title: "Users", sortable: true, num: true, width: "68px", render: (r) => fmt(r.users) },
    { key: "last_seen", title: "Lần cuối", sortable: true, num: true, width: "84px", hideBelow: "sm", render: (r) => <span className="text-xs muted" title={new Date(r.last_seen).toLocaleString()}>{ago(r.last_seen)}</span> },
  ];

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
      <div className="min-w-0 space-y-2">
        <ErrorBox error={ev.error} />
        <PagedTable<EventPageRow>
          compact cols={cols} rows={ev.data?.rows} total={ev.data?.total ?? 0} loading={ev.loading}
          page={page} pageSize={size} sort={sort} dir={dir}
          onSort={onSort} onPage={setPage} onPageSize={setSize}
          onRow={(r) => setSel(r.name)} active={(r) => r.name === sel} rowKey={(r) => r.name}
          emptyText={term ? `Không có event nào chứa "${term}"` : "Chưa có event"}
          toolbar={
            <>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#8b5cf6]/10 text-[#8b5cf6]"><Icon name="list" size={16} /></span>
                <div>
                  <div className="text-[15px] font-semibold leading-tight">Tất cả events</div>
                  <div className="text-xs muted">{ev.data ? `${ev.data.total.toLocaleString()} loại event` : "…"}</div>
                </div>
              </div>
              <div className="relative ml-auto w-full sm:w-56">
                <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 muted" />
                <input className="input w-full !pl-9 pr-8" placeholder="Tìm event…" value={search} onChange={(e) => setSearch(e.target.value)} />
                {search && (
                  <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 muted hover:text-fg" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm">
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            </>
          }
        />
      </div>
      {/* detail stays in view while browsing the list */}
      <div className="min-w-0 xl:sticky xl:top-[76px]">
        {sel ? <EventDetail name={sel} /> : <Card><Empty icon="list">Chọn 1 event</Empty></Card>}
      </div>
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
    <Card title={<span className="text-base">{name}</span>} subtitle={ts.data ? `${fmt(ts.data.total)} lần · ${fmt(ts.data.users)} users · ${ts.data.users ? (ts.data.total / ts.data.users).toFixed(2) : "–"} lần / user` : " "}
      right={<button className="btn" onClick={() => addFilter({ dim: "event", op: "eq", val: name })}><Icon name="filter" size={15} className="muted" /> Lọc theo event này</button>}>
      <ErrorBox error={ts.error || keys.error || rows.error} />
      <TimeChart loading={ts.loading} labels={ts.data?.labels ?? []} series={ts.data?.series ?? []} height={210} />
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
        <DataTable rows={rows.data} loading={rows.loading} maxHeight={340} onRow={(r) => addFilter({ dim: "p", key: param, op: "eq", val: r.value })} cols={[
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
