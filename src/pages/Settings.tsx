import { useState } from "react";
import { changePassword, me } from "../lib/api";
import { useLoad } from "../lib/state";
import { Card } from "../components/ui";

export function Settings() {
  const who = useLoad(() => me(), []);
  const [oldPw, setOld] = useState("");
  const [newPw, setNew] = useState("");
  const [newUser, setNewUser] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await changePassword(oldPw, newPw, newUser.trim() || undefined);
      setMsg({ ok: true, text: "Đã đổi. Các phiên đăng nhập khác đã bị đăng xuất." });
      setOld(""); setNew(""); setNewUser("");
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <Card title="Tài khoản admin" className="max-w-md">
      <p className="mb-3 text-sm">Đang đăng nhập: <b>{who.data?.username ?? "…"}</b></p>
      <form onSubmit={submit} className="space-y-3">
        <input className="input w-full" type="password" placeholder="Mật khẩu hiện tại" value={oldPw} onChange={(e) => setOld(e.target.value)} />
        <input className="input w-full" type="password" placeholder="Mật khẩu mới (≥ 8 ký tự)" value={newPw} onChange={(e) => setNew(e.target.value)} />
        <input className="input w-full" placeholder="Username mới (để trống = giữ nguyên)" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
        {msg && <div className={`text-sm ${msg.ok ? "text-emerald-500" : "text-red-500"}`}>{msg.text}</div>}
        <button className="btn-primary">Đổi mật khẩu</button>
      </form>
    </Card>
  );
}
