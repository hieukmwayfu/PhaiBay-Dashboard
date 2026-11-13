import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Icon, type IconName } from "./Icon";

export function Card({ title, subtitle, right, children, className = "", pad = true }: {
  title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={`card min-w-0 animate-fade-in ${pad ? "" : "!p-0"} ${className}`}>
      {(title || right) && (
        <div className={`mb-4 flex items-start gap-3 ${pad ? "" : "px-5 pt-5"}`}>
          <div className="min-w-0">
            {title && <h3 className="card-title truncate">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs muted">{subtitle}</p>}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div>
        </div>
      )}
      {children}
    </section>
  );
}

/** Percent change vs previous period; null when not computable. */
export function delta(cur?: number, prev?: number): number | null {
  if (cur == null || prev == null || prev === 0) return null;
  return (cur - prev) / prev;
}

export function Delta({ value }: { value: number | null }) {
  if (value == null || !isFinite(value)) return null;
  const up = value >= 0;
  const flat = Math.abs(value) < 0.0005;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular
      ${flat ? "bg-raised text-dim" : up ? "bg-good/10 text-good" : "bg-bad/10 text-bad"}`}>
      {!flat && <Icon name={up ? "arrowUp" : "arrowDown"} size={11} strokeWidth={2.4} />}
      {Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%
    </span>
  );
}

export function Kpi({ label, value, icon, change, spark, color = "#8b80ff", loading }: {
  label: string; value: ReactNode; icon?: IconName; change?: number | null; spark?: number[]; color?: string; loading?: boolean;
}) {
  const id = "sp" + label.replace(/\W/g, "");
  return (
    <div className="card relative overflow-hidden !p-4 animate-fade-in">
      <div className="flex items-center gap-2 text-[13px] font-medium muted">
        {icon && (
          <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: color + "1f", color }}>
            <Icon name={icon} size={15} />
          </span>
        )}
        {label}
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1.5">
        {loading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold leading-none tracking-tight tabular sm:text-[28px]">{value}</div>}
        {!loading && <div className="mb-0.5"><Delta value={change ?? null} /></div>}
      </div>
      {spark && spark.length > 1 && (
        <div className="pointer-events-none -mx-4 -mb-4 mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={color} stopOpacity={0.35} />
                  <stop offset="1" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-bad">
      <Icon name="x" size={16} className="mt-0.5" />
      <span className="min-w-0 break-words">{error}</span>
    </div>
  );
}

export function Empty({ children = "Không có dữ liệu", icon = "layers" }: { children?: ReactNode; icon?: IconName }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm muted">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-raised"><Icon name={icon} size={18} /></span>
      {children}
    </div>
  );
}

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-raised ${className}`} style={style}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export interface Col<T> {
  key: keyof T | string;
  title: string;
  num?: boolean;
  bar?: boolean; // draws an inline bar proportional to the column max
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({ cols, rows, onRow, maxHeight, loading, active }: {
  cols: Col<T>[]; rows: T[] | null | undefined; onRow?: (r: T) => void; maxHeight?: number; loading?: boolean; active?: (r: T) => boolean;
}) {
  if (!rows && loading) {
    return <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
  }
  if (!rows || rows.length === 0) return <Empty />;
  const max: Record<string, number> = {};
  for (const c of cols) if (c.bar) max[c.key as string] = Math.max(1, ...rows.map((r) => Number((r as Record<string, unknown>)[c.key as string]) || 0));
  return (
    <div className="-mx-2 overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr>
            {cols.map((c) => (
              <th key={String(c.key) + c.title}
                className={`whitespace-nowrap border-b border-line px-2 pb-2.5 pt-1 text-[11px] font-semibold uppercase tracking-wider muted ${c.num ? "text-right" : "text-left"}`}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const on = active?.(r);
            return (
              <tr key={i} onClick={onRow ? () => onRow(r) : undefined}
                className={`group ${onRow ? "cursor-pointer" : ""} ${on ? "bg-accent/10" : onRow ? "hover:bg-raised/70" : ""}`}>
                {cols.map((c, ci) => {
                  const raw = (r as Record<string, unknown>)[c.key as string];
                  const content = c.render ? c.render(r) : String(raw ?? "");
                  const base = `border-b border-line/60 px-2 py-2 ${ci === 0 ? "rounded-l-lg" : ""} ${ci === cols.length - 1 ? "rounded-r-lg" : ""}`;
                  if (c.bar) {
                    const w = (100 * (Number(raw) || 0)) / max[c.key as string];
                    return (
                      <td key={String(c.key) + c.title} className={`${base} relative min-w-[110px] whitespace-nowrap text-right tabular`}>
                        <span className="absolute inset-y-1.5 left-1 rounded-md bg-accent/15 transition-all" style={{ width: `calc(${w}% - 8px)` }} />
                        <span className="relative font-medium">{content}</span>
                      </td>
                    );
                  }
                  return <td key={String(c.key) + c.title} className={`${base} whitespace-nowrap ${c.num ? "text-right tabular" : ""}`}>{content}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Loading({ on }: { on: boolean }) {
  return on ? <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : null;
}

export function Modal({ title, onClose, children, width = "max-w-md" }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={`card w-full ${width} animate-fade-in rounded-b-none shadow-pop sm:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center">
          <h3 className="text-base font-semibold">{title}</h3>
          <button className="btn-ghost ml-auto !h-8 !px-2" onClick={onClose} aria-label="Đóng"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm muted">{subtitle}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn-ghost !h-7 !px-2 text-xs"
      onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}>
      <Icon name={ok ? "check" : "copy"} size={14} className={ok ? "text-good" : ""} />
      {label && (ok ? "Đã copy" : label)}
    </button>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.v)} type="button" data-on={o.v === value} onClick={() => onChange(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}
