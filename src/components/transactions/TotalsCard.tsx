import React from 'react';
import { Transaction, TransactionTotals } from '../../types';

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const shortDate = (d: string) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function periodLabel(from: string, to: string) {
  if (from && to) return `${shortDate(from)} – ${shortDate(to)}`;
  if (from) return `Since ${shortDate(from)}`;
  if (to) return `Until ${shortDate(to)}`;
  return 'All time';
}

/** A day's entries added up by kind, each in its own colour, matching the amounts on the rows. */
export function dayPieces(txns: Transaction[]) {
  const sum = (type: Transaction['type']) =>
    txns.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0);
  // A refund not linked to a purchase (or the part beyond what it's linked to) counts as income
  const surplus = txns.reduce((s, t) => s + (t.type === 'refund' ? t.refund_surplus ?? 0 : 0), 0);
  return {
    spent: sum('expense'),
    refunds: sum('refund') - surplus,
    income: sum('income') + surplus,
    transfers: sum('transfer'),
  };
}

/** Day subtotal: spent, back, in and moved, shown only when there is some. */
export const DayTotals: React.FC<{ txns: Transaction[]; className?: string }> = ({ txns, className = '' }) => {
  const p = dayPieces(txns);
  const items = [
    { v: p.spent,     text: `−${fmt(p.spent)}`,     color: 'var(--expense)',  title: 'Spent' },
    { v: p.refunds,   text: `↩ ${fmt(p.refunds)}`,  color: 'var(--refund)',   title: 'Refunded' },
    { v: p.income,    text: `+${fmt(p.income)}`,    color: 'var(--income)',   title: 'Income' },
    { v: p.transfers, text: `⇄ ${fmt(p.transfers)}`, color: 'var(--transfer)', title: 'Moved between accounts' },
  ].filter(i => i.v > 0.005);
  return (
    <span className={`flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5 text-xs font-semibold tabular-nums ${className}`}>
      {items.map(i => (
        <span key={i.title} title={i.title} aria-label={`${i.title} ${fmt(i.v)}`} className="whitespace-nowrap" style={{ color: i.color }}>
          {i.text}
        </span>
      ))}
    </span>
  );
};

/** One coloured amount in the explanation under the totals. */
const Amt: React.FC<{ v: number; color: string }> = ({ v, color }) => (
  <span className="tabular-nums font-semibold whitespace-nowrap" style={{ color }}>{fmt(v)}</span>
);

/** Totals for everything matching the current filters, not just the loaded page. */
export const TotalsCard: React.FC<{
  totals: TransactionTotals | null;
  label: string;
  filtered: boolean;
  onSelect?: () => void;
  /** Filtered to one account: also show what came in and went out of it */
  byAccount?: boolean;
}> = ({ totals, label, filtered, onSelect, byAccount }) => {
  // Refunds and the part spent on others bring spending down, so "Spent" is what it cost me
  const spent = totals ? totals.expenses - totals.refunds : 0;
  const onlyTransfers = totals && totals.count > 0 && totals.count === totals.transfers;
  const some = (v?: number | null) => (v ?? 0) > 0.005;
  const gross = totals ? totals.expenses + totals.for_others : 0;
  const flow = totals && totals.money_in != null && totals.money_out != null && byAccount
    ? { in: totals.money_in, out: totals.money_out }
    : null;

  return (
    <div
      className="rounded-xl mb-4 px-4 py-3"
      style={{ background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs min-w-0 truncate" style={{ color: 'var(--muted)' }}>
          {label}
          {totals && ` · ${totals.count} ${totals.count === 1 ? 'entry' : 'entries'}`}
          {filtered && ' · filtered'}
        </p>
        {onSelect && totals && totals.count > 0 && (
          <button
            type="button"
            onClick={onSelect}
            className="lg:hidden shrink-0 -my-2 px-2 h-9 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            Select
          </button>
        )}
      </div>

      {onlyTransfers ? (
        <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
          Transfers move money between your accounts, so they aren't counted as spending or income.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 mt-1.5">
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>Spent</p>
            <p className="text-lg font-bold tabular-nums truncate" style={{ color: 'var(--expense)' }}>
              {totals ? fmt(spent) : '…'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>Income</p>
            <p className="text-lg font-bold tabular-nums truncate" style={{ color: 'var(--income)' }}>
              {totals ? fmt(totals.income) : '…'}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>Net</p>
            <p
              className="text-lg font-bold tabular-nums truncate"
              style={{ color: !totals ? 'var(--text)' : totals.net >= 0 ? 'var(--income)' : 'var(--expense)' }}
            >
              {totals ? `${totals.net >= 0 ? '+' : '−'}${fmt(Math.abs(totals.net))}` : '…'}
            </p>
          </div>
        </div>
      )}

      {/* How the numbers above were reached; only the lines that apply */}
      {totals && (some(totals.refunds) || some(totals.for_others) || some(totals.paid_back) || (!onlyTransfers && totals.transfers > 0) || flow) && (
        <div className="mt-2.5 pt-2 space-y-1 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--muted)' }}>
          {(some(totals.refunds) || some(totals.for_others)) && (
            <p className="leading-relaxed">
              Spent = <Amt v={gross} color="var(--expense)" /> expenses
              {some(totals.for_others) && <> − <Amt v={totals.for_others} color="var(--text-2)" /> for others</>}
              {some(totals.refunds) && <> − <Amt v={totals.refunds} color="var(--refund)" /> refunded</>}
            </p>
          )}
          {some(totals.paid_back) && (
            <p className="leading-relaxed">
              <Amt v={totals.paid_back} color="var(--text-2)" /> paid back to me, not counted as income
            </p>
          )}
          {!onlyTransfers && totals.transfers > 0 && (
            <p className="leading-relaxed">
              <Amt v={totals.transfer_amount ?? 0} color="var(--transfer)" /> moved in {totals.transfers} {totals.transfers === 1 ? 'transfer' : 'transfers'}, not counted
            </p>
          )}
          {flow && (
            <p className="leading-relaxed">
              This account: <Amt v={flow.in} color="var(--income)" /> in · <Amt v={flow.out} color="var(--expense)" /> out, transfers included
            </p>
          )}
        </div>
      )}
    </div>
  );
};
