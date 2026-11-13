import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function Card({ title, subtitle, right, children, className = "", pad = true }: {
  title?: ReactNode; subtitle?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean;
}) {
  return (
    <section className={`card min-w-0 ${pad ? "" : "!p-0"} ${className}`}>
      {(title || right) && (
        <div className={`mb-3 flex items-start gap-3 ${pad ? "" : "px-4 pt-4"}`}>
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

/** Plain colored text + arrow (no pill), like Stripe's comparisons. */
export function Delta({ value }: { value: number | null }) {
  if (value == null || !isFinite(value)) return null;
  const flat = Math.abs(value) < 0.0005;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center text-xs font-medium tabular ${flat ? "muted" : up ? "text-good" : "text-bad"}`}>
      {!flat && <Icon name={up ? "arrowUp" : "arrowDown"} size={12} strokeWidth={2.2} />}
      {Math.abs(value * 100).toFixed(Math.abs(value) < 0.1 ? 1 : 0)}%
    </span>
  );
}

/** Stat tile (Plane "Overview" style): outlined icon box, small label, number. */
export function Kpi({ label, value, icon, change, loading, active, onClick }: {
  label: string; value: ReactNode; icon?: IconName; change?: number | null; loading?: boolean;
  spark?: number[]; color?: string; iconColor?: string; // accepted for compatibility, intentionally not drawn
  active?: boolean; onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick}
      className={`flex min-w-0 items-center gap-3 rounded-lg border bg-surface px-4 py-3 text-left transition-colors
        ${active ? "border-accent ring-1 ring-accent" : "border-line"} ${onClick ? "hover:bg-raised" : ""}`}>
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-dim">
          <Icon name={icon} size={17} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-xs muted">{label}</span>
        <span className="mt-0.5 flex items-baseline gap-2">
          {loading ? <Skeleton className="h-5 w-16" /> : <span className="text-[17px] font-semibold tabular">{value}</span>}
          {!loading && <Delta value={change ?? null} />}
        </span>
      </span>
    </Tag>
  );
}

export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-bad/30 bg-bad/5 px-3 py-2 text-[13px] text-bad">
      <Icon name="x" size={15} className="mt-0.5" />
      <span className="min-w-0 break-words">{error}</span>
    </div>
  );
}

export function Empty({ children = "Không có dữ liệu" }: { children?: ReactNode; icon?: IconName }) {
  return <div className="py-8 text-center text-[13px] muted">{children}</div>;
}

export function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <div className={`animate-pulse rounded bg-raised ${className}`} style={style} />;
}

export interface Col<T> {
  key: keyof T | string;
  title: string;
  num?: boolean;
  bar?: boolean; // thin inline bar proportional to the column max
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({ cols, rows, onRow, maxHeight, loading, active }: {
  cols: Col<T>[]; rows: T[] | null | undefined; onRow?: (r: T) => void; maxHeight?: number; loading?: boolean; active?: (r: T) => boolean;
}) {
  if (!rows && loading) {
    return <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>;
  }
  if (!rows || rows.length === 0) return <Empty />;
  const max: Record<string, number> = {};
  for (const c of cols) if (c.bar) max[c.key as string] = Math.max(1, ...rows.map((r) => Number((r as Record<string, unknown>)[c.key as string]) || 0));
  return (
    <div className="-mx-1 overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-[13px]">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr>
            {cols.map((c) => (
              <th key={String(c.key) + c.title}
                className={`whitespace-nowrap border-b border-line px-1 py-2 text-xs font-medium muted ${c.num ? "text-right" : "text-left"}`}>
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
                className={`border-b border-line/70 ${onRow ? "cursor-pointer" : ""} ${on ? "bg-raised" : onRow ? "hover:bg-raised" : ""}`}>
                {cols.map((c) => {
                  const raw = (r as Record<string, unknown>)[c.key as string];
                  const content = c.render ? c.render(r) : String(raw ?? "");
                  if (c.bar) {
                    const w = (100 * (Number(raw) || 0)) / max[c.key as string];
                    return (
                      <td key={String(c.key) + c.title} className="whitespace-nowrap px-1 py-1.5 text-right tabular">
                        <span className="inline-flex items-center justify-end gap-2">
                          <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-raised sm:block">
                            <span className="block h-full rounded-full bg-accent/60" style={{ width: `${w}%` }} />
                          </span>
                          <span className="min-w-[3.5rem]">{content}</span>
                        </span>
                      </td>
                    );
                  }
                  return <td key={String(c.key) + c.title} className={`whitespace-nowrap px-1 py-1.5 ${c.num ? "text-right tabular" : ""}`}>{content}</td>;
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
  return on ? <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-dim/40 border-t-dim" /> : null;
}

export function Modal({ title, onClose, children, width = "max-w-md" }: { title: ReactNode; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className={`w-full ${width} rounded-t-lg border border-line bg-surface p-5 shadow-pop sm:rounded-lg`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button className="btn-ghost ml-auto !h-7 !px-1.5" onClick={onClose} aria-label="Đóng"><Icon name="x" size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Stripe-style page title row: big plain title, actions on the right. */
export function PageHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] muted">{subtitle}</p>}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{right}</div>
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn-ghost !h-7 !px-1.5 text-xs"
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

/** Small status badge (Stripe "Succeeded ✓" / "Failed ✕"). */
export function Badge({ tone = "neutral", children }: { tone?: "good" | "bad" | "warn" | "neutral" | "accent"; children: ReactNode }) {
  const cls = {
    good: "bg-good/10 text-good", bad: "bg-bad/10 text-bad", warn: "bg-warn/10 text-warn",
    neutral: "bg-raised text-dim", accent: "bg-accent/10 text-accent",
  }[tone];
  return <span className={`badge ${cls}`}>{children}</span>;
}
