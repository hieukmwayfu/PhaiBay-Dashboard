import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type BreakdownRow, type ParamKey, type Timeseries } from "../lib/api";
import { fmt } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { TimeChart } from "../components/Charts";
import { DataTable, ErrorBox, Loading, Segmented } from "../components/ui";
import { DeleteEventsDialog } from "../components/DeleteEvents";
import { EVENTS_DELETED, usePendingDeletes } from "../lib/pendingDelete";
import { Icon } from "../components/Icon";
import { PagedTable, type PCol } from "../components/PagedTable";

interface EventPageRow { name: string; count: number; users: number; last_seen: number }
interface EventPage { total: number; rows: EventPageRow[] }

const CHUNK = 50; // events fetched per scroll step

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

/** Events: list on top (scrolls, loads more at the end), selected event's detail below. */
export function Events() {
  const { q, version, appId } = useDash();
  const [picked, setPicked] = useState<Set<string>>(new Set()); // events ticked for deletion
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const pending = usePendingDeletes();
  const queued = new Set(pending.filter((p) => p.appId === appId && (p.state === "waiting" || p.state === "running")).flatMap((p) => p.names));
  useEffect(() => { setPicked(new Set()); }, [appId]);
  useEffect(() => {
    const f = () => setPicked(new Set());
    window.addEventListener(EVENTS_DELETED, f);
    return () => window.removeEventListener(EVENTS_DELETED, f);
  }, []);
  const toggle = (name: string) => setPicked((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n; });
  const [sel, setSel] = useState<string | null>(null); // event shown in the bottom panel
  const detailRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());
  const [sort, setSort] = useState("count");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // infinite list state
  const [rows, setRows] = useState<EventPageRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const gen = useRef(0); // drops responses of an outdated query
  const busy = useRef(false); // scroll events fire in bursts: one request at a time

  const load = useCallback(async (offset: number, replace: boolean) => {
    if (busy.current && !replace) return;
    const my = replace ? ++gen.current : gen.current;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const r = await api<EventPage>("/api/events/page", q({ q: term, sort, dir, offset, limit: CHUNK }));
      if (my !== gen.current) return;
      setTotal(r.total);
      setRows((prev) => {
        if (replace || !prev) return r.rows;
        const seen = new Set(prev.map((x) => x.name));
        return [...prev, ...r.rows.filter((x) => !seen.has(x.name))];
      });
    } catch (e) {
      if (my === gen.current) setError((e as Error).message);
    } finally {
      if (my === gen.current) { setLoading(false); busy.current = false; }
    }
  }, [q, term, sort, dir]);

  // new query (filters, dates, search, sort, refresh): start over
  useEffect(() => { load(0, true); }, [load, version]);

  const more = () => {
    if (!loading && rows && rows.length < total) load(rows.length, false);
  };

  // default selection: first event (kept while it is still listed)
  useEffect(() => {
    if (rows?.length && (!sel || !rows.some((r) => r.name === sel))) setSel(rows[0].name);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (name: string) => {
    setSel(name);
    const el = detailRef.current;
    if (el && el.getBoundingClientRect().top > window.innerHeight - 120) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSort = (k: string) => {
    if (k === sort) setDir(dir === "desc" ? "asc" : "desc");
    else { setSort(k); setDir(k === "name" ? "asc" : "desc"); }
  };

  const allPicked = !!rows?.length && rows.every((r) => picked.has(r.name));
  const cols: PCol<EventPageRow>[] = [
    { key: "pick", width: "36px", title: (
      <input type="checkbox" className="check" aria-label="Chọn tất cả" checked={allPicked} disabled={!rows?.length}
        ref={(el) => { if (el) el.indeterminate = picked.size > 0 && !allPicked; }}
        onChange={() => setPicked(allPicked ? new Set() : new Set(rows?.map((r) => r.name)))} />
    ), render: (r) => (
      <input type="checkbox" className="check" aria-label={`Chọn ${r.name}`} checked={picked.has(r.name)}
        onClick={(e) => e.stopPropagation()} onChange={() => toggle(r.name)} />
    ) },
    { key: "name", title: "Event", sortable: true, render: (r) => (
      <span className="flex min-w-0 items-center gap-1.5" title={r.name}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${sel === r.name ? "bg-accent" : "bg-transparent"}`} />
        <span className={`truncate font-medium ${queued.has(r.name) ? "text-dim line-through" : ""}`}>{r.name}</span>
        {queued.has(r.name) && <span className="badge shrink-0 bg-bad/10 text-bad">chờ xóa</span>}
      </span>
    ) },
    { key: "count", title: "Số lần", sortable: true, num: true, width: "120px", render: (r) => fmt(r.count) },
    { key: "users", title: "Users", sortable: true, num: true, width: "110px", render: (r) => fmt(r.users) },
    { key: "per_user", title: "Lần / user", sortable: true, num: true, width: "110px", hideBelow: "md", render: (r) => (r.users ? (r.count / r.users).toFixed(1) : "—") },
    { key: "last_seen", title: "Lần cuối", sortable: true, num: true, width: "150px", hideBelow: "sm", render: (r) => <span className="muted" title={new Date(r.last_seen).toLocaleString()}>{ago(r.last_seen)}</span> },
  ];

  return (
    <div>
      <ErrorBox error={error} />
      <PagedTable<EventPageRow>
        plain cols={cols} rows={rows} total={total} loading={loading}
        page={1} pageSize={Math.max(CHUNK, rows?.length ?? 0)} sort={sort} dir={dir}
        onSort={onSort} onPage={() => {}} onPageSize={() => {}}
        onRow={(r) => pick(r.name)} active={(r) => r.name === sel} rowKey={(r) => r.name}
        maxBodyHeight={372} onReachEnd={more}
        emptyText={term ? `Không có event nào chứa "${term}"` : "Chưa có event"}
        footer={
          <div className="flex items-center gap-2 border-t border-line pt-2 text-xs muted">
            {rows && <span>Hiển thị {rows.length.toLocaleString()} / {total.toLocaleString()} event</span>}
            {rows && rows.length < total && !loading && <button className="hover:text-fg" onClick={more}>· Tải thêm</button>}
            <Loading on={loading} />
          </div>
        }
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
            {picked.size > 0 ? (
              <span key="sel" className="ml-auto flex animate-fade-in items-center gap-2">
                <span className="text-xs"><b className="tabular">{picked.size}</b> <span className="muted">đã chọn</span></span>
                <button className="text-xs muted hover:text-fg" onClick={() => setPicked(new Set())}>Bỏ chọn</button>
                <button className="btn-danger !h-7" onClick={() => setConfirm([...picked])}><Icon name="trash" size={13} /> Xóa</button>
              </span>
            ) : (
              <span className="ml-auto text-xs muted">{rows ? `${total.toLocaleString()} loại event` : ""}</span>
            )}
          </>
        }
      />

      {confirm && <DeleteEventsDialog names={confirm} onClose={() => setConfirm(null)} onScheduled={() => setPicked(new Set())} />}

      {/* bottom: detail of the selected event */}
      <div ref={detailRef} className="mt-6 scroll-mt-4 border-t border-line pt-5">
        {sel ? <EventBody key={sel} name={sel} inline /> : (
          !loading && <p className="text-[13px] muted">Chọn một event ở danh sách phía trên để xem chi tiết.</p>
        )}
      </div>
    </div>
  );
}

/** /app/:appId/events/:name — same content as the panel, as its own page (deep link). */
export function EventDetail() {
  const { name: raw = "" } = useParams();
  const { appId } = useDash();
  return (
    <div>
      <Link to={`/app/${appId}/events`} className="mb-3 inline-flex items-center gap-1 text-[13px] muted hover:text-fg">
        <Icon name="back" size={14} /> Events
      </Link>
      <EventBody name={decodeURIComponent(raw)} />
    </div>
  );
}

/** One event: name + headline numbers, parameter breakdown first, daily trend last. */
function EventBody({ name, inline }: { name: string; inline?: boolean }) {
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
    <div className="space-y-6">
      <ErrorBox error={ts.error || keys.error || rows.error} />

      {/* name + compact numbers on one line */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <h2 className="text-[18px] font-semibold">{name}</h2>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <span><span className="muted">Số lần </span><b className="tabular">{ts.data ? fmt(ts.data.total) : "…"}</b></span>
          <span><span className="muted">Users </span><b className="tabular">{ts.data ? fmt(ts.data.users) : "…"}</b></span>
          <span><span className="muted">Lần / user </span><b className="tabular">{ts.data?.users ? (ts.data.total / ts.data.users).toFixed(1) : "—"}</b></span>
        </div>
        <button className="btn ml-auto" onClick={() => addFilter({ dim: "event", op: "eq", val: name })}>
          <Icon name="filter" size={14} className="muted" /> Lọc theo event này
        </button>
      </div>

      {/* parameters first */}
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
            <DataTable rows={rows.data} loading={rows.loading} maxHeight={inline ? 320 : undefined} onRow={(r) => addFilter({ dim: "p", key: param, op: "eq", val: r.value })} cols={[
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

      {/* daily trend last */}
      <section>
        <h3 className="mb-3 text-[13px] font-semibold">Theo ngày</h3>
        <TimeChart loading={ts.loading} labels={ts.data?.labels ?? []} series={ts.data?.series ?? []} height={inline ? 200 : 240} />
      </section>
    </div>
  );
}
