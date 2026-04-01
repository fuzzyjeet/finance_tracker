import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { transactionsApi, TransactionPayload } from '../api/transactions';
import { accountsApi } from '../api/accounts';
import { categoriesApi } from '../api/categories';
import { tagsApi } from '../api/tags';
import { Account, Category, Tag, Transaction } from '../types';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const PAGE_SIZE = 20;

interface TxnForm {
  date: string;
  billing_date: string;
  amount: string;
  type: string;
  category_id: string;
  account_id: string;
  to_account_id: string;
  payee: string;
  notes: string;
  tag_ids: string[];
}

const emptyForm = (): TxnForm => ({
  date: new Date().toISOString().split('T')[0],
  billing_date: '',
  amount: '',
  type: 'expense',
  category_id: '',
  account_id: '',
  to_account_id: '',
  payee: '',
  notes: '',
  tag_ids: [],
});

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
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
  const [form, setForm] = useState<TxnForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadRefs = async () => {
    const [accts, cats, tgs] = await Promise.all([
      accountsApi.list(),
      categoriesApi.list(),
      tagsApi.list(),
    ]);
    setAccounts(accts);
    setCategories(cats);
    setTags(tgs);
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

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (txn: Transaction) => {
    setEditing(txn);
    setForm({
      date: txn.date,
      billing_date: txn.billing_date ?? '',
      amount: txn.amount.toString(),
      type: txn.type,
      category_id: txn.category_id ?? '',
      account_id: txn.account_id,
      to_account_id: txn.to_account_id ?? '',
      payee: txn.payee,
      notes: txn.notes ?? '',
      tag_ids: txn.tags?.map(t => t.id) ?? [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: TransactionPayload = {
        date: form.date,
        billing_date: form.billing_date || undefined,
        amount: parseFloat(form.amount),
        type: form.type,
        category_id: form.category_id || undefined,
        account_id: form.account_id,
        to_account_id: form.to_account_id || undefined,
        payee: form.payee,
        notes: form.notes || undefined,
        tag_ids: form.tag_ids,
      };
      if (editing) {
        await transactionsApi.update(editing.id, payload);
      } else {
        await transactionsApi.create(payload);
      }
      setModalOpen(false);
      await load(offset);
      await loadRefs(); // refresh account balances
    } finally {
      setSaving(false);
    }
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

  const filteredCategories = categories.filter(c => {
    if (form.type === 'income') return c.type === 'income' || c.type === 'both';
    if (form.type === 'expense') return c.type === 'expense' || c.type === 'both';
    return false;
  });

  const selectedAccount = accounts.find(a => a.id === form.account_id);

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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Transaction' : 'Add Transaction'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            />
            <Select
              label="Type"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value, category_id: '', to_account_id: '' }))}
              options={[
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expense' },
                { value: 'transfer', label: 'Transfer' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Payee"
              value={form.payee}
              onChange={e => setForm(f => ({ ...f, payee: e.target.value }))}
              placeholder="e.g. Whole Foods"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Account"
              value={form.account_id}
              onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
              options={accounts.map(a => ({ value: a.id, label: a.name }))}
              placeholder="Select account"
            />
            {form.type === 'transfer' ? (
              <Select
                label="To Account"
                value={form.to_account_id}
                onChange={e => setForm(f => ({ ...f, to_account_id: e.target.value }))}
                options={accounts.filter(a => a.id !== form.account_id).map(a => ({ value: a.id, label: a.name }))}
                placeholder="Select account"
              />
            ) : (
              <Select
                label="Category"
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                options={filteredCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))}
                placeholder="Select category"
              />
            )}
          </div>

          {selectedAccount?.type === 'credit_card' && (
            <Input
              label="Billing Date (optional)"
              type="date"
              value={form.billing_date}
              onChange={e => setForm(f => ({ ...f, billing_date: e.target.value }))}
              hint="The billing date for credit card transactions"
            />
          )}

          <Input
            label="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Add a note..."
          />

          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      tag_ids: f.tag_ids.includes(tag.id)
                        ? f.tag_ids.filter(id => id !== tag.id)
                        : [...f.tag_ids, tag.id],
                    }))}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border-2 ${
                      form.tag_ids.includes(tag.id) ? 'border-current opacity-100' : 'border-transparent opacity-60'
                    }`}
                    style={{
                      backgroundColor: `${tag.color}22`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!form.amount || !form.account_id || !form.payee}
            >
              {editing ? 'Save Changes' : 'Add Transaction'}
            </Button>
          </div>
        </div>
      </Modal>

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
