import { useCallback, useEffect, useState } from "react";
import { Settings } from "./pages/Settings";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getToken, listApps, logout, setToken, setUnauthorizedHandler } from "./lib/api";
import { DashProvider, useDash } from "./lib/state";
import { Layout } from "./components/Layout";
import { AppScope } from "./components/AppScope";
import { ErrorBox } from "./components/ui";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Overview } from "./pages/Overview";
import { EventDetail, Events } from "./pages/Events";
import { Explore } from "./pages/Explore";
import { Funnel } from "./pages/Funnel";
import { Debug } from "./pages/Debug";
import { Dashboards } from "./pages/Dashboards";

function Shell({ onLogout }: { onLogout: () => void }) {
  const { setApps } = useDash();
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    listApps().then(setApps).catch((e: Error) => setErr(e.message)).finally(() => setReady(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!ready) return null;
  if (err) return <div className="p-4"><ErrorBox error={err} /><button className="btn" onClick={onLogout}>Đăng nhập lại</button></div>;
  return (
    <Routes>
      <Route element={<Layout onLogout={onLogout} />}>
        <Route index element={<Home />} />
        <Route path="app/:appId" element={<AppScope />}>
          <Route index element={<Overview />} />
          <Route path="events" element={<Events />} />
          <Route path="events/:name" element={<EventDetail />} />
          <Route path="explore" element={<Explore />} />
          <Route path="funnel" element={<Funnel />} />
          <Route path="dashboards" element={<Dashboards />} />
          <Route path="settings" element={<Settings />} />
          <Route path="debug" element={<Debug />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
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
