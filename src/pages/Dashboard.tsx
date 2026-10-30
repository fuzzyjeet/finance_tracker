import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parse, endOfMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { statsApi, Trends, TrendSeries } from '../api/stats';
import { onDataChanged } from '../lib/events';

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtAxis = (v: number) =>
  Math.abs(v) >= 10000
    ? `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(v / 1000)}k`
    : new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v);
const toDate = (m: string) => parse(m, 'yyyy-MM', new Date());
const monthLong = (m: string) => format(toDate(m), 'MMMM yyyy');
const monthShort = (m: string) => format(toDate(m), 'MMMM');

const RANGES = [
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
  { months: 24, label: '2 years' },
];

const cardStyle = { background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' };

/**
 * Average of the full months that have data: leaves out the current month (not over yet)
 * and the empty months before the first entry.
 */
function monthlyAverage(values: number[], partialLast: boolean): number | null {
  const first = values.findIndex(v => Math.abs(v) > 0.005);
  if (first < 0) return null;
  const full = values.slice(first, partialLast ? -1 : undefined);
  return full.length ? full.reduce((s, v) => s + v, 0) / full.length : null;
}

/** Round axis ticks (0 / 500 / 1.000 …) covering the data, always including zero. */
function niceTicks(values: number[]): number[] {
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
const Column = (props: any) => {
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

const ChartTooltip = ({ active, payload, partialMonth, signed }: any) => {
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

const MonthColumns: React.FC<{
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
const Delta: React.FC<{ value: number; reference: number; label: string; upIsGood?: boolean }> = ({ value, reference, label, upIsGood }) => {
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

type Drill = { category: TrendSeries; payee?: string } | null;

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState(6);
  const [data, setData] = useState<Trends | null>(null);
  const [selected, setSelected] = useState(5);
  const [drill, setDrill] = useState<Drill>(null);
  const [drillData, setDrillData] = useState<Trends | null>(null);

  const load = useCallback(async () => {
    const d = await statsApi.trends({ months: range });
    setData(d);
    setSelected(s => Math.min(s, d.months.length - 1));
  }, [range]);

  const loadDrill = useCallback(async () => {
    if (!drill) { setDrillData(null); return; }
    setDrillData(await statsApi.trends({ months: range, category_id: drill.category.id, payee: drill.payee }));
  }, [drill, range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDrill(); }, [loadDrill]);
  useEffect(() => onDataChanged(() => { load(); loadDrill(); }), [load, loadDrill]);

  const changeRange = (months: number) => {
    setRange(months);
    setSelected(months - 1);
  };

  if (!data) {
    return (
      <div>
        <Header title="Dashboard" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  // The range can change before its data arrives: keep the pick inside what's loaded
  const sel = Math.min(selected, data.months.length - 1);
  const month = data.months[sel];
  const partialMonth = data.day_of_month != null ? data.months[data.months.length - 1] : undefined;
  const isPartial = month === partialMonth;

  return (
    <div className="pb-4">
      <Header title="Dashboard" />

      {/* One period for every chart. Tapping a spending column picks the month for the
          categories too; the net balance chart picks its own */}
      <div className="flex items-center gap-2 mb-4">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl flex-1 md:flex-none md:w-80" style={{ background: 'var(--surface-low)' }}>
          {RANGES.map(r => (
            <button
              key={r.months}
              onClick={() => changeRange(r.months)}
              className="h-9 rounded-lg text-sm font-semibold"
              style={range === r.months ? { background: 'var(--surface-highest)', color: 'var(--text)' } : { color: 'var(--muted)' }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <SpendingCard data={data} selected={sel} onSelect={setSelected} partialMonth={partialMonth} />

        <div className="lg:row-span-2">
          {drill && drillData ? (
            <DrillCard
              drill={drill}
              data={drillData}
              selected={drillData.months.includes(month) ? drillData.months.indexOf(month) : drillData.months.length - 1}
              onSelect={setSelected}
              partialMonth={partialMonth}
              onBack={() => setDrill(drill.payee ? { category: drill.category } : null)}
              onPayee={payee => setDrill({ category: drill.category, payee })}
              onSeeTransactions={() => {
                const params = new URLSearchParams();
                if (drill.category.id !== 'none') params.set('category_id', drill.category.id);
                if (drill.payee) params.set('search', drill.payee);
                params.set('date_from', `${month}-01`);
                params.set('date_to', format(endOfMonth(toDate(month)), 'yyyy-MM-dd'));
                navigate(`/transactions?${params}`);
              }}
            />
          ) : (
            <CategoryCard data={data} selected={sel} isPartial={isPartial} onOpen={c => setDrill({ category: c })} />
          )}
        </div>

        <NetCard data={data} partialMonth={partialMonth} />
        <OthersCard data={data} selected={sel} isPartial={isPartial} />
      </div>
    </div>
  );
};

// ── Spending ────────────────────────────────────────────────────────────────
const SpendingCard: React.FC<{
  data: Trends; selected: number; onSelect: (i: number) => void; partialMonth?: string;
}> = ({ data, selected, onSelect, partialMonth }) => {
  const month = data.months[selected];
  const value = data.spending[selected];
  const isPartial = month === partialMonth;
  const average = monthlyAverage(data.spending, !!partialMonth);

  return (
    <section className="rounded-xl px-4 py-4" style={cardStyle}>
      <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Spending</h2>
      <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{monthLong(month)}{isPartial ? ' so far' : ''}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(value)}</p>
      {isPartial && data.so_far_last_month != null ? (
        <Delta value={value} reference={data.so_far_last_month} label={`by day ${data.day_of_month} last month (${fmt(data.so_far_last_month)})`} />
      ) : average != null ? (
        <Delta value={value} reference={average} label={`your monthly average (${fmt(average)})`} />
      ) : null}
      <MonthColumns
        months={data.months}
        values={data.spending}
        selected={selected}
        onSelect={onSelect}
        colorFor={() => 'var(--expense)'}
        average={average}
        partialMonth={partialMonth}
        label="Spending per month"
      />
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
        Your share, after refunds. Tap a month to see its categories below.
      </p>
    </section>
  );
};

// ── By category ─────────────────────────────────────────────────────────────
const CategoryCard: React.FC<{
  data: Trends; selected: number; isPartial: boolean; onOpen: (c: TrendSeries) => void;
}> = ({ data, selected, isPartial, onOpen }) => {
  const [showAll, setShowAll] = useState(false);
  const month = data.months[selected];
  const rows = data.categories
    .map(c => ({ c, value: c.amounts[selected] ?? 0 }))
    .filter(r => r.value > 0.005)
    .sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = rows[0]?.value ?? 0;
  const shown = showAll ? rows : rows.slice(0, 8);

  return (
    <section className="rounded-xl px-4 py-4" style={cardStyle}>
      <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>By category</h2>
      <p className="text-sm mt-0.5" style={{ color: 'var(--muted)' }}>
        {monthLong(month)}{isPartial ? ' so far' : ''} · tap one to see it over time
      </p>
      {rows.length === 0 ? (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>No spending this month.</p>
      ) : (
        <div className="mt-2 -mx-2">
          {shown.map(({ c, value }) => (
            <button
              key={c.id}
              onClick={() => onOpen(c)}
              className="w-full text-left px-2 py-2.5 rounded-xl active:bg-white/5 hover:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: `color-mix(in srgb, ${c.color} 15%, transparent)` }}>
                  {c.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-medium truncate" style={{ color: 'var(--text)' }}>{c.name}</p>
                    <p className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--text)' }}>{fmt(value)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-highest)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(value / max) * 100}%`, background: 'var(--expense)' }} />
                    </div>
                    <span className="text-xs tabular-nums w-9 text-right" style={{ color: 'var(--muted)' }}>
                      {Math.round((value / total) * 100)}%
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--faint)' }} />
              </div>
            </button>
          ))}
          {rows.length > 8 && (
            <button onClick={() => setShowAll(s => !s)} className="w-full h-10 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              {showAll ? 'Show fewer' : `Show all ${rows.length}`}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

// ── One category, or one payee in it, over time ────────────────────────────
const DrillCard: React.FC<{
  drill: NonNullable<Drill>;
  data: Trends;
  selected: number;
  onSelect: (i: number) => void;
  partialMonth?: string;
  onBack: () => void;
  onPayee: (payee: string) => void;
  onSeeTransactions: () => void;
}> = ({ drill, data, selected, onSelect, partialMonth, onBack, onPayee, onSeeTransactions }) => {
  const [showAll, setShowAll] = useState(false);
  const month = data.months[selected];
  const value = data.spending[selected] ?? 0;
  const isPartial = month === partialMonth;
  const average = monthlyAverage(data.spending, !!partialMonth);
  const total = data.spending.reduce((s, v) => s + v, 0);

  const payees = useMemo(() => data.payees
    .map(p => ({ payee: p.payee, value: p.amounts[selected] ?? 0 }))
    .filter(p => p.value > 0.005)
    .sort((a, b) => b.value - a.value), [data, selected]);
  const shown = showAll ? payees : payees.slice(0, 6);
  const max = payees[0]?.value ?? 0;

  return (
    <section className="rounded-xl px-4 py-4" style={cardStyle}>
      <button onClick={onBack} className="flex items-center gap-1 h-9 -ml-1.5 pr-2 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
        <ChevronLeft size={18} /> {drill.payee ? drill.category.name : 'All categories'}
      </button>
      <div className="flex items-center gap-2.5 mt-1">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: `color-mix(in srgb, ${drill.category.color} 15%, transparent)` }}>
          {drill.category.icon}
        </span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold truncate" style={{ color: 'var(--text)' }}>{drill.payee ?? drill.category.name}</h2>
          {drill.payee && <p className="text-xs" style={{ color: 'var(--muted)' }}>in {drill.category.name}</p>}
        </div>
      </div>

      <p className="text-sm mt-3" style={{ color: 'var(--muted)' }}>{monthLong(month)}{isPartial ? ' so far' : ''}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(value)}</p>
      {average != null && (
        isPartial
          ? <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-2)' }}>Monthly average {fmt(average)}</p>
          : <Delta value={value} reference={average} label={`the monthly average (${fmt(average)})`} />
      )}

      <MonthColumns
        months={data.months}
        values={data.spending}
        selected={selected}
        onSelect={onSelect}
        colorFor={() => 'var(--expense)'}
        average={average}
        partialMonth={partialMonth}
        label={`${drill.payee ?? drill.category.name} spending per month`}
      />
      <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--muted)' }}>
        {fmt(total)} over these {data.months.length} months
      </p>

      {!drill.payee && (
        <>
          <h3 className="text-sm font-semibold mt-5" style={{ color: 'var(--text-2)' }}>Payees in {monthShort(month)}</h3>
          {payees.length === 0 ? (
            <p className="text-sm py-4" style={{ color: 'var(--muted)' }}>Nothing this month.</p>
          ) : (
            <div className="mt-1 -mx-2">
              {shown.map(p => (
                <button
                  key={p.payee}
                  onClick={() => onPayee(p.payee)}
                  className="w-full text-left px-2 py-2 rounded-xl active:bg-white/5 hover:bg-white/5"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{p.payee}</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-sm tabular-nums" style={{ color: 'var(--text)' }}>{fmt(p.value)}</span>
                      <ChevronRight size={15} style={{ color: 'var(--faint)' }} />
                    </span>
                  </div>
                  <div className="h-1 mt-1.5 mr-5 rounded-full overflow-hidden" style={{ background: 'var(--surface-highest)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(p.value / max) * 100}%`, background: 'var(--expense)', opacity: 0.8 }} />
                  </div>
                </button>
              ))}
              {payees.length > 6 && (
                <button onClick={() => setShowAll(s => !s)} className="w-full h-10 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                  {showAll ? 'Show fewer' : `Show all ${payees.length}`}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <button
        onClick={onSeeTransactions}
        className="w-full h-11 mt-3 rounded-xl text-sm font-semibold"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
      >
        See {monthShort(month)}'s transactions
      </button>
    </section>
  );
};

// ── Net balance ─────────────────────────────────────────────────────────────
// Picks its own month: tapping a column here only changes this card
const NetCard: React.FC<{ data: Trends; partialMonth?: string }> = ({ data, partialMonth }) => {
  const last = data.months.length - 1;
  const [picked, setPicked] = useState<string | null>(null);
  const selected = picked && data.months.includes(picked) ? data.months.indexOf(picked) : last;
  const onSelect = (i: number) => setPicked(data.months[i]);
  const month = data.months[selected];
  const net = data.net[selected];
  const isPartial = month === partialMonth;
  const totalNet = data.net.reduce((s, v) => s + v, 0);
  const totalIncome = data.income.reduce((s, v) => s + v, 0);
  const sign = (v: number) => (v > 0.005 ? '+' : v < -0.005 ? '−' : '');

  return (
    <section className="rounded-xl px-4 py-4" style={cardStyle}>
      <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Net balance</h2>
      <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{monthLong(month)}{isPartial ? ' so far' : ''}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: net < -0.005 ? 'var(--expense)' : 'var(--income)' }}>
        {sign(net)}{fmt(Math.abs(net))}
      </p>
      <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-2)' }}>
        {fmt(data.income[selected])} in − {fmt(data.expenses[selected])} spent
      </p>
      <MonthColumns
        months={data.months}
        values={data.net}
        selected={selected}
        onSelect={onSelect}
        colorFor={v => (v < 0 ? 'var(--expense)' : 'var(--income)')}
        signed
        partialMonth={partialMonth}
        label="Income minus spending per month"
      />
      <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--muted)' }}>
        Over these {data.months.length} months: <span className="font-semibold" style={{ color: 'var(--text-2)' }}>{sign(totalNet)}{fmt(Math.abs(totalNet))}</span>
        {totalIncome > 0.005 && totalNet > 0 && ` · you kept ${Math.round((totalNet / totalIncome) * 100)}% of what came in`}
      </p>
    </section>
  );
};

// ── Money spent on others ───────────────────────────────────────────────────
/** What I covered for friends vs what came back. Hidden when there's none in the period. */
const OthersCard: React.FC<{ data: Trends; selected: number; isPartial: boolean }> = ({ data, selected, isPartial }) => {
  const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
  const totalOthers = sum(data.for_others);
  const totalBack = sum(data.paid_back);
  if (totalOthers < 0.005 && totalBack < 0.005) return null;

  const month = data.months[selected];
  const rows = [
    { label: `${monthLong(month)}${isPartial ? ' so far' : ''}`, others: data.for_others[selected], back: data.paid_back[selected] },
    { label: `Over these ${data.months.length} months`, others: totalOthers, back: totalBack },
  ];

  return (
    <section className="rounded-xl px-4 py-4" style={cardStyle}>
      <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>Spent on others</h2>
      <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
        The part of expenses you paid for friends, and what they paid you back. Neither counts in your spending or income.
      </p>
      <div className="mt-3 space-y-3">
        {rows.map(r => {
          const out = r.others - r.back;
          return (
            <div key={r.label}>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{r.label}</p>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>On others</p>
                  <p className="text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(r.others)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Paid back</p>
                  <p className="text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(r.back)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{out >= 0 ? 'Still out' : 'Back more'}</p>
                  <p className="text-base font-semibold tabular-nums" style={{ color: out > 0.005 ? 'var(--warn)' : 'var(--text)' }}>{fmt(Math.abs(out))}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
