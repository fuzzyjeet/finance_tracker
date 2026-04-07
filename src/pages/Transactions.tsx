import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ChevronDown, X,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { transactionsApi } from '../api/transactions';
import { accountsApi } from '../api/accounts';
import { categoriesApi } from '../api/categories';
import { Account, Category, Transaction } from '../types';

const PAGE_SIZE = 20;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(v);

function formatDateLabel(dateStr: string) {
  const today = new Date().toISOString().split('T')[0];
  const d = new Date(dateStr + 'T00:00:00');
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Split categories cell ──────────────────────────────────
const INLINE_LIMIT = 3;

function SplitCategoriesCell({
  txn,
  isExpanded,
  onToggle,
}: {
  txn: Transaction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const splits = txn.splits ?? [];
  const count = splits.length;

  // All categories visible — no expand needed
  if (count <= INLINE_LIMIT) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {splits.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {s.category ? (
              <>
                <span>{s.category.icon}</span>
                <span style={{ color: '#bdc8d1' }}>{s.category.name}</span>
              </>
            ) : (
              <span style={{ color: '#4b5563' }}>—</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  // Many splits → icon stack + count
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <div className="flex -space-x-1.5">
        {splits.slice(0, 4).map((s, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px]"
            style={{ background: '#222a3d', border: '1px solid rgba(255,255,255,0.08)', zIndex: 4 - i }}
          >
            {s.category?.icon ?? '·'}
          </div>
        ))}
        {count > 4 && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: '#222a3d', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}
          >
            +{count - 4}
          </div>
        )}
      </div>
      <span className="text-xs" style={{ color: '#6b7280' }}>{count} splits</span>
      <ChevronDown
        size={11}
        style={{ color: '#6b7280', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
      />
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────
export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [offset, setOffset]             = useState(0);
  const [hasMore, setHasMore]           = useState(true);

  const location = useLocation();
  const _initParams = new URLSearchParams(location.search);

  // Filters
  const [filterAccount, setFilterAccount]   = useState(_initParams.get('account_id') ?? '');
  const [filterCategory, setFilterCategory] = useState(_initParams.get('category_id') ?? '');
  const [filterType, setFilterType]         = useState('');
  const [filterFrom, setFilterFrom]         = useState('');
  const [filterTo, setFilterTo]             = useState('');
  const [filterSearch, setFilterSearch]     = useState('');

  // Modal
  const [modalOpen, setModalOpen]           = useState(false);
  const [editing, setEditing]               = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<string | null>(null);
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());

  const toggleSplits = (id: string) =>
    setExpandedSplits(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const loadRefs = async () => {
    const [accts, cats] = await Promise.all([accountsApi.list(), categoriesApi.list()]);
    setAccounts(accts);
    setCategories(cats);
  };

  const load = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const txns = await transactionsApi.list({
        account_id:  filterAccount  || undefined,
        category_id: filterCategory || undefined,
        type:        filterType     || undefined,
        date_from:   filterFrom     || undefined,
        date_to:     filterTo       || undefined,
        search:      filterSearch   || undefined,
        limit:  PAGE_SIZE,
        offset: newOffset,
      });
      setTransactions(txns);
      setHasMore(txns.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [filterAccount, filterCategory, filterType, filterFrom, filterTo, filterSearch]);

  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { setOffset(0); load(0); }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (txn: Transaction) => { setEditing(txn); setModalOpen(true); };

  const handleSaved = async () => { await load(offset); await loadRefs(); };

  const handleDelete = async (id: string) => {
    await transactionsApi.delete(id);
    setDeleteConfirm(null);
    await load(offset);
    await loadRefs();
  };

  const prevPage = () => { const n = Math.max(0, offset - PAGE_SIZE); setOffset(n); load(n); };
  const nextPage = () => { const n = offset + PAGE_SIZE; setOffset(n); load(n); };

  const clearFilters = () => {
    setFilterAccount(''); setFilterCategory(''); setFilterType('');
    setFilterFrom(''); setFilterTo(''); setFilterSearch('');
  };

  const activeFilterCount = [filterAccount, filterCategory, filterType, filterFrom, filterTo, filterSearch]
    .filter(Boolean).length;

  // ── Group transactions by date ────────────────────────────
  type DateGroup = { date: string; txns: Transaction[] };
  const dateGroups: DateGroup[] = transactions.reduce<DateGroup[]>((acc, txn) => {
    const last = acc[acc.length - 1];
    if (last && last.date === txn.date) {
      last.txns.push(txn);
    } else {
      acc.push({ date: txn.date, txns: [txn] });
    }
    return acc;
  }, []);

  // ── Shared styles ─────────────────────────────────────────
  const inputCls = [
    'text-sm border rounded-lg px-3 py-2 outline-none transition-colors',
    'bg-[#171f33] text-[#dae2fd] placeholder-slate-500',
    'border-white/8 focus:border-white/20 focus:ring-1 focus:ring-[#8ed5ff]/30',
  ].join(' ');

  const TYPE_OPTS = [
    { value: '',         label: 'All' },
    { value: 'income',   label: 'Income',   color: '#4edea3' },
    { value: 'expense',  label: 'Expense',  color: '#ffb4ab' },
    { value: 'transfer', label: 'Transfer', color: '#8ed5ff' },
  ];

  return (
    <div>
      <Header
        title="Transactions"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Transaction</Button>}
      />

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div
        className="rounded-xl mb-4 p-3"
        style={{ background: '#0f1829', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Row 1: search + account + category */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#6b7280' }} />
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search payee…"
              className={`w-full pl-8 pr-3 ${inputCls}`}
            />
          </div>

          {/* Account */}
          <CustomSelect
            value={filterAccount}
            onChange={setFilterAccount}
            options={[
              { value: '', label: 'All Accounts' },
              ...accounts.map(a => ({ value: a.id, label: a.name })),
            ]}
            className="min-w-[130px]"
          />

          {/* Category */}
          <CustomSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })),
            ]}
            className="min-w-[140px]"
          />

          {/* Date range */}
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ background: '#171f33', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="bg-transparent text-sm outline-none w-[118px]"
              style={{ color: filterFrom ? '#dae2fd' : '#4b5563', colorScheme: 'dark' }}
              title="From"
            />
            <span style={{ color: '#374151' }}>–</span>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="bg-transparent text-sm outline-none w-[118px]"
              style={{ color: filterTo ? '#dae2fd' : '#4b5563', colorScheme: 'dark' }}
              title="To"
            />
          </div>

          {/* Clear button */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ color: '#ffb4ab', background: 'rgba(255,180,171,0.08)', border: '1px solid rgba(255,180,171,0.2)' }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* Row 2: type toggle pills */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <span className="text-[10px] uppercase tracking-widest mr-1" style={{ color: '#4b5563' }}>Type</span>
          {TYPE_OPTS.map(opt => {
            const active = filterType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterType(opt.value)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: active
                    ? (opt.color ? `${opt.color}22` : 'rgba(255,255,255,0.1)')
                    : 'transparent',
                  color: active
                    ? (opt.color ?? '#dae2fd')
                    : '#4b5563',
                  border: `1px solid ${active ? (opt.color ? `${opt.color}44` : 'rgba(255,255,255,0.2)') : 'transparent'}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
          {activeFilterCount > 0 && (
            <span
              className="ml-auto text-[10px] uppercase tracking-widest"
              style={{ color: '#4b5563' }}
            >
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </span>
          )}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: '#0f1829', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-4 border-[#8ed5ff] border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: '#4b5563' }}>No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  {['#', 'Payee', 'Category', 'Account', 'Tags', 'Amount', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i === 5 ? 'text-right' : 'text-left'}`}
                      style={{ color: '#4b5563' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dateGroups.map(group => {
                  const income   = group.txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
                  const expenses = group.txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                  const net      = income - expenses;

                  return (
                    <React.Fragment key={group.date}>
                      {/* ── Date separator row ── */}
                      <tr style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td colSpan={4} className="px-4 py-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: '#6b7280' }}>
                            {formatDateLabel(group.date)}
                          </span>
                        </td>
                        <td colSpan={3} className="px-4 py-1.5">
                          <div className="flex items-center justify-end gap-3">
                            {income > 0 && (
                              <span className="text-[11px] font-semibold" style={{ color: '#4edea3' }}>
                                +{formatCurrency(income)}
                              </span>
                            )}
                            {expenses > 0 && (
                              <span className="text-[11px] font-semibold" style={{ color: '#ffb4ab' }}>
                                −{formatCurrency(expenses)}
                              </span>
                            )}
                            {(income > 0 || expenses > 0) && (
                              <span
                                className="text-[11px] font-semibold pl-2"
                                style={{
                                  color: net >= 0 ? '#4edea3' : '#ffb4ab',
                                  borderLeft: '1px solid rgba(255,255,255,0.06)',
                                }}
                              >
                                {net >= 0 ? '+' : ''}{formatCurrency(net)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Transactions for this date ── */}
                      {group.txns.map((txn, txnIdx) => {
                        const hasSplits = txn.splits && txn.splits.length > 0;
                        const isExpanded = expandedSplits.has(txn.id);
                        return (
                          <React.Fragment key={txn.id}>
                            <tr
                              className="transition-colors"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              {/* Day index */}
                              <td className="px-4 py-3 whitespace-nowrap text-center w-10">
                                <span
                                  className="text-xs font-semibold tabular-nums"
                                  style={{ color: '#374151' }}
                                >
                                  {txnIdx + 1}
                                </span>
                                {txn.billing_date && (
                                  <div className="text-[10px] mt-0.5" style={{ color: '#4b5563' }}>📅</div>
                                )}
                              </td>

                              {/* Payee */}
                              <td className="px-4 py-3">
                                <div className="font-medium" style={{ color: '#dae2fd' }}>{txn.payee}</div>
                                {txn.notes && (
                                  <div className="text-xs truncate max-w-[180px]" style={{ color: '#4b5563' }}>{txn.notes}</div>
                                )}
                              </td>

                              {/* Category / Splits */}
                              <td className="px-4 py-3">
                                {hasSplits ? (
                                  <SplitCategoriesCell
                                    txn={txn}
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleSplits(txn.id)}
                                  />
                                ) : txn.category ? (
                                  <span className="inline-flex items-center gap-1.5 text-sm">
                                    <span>{txn.category.icon}</span>
                                    <span style={{ color: '#bdc8d1' }}>{txn.category.name}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: '#4b5563' }}>—</span>
                                )}
                              </td>

                              {/* Account */}
                              <td className="px-4 py-3">
                                <div style={{ color: '#bdc8d1' }}>{txn.account_name}</div>
                                {txn.to_account_name && (
                                  <div className="text-xs" style={{ color: '#4b5563' }}>→ {txn.to_account_name}</div>
                                )}
                              </td>

                              {/* Tags */}
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {txn.tags?.map(tag => (
                                    <Badge key={tag.id} color={tag.color}>{tag.name}</Badge>
                                  ))}
                                </div>
                              </td>

                              {/* Amount */}
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div
                                  className="flex items-center justify-end gap-1 font-bold"
                                  style={{
                                    color: txn.type === 'income'   ? '#4edea3'
                                         : txn.type === 'expense'  ? '#ffb4ab'
                                         : '#8ed5ff',
                                  }}
                                >
                                  {txn.type === 'income'   ? <ArrowDownLeft size={14}  /> :
                                   txn.type === 'expense'  ? <ArrowUpRight size={14}   /> :
                                                             <ArrowLeftRight size={14} />}
                                  {txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : ''}
                                  {formatCurrency(txn.amount)}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEdit(txn)}
                                    className="p-1 rounded transition-colors"
                                    style={{ color: '#4b5563' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#dae2fd'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4b5563'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(txn.id)}
                                    className="p-1 rounded transition-colors"
                                    style={{ color: '#4b5563' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ffb4ab'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,180,171,0.1)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#4b5563'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded splits detail */}
                            {hasSplits && isExpanded && (
                              <tr style={{ background: 'rgba(142,213,255,0.03)', borderBottom: '1px solid rgba(142,213,255,0.08)' }}>
                                <td />
                                <td colSpan={4} className="px-4 py-2.5">
                                  <div className="space-y-1.5">
                                    {txn.splits!.map((split, si) => (
                                      <div key={si} className="flex items-center gap-3 text-xs" style={{ color: '#bdc8d1' }}>
                                        <span style={{ color: '#4b5563' }}>↳</span>
                                        {split.category ? (
                                          <span className="flex items-center gap-1">
                                            <span>{split.category.icon}</span>
                                            <span className="font-medium">{split.category.name}</span>
                                          </span>
                                        ) : (
                                          <span className="italic" style={{ color: '#4b5563' }}>No category</span>
                                        )}
                                        {split.notes && <span style={{ color: '#4b5563' }}>· {split.notes}</span>}
                                        <span className="ml-auto font-semibold" style={{ color: '#ffb4ab' }}>
                                          {formatCurrency(split.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td />
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}
        >
          <span className="text-xs uppercase tracking-widest" style={{ color: '#4b5563' }}>
            Showing {offset + 1}–{offset + transactions.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevPage} disabled={offset === 0}>
              <ChevronLeft size={16} /> Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={nextPage} disabled={!hasMore}>
              Next <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        editing={editing}
      />

      {/* Delete confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Transaction"
        size="sm"
      >
        <p className="text-sm text-on-surface-variant mb-4">
          Are you sure you want to delete this transaction?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
};
