import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt, PALETTE } from "../lib/format";

export interface ChartSeries { name: string; values: number[] }

const axis = { stroke: "#71717a", fontSize: 12 };
const tooltipStyle = { backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fafafa", fontSize: 12 };

function toRows(labels: string[], series: ChartSeries[]) {
  return labels.map((l, i) => {
    const row: Record<string, string | number> = { label: l };
    series.forEach((s) => (row[s.name] = s.values[i] ?? 0));
    return row;
  });
}

export function TimeChart({ labels, series, height = 280, bars = false }: { labels: string[]; series: ChartSeries[]; height?: number; bars?: boolean }) {
  const rows = toRows(labels.map((l) => l.slice(5)), series);
  const common = (
    <>
      <CartesianGrid stroke="#71717a" strokeOpacity={0.15} vertical={false} />
      <XAxis dataKey="label" {...axis} tickLine={false} minTickGap={16} />
      <YAxis {...axis} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => fmt(v)} />
      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
    </>
  );
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {bars ? (
          <BarChart data={rows}>
            {common}
            {series.map((s, i) => <Bar key={s.name} dataKey={s.name} fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]} />)}
          </BarChart>
        ) : (
          <LineChart data={rows}>
            {common}
            {series.map((s, i) => (
              <Line key={s.name} type="monotone" dataKey={s.name} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={labels.length <= 31 ? { r: 2 } : false} />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function HBarChart({ rows, height = 300 }: { rows: { label: string; value: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid stroke="#71717a" strokeOpacity={0.15} horizontal={false} />
          <XAxis type="number" {...axis} tickFormatter={(v) => fmt(v)} />
          <YAxis type="category" dataKey="label" {...axis} width={150} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
          <Bar dataKey="value" name="Users" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
