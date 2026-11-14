import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import { fmt, useChartTheme } from "../lib/format";
import { Empty, Skeleton } from "./ui";

const REDUCED = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface ChartSeries { name: string; values: number[] }

const MAX_SERIES = 8; // categorical palette size; callers cap breakdowns at 8

function toRows(labels: string[], series: ChartSeries[]) {
  return labels.map((l, i) => {
    const row: Record<string, string | number> = { label: l };
    series.forEach((s) => (row[s.name] = s.values[i] ?? 0));
    return row;
  });
}

const shortDay = (s: string) => {
  // "2026-11-13" -> "13/11"
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[2]}/${m[1]}` : s;
};

/** Tooltip: text in ink tokens, identity carried by the colored key beside it. */
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-md border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="mb-1.5 font-semibold text-fg">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate muted">{p.name}</span>
            <span className="font-semibold tabular text-fg">{fmt(p.value as number)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legend for >= 2 series: swatch + text-token label (never colored text). */
function Legend({ names, colors }: { names: string[]; colors: string[] }) {
  if (names.length < 2) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {names.map((n, i) => (
        <span key={n} className="inline-flex min-w-0 items-center gap-1.5 text-xs muted">
          <span className="h-2 w-3 shrink-0 rounded-sm" style={{ background: colors[i] }} />
          <span className="max-w-[180px] truncate">{n}</span>
        </span>
      ))}
    </div>
  );
}

export function TimeChart({ labels, series, height = 280, bars = false, loading = false }: {
  labels: string[]; series: ChartSeries[]; height?: number; bars?: boolean; loading?: boolean;
}) {
  const { palette, chrome, dark } = useChartTheme();
  if (loading && labels.length === 0) return <Skeleton className="w-full" style={{ height }} />;
  if (labels.length === 0 || series.length === 0) return <div style={{ height }} className="grid place-items-center"><Empty /></div>;

  const shown = series.slice(0, MAX_SERIES);
  const colors = shown.map((_, i) => palette[i]);
  const rows = toRows(labels.map(shortDay), shown);
  const tick = { fill: chrome.axis, fontSize: 11 };
  const grid = <CartesianGrid stroke={chrome.grid} vertical={false} />;
  const xAxis = <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: chrome.baseline }} minTickGap={20} tickMargin={8} />;
  const yAxis = <YAxis tick={tick} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => fmt(v)} allowDecimals={false} />;
  const surface = dark ? "#121218" : "#ffffff";

  return (
    <div>
      <Legend names={shown.map((s) => s.name)} colors={colors} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {bars ? (
            <BarChart data={rows} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              {grid}{xAxis}{yAxis}
              <Tooltip content={<ChartTooltip />} cursor={{ fill: chrome.cursor, fillOpacity: 0.25 }} />
              {shown.map((s, i) => (
                <Bar key={s.name} dataKey={s.name} fill={colors[i]} radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={550} animationEasing="ease-out" isAnimationActive={!REDUCED} />
              ))}
            </BarChart>
          ) : (
            <AreaChart data={rows} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <defs>
                {shown.map((s, i) => (
                  <linearGradient key={s.name} id={`fill-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={colors[i]} stopOpacity={shown.length > 2 ? 0.06 : 0.16} />
                    <stop offset="1" stopColor={colors[i]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              {grid}{xAxis}{yAxis}
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: chrome.cursor, strokeWidth: 1 }} />
              {shown.map((s, i) => (
                <Area key={s.name} type="monotone" dataKey={s.name} stroke={colors[i]} strokeWidth={2} fill={`url(#fill-${i})`}
                  dot={false} activeDot={{ r: 4.5, strokeWidth: 2, stroke: surface, fill: colors[i] }} animationDuration={650} animationEasing="ease-out" isAnimationActive={!REDUCED} />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Funnel: one horizontal bar per step, ordinal single hue, value + conversion at the bar tip. */
export function FunnelBars({ steps }: { steps: { name: string; users: number; conversion: number; step_conversion: number }[] }) {
  const { palette } = useChartTheme();
  const max = Math.max(1, ...steps.map((s) => s.users));
  return (
    <div className="space-y-3">
      {steps.map((s, i) => (
        <div key={i} className="group">
          <div className="mb-1.5 flex items-baseline gap-2 text-sm">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-raised text-[11px] font-semibold muted">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
            <span className="font-semibold tabular">{fmt(s.users)}</span>
            <span className="w-14 text-right text-xs tabular muted">{(s.conversion * 100).toFixed(1)}%</span>
          </div>
          <div className="h-6 overflow-hidden rounded-md bg-raised">
            <div className="h-full rounded-r-[4px] transition-all duration-500"
              style={{ width: `${Math.max(0.5, (100 * s.users) / max)}%`, background: palette[0], opacity: 1 - i * (0.5 / Math.max(1, steps.length - 1)) }} />
          </div>
          {i > 0 && (
            <div className="mt-1 text-[11px] muted">
              ↳ {(s.step_conversion * 100).toFixed(1)}% từ bước trước · rơi {fmt(steps[i - 1].users - s.users)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
