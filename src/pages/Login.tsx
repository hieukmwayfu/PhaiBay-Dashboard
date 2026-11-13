import { useState } from "react";
import { getServerUrl, login, normalizeServerUrl, serverUrlProblem, setServerUrl } from "../lib/api";
import { Icon, Logo } from "../components/Icon";

export function Login({ onDone }: { onDone: () => void }) {
  const [server, setServer] = useState(getServerUrl());
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {/* backdrop: soft glows + faint grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-[#8b80ff]/25 blur-[120px]" />
        <div className="absolute -bottom-48 -right-40 h-[520px] w-[520px] rounded-full bg-[#e14bd2]/15 blur-[130px]" />
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgb(var(--line))_1px,transparent_1px),linear-gradient(90deg,rgb(var(--line))_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      </div>

      <form onSubmit={submit} className="card relative w-full max-w-[400px] space-y-5 !p-7 shadow-pop animate-fade-in">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo size={48} />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Đăng nhập PhaiBay</h1>
            <p className="mt-1 text-sm muted">Analytics tự host cho game của bạn</p>
          </div>
        </div>

        <label className="block">
          <span className="label">Server</span>
          <div className="relative">
            <Icon name="server" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 muted" />
            <input className="input w-full !pl-9 font-mono text-[13px]" value={server} onChange={(e) => setServer(e.target.value)} placeholder="https://xxxx.trycloudflare.com" required />
          </div>
          {warn && <span className="mt-1.5 block text-xs text-warn">{warn}</span>}
        </label>
        <label className="block">
          <span className="label">Username</span>
          <input className="input w-full" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <div className="relative">
            <input className="input w-full pr-16" type={show ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-0.5 text-xs font-medium muted hover:text-fg" onClick={() => setShow(!show)}>
              {show ? "Ẩn" : "Hiện"}
            </button>
          </div>
        </label>
        {err && (
          <div className="flex items-start gap-2 rounded-xl border border-bad/30 bg-bad/10 px-3 py-2.5 text-sm text-bad">
            <Icon name="x" size={16} className="mt-0.5" /> <span className="min-w-0 break-words">{err}</span>
          </div>
        )}
        <button className="btn-primary h-10 w-full" disabled={busy}>
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon name="arrowRight" size={16} strokeWidth={2.2} />}
          {busy ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
