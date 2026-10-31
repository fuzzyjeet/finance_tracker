import React from 'react';
import { TransactionTotals } from '../../types';

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

/** Totals for everything matching the current filters, not just the loaded page. */
export const TotalsCard: React.FC<{
  totals: TransactionTotals | null;
  label: string;
  filtered: boolean;
  onSelect?: () => void;
}> = ({ totals, label, filtered, onSelect }) => {
  // Refunds and the part spent on others bring spending down, so "Spent" is what it cost me
  const spent = totals ? totals.expenses - totals.refunds : 0;
  const onlyTransfers = totals && totals.count > 0 && totals.count === totals.transfers;

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
            {totals && totals.refunds > 0.005 && (
              <p className="text-xs tabular-nums truncate" style={{ color: 'var(--refund)' }}>
                after {fmt(totals.refunds)} back
              </p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--faint)' }}>In</p>
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
    </div>
  );
};
