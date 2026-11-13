import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import { getServerUrl } from "../lib/api";
import { DIM_LABEL, OP_LABEL, RANGES, useDash, type RangeKey } from "../lib/state";
import { FilterDialog } from "./FilterDialog";
import { Icon, Logo, type IconName } from "./Icon";

export const APP_NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "", label: "Tổng quan", icon: "chart", end: true },
  { to: "events", label: "Events", icon: "list" },
  { to: "explore", label: "Explore", icon: "compass" },
  { to: "funnel", label: "Funnel", icon: "funnel" },
  { to: "debug", label: "DebugView", icon: "pulse" },
  { to: "setup", label: "Tích hợp SDK", icon: "code" },
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

function Initials({ name, size = 28 }: { name: string; size?: number }) {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span className="grid shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
      style={{ width: size, height: size, background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${(hue + 40) % 360} 70% 46%))` }}>
      {name.trim().slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}

function AppSwitcher({ onPick }: { onPick?: () => void }) {
  const d = useDash();
  const nav = useNavigate();
  const p = usePopover();
  const app = d.apps.find((a) => a.id === d.appId);
  const go = (to: string) => { p.setOpen(false); onPick?.(); nav(to); };
  return (
    <div ref={p.ref} className="relative">
      <button onClick={() => p.setOpen(!p.open)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface p-2 text-left transition hover:bg-raised">
        {app ? <Initials name={app.name} /> : <span className="grid h-7 w-7 place-items-center rounded-lg bg-raised"><Icon name="grid" size={15} /></span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{app ? app.name : "Tất cả app"}</span>
          <span className="block truncate font-mono text-[11px] muted">{app ? app.app_key : `${d.apps.length} app`}</span>
        </span>
        <Icon name="chevron" size={14} className={`muted transition ${p.open ? "-rotate-90" : "rotate-90"}`} />
      </button>
      {p.open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-pop animate-fade-in">
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

function NavItem({ to, icon, label, end, onClick }: { to: string; icon: IconName; label: string; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink to={to} end={end} onClick={onClick}
      className={({ isActive }) => `relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition
        ${isActive ? "bg-accent/10 text-fg" : "text-dim hover:bg-raised hover:text-fg"}`}>
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" />}
          <Icon name={icon} size={17} className={isActive ? "text-accent" : ""} />
          {label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ onLogout, onNavigate }: { onLogout: () => void; onNavigate?: () => void }) {
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
    <div className="flex h-full flex-col gap-5 p-4">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-2.5 px-1">
        <Logo size={30} />
        <span>
          <span className="block text-[15px] font-extrabold leading-tight tracking-tight">PhaiBay</span>
          <span className="block text-[11px] leading-tight muted">Analytics</span>
        </span>
      </Link>

      <AppSwitcher onPick={onNavigate} />

      <nav className="flex flex-col gap-0.5">
        <NavItem to="/" end icon="home" label="Tất cả app" onClick={onNavigate} />
        {inApp && d.appId != null && (
          <>
            <div className="mb-1 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider muted">App</div>
            {APP_NAV.map((n) => (
              <NavItem key={n.to} to={`/app/${d.appId}${n.to ? "/" + n.to : ""}`} end={n.end} icon={n.icon} label={n.label} onClick={onNavigate} />
            ))}
          </>
        )}
      </nav>

      <div className="mt-auto space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs" title={getServerUrl()}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
          </span>
          <span className="min-w-0 flex-1 truncate font-mono muted">{host || "no server"}</span>
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost flex-1" onClick={toggleTheme} title="Đổi giao diện sáng / tối">
            <Icon name={dark ? "sun" : "moon"} size={16} /> {dark ? "Sáng" : "Tối"}
          </button>
          <button className="btn-ghost flex-1" onClick={onLogout}><Icon name="logout" size={16} /> Thoát</button>
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
  const t = useTitle();
  const app = d.apps.find((a) => a.id === d.appId);
  useEffect(() => setDrawer(false), [loc.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface/60 backdrop-blur lg:block">
        <Sidebar onLogout={onLogout} />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-line bg-surface shadow-pop animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <Sidebar onLogout={onLogout} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 py-3 sm:px-6">
          <button className="btn-ghost -ml-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Menu"><Icon name="menu" size={20} /></button>
          <div className="flex min-w-0 items-center gap-2">
            {app && <span className="hidden truncate text-sm muted sm:inline">{app.name}</span>}
            {app && <Icon name="chevron" size={14} className="hidden muted sm:block" />}
            <Icon name={t.icon} size={18} className="text-accent" />
            <h1 className="truncate text-[15px] font-semibold">{t.title}</h1>
          </div>
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
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-1.5 px-4 pb-3 sm:px-6">
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
  return <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>;
}
