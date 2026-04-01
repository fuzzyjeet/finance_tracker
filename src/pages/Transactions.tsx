import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
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

  // Filters
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  return (
    <div>
      <Header
        title="Transactions"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Transaction</Button>}
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Search payee..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterAccount}
            onChange={e => setFilterAccount(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="From date"
            />
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No transactions found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Payee</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tags</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map(txn => (
                  <tr key={txn.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      <div>{txn.date}</div>
                      {txn.billing_date && (
                        <div className="text-xs text-gray-400">Bill: {txn.billing_date}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{txn.payee}</div>
                      {txn.notes && <div className="text-xs text-gray-400 truncate max-w-[200px]">{txn.notes}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {txn.category ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span>{txn.category.icon}</span>
                          <span className="text-gray-700">{txn.category.name}</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{txn.account_name}</div>
                      {txn.to_account_name && (
                        <div className="text-xs text-gray-400">→ {txn.to_account_name}</div>
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
                      <div className={`flex items-center justify-end gap-1 font-semibold ${
                        txn.type === 'income' ? 'text-green-600' :
                        txn.type === 'expense' ? 'text-red-600' : 'text-blue-600'
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
                          className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(txn.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <span className="text-sm text-gray-500">
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
        <p className="text-sm text-gray-600 mb-4">
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
