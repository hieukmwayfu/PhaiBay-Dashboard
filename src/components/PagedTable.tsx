import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Empty, Skeleton } from "./ui";

export interface PCol<T> {
  key: string;
  title: string;
  num?: boolean;
  sortable?: boolean;
  bar?: boolean; // inline bar proportional to the max of this column on the current page
  width?: string;
  /** hide below this breakpoint to keep narrow layouts readable */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
  render?: (row: T) => ReactNode;
}

const HIDE: Record<string, string> = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell", xl: "hidden xl:table-cell", "2xl": "hidden 2xl:table-cell" };

export const PAGE_SIZES = [10, 20, 50, 100];

/**
 * Server-paged table: toolbar slot, sortable gray header, divided rows,
 * footer with rows-per-page, range and first / prev / page x of y / next / last.
 */
export function PagedTable<T>({
  cols, rows, total, page, pageSize, sort, dir, loading, toolbar, emptyText = "Không có dữ liệu",
  onSort, onPage, onPageSize, onRow, active, rowKey, compact, plain,
}: {
  compact?: boolean;
  /** no frame: table sits directly on the page (Stripe list style) */
  plain?: boolean;
  cols: PCol<T>[];
  rows: T[] | null | undefined;
  total: number;
  page: number; // 1-based
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
  loading?: boolean;
  toolbar?: ReactNode;
  emptyText?: ReactNode;
  onSort: (key: string) => void;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  onRow?: (r: T) => void;
  active?: (r: T) => boolean;
  rowKey: (r: T) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const max: Record<string, number> = {};
  for (const c of cols) if (c.bar) max[c.key] = Math.max(1, ...(rows ?? []).map((r) => Number((r as Record<string, unknown>)[c.key]) || 0));

  return (
    <div className={plain ? "" : "overflow-hidden rounded-lg border border-line bg-surface"}>
      {toolbar && <div className={`flex flex-wrap items-center gap-2 ${plain ? "pb-3" : "border-b border-line p-3"}`}>{toolbar}</div>}

      <div className={`relative overflow-x-auto ${plain ? "-mx-3" : ""}`}>
        {loading && rows && <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-accent/50" />}
        <table className="w-full text-[13px]">
          <thead className="border-b border-line text-xs font-medium muted">
            <tr>
              {cols.map((c) => {
                const on = sort === c.key;
                return (
                  <th key={c.key} style={c.width ? { width: c.width } : undefined}
                    onClick={c.sortable ? () => onSort(c.key) : undefined}
                    className={`select-none whitespace-nowrap ${plain ? "px-3 py-2" : compact ? "px-3 py-2.5" : "px-4 py-3"} ${c.hideBelow ? HIDE[c.hideBelow] : ""} ${c.num ? "text-right" : "text-left"} ${c.sortable ? "group cursor-pointer transition hover:bg-raised hover:text-fg" : ""} ${on ? "text-fg" : ""}`}>
                    <span className={`inline-flex items-center gap-1 ${c.num ? "flex-row-reverse" : ""}`}>
                      {c.title}
                      {c.sortable && (
                        on
                          ? <Icon name={dir === "asc" ? "arrowUp" : "arrowDown"} size={13} strokeWidth={2.4} className="text-accent" />
                          : <Icon name="arrowDown" size={13} className="opacity-0 transition group-hover:opacity-40" />
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70 border-b border-line/70">
            {!rows && loading && Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
              <tr key={i}><td colSpan={cols.length} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
            ))}
            {rows?.map((r) => {
              const on = active?.(r);
              return (
                <tr key={rowKey(r)} onClick={onRow ? () => onRow(r) : undefined}
                  className={`${onRow ? "cursor-pointer" : ""} ${on ? "bg-raised" : "hover:bg-raised/70"} transition-colors`}>
                  {cols.map((c, ci) => {
                    const raw = (r as Record<string, unknown>)[c.key];
                    const content = c.render ? c.render(r) : String(raw ?? "");
                    if (c.bar) {
                      const w = (100 * (Number(raw) || 0)) / max[c.key];
                      return (
                        <td key={c.key} className={`relative whitespace-nowrap text-right tabular ${compact ? "px-3 py-2" : "px-4 py-2.5"} ${c.hideBelow ? HIDE[c.hideBelow] : ""}`} style={{ width: c.width }}>
                          <span className="inline-flex items-center justify-end gap-2">
                            <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-raised sm:block"><span className="block h-full rounded-full bg-accent/60" style={{ width: `${w}%` }} /></span>
                            <span className="min-w-[3rem]">{content}</span>
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={c.key} className={`whitespace-nowrap ${plain ? "px-3 py-2.5" : compact ? "px-3 py-2" : "px-4 py-2.5"} ${c.hideBelow ? HIDE[c.hideBelow] : ""} ${c.num ? "text-right tabular" : "max-w-0"} ${ci === 0 && on ? "font-semibold" : ""}`}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows && rows.length === 0 && <Empty>{emptyText}</Empty>}
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-3 text-[13px] ${plain ? "border-t border-line pt-3" : "border-t border-line px-4 py-3"}`}>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 muted">
            <span className="hidden sm:inline">Số dòng / trang</span>
            <select className="input !h-8 !py-0" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span className="tabular muted">{from.toLocaleString()}–{to.toLocaleString()} / <b className="text-fg">{total.toLocaleString()}</b></span>
        </div>
        <div className="flex items-center gap-1">
          <PageBtn icon="chevronsLeft" title="Trang đầu" disabled={page <= 1} onClick={() => onPage(1)} />
          <PageBtn icon="back" title="Trang trước" disabled={page <= 1} onClick={() => onPage(page - 1)} />
          <span className="mx-2 whitespace-nowrap font-medium tabular">Trang {page}/{pages}</span>
          <PageBtn icon="chevron" title="Trang sau" disabled={page >= pages} onClick={() => onPage(page + 1)} />
          <PageBtn icon="chevronsLeft" flip title="Trang cuối" disabled={page >= pages} onClick={() => onPage(pages)} />
        </div>
      </div>
    </div>
  );
}

function PageBtn({ icon, title, disabled, onClick, flip }: { icon: "chevronsLeft" | "back" | "chevron"; title: string; disabled: boolean; onClick: () => void; flip?: boolean }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg muted transition hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-30">
      <Icon name={icon} size={16} className={flip ? "rotate-180" : ""} />
    </button>
  );
}
