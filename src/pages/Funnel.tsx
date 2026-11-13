import { useState } from "react";
import { api, storage, type EventRow, type FunnelStep } from "../lib/api";
import { fmt, pct } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { FunnelBars } from "../components/Charts";
import { Icon } from "../components/Icon";
import { Card, DataTable, Empty, ErrorBox, Loading } from "../components/ui";

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
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
    <Card title="Các bước" subtitle="Funnel đóng, có thứ tự: user phải làm bước N sau bước N-1.">
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-xs font-bold text-accent">{i + 1}</span>
            <select className="input min-w-0 flex-1" value={s} onChange={(e) => set(i, e.target.value)}>
              <option value="">(chọn event)</option>
              {!events.data?.some((e) => e.name === s) && s && <option>{s}</option>}
              {(events.data ?? []).map((e) => <option key={e.name}>{e.name}</option>)}
            </select>
            <button className={`btn-ghost !px-2 ${steps.length > 2 ? "" : "invisible"}`} onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Xóa bước">
              <Icon name="x" size={15} />
            </button>
          </div>
        ))}
        {steps.length < 10 && <button className="btn w-full border-dashed" onClick={() => setSteps([...steps, ""])}><Icon name="plus" size={15} /> Thêm bước</button>}
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <span className="label">Khoảng thời gian tối đa từ bước 1</span>
        <div className="flex items-center gap-2 text-sm">
          <input type="number" min={0} className="input w-24" value={windowH} onChange={(e) => setWindowH(Number(e.target.value))} /> giờ
          <span className="text-xs muted">(0 = không giới hạn)</span>
        </div>
      </div>
      <button className="btn-primary mt-5 w-full" onClick={() => setRun(run + 1)}><Icon name="funnel" size={16} /> Chạy funnel</button>
    </Card>
    <Card title="Kết quả" right={<Loading on={res.loading} />}>
      <ErrorBox error={res.error} />
      {!res.data && !res.loading && <Empty icon="funnel">Chọn ít nhất 2 bước rồi bấm Chạy</Empty>}
      {res.data && (
        <>
          <FunnelBars steps={res.data} />
          <div className="mt-6 border-t border-line pt-4">
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
    </div>
  );
}
