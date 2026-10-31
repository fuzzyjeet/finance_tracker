import React from 'react';
import { format, parse } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
export const fmtAxis = (v: number) =>
  Math.abs(v) >= 10000
    ? `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(v / 1000)}k`
    : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v);
export const toDate = (m: string) => parse(m, 'yyyy-MM', new Date());
export const monthLong = (m: string) => format(toDate(m), 'MMMM yyyy');
export const monthShort = (m: string) => format(toDate(m), 'MMMM');


export const cardStyle = { background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' };

/**
 * Average of the full months that have data: leaves out the current month (not over yet)
 * and the empty months before the first entry.
 */
export function monthlyAverage(values: number[], partialLast: boolean): number | null {
  const first = values.findIndex(v => Math.abs(v) > 0.005);
  if (first < 0) return null;
  const full = values.slice(first, partialLast ? -1 : undefined);
  return full.length ? full.reduce((s, v) => s + v, 0) / full.length : null;
}

/** Round axis ticks (0 / 500 / 1.000 …) covering the data, always including zero. */
export function niceTicks(values: number[]): number[] {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  if (hi - lo < 0.005) return [0, 1];
  const raw = (hi - lo) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= raw)!;
  const ticks: number[] = [];
  for (let t = Math.floor(lo / step) * step; t <= Math.ceil(hi / step) * step + step / 2; t += step) ticks.push(Math.round(t * 100) / 100);
  return ticks;
}

// ── Monthly column chart ────────────────────────────────────────────────────
// One series, one colour. The selected month is full strength, the rest recede.
// Columns round the end away from zero, so negative months grow downwards.
export const Column = (props: any) => {
  const { x, y, width, height, fill, fillOpacity, value } = props;
  if (!height || Math.abs(height) < 0.5) return null;
  const top = Math.min(y, y + height);
  const h = Math.abs(height);
  const r = Math.min(4, h, width / 2);
  const up = (Array.isArray(value) ? value[1] : value) >= 0;
  const d = up
    ? `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${top + h} Z`
    : `M${x},${top} V${top + h - r} Q${x},${top + h} ${x + r},${top + h} H${x + width - r} Q${x + width},${top + h} ${x + width},${top + h - r} V${top} Z`;
  return <path d={d} fill={fill} fillOpacity={fillOpacity} />;
};

export const ChartTooltip = ({ active, payload, partialMonth, signed }: any) => {
  if (!active || !payload?.length) return null;
  const { month, value } = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: 'var(--muted)', marginBottom: 2 }}>{monthLong(month)}{month === partialMonth ? ' (so far)' : ''}</p>
      <p style={{ color: 'var(--text)', fontWeight: 700 }} className="tabular-nums">
        {signed && value > 0 ? '+' : signed && value < 0 ? '−' : ''}{fmt(signed ? Math.abs(value) : value)}
      </p>
    </div>
  );
};

export const MonthColumns: React.FC<{
  months: string[];
  values: number[];
  selected: number;
  onSelect: (i: number) => void;
  colorFor: (v: number) => string;
  average?: number | null;
  signed?: boolean;
  partialMonth?: string;
  label: string;
}> = ({ months, values, selected, onSelect, colorFor, average, signed, partialMonth, label }) => {
  const data = months.map((month, i) => ({ month, value: values[i] ?? 0 }));
  const yearMarks = months.length > 12;
  const ticks = niceTicks(values);
  return (
    <div className="h-44 -ml-2 mt-3 select-none" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 26, bottom: 0, left: 0 }}
          barCategoryGap="22%"
          onClick={(s: any) => { if (s && s.activeTooltipIndex != null) onSelect(s.activeTooltipIndex); }}
        >
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            interval={yearMarks ? 5 : months.length > 6 ? 1 : 0}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickFormatter={(m: string) => format(toDate(m), m.endsWith('-01') || yearMarks ? 'MMM yy' : 'MMM')}
          />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickFormatter={fmtAxis}
            ticks={ticks}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            content={<ChartTooltip partialMonth={partialMonth} signed={signed} />}
          />
          {signed && <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />}
          {average != null && average > 0 && !signed && (
            <ReferenceLine
              y={average}
              stroke="var(--text-2)"
              strokeOpacity={0.6}
              label={{ value: 'avg', position: 'right', fill: 'var(--muted)', fontSize: 11 }}
            />
          )}
          <Bar dataKey="value" maxBarSize={24} shape={<Column />} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={d.month}
                fill={colorFor(d.value)}
                fillOpacity={i === selected ? 1 : 0.4}
                cursor="pointer"
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

/** Change vs a reference, coloured by whether it's good news (spending down = good). */
export const Delta: React.FC<{ value: number; reference: number; label: string; upIsGood?: boolean }> = ({ value, reference, label, upIsGood }) => {
  if (reference <= 0.005) return null;
  const diff = value - reference;
  const pct = Math.round((diff / reference) * 100);
  const up = diff > 0;
  const good = upIsGood ? up : !up;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <p className="flex items-center gap-1.5 text-xs mt-1 tabular-nums" style={{ color: 'var(--text-2)' }}>
      {Math.abs(pct) >= 1 && (
        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: good ? 'var(--income)' : 'var(--expense)' }}>
          <Icon size={14} /> {Math.abs(pct)}% {up ? 'more' : 'less'}
        </span>
      )}
      <span>{Math.abs(pct) >= 1 ? 'than' : 'Same as'} {label}</span>
    </p>
  );
};
