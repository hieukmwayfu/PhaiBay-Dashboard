import type { ReactNode } from "react";

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`card min-w-0 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center gap-2">
          {title && <h3 className="card-title mb-0">{title}</h3>}
          <div className="ml-auto">{right}</div>
        </div>
      )}
      {children}
    </div>
  );
}

export function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="card">
      <div className="text-sm muted">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">Lỗi: {error}</div>;
}

export function Empty({ children = "Không có dữ liệu" }: { children?: ReactNode }) {
  return <div className="py-6 text-center text-sm muted">{children}</div>;
}

export interface Col<T> {
  key: keyof T | string;
  title: string;
  num?: boolean;
  bar?: boolean; // draws an inline bar proportional to the column max
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({ cols, rows, onRow, maxHeight }: { cols: Col<T>[]; rows: T[] | null | undefined; onRow?: (r: T) => void; maxHeight?: number }) {
  if (!rows || rows.length === 0) return <Empty />;
  const max: Record<string, number> = {};
  for (const c of cols) if (c.bar) max[c.key as string] = Math.max(1, ...rows.map((r) => Number((r as Record<string, unknown>)[c.key as string]) || 0));
  return (
    <div className="overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white dark:bg-zinc-900">
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            {cols.map((c) => (
              <th key={String(c.key) + c.title} className={`whitespace-nowrap px-2 py-2 text-xs font-semibold muted ${c.num ? "text-right" : "text-left"}`}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} onClick={onRow ? () => onRow(r) : undefined}
              className={`border-b border-zinc-100 dark:border-zinc-800/70 ${onRow ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50" : ""}`}>
              {cols.map((c) => {
                const raw = (r as Record<string, unknown>)[c.key as string];
                const content = c.render ? c.render(r) : String(raw ?? "");
                if (c.bar) {
                  const w = (100 * (Number(raw) || 0)) / max[c.key as string];
                  return (
                    <td key={String(c.key) + c.title} className="relative whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                      <span className="absolute inset-y-1 left-0 rounded bg-blue-500/15" style={{ width: `${w}%` }} />
                      <span className="relative">{content}</span>
                    </td>
                  );
                }
                return <td key={String(c.key) + c.title} className={`whitespace-nowrap px-2 py-1.5 ${c.num ? "text-right tabular-nums" : ""}`}>{content}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Loading({ on }: { on: boolean }) {
  return on ? <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent" /> : null;
}
