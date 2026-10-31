import React, { useCallback, useEffect, useState } from 'react';
import { format, endOfMonth } from 'date-fns';
import { ChevronDown, ChevronLeft, ArrowRight } from 'lucide-react';
import { transactionsApi } from '../../api/transactions';
import { Health, Trends } from '../../api/stats';
import { Transaction } from '../../types';
import { myShare } from '../../lib/myShare';
import { fmt, toDate, monthLong, cardStyle } from '../charts/MonthColumns';
import { useTransactionEditor } from '../transactions/useTransactionEditor';
import { onDataChanged } from '../../lib/events';

const SAVINGS_TYPES = ['savings', 'investment'];
const shortDate = (iso: string) => format(new Date(iso + 'T00:00:00'), 'd MMM');

type Line = { txn: Transaction; amount: number };
type Group = { key: string; name: string; icon: string; color: string; total: number; lines: Line[] };

/** Splits a month's entries the same way as the "Where the money went" chart. */
function sortMonth(txns: Transaction[], savingsIds: Set<string>) {
  const spent = new Map<string, Group>();
  const moved: Line[] = [];
  const cameIn: Line[] = [];
  const addSpent = (txn: Transaction, cat: Transaction['category'], amount: number) => {
    if (amount < 0.005) return;
    const key = cat?.id ?? 'none';
    if (!spent.has(key)) {
      spent.set(key, { key, name: cat?.name ?? 'Uncategorised', icon: cat?.icon ?? '❓', color: cat?.color ?? '#9ca3af', total: 0, lines: [] });
    }
    const g = spent.get(key)!;
    g.total += amount;
    g.lines.push({ txn, amount });
  };
  for (const t of txns) {
    if (t.type === 'expense') {
      const factor = t.amount > 0 ? myShare(t) / t.amount : 0;
      if (t.splits?.length) t.splits.forEach(s => addSpent(t, s.category, s.amount * factor));
      else addSpent(t, t.category, t.amount * factor);
    } else if (t.type === 'income' && !t.paid_back) {
      cameIn.push({ txn: t, amount: t.amount });
    } else if (t.type === 'refund' && (t.refund_surplus ?? 0) > 0.005) {
      cameIn.push({ txn: t, amount: t.refund_surplus! });
    } else if (t.type === 'transfer') {
      const into = !!t.to_account_id && savingsIds.has(t.to_account_id);
      const out = savingsIds.has(t.account_id);
      if (into !== out) moved.push({ txn: t, amount: into ? t.amount : -t.amount });
    }
  }
  const groups = [...spent.values()].sort((a, b) => b.total - a.total);
  groups.forEach(g => g.lines.sort((a, b) => b.amount - a.amount));
  return { groups, moved, cameIn };
}

/** One month's money inside Health: what came in, what was spent by category, what was saved. */
export const MonthMoney: React.FC<{ month: string; health: Health; trends: Trends; onBack: () => void }> = ({ month, health, trends, onBack }) => {
  const [txns, setTxns] = useState<Transaction[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const editor = useTransactionEditor();

  const load = useCallback(() => {
    transactionsApi.list({
      date_from: `${month}-01`,
      date_to: format(endOfMonth(toDate(month)), 'yyyy-MM-dd'),
      limit: 5000,
    }).then(setTxns).catch(() => setTxns([]));
  }, [month]);
  useEffect(() => { setTxns(null); load(); }, [load]);
  // An entry edited from here updates the lists
  useEffect(() => onDataChanged(load), [load]);

  const i = trends.months.indexOf(month);
  const isPartial = i === trends.months.length - 1;
  const income = i >= 0 ? trends.income[i] : 0;
  const spent = i >= 0 ? trends.expenses[i] : 0;
  const toSavings = Math.max(0, health.moved_to_savings[month] ?? 0);
  const left = income - spent - toSavings;
  const savingsIds = new Set(health.accounts.filter(a => SAVINGS_TYPES.includes(a.type)).map(a => a.id));
  const sorted = txns ? sortMonth(txns, savingsIds) : null;

  const figure = (label: string, value: string, color = 'var(--text)') => (
    <div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-lg font-semibold tabular-nums" style={{ color }}>{value}</p>
    </div>
  );

  const row = ({ txn, amount }: Line, sub: React.ReactNode, sign = '') => (
    <button type="button" key={`${txn.id}-${amount}`} onClick={() => editor.open(txn)} className="w-full flex items-center gap-3 py-2 text-left active:bg-white/5">
      <span className="w-12 text-xs tabular-nums shrink-0" style={{ color: 'var(--muted)' }}>{shortDate(txn.date)}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm truncate" style={{ color: 'var(--text)' }}>{txn.payee || '—'}</span>
        <span className="block text-xs truncate" style={{ color: 'var(--muted)' }}>{sub}</span>
      </span>
      <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--text)' }}>{sign}{fmt(Math.abs(amount))}</span>
    </button>
  );

  const section = (title: string, total: number, children: React.ReactNode, note?: string) => (
    <section className="rounded-xl px-4 py-4" style={cardStyle}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
        <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>{fmt(total)}</span>
      </div>
      {note && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 h-10 -ml-2 pr-3 pl-1 rounded-lg text-sm font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        <ChevronLeft size={20} /> Health
      </button>
      <h1 className="font-headline text-xl md:text-2xl font-bold mt-1" style={{ color: 'var(--text)' }}>
        {monthLong(month)}{isPartial ? ' so far' : ''}
      </h1>
      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--muted)' }}>Where the money went</p>

      <section className="rounded-xl px-4 py-4 grid grid-cols-2 gap-x-3 gap-y-3 mb-4" style={cardStyle}>
        {figure('Came in', fmt(income), 'var(--income)')}
        {figure('Spent', fmt(spent), 'var(--expense)')}
        {figure('Moved to savings', fmt(toSavings))}
        {left >= -0.005
          ? figure('Left in your accounts', fmt(left))
          : figure('More than came in', fmt(-left), 'var(--expense)')}
      </section>

      {!sorted ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {section('Spent', sorted.groups.reduce((s, g) => s + g.total, 0), sorted.groups.length === 0
            ? <p className="text-sm" style={{ color: 'var(--text-2)' }}>Nothing spent.</p>
            : sorted.groups.map(g => {
                const expanded = open === g.key;
                return (
                  <div key={g.key}>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : g.key)}
                      aria-expanded={expanded}
                      className="w-full flex items-center gap-3 min-h-[48px] py-1.5 text-left"
                    >
                      <span className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
                        style={{ background: `color-mix(in srgb, ${g.color} 14%, transparent)` }}>{g.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{g.name}</span>
                        <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                          {g.lines.length} entr{g.lines.length === 1 ? 'y' : 'ies'}
                        </span>
                      </span>
                      <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--text)' }}>{fmt(g.total)}</span>
                      <ChevronDown size={16} className="shrink-0 transition-transform"
                        style={{ color: 'var(--muted)', transform: expanded ? 'rotate(180deg)' : undefined }} />
                    </button>
                    {expanded && (
                      <div className="ml-3 pl-3 mb-2 divide-y divide-white/5" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                        {g.lines.map(l => row(l,
                          Math.abs(l.amount - l.txn.amount) > 0.005
                            ? `Yours of ${fmt(l.txn.amount)}${l.txn.splits?.length ? ' (split)' : ''} · ${l.txn.account_name ?? ''}`
                            : l.txn.account_name ?? ''))}
                      </div>
                    )}
                  </div>
                );
              }),
            'Your share, after refunds and the part for others')}

          <div className="space-y-4">
            {section('Came in', sorted.cameIn.reduce((s, l) => s + l.amount, 0), sorted.cameIn.length === 0
              ? <p className="text-sm" style={{ color: 'var(--text-2)' }}>Nothing came in.</p>
              : <div className="divide-y divide-white/5">
                  {sorted.cameIn.sort((a, b) => b.amount - a.amount).map(l =>
                    row(l, l.txn.type === 'refund' ? 'Refund not linked to an expense' : [l.txn.category?.name, l.txn.account_name].filter(Boolean).join(' · '), '+'))}
                </div>,
              'Money paid back to you is left out')}

            {sorted.moved.length > 0 && section('Moved to savings', sorted.moved.reduce((s, l) => s + l.amount, 0),
              <div className="divide-y divide-white/5">
                {sorted.moved.map(l => row(l,
                  <span className="inline-flex items-center gap-1">{l.txn.account_name} <ArrowRight size={11} /> {l.txn.to_account_name}</span>,
                  l.amount < 0 ? '−' : ''))}
              </div>)}
          </div>
        </div>
      )}
      {editor.element}
    </div>
  );
};
