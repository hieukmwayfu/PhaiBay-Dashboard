import { useState } from "react";
import { api, storage, type EventRow, type FunnelStep } from "../lib/api";
import { fmt, pct } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { HBarChart } from "../components/Charts";
import { Card, DataTable, ErrorBox } from "../components/ui";

export function Funnel() {
  const { q } = useDash();
  const [steps, setSteps] = useState<string[]>(storage.get("funnel", ["session_start", "level_start", "level_complete"]));
  const [windowH, setWindowH] = useState(0);
  const [run, setRun] = useState(0);
  const events = useLoad(() => api<EventRow[]>("/api/events", q({}, ["event"])), [q]);

  const valid = steps.filter(Boolean);
  const res = useLoad(() => {
    if (valid.length < 2) return Promise.resolve(null);
    storage.set("funnel", valid);
    return api<FunnelStep[]>("/api/funnel", q({ steps: valid.join(","), window_hours: windowH }, ["event"]));
  }, [q, run]);

  const set = (i: number, v: string) => setSteps(steps.map((s, j) => (j === i ? v : s)));

  return (
    <Card>
      <p className="mb-3 text-sm muted">Funnel đóng, có thứ tự: user phải làm bước N sau bước N-1 (trong khoảng ngày + filter đang chọn).</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="text-xs muted">{i + 1}.</span>
            <select className="input" value={s} onChange={(e) => set(i, e.target.value)}>
              <option value="">(chọn event)</option>
              {!events.data?.some((e) => e.name === s) && s && <option>{s}</option>}
              {(events.data ?? []).map((e) => <option key={e.name}>{e.name}</option>)}
            </select>
            {steps.length > 2 && <button className="px-1 muted hover:text-red-500" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>✕</button>}
            {i < steps.length - 1 && <span className="muted">→</span>}
          </span>
        ))}
        {steps.length < 10 && <button className="btn" onClick={() => setSteps([...steps, ""])}>+ Bước</button>}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        Trong vòng <input type="number" min={0} className="input w-24" value={windowH} onChange={(e) => setWindowH(Number(e.target.value))} /> giờ (0 = không giới hạn)
        <button className="btn-primary" onClick={() => setRun(run + 1)}>Chạy</button>
      </div>
      <ErrorBox error={res.error} />
      {res.data && (
        <>
          <HBarChart rows={res.data.map((r, i) => ({ label: `${i + 1}. ${r.name}`, value: r.users }))} height={Math.max(200, res.data.length * 56)} />
          <div className="mt-3">
            <DataTable rows={res.data} cols={[
              { key: "name", title: "Bước" },
              { key: "users", title: "Users", num: true, bar: true, render: (r) => fmt(r.users) },
              { key: "conversion", title: "So với bước 1", num: true, render: (r) => pct(r.conversion) },
              { key: "step_conversion", title: "So với bước trước", num: true, render: (r) => pct(r.step_conversion) },
            ]} />
          </div>
        </>
      )}
    </Card>
  );
}
