import { useState } from "react";
import { Link, Outlet, useMatch, useNavigate } from "react-router-dom";
import { getServerUrl } from "../lib/api";
import { DIM_LABEL, OP_LABEL, RANGES, useDash, type RangeKey } from "../lib/state";
import { FilterDialog } from "./FilterDialog";

export function Layout({ onLogout }: { onLogout: () => void }) {
  const d = useDash();
  const nav = useNavigate();
  const inApp = useMatch("/app/:appId/*");
  const [dlg, setDlg] = useState(false);
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    const v = !dark;
    setDark(v);
    document.documentElement.classList.toggle("dark", v);
    try { localStorage.setItem("pb_theme", v ? "dark" : "light"); } catch { /* ignore */ }
  };
  let host = "";
  try { host = new URL(getServerUrl()).host; } catch { /* ignore */ }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <Link to="/" className="mr-1 flex items-center gap-2 text-lg font-extrabold">
            <span className="inline-block h-6 w-6 rounded-md bg-brand" /> PhaiBay
          </Link>
          {inApp ? (
            <>
              <span className="muted">/</span>
              <select className="input font-medium" value={d.appId ?? ""} onChange={(e) => nav(`/app/${e.target.value}`)}>
                {d.apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </>
          ) : (
            <span className="text-sm muted">/ Tất cả app</span>
          )}
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
          {inApp && <button className="btn" onClick={() => setDlg(true)}>+ Filter</button>}
          <div className="flex-1" />
          <span className="hidden text-xs muted md:inline" title={getServerUrl()}>{host}</span>
          <button className="btn" title="Tải lại" onClick={d.refresh}>⟳</button>
          <button className="btn" title="Đổi theme" onClick={toggleTheme}>{dark ? "☀" : "☾"}</button>
          <button className="btn" onClick={onLogout}>Thoát</button>
        </div>

        {inApp && d.filters.length > 0 && (
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
      </header>

      <Outlet />
      {dlg && <FilterDialog onClose={() => setDlg(false)} />}
    </div>
  );
}
