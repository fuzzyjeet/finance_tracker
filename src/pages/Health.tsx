import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Eye, EyeOff, ChevronDown, ShieldCheck, Repeat, Users } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { statsApi, Health as HealthData, HealthAccount, Trends, TrendSeries } from '../api/stats';
import { onDataChanged } from '../lib/events';
import {
  fmt, fmtAxis, toDate, monthLong, cardStyle, niceTicks, MonthColumns, Delta,
} from '../components/charts/MonthColumns';

const HISTORY_MONTHS = 24;
const LATELY = 3;    // recent months compared…
const USUAL = 12;    // …with the ones before them
const MIN_USUAL = 3; // fewer months than this before "lately" is too little to compare

const HIDDEN = '••••••';

// Kinds of money, in the order they're listed. Credit cards are shown apart, as money owed.
const GROUPS: { type: HealthAccount['type']; label: string; color: string }[] = [
  { type: 'checking', label: 'Current accounts', color: 'var(--transfer)' },
  { type: 'savings', label: 'Savings', color: 'var(--income)' },
  { type: 'investment', label: 'Investments', color: 'var(--accent)' },
  { type: 'cash', label: 'Cash', color: 'var(--refund)' },
];

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const signed = (v: number) => `${v > 0.005 ? '+' : v < -0.005 ? '−' : ''}${fmt(Math.abs(v))}`;
const monthTick = (m: string) => format(toDate(m), 'MMM yy');

/** The "lately" and "usual" month windows of the trends, leaving out this (unfinished) month. */
function windows(trends: Trends) {
  const done = trends.months.length - 1;
  const first = trends.months.findIndex((_, i) => trends.income[i] > 0.005 || trends.expenses[i] > 0.005);
  const latelyFrom = done - LATELY;
  const usualFrom = Math.max(first < 0 ? latelyFrom : first, latelyFrom - USUAL);
  return {
    lately: [latelyFrom, done] as const,
    usual: [usualFrom, latelyFrom] as const,
    enough: first >= 0 && latelyFrom - usualFrom >= MIN_USUAL,
    usualMonths: latelyFrom - usualFrom,
  };
}

const slice = (xs: number[], [from, to]: readonly [number, number]) => xs.slice(from, to);

const Section: React.FC<{ title: string; note?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }> = ({ title, note, action, children }) => (
  <section className="rounded-xl px-4 py-4" style={cardStyle}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
        {note && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{note}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const Health: React.FC = () => {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);

  const load = useCallback(async () => {
    const [h, t] = await Promise.all([statsApi.health(HISTORY_MONTHS), statsApi.trends({ months: HISTORY_MONTHS })]);
    setHealth(h);
    setTrends(t);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onDataChanged(load), [load]);

  if (!health || !trends) {
    return (
      <div>
        <Header title="Health" />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      </div>
    );
  }

  const w = windows(trends);
  return (
    <div className="pb-4">
      <Header title="Health" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <WhatIHave health={health} />
        <IncomeAndSpending trends={trends} health={health} w={w} />
        <WhatChanged trends={trends} w={w} />
        <SafetyNet trends={trends} health={health} w={w} />
      </div>
    </div>
  );
};

// ── 1. What I have ──────────────────────────────────────────────────────────
/** Total across accounts by kind of money. Amounts start hidden every time the page opens. */
const WhatIHave: React.FC<{ health: HealthData }> = ({ health }) => {
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const money = (v: number) => (shown ? fmt(v) : HIDDEN);

  const groups = GROUPS
    .map(g => {
      const accounts = health.accounts.filter(a => a.type === g.type);
      return { ...g, accounts, total: sum(accounts.map(a => a.balance)) };
    })
    .filter(g => g.accounts.length);
  const cards = health.accounts.filter(a => a.type === 'credit_card');
  const owed = sum(cards.map(a => a.balance));
  const total = sum(health.accounts.map(a => a.balance));
  const assets = sum(groups.map(g => Math.max(0, g.total)));

  // History from the first month the total moved
  const start = Math.max(0, health.worth.findIndex((v, i) => i + 1 < health.worth.length && Math.abs(health.worth[i + 1] - v) > 0.005));
  const months = health.months.slice(start);
  const worth = health.worth.slice(start);
  const yearAgo = worth.length > 12 ? worth[worth.length - 13] : worth[0];
  const yearAgoMonth = worth.length > 12 ? months[months.length - 13] : months[0];

  const row = (key: string, color: string, label: string, sub: string, amount: number, share: string | null, accounts: HealthAccount[], negative = false) => {
    const expanded = open === key;
    return (
      <div key={key}>
        <button
          type="button"
          onClick={() => setOpen(expanded ? null : key)}
          aria-expanded={expanded}
          className="w-full flex items-center gap-3 min-h-[48px] py-1.5 text-left"
        >
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{label}</span>
            <span className="block text-xs" style={{ color: 'var(--muted)' }}>{sub}</span>
          </span>
          <span className="text-right shrink-0">
            <span className="block text-sm font-semibold tabular-nums" style={{ color: negative && shown ? 'var(--expense)' : 'var(--text)' }}>
              {negative && shown ? '−' : ''}{money(Math.abs(amount))}
            </span>
            {share && <span className="block text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{share}</span>}
          </span>
          <ChevronDown size={16} className="shrink-0 transition-transform" style={{ color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : undefined }} />
        </button>
        {expanded && (
          <div className="ml-5 mb-2 pl-3 space-y-1.5" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate" style={{ color: 'var(--text-2)' }}>{a.name}</span>
                <span className="tabular-nums shrink-0" style={{ color: a.balance < 0 && shown ? 'var(--expense)' : 'var(--text-2)' }}>
                  {shown && a.balance < 0 ? '−' : ''}{money(Math.abs(a.balance))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const count = (n: number) => `${n} account${n === 1 ? '' : 's'}`;

  return (
    <Section
      title="What I have"
      note={cards.length ? 'Across your accounts, minus what you owe on cards' : 'Across your accounts'}
      action={
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-label={shown ? 'Hide amounts' : 'Show amounts'}
          aria-pressed={shown}
          className="w-10 h-10 -mr-2 -mt-2 flex items-center justify-center rounded-lg shrink-0"
          style={{ color: shown ? 'var(--accent)' : 'var(--muted)' }}
        >
          {shown ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      }
    >
      <p className="text-3xl font-bold tabular-nums mt-2" style={{ color: total < 0 && shown ? 'var(--expense)' : 'var(--text)' }}>
        {shown && total < 0 ? '−' : ''}{money(Math.abs(total))}
      </p>
      {worth.length > 1 && (
        <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-2)' }}>
          {shown
            ? <><span className="font-semibold" style={{ color: total - yearAgo < 0 ? 'var(--expense)' : 'var(--income)' }}>{signed(total - yearAgo)}</span> since the end of {monthLong(yearAgoMonth)}</>
            : <>Tap the eye to show amounts</>}
        </p>
      )}

      {/* Proportions show the mix even while the amounts are hidden */}
      {assets > 0.005 && (
        <div className="flex h-2.5 rounded-full overflow-hidden mt-4 gap-[2px]" role="img" aria-label="Share of each kind of money">
          {groups.filter(g => g.total > 0.005).map(g => (
            <div key={g.type} style={{ flexGrow: g.total, flexBasis: 0, background: g.color }} />
          ))}
        </div>
      )}

      <div className="mt-2">
        {groups.map(g => row(g.type, g.color, g.label, count(g.accounts.length), g.total,
          assets > 0.005 && g.total > 0 ? pct(g.total / assets) : null, g.accounts, g.total < 0))}
        {cards.length > 0 && row('cards', 'var(--expense)', 'Owed on cards', count(cards.length), owed, null, cards, owed < 0)}
      </div>

      {months.length > 2 && <WorthChart months={months} worth={worth} shown={shown} />}

      {health.left_out.length > 0 && (
        <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
          Accounts in {health.left_out.join(', ')} aren't counted until other currencies are supported.
        </p>
      )}
    </Section>
  );
};

const WorthChart: React.FC<{ months: string[]; worth: number[]; shown: boolean }> = ({ months, worth, shown }) => {
  const data = months.map((month, i) => ({ month, value: worth[i] }));
  const ticks = niceTicks(worth);
  return (
    <div className="h-36 mt-3 -ml-2 select-none" role="img" aria-label="Total across accounts at the end of each month">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: shown ? 0 : 8 }}>
          <defs>
            <linearGradient id="worthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} interval={months.length > 12 ? 5 : 2} padding={{ left: 14, right: 14 }}
            tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={monthTick} />
          <YAxis hide={!shown} width={48} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}
            tickFormatter={fmtAxis} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} interval={0} />
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
            content={({ active, payload }: any) => active && payload?.length ? (
              <div style={{ background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
                <p style={{ color: 'var(--muted)' }}>End of {monthLong(payload[0].payload.month)}</p>
                <p className="tabular-nums" style={{ color: 'var(--text)', fontWeight: 700 }}>{shown ? fmt(payload[0].payload.value) : HIDDEN}</p>
              </div>
            ) : null}
          />
          <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="url(#worthFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

type Windows = ReturnType<typeof windows>;

// ── 2. Income and spending, long term ───────────────────────────────────────
const IncomeAndSpending: React.FC<{ trends: Trends; health: HealthData; w: Windows }> = ({ trends, health, w }) => {
  const moved = trends.months.map(m => health.moved_to_savings[m] ?? 0);
  const figures = (range: readonly [number, number]) => {
    const income = avg(slice(trends.income, range));
    const spent = avg(slice(trends.expenses, range));
    const toSavings = avg(slice(moved, range));
    return { income, spent, toSavings, kept: income > 0.005 ? (income - spent) / income : null };
  };
  const lately = figures(w.lately);
  const usual = figures(w.usual);
  const usualLabel = `your usual ${fmt(usual.spent)}`;

  return (
    <Section
      title="Income and spending"
      note={w.enough
        ? `Monthly averages: the last ${LATELY} months against the ${w.usualMonths} before them`
        : `Monthly averages over the last ${LATELY} months. Comparisons start once there are ${LATELY + MIN_USUAL} months of entries.`}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 mt-3">
        <div className="col-span-2">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Spent a month lately</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(lately.spent)}</p>
          {w.enough && <Delta value={lately.spent} reference={usual.spent} label={usualLabel} />}
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Came in a month</p>
          <p className="text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmt(lately.income)}</p>
          {w.enough && <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-2)' }}>usually {fmt(usual.income)}</p>}
        </div>
        <div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>You kept</p>
          <p className="text-base font-semibold tabular-nums" style={{ color: lately.kept != null && lately.kept < 0 ? 'var(--expense)' : 'var(--text)' }}>
            {lately.kept == null ? '–' : pct(lately.kept)}
          </p>
          {w.enough && usual.kept != null && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>usually {pct(usual.kept)}</p>
          )}
        </div>
      </div>

      <p className="text-sm font-medium mt-5" style={{ color: 'var(--text)' }}>Where the money went</p>
      <div className="space-y-3 mt-2">
        <MoneySplit label="Lately" f={lately} />
        {w.enough && <MoneySplit label="Usually" f={usual} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: 'var(--text-2)' }}>
        {SPLIT_PARTS.map(p => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} /> {p.label}
          </span>
        ))}
      </div>

      <TrendLines trends={trends} />
    </Section>
  );
};

const SPLIT_PARTS = [
  { key: 'spent', label: 'Spent', color: 'var(--expense)' },
  { key: 'toSavings', label: 'Moved to savings', color: 'var(--income)' },
  { key: 'left', label: 'Left in your accounts', color: 'var(--transfer)' },
] as const;

/** One month's income split into spent, moved to savings and what stayed. */
const MoneySplit: React.FC<{ label: string; f: { income: number; spent: number; toSavings: number } }> = ({ label, f }) => {
  const toSavings = Math.max(0, f.toSavings);
  const left = f.income - f.spent - toSavings;
  const parts = { spent: f.spent, toSavings, left: Math.max(0, left) };
  const whole = Math.max(f.income, f.spent + toSavings);
  if (whole < 0.005) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
        <span>{label}</span>
        <span className="tabular-nums">
          {left >= -0.005
            ? <>{fmt(f.income)} in · {pct(parts.spent / whole)} spent{toSavings > 0.005 ? ` · ${pct(toSavings / whole)} saved` : ''}</>
            : <span style={{ color: 'var(--expense)' }}>{fmt(-left)} a month more than came in</span>}
        </span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {SPLIT_PARTS.map(p => parts[p.key] > 0.005 && (
          <div key={p.key} style={{ width: `${(parts[p.key] / whole) * 100}%`, background: p.color }} />
        ))}
      </div>
    </div>
  );
};

/** Income and spending per month, each smoothed over 3 months so one-offs don't hide the trend. */
const TrendLines: React.FC<{ trends: Trends }> = ({ trends }) => {
  const done = trends.months.length - 1; // this month isn't over
  const first = trends.months.findIndex((_, i) => trends.income[i] > 0.005 || trends.expenses[i] > 0.005);
  if (first < 0 || done - first < 3) return null;
  const rolling = (xs: number[], i: number) => avg(xs.slice(Math.max(first, i - 2), i + 1));
  const data = [];
  for (let i = first; i < done; i++) {
    data.push({ month: trends.months[i], income: rolling(trends.income, i), spent: rolling(trends.expenses, i) });
  }
  const ticks = niceTicks(data.flatMap(d => [d.income, d.spent]));
  return (
    <>
      <div className="flex items-center justify-between mt-5">
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Over time</p>
        <div className="flex gap-3 text-xs" style={{ color: 'var(--text-2)' }}>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: 'var(--income)' }} /> Came in</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 rounded" style={{ background: 'var(--expense)' }} /> Spent</span>
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>Each point is the average of 3 months</p>
      <div className="h-44 mt-2 -ml-2 select-none" role="img" aria-label="Income and spending per month, 3-month averages">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} interval={data.length > 12 ? 5 : 2} padding={{ left: 14, right: 14 }}
              tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={monthTick} />
            <YAxis width={48} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}
              tickFormatter={fmtAxis} ticks={ticks} domain={[ticks[0], ticks[ticks.length - 1]]} interval={0} />
            <Tooltip
              cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
              content={({ active, payload }: any) => active && payload?.length ? (
                <div style={{ background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', fontSize: 12 }}>
                  <p style={{ color: 'var(--muted)', marginBottom: 2 }}>3 months to {monthLong(payload[0].payload.month)}</p>
                  <p className="tabular-nums" style={{ color: 'var(--text)' }}>Came in <b>{fmt(payload[0].payload.income)}</b></p>
                  <p className="tabular-nums" style={{ color: 'var(--text)' }}>Spent <b>{fmt(payload[0].payload.spent)}</b></p>
                </div>
              ) : null}
            />
            <Line type="monotone" dataKey="income" stroke="var(--income)" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="spent" stroke="var(--expense)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};

// ── 3. What changed, by category ────────────────────────────────────────────
const SHOWN_PER_SIDE = 5;
const MIN_CHANGE = 5; // € a month; smaller moves are noise

const WhatChanged: React.FC<{ trends: Trends; w: Windows }> = ({ trends, w }) => {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (!w.enough) return null;

  const rows = trends.categories.map(c => {
    const usual = avg(slice(c.amounts, w.usual));
    const lately = avg(slice(c.amounts, w.lately));
    return { c, usual, lately, diff: lately - usual };
  }).filter(r => Math.abs(r.diff) >= MIN_CHANGE);
  const more = rows.filter(r => r.diff > 0).sort((a, b) => b.diff - a.diff);
  const less = rows.filter(r => r.diff < 0).sort((a, b) => a.diff - b.diff);
  const net = sum(rows.map(r => r.diff));

  const list = (title: string, items: typeof rows) => items.length > 0 && (
    <div className="mt-3">
      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
      <div className="mt-1">
        {(all ? items : items.slice(0, SHOWN_PER_SIDE)).map(r => (
          <ChangeRow key={r.c.id} r={r} trends={trends} open={open === r.c.id} onToggle={() => setOpen(open === r.c.id ? null : r.c.id)} />
        ))}
      </div>
    </div>
  );

  const hiddenCount = Math.max(0, more.length - SHOWN_PER_SIDE) + Math.max(0, less.length - SHOWN_PER_SIDE);
  return (
    <Section
      title="What changed"
      note={`Monthly spending by category: the last ${LATELY} months against the ${w.usualMonths} before`}
    >
      {rows.length === 0 ? (
        <p className="text-sm mt-3" style={{ color: 'var(--text-2)' }}>No category moved by more than {fmt(MIN_CHANGE)} a month.</p>
      ) : (
        <>
          {list('Spending more on', more)}
          {list('Spending less on', less)}
          {hiddenCount > 0 && (
            <button type="button" onClick={() => setAll(a => !a)} className="h-10 mt-1 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              {all ? 'Show fewer' : `Show ${hiddenCount} more`}
            </button>
          )}
          <p className="text-xs mt-2 tabular-nums" style={{ color: 'var(--muted)' }}>
            Altogether {signed(net)} a month
          </p>
        </>
      )}
    </Section>
  );
};

const ChangeRow: React.FC<{
  r: { c: TrendSeries; usual: number; lately: number; diff: number };
  trends: Trends;
  open: boolean;
  onToggle: () => void;
}> = ({ r, trends, open, onToggle }) => {
  const [sel, setSel] = useState(trends.months.length - 2);
  const up = r.diff > 0;
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 min-h-[48px] py-1.5 text-left">
        <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: `color-mix(in srgb, ${r.c.color} 14%, transparent)` }}>
          {r.c.icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{r.c.name}</span>
          <span className="block text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
            {r.usual < 0.005 ? 'New' : `Usually ${fmt(r.usual)}`} → {fmt(r.lately)}
          </span>
        </span>
        <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: up ? 'var(--expense)' : 'var(--income)' }}>
          {signed(r.diff)}
        </span>
      </button>
      {open && (
        <div className="pb-2">
          <MonthColumns
            months={trends.months}
            values={r.c.amounts}
            selected={sel}
            onSelect={setSel}
            colorFor={() => r.c.color}
            average={r.usual}
            partialMonth={trends.months[trends.months.length - 1]}
            label={`${r.c.name} spending per month`}
          />
          <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
            {monthLong(trends.months[sel])}: <span style={{ color: 'var(--text-2)' }}>{fmt(r.c.amounts[sel] ?? 0)}</span> · the line is your usual
          </p>
        </div>
      )}
    </div>
  );
};

// ── 4. Safety net ───────────────────────────────────────────────────────────
const SafetyNet: React.FC<{ trends: Trends; health: HealthData; w: Windows }> = ({ trends, health, w }) => {
  const range = w.enough ? w.usual : w.lately;
  const usualSpent = avg(slice(trends.expenses, range));
  const usualIncome = avg(slice(trends.income, range));
  const ready = sum(health.accounts.filter(a => ['checking', 'savings', 'cash'].includes(a.type)).map(a => a.balance))
    + sum(health.accounts.filter(a => a.type === 'credit_card').map(a => Math.min(0, a.balance)));
  const cover = usualSpent > 0.005 ? ready / usualSpent : null;

  const item = (icon: React.ReactNode, title: string, value: React.ReactNode, sub: React.ReactNode) => (
    <div className="flex gap-3 py-2.5">
      <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgb(var(--accent-rgb) / 0.1)', color: 'var(--accent)' }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{title}</p>
        <p className="text-base font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>{sub}</p>
      </div>
    </div>
  );

  return (
    <Section title="Safety net">
      <div className="mt-1 divide-y divide-white/5">
        {cover != null && item(
          <ShieldCheck size={18} />,
          'Emergency cover',
          `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(Math.max(0, cover))} months`,
          'How long your cash, current and savings accounts (less card debt) would last at your usual spending. Investments not included.',
        )}
        {item(
          <Repeat size={18} />,
          'Fixed costs',
          health.fixed_monthly > 0.005 ? `${fmt(health.fixed_monthly)} a month` : 'None set up',
          health.fixed_monthly > 0.005
            ? <>{usualIncome > 0.005 && `${pct(health.fixed_monthly / usualIncome)} of your usual income. `}<Link to="/recurring" className="font-semibold" style={{ color: 'var(--accent)' }}>See recurring</Link></>
            : <><Link to="/recurring" className="font-semibold" style={{ color: 'var(--accent)' }}>Add recurring entries</Link> like rent and subscriptions to see them here.</>,
        )}
        {health.still_owed > 0.005 && item(
          <Users size={18} />,
          'Still owed to you',
          fmt(health.still_owed),
          'Paid for others and not paid back yet.',
        )}
      </div>
    </Section>
  );
};
