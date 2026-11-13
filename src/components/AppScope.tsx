import { useEffect } from "react";
import { Navigate, NavLink, Outlet, useParams } from "react-router-dom";
import { useDash } from "../lib/state";

const TABS = [
  { to: "", label: "Tổng quan", end: true },
  { to: "events", label: "Events" },
  { to: "explore", label: "Explore" },
  { to: "funnel", label: "Funnel" },
  { to: "retention", label: "Retention" },
  { to: "debug", label: "DebugView" },
  { to: "setup", label: "Tích hợp SDK" },
];

/** /app/:appId/* — selects the app and renders its tabs. */
export function AppScope() {
  const { appId: param } = useParams();
  const { apps, appId, setAppId } = useDash();
  const id = Number(param);
  const app = apps.find((a) => a.id === id);

  useEffect(() => {
    if (app) setAppId(app.id);
  }, [app?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => setAppId(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!app) return <Navigate to="/" replace />;

  return (
    <>
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-x-6 px-4 pt-3">
          <div className="pb-2">
            <div className="text-lg font-bold">{app.name}</div>
            <code className="text-xs muted">{app.app_key}</code>
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) => `whitespace-nowrap border-b-2 px-3 py-2 text-sm ${isActive ? "border-brand font-medium" : "border-transparent muted hover:text-zinc-900 dark:hover:text-zinc-100"}`}>
                {t.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-[1400px] p-4">
        {/* render pages only once the context points at this app, so no query runs for the previous one */}
        {appId === app.id && <Outlet />}
      </main>
    </>
  );
}
