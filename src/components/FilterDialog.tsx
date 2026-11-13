import { useEffect, useState } from "react";
import { api, type ParamKey, type ValueRow } from "../lib/api";
import { NAME_RE } from "../lib/format";
import { DIM_LABEL, useDash, type Dim, type Op } from "../lib/state";

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="card w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="card-title">Thêm filter</h3>
        <label className="block text-xs muted">Trường
          <select className="input mt-1 w-full" value={dim} onChange={(e) => { setDim(e.target.value as Dim); setKey(""); setVal(""); setOp("eq"); }}>
            {Object.entries(DIM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="p">Event param…</option>
            <option value="u">User property…</option>
          </select>
        </label>
        {kv && (
          <label className="block text-xs muted">Key
            <input className="input mt-1 w-full" list="pb-keys" value={key} onChange={(e) => setKey(e.target.value)} placeholder="vd: level" />
            <datalist id="pb-keys">{keys.map((k) => <option key={k.key} value={k.key} />)}</datalist>
          </label>
        )}
        {kv && (
          <label className="block text-xs muted">Điều kiện
            <select className="input mt-1 w-full" value={op} onChange={(e) => setOp(e.target.value as Op)}>
              <option value="eq">bằng</option><option value="ne">khác</option>
              <option value="gt">&gt;</option><option value="gte">≥</option><option value="lt">&lt;</option><option value="lte">≤</option>
              <option value="contains">chứa</option>
            </select>
          </label>
        )}
        <label className="block text-xs muted">Giá trị {!kv && "(nhiều giá trị cách nhau dấu phẩy)"}
          <input className="input mt-1 w-full" list="pb-vals" value={val} autoFocus onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ok()} placeholder={kv ? "vd: 5" : "vd: VN,US"} />
          <datalist id="pb-vals">{values.map((v) => <option key={v.value} value={v.value}>{v.count}</option>)}</datalist>
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={ok}>Thêm</button>
        </div>
      </div>
    </div>
  );
}
