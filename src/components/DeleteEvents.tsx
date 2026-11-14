import { useEffect, useState } from "react";
import { deleteEvents, type DeleteEventsResult } from "../lib/api";
import { fmt } from "../lib/format";
import { cancelDelete, DELETE_DELAY_MS, scheduleDelete, usePendingDeletes } from "../lib/pendingDelete";
import { useDash } from "../lib/state";
import { Icon } from "./Icon";
import { ErrorBox, Loading, Modal, Segmented } from "./ui";

/** Confirm step: shows exactly what will be removed (server dry run) before scheduling the delete. */
export function DeleteEventsDialog({ names, onClose, onScheduled }: { names: string[]; onClose: () => void; onScheduled: () => void }) {
  const { appId, apps, dates } = useDash();
  const app = apps.find((a) => a.id === appId);
  const [scope, setScope] = useState<"range" | "all">("range");
  const [info, setInfo] = useState<DeleteEventsResult | null>(null);
  const [err, setErr] = useState("");
  const range = scope === "range" ? { from: dates.from, to: dates.to } : {};

  useEffect(() => {
    if (!appId) return;
    let alive = true;
    setInfo(null);
    setErr("");
    deleteEvents({ app_id: appId, names, ...range, dry_run: true })
      .then((r) => alive && setInfo(r))
      .catch((e) => alive && setErr((e as Error).message));
    return () => { alive = false; };
  }, [appId, names, scope, dates.from, dates.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = () => {
    if (!app || !info?.total) return;
    scheduleDelete({ appId: app.id, appName: app.name, names, ...range, total: info.total });
    onScheduled();
    onClose();
  };

  return (
    <Modal title="Xóa event" onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          <span className="muted">App</span><span className="font-medium">{app?.name}</span>
          <span className="muted">Khoảng</span>
          <span><Segmented value={scope} onChange={setScope} options={[
            { v: "range", label: `${dates.from} → ${dates.to}` },
            { v: "all", label: "Toàn bộ thời gian" },
          ]} /></span>
        </div>

        <div className="overflow-hidden rounded-md border border-line">
          <div className="max-h-56 overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-raised text-xs muted">
                <tr><th className="px-3 py-1.5 text-left font-medium">Event</th><th className="px-3 py-1.5 text-right font-medium">Số bản ghi</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {names.map((n) => {
                  const c = info?.names.find((x) => x.name === n)?.count ?? 0;
                  return (
                    <tr key={n}>
                      <td className="max-w-0 truncate px-3 py-1.5 font-medium" title={n}>{n}</td>
                      <td className="px-3 py-1.5 text-right tabular">{info ? fmt(c) : "…"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line bg-raised/60 px-3 py-1.5 text-[13px]">
            <span className="muted">Tổng</span>
            <span className="flex items-center gap-2 font-semibold tabular"><Loading on={!info && !err} />{info ? fmt(info.total) : ""}</span>
          </div>
        </div>

        <ErrorBox error={err} />
        <ul className="list-disc space-y-1 pl-5 text-xs muted">
          <li>Xóa mọi bản ghi của các event trên trong khoảng đã chọn. Bộ lọc khác (version, quốc gia…) <b className="text-fg">không</b> áp dụng.</li>
          <li>Không khôi phục được. Users / sessions được tính lại theo dữ liệu còn lại.</li>
          <li>Lệnh xóa được gửi sau {DELETE_DELAY_MS / 1000} giây, trong lúc đó bấm <b className="text-fg">Hủy</b> để dừng.</li>
        </ul>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn-danger" disabled={!info?.total} onClick={confirm}>
            <Icon name="trash" size={14} /> {info ? (info.total ? `Xóa ${fmt(info.total)} bản ghi` : "Không có gì để xóa") : "Đang đếm…"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Bottom-right countdown toasts for scheduled deletes (rendered once in the layout). */
export function DeleteToasts() {
  const items = usePendingDeletes();
  const { refresh } = useDash();
  const [now, setNow] = useState(Date.now());
  const waiting = items.some((x) => x.state === "waiting");

  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [waiting]);

  // reload every page's data once a delete went through
  const doneIds = items.filter((x) => x.state === "done").map((x) => x.id).join(",");
  useEffect(() => { if (doneIds) refresh(); }, [doneIds]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((it) => {
        const left = Math.max(0, it.deadline - now);
        const what = it.names.length === 1 ? <b className="font-semibold">{it.names[0]}</b> : <b className="font-semibold">{it.names.length} event</b>;
        return (
          <div key={it.id} className="pointer-events-auto animate-toast-in overflow-hidden rounded-lg border border-line bg-surface shadow-pop">
            <div className="flex items-start gap-3 px-3.5 py-3">
              <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${it.state === "done" ? "bg-good/10 text-good" : it.state === "error" ? "bg-bad/10 text-bad" : "bg-bad/10 text-bad"}`}>
                <Icon name={it.state === "done" ? "check" : it.state === "error" ? "x" : "trash"} size={15} />
              </span>
              <div className="min-w-0 flex-1 text-[13px]">
                {it.state === "waiting" && (<>
                  <div>Sẽ xóa {what} ({fmt(it.total)} bản ghi)</div>
                  <div className="text-xs muted">{it.appName} · gửi lệnh sau <b className="tabular text-fg">{Math.ceil(left / 1000)}s</b></div>
                </>)}
                {it.state === "running" && <div className="flex items-center gap-2">Đang xóa {what}… <Loading on /></div>}
                {it.state === "done" && <div>Đã xóa {fmt(it.deleted ?? 0)} bản ghi của {what}</div>}
                {it.state === "error" && <div><span className="text-bad">Xóa thất bại:</span> <span className="muted">{it.error}</span></div>}
              </div>
              {it.state === "waiting" && <button className="btn !h-7 shrink-0" onClick={() => cancelDelete(it.id)}>Hủy</button>}
              {(it.state === "done" || it.state === "error") && (
                <button className="btn-ghost !h-7 !px-1.5" onClick={() => cancelDelete(it.id)} aria-label="Đóng"><Icon name="x" size={14} /></button>
              )}
            </div>
            {it.state === "waiting" && (
              <div className="h-0.5 bg-raised"><div className="h-full bg-bad/70" style={{ width: `${(100 * left) / DELETE_DELAY_MS}%` }} /></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
