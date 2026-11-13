import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { getServerUrl, storage } from "../lib/api";
import { DIM_LABEL, OP_LABEL, RANGES, useDash, type RangeKey } from "../lib/state";
import { FilterDialog } from "./FilterDialog";
import { Icon, Logo, type IconName } from "./Icon";

/** App sections. Each has its own icon color (white when active), like the mobilehub sidebar. */
export const APP_NAV: { to: string; label: string; icon: IconName; color: string; end?: boolean }[] = [
  { to: "", label: "Tổng quan", icon: "chart", color: "#6366f1", end: true },
  { to: "events", label: "Events", icon: "list", color: "#8b5cf6" },
  { to: "explore", label: "Explore", icon: "compass", color: "#3b82f6" },
  { to: "funnel", label: "Funnel", icon: "funnel", color: "#f59e0b" },
  { to: "ai", label: "AI phân tích", icon: "sparkles", color: "#ec4899" },
  { to: "debug", label: "DebugView", icon: "pulse", color: "#10b981" },
  { to: "setup", label: "Tích hợp SDK", icon: "code", color: "#64748b" },
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

export function Initials({ name, size = 28 }: { name: string; size?: number }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="grid shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 70% 46%))` }}>
      {name.trim().slice(0, 2).toUpperCase() || "?"}
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
        className={`flex w-full items-center gap-2.5 rounded-lg border border-side-line/70 bg-surface p-2 text-left shadow-sm transition hover:shadow-md ${collapsed ? "justify-center" : ""}`}>
        {app ? <Initials name={app.name} /> : <span className="grid h-7 w-7 place-items-center rounded-lg bg-raised"><Icon name="grid" size={15} /></span>}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{app ? app.name : "Tất cả app"}</span>
              <span className="block truncate font-mono text-[11px] muted">{app ? app.app_key : `${d.apps.length} app`}</span>
            </span>
            <Icon name="chevron" size={14} className={`muted transition ${p.open ? "-rotate-90" : "rotate-90"}`} />
          </>
        )}
      </button>
      {p.open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 max-h-80 w-60 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop animate-fade-in">
          <button onClick={() => go("/")} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm hover:bg-raised">
            <Icon name="grid" size={15} className="muted" /> Tất cả app
            {!app && <Icon name="check" size={15} className="ml-auto text-accent" />}
          </button>
          {d.apps.length > 0 && <div className="my-1 h-px bg-line" />}
          {d.apps.map((a) => (
            <button key={a.id} onClick={() => go(`/app/${a.id}`)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-raised">
              <Initials name={a.name} size={22} />
              <span className="min-w-0 flex-1 truncate">{a.name}</span>
              {a.id === d.appId && <Icon name="check" size={15} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, color, end, collapsed, onClick }: {
  to: string; icon: IconName; label: string; color: string; end?: boolean; collapsed: boolean; onClick?: () => void;
}) {
  return (
    <NavLink to={to} end={end} onClick={onClick} title={collapsed ? label : undefined}
      className={({ isActive }) => `flex items-center rounded-lg p-3 text-sm font-medium transition
        ${collapsed ? "justify-center" : "gap-3.5"}
        ${isActive ? "bg-nav-on text-white shadow-lg" : "text-fg hover:bg-surface hover:shadow-md"}`}>
      {({ isActive }) => (
        <>
          <span style={{ color: isActive ? "#fff" : color }}><Icon name={icon} size={20} /></span>
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
    <div className="flex h-full flex-col gap-4 p-4">
      <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
        {!collapsed && (
          <Link to="/" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
            <Logo size={30} />
            <span className="min-w-0">
              <span className="block text-[15px] font-extrabold leading-tight tracking-tight">PhaiBay</span>
              <span className="block text-[11px] leading-tight muted">Analytics</span>
            </span>
          </Link>
        )}
        {!mobile && (
          <button onClick={onToggle} className="rounded-full p-2 transition hover:bg-nav-on hover:text-white" title={collapsed ? "Mở rộng" : "Thu gọn"}>
            <Icon name="menu" size={22} />
          </button>
        )}
      </div>

      <AppSwitcher collapsed={collapsed} onPick={onNavigate} />

      <nav className="flex flex-col gap-1.5">
        <NavItem to="/" end icon="home" label="Tất cả app" color="#6366f1" collapsed={collapsed} onClick={onNavigate} />
        {inApp && d.appId != null && (
          <>
            {!collapsed ? <div className="mb-0.5 mt-3 px-3 text-[11px] font-semibold uppercase tracking-wider muted">App</div> : <div className="my-2 h-px bg-side-line" />}
            {APP_NAV.map((n) => (
              <NavItem key={n.to} to={`/app/${d.appId}${n.to ? "/" + n.to : ""}`} end={n.end} icon={n.icon} label={n.label} color={n.color}
                collapsed={collapsed} onClick={onNavigate} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-auto space-y-2">
        {!collapsed && (
          <div className="flex items-center gap-2 rounded-lg border border-side-line/70 bg-surface px-3 py-2 text-xs" title={getServerUrl()}>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
            </span>
            <span className="min-w-0 flex-1 truncate font-mono muted">{host || "no server"}</span>
          </div>
        )}
        <div className={`flex gap-1 ${collapsed ? "flex-col" : ""}`}>
          <button className="btn-ghost flex-1" onClick={toggleTheme} title="Đổi giao diện sáng / tối">
            <Icon name={dark ? "sun" : "moon"} size={17} /> {!collapsed && (dark ? "Sáng" : "Tối")}
          </button>
          <button className="btn-ghost flex-1" onClick={onLogout} title="Đăng xuất"><Icon name="logout" size={17} /> {!collapsed && "Thoát"}</button>
        </div>
      </div>
    </div>
  );
}

function RangePicker() {
  const d = useDash();
  const p = usePopover();
  const label = d.range === "custom" ? `${d.custom.from} → ${d.custom.to}` : RANGES.find((r) => r.k === d.range)?.label;
  const pick = (k: RangeKey) => { d.setRange(k); if (k !== "custom") p.setOpen(false); };
  return (
    <div ref={p.ref} className="relative">
      <button className="btn" onClick={() => p.setOpen(!p.open)}>
        <Icon name="calendar" size={16} className="muted" />
        <span className="max-w-[200px] truncate">{label}</span>
      </button>
      {p.open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-line bg-surface p-1 shadow-pop animate-fade-in">
          {RANGES.filter((r) => r.k !== "custom").map((r) => (
            <button key={r.k} onClick={() => pick(r.k)} className="flex w-full items-center rounded-lg px-3 py-2 text-sm hover:bg-raised">
              {r.label}
              {d.range === r.k && <Icon name="check" size={16} strokeWidth={2.4} className="ml-auto text-accent" />}
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <div className="space-y-2 p-2">
            <div className="flex items-center text-xs font-medium muted">
              Tùy chọn
              {d.range === "custom" && <Icon name="check" size={14} strokeWidth={2.4} className="ml-auto text-accent" />}
            </div>
            <input type="date" className="input w-full" value={d.custom.from} onChange={(e) => { d.setCustom({ ...d.custom, from: e.target.value }); d.setRange("custom"); }} />
            <input type="date" className="input w-full" value={d.custom.to} onChange={(e) => { d.setCustom({ ...d.custom, to: e.target.value }); d.setRange("custom"); }} />
          </div>
        </div>
      )}
    </div>
  );
}

function useTitle(): { title: string; icon: IconName; color: string } {
  const loc = useLocation();
  const m = /^\/app\/\d+\/?([^/]*)/.exec(loc.pathname);
  if (!m) return { title: "Tất cả app", icon: "home", color: "#6366f1" };
  const n = APP_NAV.find((x) => x.to === m[1]) ?? APP_NAV[0];
  return { title: n.label, icon: n.icon, color: n.color };
}

export function Layout({ onLogout }: { onLogout: () => void }) {
  const d = useDash();
  const inApp = useMatch("/app/:appId/*");
  const loc = useLocation();
  const nav = useNavigate();
  const [dlg, setDlg] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsedS] = useState<boolean>(storage.get("side_collapsed", false));
  const setCollapsed = (v: boolean) => { setCollapsedS(v); storage.set("side_collapsed", v); };
  const t = useTitle();
  const app = d.apps.find((a) => a.id === d.appId);
  useEffect(() => setDrawer(false), [loc.pathname]);
  const sideW = collapsed ? "lg:pl-[88px]" : "lg:pl-64";

  return (
    <div className={`min-h-screen transition-[padding] duration-200 ${sideW}`}>
      {/* desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-side-line bg-side shadow-sm transition-[width] duration-200 lg:block ${collapsed ? "w-[88px]" : "w-64"}`}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onLogout={onLogout} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-side-line bg-side shadow-pop animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <Sidebar mobile collapsed={false} onLogout={onLogout} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-line bg-surface/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <button className="btn-ghost -ml-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Menu"><Icon name="menu" size={20} /></button>
          {/* breadcrumb */}
          <nav className="flex min-w-0 items-center gap-1 text-sm font-medium muted" aria-label="Breadcrumb">
            <button className="hidden hover:text-accent sm:inline" onClick={() => nav("/")}>PhaiBay</button>
            {app && (
              <>
                <Icon name="chevron" size={15} className="hidden text-dim/60 sm:block" />
                <button className="hidden truncate hover:text-accent sm:inline" onClick={() => nav(`/app/${app.id}`)}>{app.name}</button>
              </>
            )}
            <Icon name="chevron" size={15} className="hidden text-dim/60 sm:block" />
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-fg">
              <span style={{ color: t.color }}><Icon name={t.icon} size={17} /></span>
              <span className="truncate">{t.title}</span>
            </span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <RangePicker />
            {inApp && (
              <button className="btn" onClick={() => setDlg(true)}>
                <Icon name="filter" size={16} className="muted" />
                <span className="hidden sm:inline">Filter</span>
                {d.filters.length > 0 && <span className="rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-fg">{d.filters.length}</span>}
              </button>
            )}
            <button className="btn !px-2.5" title="Tải lại" onClick={d.refresh}><Icon name="refresh" size={16} /></button>
          </div>
        </div>

        {inApp && d.filters.length > 0 && (
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-1.5 px-4 pb-3 sm:px-6 lg:px-8">
            {d.filters.map((f, i) => (
              <span key={i} className="chip pr-1">
                <span className="muted">{f.dim === "p" ? `param.${f.key}` : f.dim === "u" ? `user.${f.key}` : DIM_LABEL[f.dim]}</span>
                <b className="font-semibold">{OP_LABEL[f.op]} {f.val}</b>
                <button className="grid h-4 w-4 place-items-center rounded-full muted hover:bg-bad/15 hover:text-bad" onClick={() => d.setFilters(d.filters.filter((_, j) => j !== i))}>
                  <Icon name="x" size={11} strokeWidth={2.4} />
                </button>
              </span>
            ))}
            <button className="text-xs font-medium muted hover:text-bad" onClick={() => d.setFilters([])}>Xóa hết</button>
          </div>
        )}
      </header>

      <Outlet />
      {dlg && <FilterDialog onClose={() => setDlg(false)} />}
    </div>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>;
}
