import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken, listApps, logout, setToken, setUnauthorizedHandler } from "./lib/api";
import { DashProvider, useDash } from "./lib/state";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Events } from "./pages/Events";
import { Explore } from "./pages/Explore";
import { Funnel } from "./pages/Funnel";
import { Retention } from "./pages/Retention";
import { Debug } from "./pages/Debug";
import { Apps } from "./pages/Apps";
import { Settings } from "./pages/Settings";

function Shell({ onLogout }: { onLogout: () => void }) {
  const { setApps, apps, appId } = useDash();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    listApps().then(setApps).catch(() => {}).finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return null;
  const needApp = apps.length === 0 || appId == null;
  return (
    <Routes>
      <Route element={<Layout onLogout={onLogout} />}>
        <Route path="/apps" element={<Apps />} />
        <Route path="/settings" element={<Settings />} />
        {needApp ? (
          <Route path="*" element={<Navigate to="/apps" replace />} />
        ) : (
          <>
            <Route index element={<Overview />} />
            <Route path="/events" element={<Events />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/funnel" element={<Funnel />} />
            <Route path="/retention" element={<Retention />} />
            <Route path="/debug" element={<Debug />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Route>
    </Routes>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const doLogout = useCallback(async () => {
    await logout();
    setAuthed(false);
  }, []);
  useEffect(() => {
    setUnauthorizedHandler(() => { setToken(""); setAuthed(false); });
  }, []);

  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return (
    <BrowserRouter>
      <DashProvider>
        <Shell onLogout={doLogout} />
      </DashProvider>
    </BrowserRouter>
  );
}
