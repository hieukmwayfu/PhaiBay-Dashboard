import { api, type Retention as R } from "../lib/api";
import { fmt, pct } from "../lib/format";
import { useDash, useLoad } from "../lib/state";
import { Card, ErrorBox } from "../components/ui";

const OFFS = [0, 1, 2, 3, 4, 5, 6, 7, 14, 21, 30];

function Cell({ v }: { v: number }) {
  if (v < 0) return <td className="px-1 py-1" />;
  const a = Math.min(1, v * 1.6);
  return (
    <td className="px-1 py-1 text-center text-xs tabular-nums" style={{ background: `rgba(59,130,246,${(a * 0.85).toFixed(2)})` }}>
      {pct(v)}
    </td>
  );
}

export function Retention() {
  const { q } = useDash();
  const r = useLoad(() => api<R>("/api/retention", q({ days: 30 })), [q]);
  const cohorts = r.data?.cohorts ?? [];
  const avg = OFFS.map((o) => {
    let n = 0, d = 0;
    cohorts.forEach((c) => { if (c.retained[o] >= 0 && c.size) { n += c.counts[o]; d += c.size; } });
    return d ? n / d : -1;
  });
  const total = cohorts.reduce((s, c) => s + c.size, 0);

  return (
    <Card title="Retention theo cohort ngày đầu tiên">
      <p className="mb-3 text-sm muted">Filter áp dụng: version (version lần đầu mở app), country, platform.</p>
      <ErrorBox error={r.error} />
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-sm">
          <thead>
            <tr className="text-xs muted">
              <th className="px-2 py-1 text-left">Cohort</th>
              <th className="px-2 py-1 text-right">Users</th>
              {OFFS.map((o) => <th key={o} className="px-1 py-1">D{o}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="font-semibold">
              <td className="px-2 py-1">Trung bình</td>
              <td className="px-2 py-1 text-right tabular-nums">{fmt(total)}</td>
              {avg.map((v, i) => <Cell key={i} v={v} />)}
            </tr>
            {cohorts.slice().reverse().map((c) => (
              <tr key={c.day}>
                <td className="whitespace-nowrap px-2 py-1">{c.day}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(c.size)}</td>
                {OFFS.map((o) => <Cell key={o} v={c.size ? c.retained[o] : -1} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
