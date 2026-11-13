import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { getServerUrl, storage } from "../lib/api";
import { DIM_LABEL, OP_LABEL, RANGES, useDash, type RangeKey } from "../lib/state";
import { FilterDialog } from "./FilterDialog";
import { Icon, Logo, type IconName } from "./Icon";

export const APP_NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "", label: "Tổng quan", icon: "chart", end: true },
  { to: "events", label: "Events", icon: "list" },
  { to: "explore", label: "Explore", icon: "compass" },
  { to: "funnel", label: "Funnel", icon: "funnel" },
  { to: "ai", label: "AI phân tích", icon: "sparkles" },
  { to: "debug", label: "DebugView", icon: "pulse" },
];

/** Closes when clicking outside or pressing Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const click = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", click);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, [open]);
  return { open, setOpen, ref };
}

/** Monochrome initials square (no gradients). */
export function Initials({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded border border-line bg-raised font-semibold text-dim"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.42) }}>
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}

function AppSwitcher({ collapsed, onPick }: { collapsed: boolean; onPick?: () => void }) {
  const d = useDash();
  const nav = useNavigate();
  const p = usePopover();
  const app = d.apps.find((a) => a.id === d.appId);
  const go = (to: string) => { p.setOpen(false); onPick?.(); nav(to); };
  return (
    <div ref={p.ref} className="relative">
      <button onClick={() => p.setOpen(!p.open)} title={app?.name ?? "Tất cả app"}
        className={`flex h-9 w-full items-center gap-2 rounded-md px-2 text-left transition-colors hover:bg-raised ${collapsed ? "justify-center" : ""}`}>
        {app ? <Initials name={app.name} /> : <Logo size={22} />}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{app ? app.name : "PhaiBay"}</span>
            <Icon name="chevron" size={13} className="rotate-90 muted" />
          </>
        )}
      </button>
      {p.open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-80 w-60 overflow-auto rounded-md border border-line bg-surface p-1 shadow-pop">
          <div className="px-2 pb-1 pt-1.5 text-xs muted">Chuyển app</div>
          <button onClick={() => go("/")} className="flex h-8 w-full items-center gap-2 rounded px-2 text-[13px] hover:bg-raised">
            <Icon name="grid" size={15} className="muted" /> Tất cả app
            {!app && <Icon name="check" size={14} className="ml-auto" />}
          </button>
          {d.apps.map((a) => (
            <button key={a.id} onClick={() => go(`/app/${a.id}`)} className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[13px] hover:bg-raised">
              <Initials name={a.name} size={18} />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              {a.id === d.appId && <Icon name="check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, end, collapsed, onClick }: {
  to: string; icon: IconName; label: string; end?: boolean; collapsed: boolean; onClick?: () => void;
}) {
  return (
    <NavLink to={to} end={end} onClick={onClick} title={collapsed ? label : undefined}
      className={({ isActive }) => `flex h-8 items-center rounded-md px-2 text-[13px] transition-colors
        ${collapsed ? "justify-center" : "gap-2.5"}
        ${isActive ? "bg-nav-on font-medium text-fg" : "text-fg/80 hover:bg-raised hover:text-fg"}`}>
      {({ isActive }) => (
        <>
          <Icon name={icon} size={16} className={isActive ? "text-fg" : "text-dim"} />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ collapsed, onToggle, onLogout, onNavigate, mobile }: {
  collapsed: boolean; onToggle?: () => void; onLogout: () => void; onNavigate?: () => void; mobile?: boolean;
}) {
  const d = useDash();
  const inApp = useMatch("/app/:appId/*");
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
    <div className="flex h-full flex-col px-3 py-3">
      <div className={`mb-3 flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
        <div className="min-w-0 flex-1"><AppSwitcher collapsed={collapsed} onPick={onNavigate} /></div>
        {!mobile && (
          <button onClick={onToggle} className="btn-ghost !h-8 !px-1.5" title={collapsed ? "Mở rộng" : "Thu gọn"}>
            <Icon name="sidebar" size={16} />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-px">
        <NavItem to="/" end icon="home" label="Tất cả app" collapsed={collapsed} onClick={onNavigate} />
        {inApp && d.appId != null && (
          <>
            {!collapsed ? <div className="mb-1 mt-5 px-2 text-xs muted">App</div> : <div className="my-2 h-px bg-line" />}
            {APP_NAV.map((n) => (
              <NavItem key={n.to} to={`/app/${d.appId}${n.to ? "/" + n.to : ""}`} end={n.end} icon={n.icon} label={n.label}
                collapsed={collapsed} onClick={onNavigate} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-px pt-4">
        {!collapsed && (
          <div className="mb-1 flex items-center gap-2 px-2 text-xs muted" title={getServerUrl()}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-good" />
            <span className="min-w-0 truncate font-mono">{host || "no server"}</span>
          </div>
        )}
        <button className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-fg/80 hover:bg-raised ${collapsed ? "justify-center" : ""}`} onClick={toggleTheme}>
          <Icon name={dark ? "sun" : "moon"} size={16} className="text-dim" /> {!collapsed && (dark ? "Giao diện sáng" : "Giao diện tối")}
        </button>
        <button className={`flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] text-fg/80 hover:bg-raised ${collapsed ? "justify-center" : ""}`} onClick={onLogout}>
          <Icon name="logout" size={16} className="text-dim" /> {!collapsed && "Đăng xuất"}
        </button>
      </div>
    </div>
  );
}

/** Date range as a dashed filter pill with a preset menu. */
function RangePicker() {
  const d = useDash();
  const p = usePopover();
  const label = d.range === "custom" ? `${d.custom.from} → ${d.custom.to}` : RANGES.find((r) => r.k === d.range)?.label;
  const pick = (k: RangeKey) => { d.setRange(k); if (k !== "custom") p.setOpen(false); };
  return (
    <div ref={p.ref} className="relative">
      <button className="pill !border-solid !text-fg" onClick={() => p.setOpen(!p.open)}>
        <Icon name="calendar" size={13} className="muted" />
        <span className="muted">Thời gian</span>
        <span className="font-medium">{label}</span>
        <Icon name="chevron" size={12} className="rotate-90 muted" />
      </button>
      {p.open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-line bg-surface p-1 shadow-pop">
          {RANGES.filter((r) => r.k !== "custom").map((r) => (
            <button key={r.k} onClick={() => pick(r.k)} className="flex h-8 w-full items-center rounded px-2 text-[13px] hover:bg-raised">
              {r.label}
              {d.range === r.k && <Icon name="check" size={14} strokeWidth={2.2} className="ml-auto" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <div className="space-y-1.5 p-2">
            <div className="text-xs muted">Tùy chọn</div>
            <input type="date" className="input w-full" value={d.custom.from} onChange={(e) => { d.setCustom({ ...d.custom, from: e.target.value }); d.setRange("custom"); }} />
            <input type="date" className="input w-full" value={d.custom.to} onChange={(e) => { d.setCustom({ ...d.custom, to: e.target.value }); d.setRange("custom"); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function useTitle(): { title: string; icon: IconName } {
  const loc = useLocation();
  const m = /^\/app\/\d+\/?([^/]*)/.exec(loc.pathname);
  if (!m) return { title: "Tất cả app", icon: "home" };
  const n = APP_NAV.find((x) => x.to === m[1]) ?? APP_NAV[0];
  return { title: n.label, icon: n.icon };
}

export function Layout({ onLogout }: { onLogout: () => void }) {
  const d = useDash();
  const inApp = useMatch("/app/:appId/*");
  const loc = useLocation();
  const [dlg, setDlg] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsedS] = useState<boolean>(storage.get("side_collapsed", false));
  const setCollapsed = (v: boolean) => { setCollapsedS(v); storage.set("side_collapsed", v); };
  const t = useTitle();
  useEffect(() => setDrawer(false), [loc.pathname]);

  return (
    <div className={`min-h-screen ${collapsed ? "lg:pl-[60px]" : "lg:pl-56"}`}>
      {/* desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-side-line bg-side lg:block ${collapsed ? "w-[60px]" : "w-56"}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onLogout={onLogout} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-side-line bg-side" onClick={(e) => e.stopPropagation()}>
            <Sidebar mobile collapsed={false} onLogout={onLogout} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      {/* mobile top bar */}
      <div className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
        <button className="btn-ghost !px-1.5" onClick={() => setDrawer(true)} aria-label="Menu"><Icon name="menu" size={18} /></button>
        <Link to="/" className="flex items-center gap-2"><Logo size={20} /><span className="text-[13px] font-semibold">PhaiBay</span></Link>
      </div>

      <div className="mx-auto max-w-[1360px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-7">
        {/* page title + actions */}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight">{t.title}</h1>
          <div className="ml-auto flex items-center gap-2">
            <button className="btn !px-2" title="Tải lại" onClick={d.refresh}><Icon name="refresh" size={15} /></button>
          </div>
        </div>

        {/* filter pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-b border-line pb-3">
          <RangePicker />
          {inApp && d.filters.map((f, i) => (
            <span key={i} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-raised pl-2.5 pr-1 text-xs">
              <span className="muted">{f.dim === "p" ? `param.${f.key}` : f.dim === "u" ? `user.${f.key}` : DIM_LABEL[f.dim]}</span>
              <span className="font-medium">{OP_LABEL[f.op]} {f.val}</span>
              <button className="grid h-5 w-5 place-items-center rounded-full muted hover:bg-line hover:text-fg" onClick={() => d.setFilters(d.filters.filter((_, j) => j !== i))} aria-label="Bỏ lọc">
                <Icon name="x" size={11} strokeWidth={2.2} />
              </button>
            </span>
          ))}
          {inApp && (
            <button className="pill" onClick={() => setDlg(true)}><Icon name="plus" size={12} /> Thêm bộ lọc</button>
          )}
          {inApp && d.filters.length > 0 && (
            <button className="ml-1 text-xs muted hover:text-fg" onClick={() => d.setFilters([])}>Xóa bộ lọc</button>
          )}
        </div>
      </div>

      <Outlet />
      {dlg && <FilterDialog onClose={() => setDlg(false)} />}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-[1360px] px-4 pb-10 pt-4 sm:px-6 lg:px-8">{children}</main>;
}
