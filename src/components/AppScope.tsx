import { useEffect } from "react";
import { Navigate, Outlet, useParams } from "react-router-dom";
import { useDash } from "../lib/state";
import { Page } from "./Layout";

/** /app/:appId/* — selects the app; navigation lives in the sidebar. */
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
  // render pages only once the context points at this app, so no query runs for the previous one
  return <Page>{appId === app.id && <Outlet />}</Page>;
}
