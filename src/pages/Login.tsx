import { useState } from "react";
import { getServerUrl, login, normalizeServerUrl, serverUrlProblem, setServerUrl } from "../lib/api";
import { Logo } from "../components/Icon";

export function Login({ onDone }: { onDone: () => void }) {
  const [server, setServer] = useState(getServerUrl());
  const [editServer, setEditServer] = useState(!getServerUrl());
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
    <div className="flex min-h-screen flex-col items-center bg-raised/50 px-4 pt-[14vh]">
      <div className="mb-6 flex items-center gap-2">
        <Logo size={26} />
        <span className="text-[17px] font-semibold">PhaiBay</span>
      </div>
      <form onSubmit={submit} className="w-full max-w-[380px] space-y-4 rounded-lg border border-line bg-surface p-6">
        <h1 className="text-[17px] font-semibold">Đăng nhập</h1>
        {editServer ? (
          <label className="block">
            <span className="label">Server</span>
            <input className="input w-full font-mono text-[12.5px]" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://phaibay.example.com" required />
            {warn && <span className="mt-1 block text-xs text-warn">{warn}</span>}
          </label>
        ) : (
          // server known (same host as the dashboard, or chosen before): no need to type it
          <div className="flex items-center gap-2 text-xs muted">
            <span className="truncate">Server: <span className="font-mono">{hostOf(server)}</span></span>
            <button type="button" className="ml-auto shrink-0 hover:text-fg" onClick={() => setEditServer(true)}>Đổi</button>
          </div>
        )}
        <label className="block">
          <span className="label">Tên đăng nhập</span>
          <input className="input w-full" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="block">
          <span className="label">Mật khẩu</span>
          <input className="input w-full" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
        </label>
        {err && <div className="rounded-md border border-bad/30 bg-bad/5 px-3 py-2 text-[13px] text-bad">{err}</div>}
        <button className="btn-primary h-9 w-full" disabled={busy}>{busy ? "Đang đăng nhập…" : "Đăng nhập"}</button>
      </form>
      <p className="mt-4 text-xs muted">Analytics tự host cho game</p>
    </div>
  );
}

function hostOf(u: string) {
  try { return new URL(u).host; } catch { return u; }
}
