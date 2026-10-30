import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search, Undo2, X } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { transactionsApi } from '../../api/transactions';
import { Account, Category, Transaction } from '../../types';

type Period = '30d' | '90d' | 'year' | 'all' | 'custom';

const PERIODS: { value: Period; label: string }[] = [
  { value: '30d',    label: '30 days' },
  { value: '90d',    label: '90 days' },
  { value: 'year',   label: 'This year' },
  { value: 'all',    label: 'All time' },
  { value: 'custom', label: 'Custom' },
];

const iso = (d: Date) => d.toISOString().split('T')[0];
const fmt = (v: number) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const fmtDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function periodRange(p: Period, from: string, to: string): { date_from?: string; date_to?: string } {
  const now = new Date();
  if (p === '30d')  return { date_from: iso(new Date(now.getTime() - 30 * 86400000)) };
  if (p === '90d')  return { date_from: iso(new Date(now.getTime() - 90 * 86400000)) };
  if (p === 'year') return { date_from: `${now.getFullYear()}-01-01` };
  if (p === 'custom') return { date_from: from || undefined, date_to: to || undefined };
  return {};
}

export const remainingRefundable = (t: Transaction) => Math.max(0, t.amount - (t.refunded_amount ?? 0));

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (txns: Transaction[]) => void;
  excludeIds: string[];
  accounts: Account[];
  categories: Category[];
}

export const RefundLinkPicker: React.FC<Props> = ({ isOpen, onClose, onConfirm, excludeIds, accounts, categories }) => {
  const [search, setSearch]           = useState('');
  const [debounced, setDebounced]     = useState('');
  const [accountId, setAccountId]     = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [period, setPeriod]           = useState<Period>('90d');
  const [customFrom, setCustomFrom]   = useState('');
  const [customTo, setCustomTo]       = useState('');
  const [hideRefunded, setHideRefunded] = useState(true);
  const [results, setResults]         = useState<Transaction[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selected, setSelected]       = useState<Map<string, Transaction>>(new Map());

  useEffect(() => {
    if (isOpen) setSelected(new Map());
  }, [isOpen]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    transactionsApi.list({
      type: 'expense',
      account_id: accountId || undefined,
      category_id: categoryId || undefined,
      search: debounced || undefined,
      ...periodRange(period, customFrom, customTo),
      limit: 500,
    })
      .then(txns => { if (!cancelled) setResults(txns); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, accountId, categoryId, debounced, period, customFrom, customTo]);

  const visible = useMemo(() => results.filter(t =>
    !excludeIds.includes(t.id) && (!hideRefunded || remainingRefundable(t) > 0.005)
  ), [results, excludeIds, hideRefunded]);

  if (!isOpen) return null;

  const toggle = (t: Transaction) => setSelected(prev => {
    const next = new Map(prev);
    next.has(t.id) ? next.delete(t.id) : next.set(t.id, t);
    return next;
  });

  const allVisibleSelected = visible.length > 0 && visible.every(t => selected.has(t.id));
  const toggleAll = () => setSelected(prev => {
    const next = new Map(prev);
    if (allVisibleSelected) visible.forEach(t => next.delete(t.id));
    else visible.forEach(t => next.set(t.id, t));
    return next;
  });

  const selectedList = [...selected.values()];
  const selectedSum = selectedList.reduce((s, t) => s + remainingRefundable(t), 0);
  const filtersActive = !!(search || accountId || categoryId || period !== '90d');

  const fieldStyle = { background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)' };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        style={{ background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-on-surface" style={{ letterSpacing: '-0.02em' }}>Link transactions</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Select the expenses this refund covers</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: 'var(--muted)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 pb-3 space-y-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search payee…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none"
              style={{ ...fieldStyle, color: 'var(--text)' }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <CustomSelect
              value={accountId}
              onChange={setAccountId}
              options={[{ value: '', label: 'All accounts' }, ...accounts.map(a => ({ value: a.id, label: a.name }))]}
            />
            <CustomSelect
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: '', label: 'All categories' },
                ...categories.filter(c => c.type !== 'income').map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })),
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PERIODS.map(p => {
              const active = period === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: active ? 'rgb(var(--refund-rgb) / 0.15)' : 'transparent',
                    color: active ? 'var(--refund)' : 'var(--muted)',
                    border: `1px solid ${active ? 'rgb(var(--refund-rgb) / 0.4)' : 'rgba(255,255,255,0.07)'}`,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
            <label className="ml-auto flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: 'var(--muted)' }}>
              <input
                type="checkbox"
                checked={hideRefunded}
                onChange={e => setHideRefunded(e.target.checked)}
                className="accent-[var(--refund)]"
              />
              Hide fully refunded
            </label>
          </div>
          {period === 'custom' && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 w-fit" style={fieldStyle}>
              <input
                type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-transparent text-sm outline-none" style={{ color: 'var(--text)', colorScheme: 'dark' }}
              />
              <span style={{ color: 'var(--faint-2)' }}>–</span>
              <input
                type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-transparent text-sm outline-none" style={{ color: 'var(--text)', colorScheme: 'dark' }}
              />
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-6 h-6 border-[3px] border-[var(--refund)] border-t-transparent rounded-full" />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--faint)' }}>
              No matching expenses{filtersActive ? ' — try widening the filters' : ''}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleAll}
                className="w-full flex items-center gap-3 px-5 py-2 text-xs hover:bg-white/[0.02]"
                style={{ color: 'var(--muted)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <CheckBox checked={allVisibleSelected} />
                {allVisibleSelected ? 'Deselect all' : `Select all ${visible.length}`}
              </button>
              {visible.map(t => {
                const isSel = selected.has(t.id);
                const remaining = remainingRefundable(t);
                const partly = (t.refunded_amount ?? 0) > 0;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t)}
                    className="w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors"
                    style={{
                      background: isSel ? 'rgb(var(--refund-rgb) / 0.07)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <CheckBox checked={isSel} />
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(255,255,255,0.04)' }}>
                      {t.category?.icon ?? (t.splits?.length ? '✂️' : '·')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{t.payee || '—'}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                        {fmtDate(t.date)} · {t.account_name}
                        {t.category ? ` · ${t.category.name}` : t.splits?.length ? ` · ${t.splits.length} splits` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--expense)' }}>−{fmt(t.amount)}</p>
                      {partly && (
                        <p className="text-xs flex items-center justify-end gap-0.5" style={{ color: 'var(--refund)' }}>
                          <Undo2 size={9} /> {fmt(remaining)} left
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: selectedList.length ? 'var(--text)' : 'var(--faint)' }}>
              {selectedList.length} selected
            </p>
            {selectedList.length > 0 && (
              <p className="text-xs" style={{ color: 'var(--refund)' }}>{fmt(selectedSum)} refundable</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-2)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedList.length === 0}
            onClick={() => { onConfirm(selectedList); onClose(); }}
            className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--refund)', color: '#2e1065' }}
          >
            Link {selectedList.length || ''}
          </button>
        </div>
      </div>
    </div>
  );
};

const CheckBox: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
    style={{
      background: checked ? 'var(--refund)' : 'transparent',
      border: `1.5px solid ${checked ? 'var(--refund)' : 'rgba(255,255,255,0.2)'}`,
    }}
  >
    {checked && <Check size={11} strokeWidth={3} style={{ color: '#2e1065' }} />}
  </span>
);
