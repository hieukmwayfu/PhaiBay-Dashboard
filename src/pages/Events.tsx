import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, storage, type BreakdownRow, type ParamKey, type Timeseries } from "../lib/api";
import { fmt } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { DataTable, ErrorBox, Kpi, Segmented } from "../components/ui";
import { Icon } from "../components/Icon";
import { PagedTable, type PCol } from "../components/PagedTable";

interface EventPageRow { name: string; count: number; users: number; last_seen: number }
interface EventPage { total: number; rows: EventPageRow[] }

function ago(ms: number) {
  if (!ms) return "—";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s} giây trước`;
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
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

/** Event list: one full-width table (Stripe "Transactions" style). Row -> detail page. */
export function Events() {
  const { q } = useDash();
  const [sel, setSel] = useState<string | null>(null); // event shown in the bottom panel
  const detailRef = useRef<HTMLDivElement>(null);
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

  // default selection: first row of the list (kept while it is still listed)
  useEffect(() => {
    const rows = ev.data?.rows ?? [];
    if (rows.length && (!sel || !rows.some((r) => r.name === sel))) setSel(rows[0].name);
  }, [ev.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (name: string) => {
    setSel(name);
    const el = detailRef.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSort = (k: string) => {
    if (k === sort) setDir(dir === "desc" ? "asc" : "desc");
    else { setSort(k); setDir(k === "name" ? "asc" : "desc"); }
  };

  const cols: PCol<EventPageRow>[] = [
    { key: "name", title: "Event", sortable: true, render: (r) => (
      <span className="flex min-w-0 items-center gap-1.5" title={r.name}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sel === r.name ? "bg-accent" : "bg-transparent"}`} />
        <span className="truncate font-medium">{r.name}</span>
      </span>
    ) },
    { key: "count", title: "Số lần", sortable: true, num: true, width: "120px", render: (r) => fmt(r.count) },
    { key: "users", title: "Users", sortable: true, num: true, width: "110px", render: (r) => fmt(r.users) },
    { key: "per_user", title: "Lần / user", sortable: true, num: true, width: "110px", hideBelow: "md", render: (r) => (r.users ? (r.count / r.users).toFixed(1) : "—") },
    { key: "last_seen", title: "Lần cuối", sortable: true, num: true, width: "150px", hideBelow: "sm", render: (r) => <span className="muted" title={new Date(r.last_seen).toLocaleString()}>{ago(r.last_seen)}</span> },
  ];

  return (
    <div>
      <ErrorBox error={ev.error} />
      <PagedTable<EventPageRow>
        plain cols={cols} rows={ev.data?.rows} total={ev.data?.total ?? 0} loading={ev.loading}
        page={page} pageSize={size} sort={sort} dir={dir}
        onSort={onSort} onPage={setPage} onPageSize={setSize}
        onRow={(r) => pick(r.name)} active={(r) => r.name === sel} rowKey={(r) => r.name} maxBodyHeight={372}
        emptyText={term ? `Không có event nào chứa "${term}"` : "Chưa có event"}
        toolbar={
          <>
            <div className="relative w-full sm:w-72">
              <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 muted" />
              <input className="input w-full !pl-8 pr-7" placeholder="Tìm event" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <button className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 muted hover:text-fg" onClick={() => setSearch("")} aria-label="Xóa tìm kiếm">
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
            <span className="ml-auto text-xs muted">{ev.data ? `${ev.data.total.toLocaleString()} loại event` : ""}</span>
          </>
        }
      />

      {/* bottom: detail of the selected event */}
      <div ref={detailRef} className="mt-8 scroll-mt-4 border-t border-line pt-6">
        {sel ? (
          <>
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-xs muted">Chi tiết event</span>
              <h2 className="text-[18px] font-semibold">{sel}</h2>
            </div>
            <EventBody key={sel} name={sel} inline />
          </>
        ) : (
          !ev.loading && <p className="text-[13px] muted">Chọn một event ở danh sách phía trên để xem chi tiết.</p>
        )}
      </div>
    </div>
  );
}

/** /app/:appId/events/:name — same content as the inline panel, as its own page (deep link). */
export function EventDetail() {
  const { name: raw = "" } = useParams();
  const { appId } = useDash();
  return (
    <div>
      <Link to={`/app/${appId}/events`} className="inline-flex items-center gap-1 text-[13px] muted hover:text-fg">
        <Icon name="back" size={14} /> Events
      </Link>
      <h2 className="mb-5 mt-1 text-[18px] font-semibold">{decodeURIComponent(raw)}</h2>
      <EventBody name={decodeURIComponent(raw)} />
    </div>
  );
}

/** One event: headline numbers, daily trend, parameter tabs with value breakdown. */
function EventBody({ name, inline }: { name: string; inline?: boolean }) {
  const { q, addFilter, appId } = useDash();
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
  const loading = ts.loading && !ts.data;

  return (
    <div className={inline ? "space-y-5" : "space-y-6"}>
      <ErrorBox error={ts.error || keys.error || rows.error} />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className={`grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:flex-1 ${inline ? "lg:max-w-3xl" : ""}`}>
          <Kpi label="Số lần" icon="bolt" value={fmt(ts.data?.total)} loading={loading} />
          <Kpi label="Users" icon="users" value={fmt(ts.data?.users)} loading={loading} />
          <Kpi label="Lần / user" icon="ratio" value={ts.data?.users ? (ts.data.total / ts.data.users).toFixed(1) : "—"} loading={loading} />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {inline && (
            <Link to={`/app/${appId}/events/${encodeURIComponent(name)}`} className="btn" title="Mở trang riêng">
              <Icon name="arrowRight" size={14} className="muted" /> Trang riêng
            </Link>
          )}
          <button className="btn" onClick={() => addFilter({ dim: "event", op: "eq", val: name })}>
            <Icon name="filter" size={14} className="muted" /> Lọc theo event này
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-[13px] font-semibold">Theo ngày</h3>
        <TimeChart loading={ts.loading} labels={ts.data?.labels ?? []} series={ts.data?.series ?? []} height={inline ? 200 : 240} />
      </section>

      <section>
        <div className="flex flex-wrap items-end gap-3 border-b border-line">
          <h3 className="mb-2 mr-2 text-[13px] font-semibold">Parameter</h3>
          {/* Plane-style underline tabs, one per parameter */}
          <nav className="-mb-px flex min-w-0 flex-1 gap-4 overflow-x-auto">
            {(keys.data ?? []).map((k) => (
              <button key={k.key} onClick={() => setParam(k.key)}
                className={`whitespace-nowrap border-b-2 pb-2 text-[13px] transition-colors ${k.key === param ? "border-accent font-medium text-fg" : "border-transparent muted hover:text-fg"}`}>
                {k.key}
              </button>
            ))}
            {keys.data && keys.data.length === 0 && <span className="pb-2 text-[13px] muted">Event này không có parameter</span>}
          </nav>
          <div className="mb-2"><Segmented value={metric} onChange={setMetric} options={[{ v: "count", label: "Số lần" }, { v: "users", label: "Users" }]} /></div>
        </div>
        {stats.data && (
          <div className="mt-3 flex gap-6 text-[13px]">
            <span><span className="muted">Tổng </span><b className="tabular">{fmt(stats.data.sum)}</b></span>
            <span><span className="muted">Trung bình </span><b className="tabular">{fmt(stats.data.avg)}</b></span>
          </div>
        )}
        {param && (
          <div className="mt-2">
            <DataTable rows={rows.data} loading={rows.loading} maxHeight={inline ? 300 : undefined} onRow={(r) => addFilter({ dim: "p", key: param, op: "eq", val: r.value })} cols={[
              { key: "value", title: param },
              { key: "metric", title: metric === "users" ? "Users" : "Số lần", num: true, bar: true, render: (r) => fmt(r.metric) },
              metric === "users"
                ? { key: "count", title: "Số lần", num: true, render: (r) => fmt(r.count) }
                : { key: "users", title: "Users", num: true, render: (r) => fmt(r.users) },
            ]} />
            {rows.data && rows.data.length > 0 && <p className="mt-2 text-xs muted">{rows.data.length} giá trị · bấm 1 dòng để lọc dashboard theo giá trị đó</p>}
          </div>
        )}
      </section>
    </div>
  );
}
