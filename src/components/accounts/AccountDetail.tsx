import React, { useCallback, useEffect, useState } from 'react';
import { format, endOfMonth, addMonths, parse } from 'date-fns';
import { ChevronLeft, ChevronRight, Pencil, Plus, ArrowLeftRight } from 'lucide-react';
import { transactionsApi } from '../../api/transactions';
import { Transaction, Account } from '../../types';
import { useTransactionEditor } from '../transactions/useTransactionEditor';
import { AccountIcon, formatAmount, typeLabel } from '../../pages/Accounts';
import { onDataChanged, emitDataChanged } from '../../lib/events';
import { TransactionFormModal } from '../transactions/TransactionFormModal';
import { localISODate } from '../../lib/dates';
import { usePayeeLogos } from '../../lib/payeeLogos';

const cardStyle = { background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' };
const toDate = (m: string) => parse(m, 'yyyy-MM', new Date());

/** How an entry changed this account's balance. */
function effect(t: Transaction, accountId: string) {
  if (t.type === 'transfer') return t.to_account_id === accountId ? t.amount : -t.amount;
  return t.type === 'expense' ? -t.amount : t.amount;
}

/** What came in and went out of the account, by kind. */
function flows(list: Transaction[], accountId: string) {
  const f = { income: 0, refunds: 0, transfersIn: 0, spent: 0, transfersOut: 0 };
  for (const t of list) {
    if (t.type === 'transfer') {
      if (t.to_account_id === accountId) f.transfersIn += t.amount; else f.transfersOut += t.amount;
    } else if (t.type === 'expense') f.spent += t.amount;
    else if (t.type === 'refund') {
      // The unlinked part of a refund counts as income, as in the Transactions totals
      const surplus = t.refund_surplus ?? 0;
      f.refunds += t.amount - surplus;
      f.income += surplus;
    }
    else f.income += t.amount;
  }
  return { ...f, in: f.income + f.refunds + f.transfersIn, out: f.spent + f.transfersOut };
}

/** One account inside the Accounts page: balance, sub-accounts and its entries month by month. */
export const AccountDetail: React.FC<{
  account: Account;
  accounts: Account[];
  backLabel: string;
  onBack: () => void;
  onOpen: (id: string) => void;
  onEdit: () => void;
  onAddSub: () => void;
}> = ({ account, accounts, backLabel, onBack, onOpen, onEdit, onAddSub }) => {
  const [month, setMonth] = useState(() => localISODate().slice(0, 7));
  const [txns, setTxns] = useState<Transaction[] | null>(null);
  const editor = useTransactionEditor();
  const [adding, setAdding] = useState(false);
  const logoFor = usePayeeLogos();

  // A different account starts on this month again
  useEffect(() => { setMonth(localISODate().slice(0, 7)); }, [account.id]);

  const load = useCallback(async () => {
    setTxns(null);
    const list = await transactionsApi.list({
      account_id: account.id,
      date_from: `${month}-01`,
      date_to: format(endOfMonth(toDate(month)), 'yyyy-MM-dd'),
      limit: 5000,
    }).catch(() => []);
    setTxns(list);
  }, [account.id, month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onDataChanged(load), [load]);

  const parent = account.parent_id ? accounts.find(a => a.id === account.parent_id) : undefined;
  const children = accounts.filter(a => a.parent_id === account.id);
  const total = account.balance + children.reduce((s, c) => s + c.balance, 0);
  const money = (v: number) => formatAmount(v, account.currency);
  const thisMonth = localISODate().slice(0, 7);
  const shift = (n: number) => setMonth(m => format(addMonths(toDate(m), n), 'yyyy-MM'));

  const flow = flows(txns ?? [], account.id);
  const change = flow.in - flow.out;
  // The parts behind In and Out, only those there are; one part alone just says what it is
  const breakdown = (parts: [string, number][]) => {
    const some = parts.filter(([, v]) => v > 0.005);
    return some.map(([label, v]) => (
      <p key={label} className="text-xs tabular-nums truncate" style={{ color: 'var(--muted)' }}>
        {label}{some.length > 1 && ` ${money(v)}`}
      </p>
    ));
  };
  const days = new Map<string, Transaction[]>();
  for (const t of txns ?? []) days.set(t.date, [...(days.get(t.date) ?? []), t]);

  return (
    // Room at the bottom so the + button doesn't cover the last entry
    <div className="pb-20 lg:pb-0">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 h-10 -ml-2 pr-3 pl-1 rounded-lg text-sm font-semibold"
        style={{ color: 'var(--accent)' }}
      >
        <ChevronLeft size={20} /> {backLabel}
      </button>

      <section className="rounded-xl px-4 py-4 mt-1" style={cardStyle}>
        <div className="flex items-start gap-3">
          <AccountIcon account={account} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="font-headline text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{account.name}</h1>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {typeLabel(account.type)} · {account.currency}
              {account.is_active === false && ' · Inactive'}
            </p>
          </div>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit account"
            className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center rounded-lg shrink-0"
            style={{ color: 'var(--muted)' }}
          >
            <Pencil size={18} />
          </button>
        </div>
        <p className="text-3xl font-bold tabular-nums mt-3" style={{ color: total < 0 ? 'var(--expense)' : 'var(--text)' }}>{money(total)}</p>
        {children.length > 0 && (
          <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'var(--text-2)' }}>
            {money(account.balance)} not in sub-accounts
          </p>
        )}
        {parent && (
          <button type="button" onClick={() => onOpen(parent.id)} className="text-xs mt-1 h-8 font-semibold" style={{ color: 'var(--accent)' }}>
            Part of {parent.name} ›
          </button>
        )}

        {!parent && (
          <div className="mt-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {children.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpen(c.id)}
                className="w-full flex items-center gap-3 min-h-[44px] text-left"
                style={{ opacity: c.is_active === false ? 0.6 : 1 }}
              >
                <AccountIcon account={c} size="sm" />
                <span className="flex-1 min-w-0 text-sm truncate" style={{ color: 'var(--text)' }}>
                  {c.name}{c.is_active === false ? ' (inactive)' : ''}
                </span>
                <span className="text-sm tabular-nums" style={{ color: c.balance < 0 ? 'var(--expense)' : 'var(--text)' }}>{money(c.balance)}</span>
                <ChevronRight size={16} style={{ color: 'var(--faint)' }} />
              </button>
            ))}
            <button type="button" onClick={onAddSub} className="flex items-center gap-1.5 h-10 text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              <Plus size={16} /> Sub-account
            </button>
          </div>
        )}
      </section>

      {/* Entries, one calendar month at a time */}
      <section className="rounded-xl mt-4 overflow-hidden" style={cardStyle}>
        <div className="flex items-center justify-between px-2 py-2">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ color: 'var(--text-2)' }}>
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={() => setMonth(thisMonth)} className="text-[15px] font-semibold h-10 px-2" style={{ color: 'var(--text)' }}>
            {format(toDate(month), 'MMMM yyyy')}
          </button>
          <button type="button" onClick={() => shift(1)} disabled={month >= thisMonth} aria-label="Next month"
            className="w-10 h-10 flex items-center justify-center rounded-lg disabled:opacity-30" style={{ color: 'var(--text-2)' }}>
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 px-4 pb-3">
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>In</p>
            <p className="text-base font-semibold tabular-nums truncate" style={{ color: 'var(--income)' }}>+{money(flow.in)}</p>
            {txns && breakdown([['Income', flow.income], ['Refunds', flow.refunds], ['Transfers in', flow.transfersIn]])}
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Out</p>
            <p className="text-base font-semibold tabular-nums truncate" style={{ color: 'var(--expense)' }}>−{money(flow.out)}</p>
            {txns && breakdown([['Spent', flow.spent], ['Transfers out', flow.transfersOut]])}
          </div>
        </div>
        {txns && txns.length > 0 && (
          <p className="flex items-center justify-between px-4 pb-3 -mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            <span>Balance change</span>
            <span className="font-semibold tabular-nums" style={{ color: change >= 0 ? 'var(--income)' : 'var(--expense)' }}>
              {change >= 0 ? '+' : '−'}{money(Math.abs(change))}
            </span>
          </p>
        )}

        {!txns ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-7 h-7 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : txns.length === 0 ? (
          <p className="px-4 pb-4 text-sm" style={{ color: 'var(--text-2)' }}>No entries this month.</p>
        ) : (
          [...days.entries()].map(([date, list]) => (
            <div key={date}>
              {(() => {
                const d = flows(list, account.id);
                return (
                  <div className="flex items-center justify-between gap-3 px-4 py-1.5 text-xs font-semibold" style={{ color: 'var(--muted)', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <span>{format(new Date(date + 'T00:00:00'), 'EEE d MMM')}</span>
                    <span className="flex gap-2.5 tabular-nums">
                      {d.in > 0.005 && <span style={{ color: 'var(--income)' }}>+{money(d.in)}</span>}
                      {d.out > 0.005 && <span style={{ color: 'var(--expense)' }}>−{money(d.out)}</span>}
                    </span>
                  </div>
                );
              })()}
              {list.map(t => {
                const v = effect(t, account.id);
                const logo = t.type === 'transfer' ? null : logoFor(t.payee);
                const other = t.type === 'transfer'
                  ? (t.to_account_id === account.id ? `From ${t.account_name}` : `To ${t.to_account_name ?? ''}`)
                  : t.splits?.length ? `${t.splits.length} splits` : t.category?.name ?? 'No category';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => editor.open(t)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left active:bg-white/5"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 overflow-hidden"
                      style={{ background: logo ? 'var(--text)' : t.category ? `color-mix(in srgb, ${t.category.color} 14%, transparent)` : 'rgba(255,255,255,0.05)' }}>
                      {t.type === 'transfer' ? <ArrowLeftRight size={14} style={{ color: 'var(--transfer)' }} />
                        : logo ? <img src={logo} alt="" className="w-full h-full object-contain p-[2px]" loading="lazy" />
                        : t.category?.icon ?? '💸'}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{t.payee || '—'}</span>
                      <span className="block text-xs truncate" style={{ color: 'var(--muted)' }}>{other}{t.notes ? ` · ${t.notes}` : ''}</span>
                    </span>
                    <span className="text-sm font-semibold tabular-nums shrink-0"
                      style={{ color: t.type === 'transfer' ? 'var(--transfer)' : v < 0 ? 'var(--expense)' : 'var(--income)' }}>
                      {v < 0 ? '−' : '+'}{money(Math.abs(v))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </section>

      {/* Add an entry straight to this account */}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="fixed fab-position w-14 h-14 bg-primary-container text-on-primary-container rounded-2xl shadow-lg flex items-center justify-center transition-all hover:brightness-110 active:scale-95 z-40"
        title={`Add transaction to ${account.name}`}
        aria-label={`Add transaction to ${account.name}`}
      >
        <Plus size={24} />
      </button>
      <TransactionFormModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        onSaved={emitDataChanged}
        defaultAccountId={account.id}
      />

      {editor.element}
    </div>
  );
};
