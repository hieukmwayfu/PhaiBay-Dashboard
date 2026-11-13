import { useEffect, useState } from "react";
import { api, type ParamKey, type ValueRow } from "../lib/api";
import { NAME_RE } from "../lib/format";
import { DIM_LABEL, useDash, type Dim, type Op } from "../lib/state";
import { Modal } from "./ui";

export function FilterDialog({ onClose }: { onClose: () => void }) {
  const { q, addFilter } = useDash();
  const [dim, setDim] = useState<Dim>("event");
  const [key, setKey] = useState("");
  const [op, setOp] = useState<Op>("eq");
  const [val, setVal] = useState("");
  const [keys, setKeys] = useState<ParamKey[]>([]);
  const [values, setValues] = useState<ValueRow[]>([]);
  const kv = dim === "p" || dim === "u";

  useEffect(() => {
    if (!kv) return;
    api<ParamKey[]>("/api/params", q({ kind: dim === "u" ? "user" : "" })).then(setKeys).catch(() => setKeys([]));
  }, [dim]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const d = kv ? (NAME_RE.test(key) ? `${dim}.${key}` : "") : dim;
    if (!d) return setValues([]);
    api<ValueRow[]>("/api/values", q({ dim: d })).then(setValues).catch(() => setValues([]));
  }, [dim, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ok = () => {
    if (!val.trim() || (kv && !NAME_RE.test(key))) return;
    addFilter(kv ? { dim, key, op, val: val.trim() } : { dim, op: "eq", val: val.trim() });
    onClose();
  };
  const picked = new Set(val.split(",").map((s) => s.trim()).filter(Boolean));
  const toggle = (v: string) => {
    if (kv) return setVal(v);
    const next = new Set(picked);
    if (next.has(v)) next.delete(v); else next.add(v);
    setVal([...next].join(","));
  };

  return (
    <Modal title="Thêm filter" onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="label">Trường</span>
          <select className="input w-full" value={dim} onChange={(e) => { setDim(e.target.value as Dim); setKey(""); setVal(""); setOp("eq"); }}>
            {Object.entries(DIM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="p">Event param…</option>
            <option value="u">User property…</option>
          </select>
        </label>
        {kv && (
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="block">
              <span className="label">Key</span>
              <input className="input w-full font-mono" list="pb-keys" value={key} onChange={(e) => setKey(e.target.value)} placeholder="vd: level" />
              <datalist id="pb-keys">{keys.map((k) => <option key={k.key} value={k.key} />)}</datalist>
            </label>
            <label className="block">
              <span className="label">Điều kiện</span>
              <select className="input w-full" value={op} onChange={(e) => setOp(e.target.value as Op)}>
                <option value="eq">bằng</option><option value="ne">khác</option>
                <option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option>
                <option value="contains">chứa</option>
              </select>
            </label>
          </div>
        )}
        <label className="block">
          <span className="label">Giá trị {!kv && <span className="font-normal">(nhiều giá trị cách nhau dấu phẩy)</span>}</span>
          <input className="input w-full" value={val} autoFocus onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} placeholder={kv ? "vd: 5" : "vd: VN,US"} />
        </label>
        {values.length > 0 && (
          <div className="max-h-44 overflow-auto rounded-xl border border-line p-1">
            {values.slice(0, 50).map((v) => (
              <button key={v.value} type="button" onClick={() => toggle(v.value)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-raised ${picked.has(v.value) ? "bg-accent/10" : ""}`}>
                <span className={`grid h-4 w-4 place-items-center rounded border ${picked.has(v.value) ? "border-accent bg-accent text-accent-fg" : "border-line"}`}>
                  {picked.has(v.value) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </span>
                <span className="min-w-0 flex-1 truncate">{v.value}</span>
                <span className="text-xs tabular muted">{v.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={ok} disabled={!val.trim() || (kv && !NAME_RE.test(key))}>Thêm filter</button>
        </div>
      </div>
    </Modal>
  );
}
