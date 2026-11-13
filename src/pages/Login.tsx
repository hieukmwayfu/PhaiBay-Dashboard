import { useState } from "react";
import { getServerUrl, login, normalizeServerUrl, serverUrlProblem, setServerUrl } from "../lib/api";

export function Login({ onDone }: { onDone: () => void }) {
  const [server, setServer] = useState(getServerUrl());
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const warn = server.trim() ? serverUrlProblem(normalizeServerUrl(server)) : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = normalizeServerUrl(server);
    if (!s) return setErr("Nhập địa chỉ server.");
    setServer(s);
    setBusy(true);
    setErr("");
    setServerUrl(s);
    try {
      await login(user.trim(), pass);
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-3">
        <div className="flex items-center gap-2 text-xl font-extrabold">
          <span className="inline-block h-7 w-7 rounded-md bg-brand" /> PhaiBay
        </div>
        <p className="text-sm muted">Đăng nhập dashboard</p>
        <label className="block text-xs muted">Server
          <input className="input mt-1 w-full" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://xxxx.trycloudflare.com" required />
        </label>
        {warn && <div className="text-xs text-amber-600 dark:text-amber-400">{warn}</div>}
        <label className="block text-xs muted">Username
          <input className="input mt-1 w-full" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="block text-xs muted">Password
          <input className="input mt-1 w-full" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <div className="text-sm text-red-500">{err}</div>}
        <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
      </form>
    </div>
  );
}
