import { useEffect, useMemo, useState } from "react";
import { api, type EventRow } from "../lib/api";
import { useDash, useLoad } from "../lib/state";
import {
  askAgent, DASHBOARDS_CHANGED, deleteDashboard, emptySpec, evalDashboard, formatValue, listDashboards, saveDashboard,
  type Agg, type DashData, type Dashboard, type DashSpec, type DashWidget, type WidgetType,
} from "../lib/dashboards";
import { TimeChart } from "../components/Charts";
import { Icon } from "../components/Icon";
import { Markdown } from "../components/Markdown";
import { Delta, ErrorBox, Loading, Segmented, Skeleton, delta } from "../components/ui";

const DIMS = ["country", "version", "platform", "os", "device", "lang", "day"];
const AGGS: Agg[] = ["count", "users", "sum", "avg", "min", "max"];
const AGG_LABEL: Record<Agg, string> = { count: "Số lần", users: "Users", sum: "Tổng param", avg: "TB param", min: "Min param", max: "Max param" };
const W_TYPES: WidgetType[] = ["kpi", "line", "bar", "table", "text"];
const W_LABEL: Record<WidgetType, string> = { kpi: "Số tổng (KPI)", line: "Biểu đồ đường", bar: "Biểu đồ cột", table: "Bảng theo chiều", text: "Ghi chú" };
const SPAN: Record<number, string> = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" };

/** Debounced copy of a value. */
function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export function Dashboards() {
  const { appId, q, version } = useDash();
  const [list, setList] = useState<Dashboard[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id?: number; name: string; spec: DashSpec } | null>(null);
  const [err, setErr] = useState("");

  const load = (selectId?: number) =>
    listDashboards(appId!).then((l) => {
      setList(l);
      setSel((cur) => selectId ?? (l.some((d) => d.id === cur) ? cur : l[0]?.id ?? null));
    }).catch((e: Error) => setErr(e.message));
  useEffect(() => { load(); }, [appId, version]); // eslint-disable-line react-hooks/exhaustive-deps
  // the AI panel saved a dashboard
  useEffect(() => {
    const h = () => load();
    window.addEventListener(DASHBOARDS_CHANGED, h);
    return () => window.removeEventListener(DASHBOARDS_CHANGED, h);
  }, [appId]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = list?.find((d) => d.id === sel) ?? null;
  const spec = editing ? editing.spec : cur?.spec;
  const live = useDebounced(spec, editing ? 600 : 0);
  const data = useLoad(
    () => (live && (live.metrics.length || live.widgets.length) ? evalDashboard(live, q()).then((r) => r.data) : Promise.resolve(null)),
    [live, q],
  );

  const startNew = () => setEditing({ name: "Dashboard mới", spec: emptySpec() });
  const save = async () => {
    if (!editing) return;
    setErr("");
    try {
      const d = await saveDashboard({ id: editing.id, app_id: appId!, name: editing.name, spec: editing.spec });
      setEditing(null);
      await load(d.id);
    } catch (e) { setErr((e as Error).message); }
  };
  const remove = async () => {
    if (!cur || !confirm(`Xoá dashboard "${cur.name}"?`)) return;
    await deleteDashboard(cur.id);
    setSel(null);
    load();
  };
  const aiPrompt = cur && !editing
    ? `Sửa custom dashboard "${cur.name}" (dashboard_id=${cur.id}): `
    : "Tạo custom dashboard cho app này: ";

  return (
    <div className="space-y-4">
      <ErrorBox error={err} />
      {/* dashboard tabs + actions */}
      <div className="flex flex-wrap items-end gap-3 border-b border-line">
        <nav className="-mb-px flex min-w-0 flex-1 gap-4 overflow-x-auto">
          {list?.map((d) => (
            <button key={d.id} onClick={() => { setSel(d.id); setEditing(null); }}
              className={`whitespace-nowrap border-b-2 pb-2 text-[13px] ${d.id === sel ? "border-accent font-medium text-fg" : "border-transparent muted hover:text-fg"}`}>
              {d.name}{d.updated_by === "ai" && <span className="ml-1 text-[10px] muted">AI</span>}
            </button>
          ))}
          {editing && !editing.id && <span className="whitespace-nowrap border-b-2 border-accent pb-2 text-[13px] font-medium">{editing.name || "Dashboard mới"}</span>}
          {list && list.length === 0 && !editing && <span className="pb-2 text-[13px] muted">Chưa có dashboard nào</span>}
        </nav>
        <div className="mb-2 flex items-center gap-2">
          {!editing ? (
            <>
              <button className="btn" onClick={() => askAgent(aiPrompt)}><Icon name="sparkles" size={14} className="muted" /> Nhờ AI</button>
              {cur && <button className="btn" onClick={() => setEditing({ id: cur.id, name: cur.name, spec: JSON.parse(JSON.stringify(cur.spec)) })}>Sửa</button>}
              {cur && <button className="btn-ghost hover:!text-bad" onClick={remove} title="Xoá"><Icon name="x" size={15} /></button>}
              <button className="btn-primary" onClick={startNew}><Icon name="plus" size={14} strokeWidth={2.2} /> Dashboard mới</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setEditing(null)}>Huỷ</button>
              <button className="btn-primary" onClick={save}>Lưu</button>
            </>
          )}
        </div>
      </div>

      {editing && <Editor value={editing} onChange={setEditing} />}

      {!spec && list && list.length === 0 && !editing && (
        <div className="py-12 text-center">
          <p className="text-[13px] muted">Tự ghép chỉ số riêng cho app: ví dụ C = A − B từ 2 event, tỉ lệ thắng, doanh thu / người chơi…</p>
          <div className="mt-3 flex justify-center gap-2">
            <button className="btn" onClick={() => askAgent("Tạo custom dashboard cho app này: ")}><Icon name="sparkles" size={14} className="muted" /> Nhờ AI tạo</button>
            <button className="btn-primary" onClick={startNew}><Icon name="plus" size={14} /> Tự tạo</button>
          </div>
        </div>
      )}

      {spec && (
        <>
          {editing && <div className="flex items-center gap-2 text-xs muted">Xem trước {data.loading && <Loading on />}</div>}
          <ErrorBox error={data.error} />
          <View spec={spec} data={data.data} loading={data.loading && !data.data} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- view

function View({ spec, data, loading }: { spec: DashSpec; data: DashData | null; loading: boolean }) {
  if (spec.widgets.length === 0) return <p className="text-[13px] muted">Chưa có widget nào. Thêm widget ở phần sửa.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      {spec.widgets.map((w, i) => (
        <section key={i} className={`card min-w-0 ${SPAN[Math.min(4, Math.max(1, w.width ?? (w.type === "kpi" ? 1 : 2)))]}`}>
          {w.title && <h3 className="card-title mb-3">{w.title}</h3>}
          {loading && w.type !== "text" ? <Skeleton className="h-24 w-full" /> : <WidgetBody w={w} index={i} data={data} />}
        </section>
      ))}
    </div>
  );
}

function WidgetBody({ w, index, data }: { w: DashWidget; index: number; data: DashData | null }) {
  if (w.type === "text") return <Markdown text={w.markdown ?? ""} />;
  if (!data) return <p className="text-xs muted">Chưa có dữ liệu</p>;
  const ss = (w.series ?? []).map((id) => data.series[id]).filter(Boolean);
  if (w.type === "kpi") {
    const s = ss[0];
    if (!s) return null;
    return (
      <div>
        <div className="text-xs muted">{s.label}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[24px] font-semibold tabular">{formatValue(s.total, s.format)}</span>
          <Delta value={delta(s.total ?? undefined, s.prev ?? undefined)} />
        </div>
        <div className="mt-1 text-xs muted">kỳ trước {formatValue(s.prev, s.format)}</div>
      </div>
    );
  }
  if (w.type === "line" || w.type === "bar") {
    return <TimeChart bars={w.type === "bar"} height={220} labels={data.labels} series={ss.map((s) => ({ name: s.label, values: s.values.map((v) => v ?? 0) }))} />;
  }
  const t = data.tables.find((x) => x.widget === index);
  if (!t) return null;
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-xs muted">
            <th className="px-1 py-2 text-left font-medium">{t.dim}</th>
            {ss.map((s) => <th key={s.id} className="px-1 py-2 text-right font-medium">{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i} className="border-b border-line/70">
              <td className="px-1 py-1.5">{String(r.value)}</td>
              {ss.map((s) => <td key={s.id} className="px-1 py-1.5 text-right tabular">{formatValue(r[s.id] as number | null, s.format)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {t.rows.length === 0 && <p className="py-4 text-center text-xs muted">Không có dữ liệu</p>}
    </div>
  );
}

// ---------------------------------------------------------------- editor

function Editor({ value, onChange }: { value: { id?: number; name: string; spec: DashSpec }; onChange: (v: { id?: number; name: string; spec: DashSpec }) => void }) {
  const { q } = useDash();
  const [mode, setMode] = useState<"form" | "json">("form");
  const [json, setJson] = useState("");
  const [jsonErr, setJsonErr] = useState("");
  const events = useLoad(() => api<EventRow[]>("/api/events", q({}, ["event"])), [q]);
  const sp = value.spec;
  const set = (spec: DashSpec) => onChange({ ...value, spec });
  const ids = useMemo(() => [...sp.metrics.map((m) => m.id), ...sp.formulas.map((f) => f.id)], [sp]);
  const nextId = () => { for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!ids.includes(c)) return c; return "M" + ids.length; };

  useEffect(() => { if (mode === "json") setJson(JSON.stringify(sp, null, 2)); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5 rounded-lg border border-line p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px]"><span className="muted">Tên</span>
          <input className="input w-64" value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} />
        </label>
        <div className="ml-auto"><Segmented value={mode} onChange={setMode} options={[{ v: "form", label: "Form" }, { v: "json", label: "JSON" }]} /></div>
      </div>

      {mode === "json" ? (
        <div>
          <textarea className="input h-80 w-full py-2 font-mono text-[12px]" value={json} spellCheck={false}
            onChange={(e) => {
              setJson(e.target.value);
              try { set(JSON.parse(e.target.value)); setJsonErr(""); } catch (x) { setJsonErr((x as Error).message); }
            }} />
          {jsonErr ? <p className="mt-1 text-xs text-bad">{jsonErr}</p> : <p className="mt-1 text-xs muted">Định dạng xem ở GET /api/dashboards/spec (AI dùng cùng tài liệu này).</p>}
        </div>
      ) : (
        <>
          <datalist id="pb-events">{events.data?.map((e) => <option key={e.name} value={e.name} />)}</datalist>
          {/* metrics */}
          <section>
            <div className="mb-2 flex items-center"><h4 className="text-[13px] font-semibold">Chỉ số từ event</h4>
              <button className="btn-ghost ml-auto !h-7 text-xs" onClick={() => set({ ...sp, metrics: [...sp.metrics, { id: nextId(), event: events.data?.[0]?.name ?? "", agg: "count" }] })}><Icon name="plus" size={13} /> Thêm</button>
            </div>
            {sp.metrics.length === 0 && <p className="text-xs muted">Ví dụ: A = số lần level_start, B = số lần level_end có success=1.</p>}
            <div className="space-y-2">
              {sp.metrics.map((m, i) => {
                const upd = (patch: Partial<typeof m>) => set({ ...sp, metrics: sp.metrics.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                const needsParam = m.agg && !["count", "users"].includes(m.agg);
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input className="input w-14 font-mono" value={m.id} onChange={(e) => upd({ id: e.target.value })} title="Id dùng trong công thức" />
                    <input className="input w-36" placeholder="Tên hiển thị" value={m.label ?? ""} onChange={(e) => upd({ label: e.target.value })} />
                    <input className="input w-44" list="pb-events" placeholder="event" value={m.event} onChange={(e) => upd({ event: e.target.value })} />
                    <select className="input" value={m.agg ?? "count"} onChange={(e) => upd({ agg: e.target.value as Agg })}>
                      {AGGS.map((a) => <option key={a} value={a}>{AGG_LABEL[a]}</option>)}
                    </select>
                    {needsParam && <input className="input w-28" placeholder="param số" value={m.param ?? ""} onChange={(e) => upd({ param: e.target.value })} />}
                    <input className="input min-w-[180px] flex-1" placeholder="lọc thêm: p.success=1; country=VN"
                      value={Object.entries(m.filters ?? {}).map(([k, v]) => `${k}=${v}`).join("; ")}
                      onChange={(e) => upd({ filters: parseKV(e.target.value) })} />
                    <button className="btn-ghost !px-1.5" onClick={() => set({ ...sp, metrics: sp.metrics.filter((_, j) => j !== i) })} aria-label="Xoá"><Icon name="x" size={14} /></button>
                  </div>
                );
              })}
            </div>
          </section>
          {/* formulas */}
          <section>
            <div className="mb-2 flex items-center"><h4 className="text-[13px] font-semibold">Công thức</h4>
              <button className="btn-ghost ml-auto !h-7 text-xs" onClick={() => set({ ...sp, formulas: [...sp.formulas, { id: nextId(), expr: "A - B" }] })}><Icon name="plus" size={13} /> Thêm</button>
            </div>
            {sp.formulas.length === 0 && <p className="text-xs muted">Ví dụ: C = A − B, tỉ lệ = B / A * 100 (định dạng %).</p>}
            <div className="space-y-2">
              {sp.formulas.map((f, i) => {
                const upd = (patch: Partial<typeof f>) => set({ ...sp, formulas: sp.formulas.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input className="input w-14 font-mono" value={f.id} onChange={(e) => upd({ id: e.target.value })} />
                    <span className="muted">=</span>
                    <input className="input w-56 font-mono" value={f.expr} onChange={(e) => upd({ expr: e.target.value })} placeholder="A - B" />
                    <input className="input w-36" placeholder="Tên hiển thị" value={f.label ?? ""} onChange={(e) => upd({ label: e.target.value })} />
                    <select className="input" value={f.format ?? "number"} onChange={(e) => upd({ format: e.target.value as "number" })}>
                      <option value="number">Số</option><option value="percent">%</option><option value="decimal">Thập phân</option>
                    </select>
                    <button className="btn-ghost !px-1.5" onClick={() => set({ ...sp, formulas: sp.formulas.filter((_, j) => j !== i) })} aria-label="Xoá"><Icon name="x" size={14} /></button>
                  </div>
                );
              })}
            </div>
          </section>
          {/* widgets */}
          <section>
            <div className="mb-2 flex items-center"><h4 className="text-[13px] font-semibold">Hiển thị</h4>
              <button className="btn-ghost ml-auto !h-7 text-xs" onClick={() => set({ ...sp, widgets: [...sp.widgets, { type: "kpi", title: "", series: ids.slice(-1), width: 1 }] })}><Icon name="plus" size={13} /> Thêm</button>
            </div>
            <div className="space-y-2">
              {sp.widgets.map((w, i) => {
                const upd = (patch: Partial<DashWidget>) => set({ ...sp, widgets: sp.widgets.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                const move = (d: number) => { const ws = [...sp.widgets]; const [x] = ws.splice(i, 1); ws.splice(Math.max(0, Math.min(ws.length, i + d)), 0, x); set({ ...sp, widgets: ws }); };
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select className="input" value={w.type} onChange={(e) => upd({ type: e.target.value as WidgetType })}>
                      {W_TYPES.map((t) => <option key={t} value={t}>{W_LABEL[t]}</option>)}
                    </select>
                    <input className="input w-40" placeholder="Tiêu đề" value={w.title ?? ""} onChange={(e) => upd({ title: e.target.value })} />
                    {w.type === "text" ? (
                      <input className="input min-w-[220px] flex-1" placeholder="Nội dung (markdown)" value={w.markdown ?? ""} onChange={(e) => upd({ markdown: e.target.value })} />
                    ) : (
                      <span className="flex flex-wrap items-center gap-1">
                        {ids.map((id) => {
                          const on = w.series?.includes(id);
                          return (
                            <button key={id} onClick={() => upd({ series: on ? w.series!.filter((x) => x !== id) : [...(w.series ?? []), id] })}
                              className={`h-7 rounded-md border px-2 font-mono text-xs ${on ? "border-accent bg-accent/10 text-fg" : "border-line muted hover:text-fg"}`}>{id}</button>
                          );
                        })}
                      </span>
                    )}
                    {w.type === "table" && (
                      <select className="input" value={w.dim ?? "country"} onChange={(e) => upd({ dim: e.target.value })}>
                        {DIMS.map((d) => <option key={d}>{d}</option>)}
                      </select>
                    )}
                    <select className="input" value={w.width ?? (w.type === "kpi" ? 1 : 2)} onChange={(e) => upd({ width: Number(e.target.value) })} title="Độ rộng (cột)">
                      {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}/4</option>)}
                    </select>
                    <span className="ml-auto flex">
                      <button className="btn-ghost !px-1.5" onClick={() => move(-1)} aria-label="Lên"><Icon name="arrowUp" size={14} /></button>
                      <button className="btn-ghost !px-1.5" onClick={() => move(1)} aria-label="Xuống"><Icon name="arrowDown" size={14} /></button>
                      <button className="btn-ghost !px-1.5" onClick={() => set({ ...sp, widgets: sp.widgets.filter((_, j) => j !== i) })} aria-label="Xoá"><Icon name="x" size={14} /></button>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function parseKV(s: string): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const part of s.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return Object.keys(out).length ? out : undefined;
}
