import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { DIM_LABEL, OP_LABEL, RANGES, useDash, type RangeKey } from "../lib/state";
import { FilterDialog } from "./FilterDialog";

const TABS = [
  { to: "/", label: "Tổng quan", end: true },
  { to: "/events", label: "Events" },
  { to: "/explore", label: "Explore" },
  { to: "/funnel", label: "Funnel" },
  { to: "/retention", label: "Retention" },
  { to: "/debug", label: "DebugView" },
  { to: "/apps", label: "Apps" },
  { to: "/settings", label: "Tài khoản" },
];

export function Layout({ onLogout }: { onLogout: () => void }) {
  const d = useDash();
  const [dlg, setDlg] = useState(false);
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    const v = !dark;
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    try { localStorage.setItem("pb_theme", v ? "dark" : "light"); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <div className="mr-2 flex items-center gap-2 text-lg font-extrabold">
            <span className="inline-block h-6 w-6 rounded-md bg-brand" /> PhaiBay
          </div>
          <select className="input" value={d.appId ?? ""} onChange={(e) => d.setAppId(Number(e.target.value))}>
            {d.apps.length === 0 && <option value="">(chưa có app)</option>}
            {d.apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="input" value={d.range} onChange={(e) => d.setRange(e.target.value as RangeKey)}>
            {RANGES.map((r) => <option key={r.k} value={r.k}>{r.label}</option>)}
          </select>
          {d.range === "custom" && (
            <>
              <input type="date" className="input" value={d.custom.from} onChange={(e) => d.setCustom({ ...d.custom, from: e.target.value })} />
              <span className="muted">→</span>
              <input type="date" className="input" value={d.custom.to} onChange={(e) => d.setCustom({ ...d.custom, to: e.target.value })} />
            </>
          )}
          <button className="btn" onClick={() => setDlg(true)}>+ Filter</button>
          <div className="flex-1" />
          <button className="btn" title="Tải lại" onClick={d.refresh}>⟳</button>
          <button className="btn" title="Đổi theme" onClick={toggleTheme}>{dark ? "☀" : "☾"}</button>
          <button className="btn" onClick={onLogout}>Thoát</button>
        </div>

        {d.filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
            {d.filters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 py-0.5 pl-3 pr-1 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                {f.dim === "p" ? `param.${f.key}` : f.dim === "u" ? `user.${f.key}` : DIM_LABEL[f.dim]}
                <b className="font-semibold">{OP_LABEL[f.op]} {f.val}</b>
                <button className="rounded-full px-1.5 muted hover:text-red-500" onClick={() => d.setFilters(d.filters.filter((_, j) => j !== i))}>✕</button>
              </span>
            ))}
            <button className="text-xs muted hover:text-red-500" onClick={() => d.setFilters([])}>Xóa hết</button>
          </div>
        )}

        <nav className="flex gap-1 overflow-x-auto px-3">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}
              className={({ isActive }) => `whitespace-nowrap border-b-2 px-3 py-2 text-sm ${isActive ? "border-brand font-medium" : "border-transparent muted hover:text-zinc-900 dark:hover:text-zinc-100"}`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] p-4">
        <Outlet />
      </main>
      {dlg && <FilterDialog onClose={() => setDlg(false)} />}
    </div>
  );
}
