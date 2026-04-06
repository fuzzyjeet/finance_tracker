import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { transactionsApi } from '../api/transactions';
import { accountsApi } from '../api/accounts';
import { categoriesApi } from '../api/categories';
import { Account, Category, Transaction } from '../types';

const PAGE_SIZE = 20;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(v);

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Read initial filter values from URL search params (set by tile navigation)
  const location = useLocation();
  const _initParams = new URLSearchParams(location.search);

  // Filters
  const [filterAccount, setFilterAccount] = useState(_initParams.get('account_id') ?? '');
  const [filterCategory, setFilterCategory] = useState(_initParams.get('category_id') ?? '');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
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
        account_id: filterAccount || undefined,
        category_id: filterCategory || undefined,
        type: filterType || undefined,
        date_from: filterFrom || undefined,
        date_to: filterTo || undefined,
        search: filterSearch || undefined,
        limit: PAGE_SIZE,
        offset: newOffset,
      });
      setTransactions(txns);
      setHasMore(txns.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [filterAccount, filterCategory, filterType, filterFrom, filterTo, filterSearch]);

  useEffect(() => {
    loadRefs();
  }, []);

  useEffect(() => {
    setOffset(0);
    load(0);
  }, [load]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (txn: Transaction) => { setEditing(txn); setModalOpen(true); };

  const handleSaved = async () => {
    await load(offset);
    await loadRefs();
  };

  const handleDelete = async (id: string) => {
    await transactionsApi.delete(id);
    setDeleteConfirm(null);
    await load(offset);
    await loadRefs();
  };

  const prevPage = () => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    load(newOffset);
  };

  const nextPage = () => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    load(newOffset);
  };

  const inputCls = "text-sm border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50 bg-surface-container-highest text-on-surface placeholder-slate-500";

  return (
    <div>
      <Header
        title="Transactions"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Transaction</Button>}
      />

      {/* Filters */}
      <div className="bg-surface-container-low rounded-xl border border-white/5 p-4 mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search payee..."
              className={`w-full pl-9 pr-3 ${inputCls}`}
            />
          </div>
          <select
            value={filterAccount}
            onChange={e => setFilterAccount(e.target.value)}
            className={inputCls}
          >
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className={inputCls}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className={inputCls}
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className={`flex-1 ${inputCls}`}
              title="From date"
            />
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className={`flex-1 ${inputCls}`}
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-xl border border-white/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 bg-white/5">
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Payee</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Category</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Account</th>
                  <th className="text-left px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Tags</th>
                  <th className="text-right px-4 py-3 text-[10px] font-medium text-slate-500 uppercase tracking-widest">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map(txn => {
                  const hasSplits = txn.splits && txn.splits.length > 0;
                  const isExpanded = expandedSplits.has(txn.id);
                  return (
                  <React.Fragment key={txn.id}>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                      <div>{txn.date}</div>
                      {txn.billing_date && (
                        <div className="text-xs text-slate-500">Bill: {txn.billing_date}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-on-surface">{txn.payee}</div>
                      {txn.notes && <div className="text-xs text-slate-500 truncate max-w-[200px]">{txn.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {hasSplits ? (
                        <button
                          onClick={() => toggleSplits(txn.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          {txn.splits!.length} splits
                        </button>
                      ) : txn.category ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span>{txn.category.icon}</span>
                          <span className="text-on-surface-variant">{txn.category.name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-on-surface-variant">{txn.account_name}</div>
                      {txn.to_account_name && (
                        <div className="text-xs text-slate-500">→ {txn.to_account_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {txn.tags?.map(tag => (
                          <Badge key={tag.id} color={tag.color}>{tag.name}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className={`flex items-center justify-end gap-1 font-headline font-bold ${
                        txn.type === 'income' ? 'text-secondary' :
                        txn.type === 'expense' ? 'text-error' : 'text-primary'
                      }`}>
                        {txn.type === 'income' ? <ArrowDownLeft size={14} /> :
                         txn.type === 'expense' ? <ArrowUpRight size={14} /> :
                         <ArrowLeftRight size={14} />}
                        {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                        {formatCurrency(txn.amount)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(txn)}
                          className="p-1 text-slate-500 hover:text-on-surface hover:bg-white/10 rounded transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(txn.id)}
                          className="p-1 text-slate-500 hover:text-error hover:bg-error/10 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded splits row */}
                  {hasSplits && isExpanded && (
                    <tr className="bg-primary/5 border-b border-primary/10">
                      <td />
                      <td colSpan={4} className="px-4 py-2">
                        <div className="space-y-1">
                          {txn.splits!.map((split, si) => (
                            <div key={si} className="flex items-center gap-3 text-xs text-on-surface-variant">
                              <span className="text-slate-500">↳</span>
                              {split.category ? (
                                <span className="flex items-center gap-1">
                                  <span>{split.category.icon}</span>
                                  <span className="font-medium">{split.category.name}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 italic">No category</span>
                              )}
                              {split.notes && <span className="text-slate-500">· {split.notes}</span>}
                              <span className="ml-auto font-semibold text-error">{formatCurrency(split.amount)}</span>
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
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/5 bg-white/5">
          <span className="text-xs text-slate-500 uppercase tracking-widest">
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

      {/* Delete Confirm */}
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
