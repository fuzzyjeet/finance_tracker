import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Play, RefreshCw, Clock } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { recurringApi, RecurringPayload } from '../api/recurring';
import { accountsApi } from '../api/accounts';
import { categoriesApi } from '../api/categories';
import { tagsApi } from '../api/tags';
import { RecurringTransaction, Account, Category, Tag } from '../types';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom interval' },
];

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

interface RecurringForm {
  name: string;
  amount: string;
  type: string;
  category_id: string;
  account_id: string;
  to_account_id: string;
  payee: string;
  notes: string;
  frequency: string;
  custom_interval_days: string;
  start_date: string;
  end_date: string;
  next_due_date: string;
  is_active: boolean;
  auto_post: boolean;
  tag_ids: string[];
}

const emptyForm = (): RecurringForm => ({
  name: '',
  amount: '',
  type: 'expense',
  category_id: '',
  account_id: '',
  to_account_id: '',
  payee: '',
  notes: '',
  frequency: 'monthly',
  custom_interval_days: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  next_due_date: new Date().toISOString().split('T')[0],
  is_active: true,
  auto_post: true,
  tag_ids: [],
});

export const Recurring: React.FC = () => {
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [pending, setPending] = useState<RecurringTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);
  const [form, setForm] = useState<RecurringForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [posting, setPosting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [all, pend, accts, cats, tgs] = await Promise.all([
        recurringApi.list(),
        recurringApi.pending(),
        accountsApi.list(),
        categoriesApi.list(),
        tagsApi.list(),
      ]);
      setItems(all);
      setPending(pend);
      setAccounts(accts);
      setCategories(cats);
      setTags(tgs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (item: RecurringTransaction) => {
    setEditing(item);
    setForm({
      name: item.name,
      amount: item.amount.toString(),
      type: item.type,
      category_id: item.category_id ?? '',
      account_id: item.account_id,
      to_account_id: item.to_account_id ?? '',
      payee: item.payee,
      notes: item.notes ?? '',
      frequency: item.frequency,
      custom_interval_days: item.custom_interval_days?.toString() ?? '',
      start_date: item.start_date,
      end_date: item.end_date ?? '',
      next_due_date: item.next_due_date,
      is_active: item.is_active,
      auto_post: item.auto_post,
      tag_ids: item.tags?.map(t => t.id) ?? [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: RecurringPayload = {
        name: form.name,
        amount: parseFloat(form.amount),
        type: form.type,
        category_id: form.category_id || undefined,
        account_id: form.account_id,
        to_account_id: form.to_account_id || undefined,
        payee: form.payee,
        notes: form.notes || undefined,
        frequency: form.frequency,
        custom_interval_days: form.custom_interval_days ? parseInt(form.custom_interval_days) : undefined,
        start_date: form.start_date,
        end_date: form.end_date || undefined,
        next_due_date: form.next_due_date,
        is_active: form.is_active,
        auto_post: form.auto_post,
        tag_ids: form.tag_ids,
      };
      if (editing) {
        await recurringApi.update(editing.id, payload);
      } else {
        await recurringApi.create(payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await recurringApi.delete(id);
    setDeleteConfirm(null);
    await load();
  };

  const handlePostNow = async (id: string) => {
    setPosting(id);
    try {
      await recurringApi.postNow(id);
      await load();
    } finally {
      setPosting(null);
    }
  };

  const handleToggleActive = async (item: RecurringTransaction) => {
    await recurringApi.update(item.id, { is_active: !item.is_active });
    await load();
  };

  const filteredCategories = categories.filter(c => {
    if (form.type === 'income') return c.type === 'income' || c.type === 'both';
    if (form.type === 'expense') return c.type === 'expense' || c.type === 'both';
    return false;
  });

  const typeColor = (type: string) =>
    type === 'income' ? '#22c55e' : type === 'expense' ? '#ef4444' : '#3b82f6';

  return (
    <div>
      <Header
        title="Recurring Transactions"
        subtitle={`${items.filter(i => i.is_active).length} active · ${pending.length} pending`}
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Recurring</Button>}
      />

      {/* Pending Queue */}
      {pending.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-700">Pending Approval ({pending.length})</h2>
          </div>
          <div className="space-y-2">
            {pending.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                    style={{ backgroundColor: item.category ? `${item.category.color}22` : '#f3f4f6' }}
                  >
                    {item.category?.icon ?? '💸'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      Due {item.next_due_date} · {item.account_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: typeColor(item.type) }}>
                    {formatCurrency(item.amount)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handlePostNow(item.id)}
                    loading={posting === item.id}
                  >
                    <Play size={13} /> Post Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Recurring */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <RefreshCw size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400 text-sm mb-3">No recurring transactions yet</p>
          <Button onClick={openCreate}><Plus size={16} /> Add Recurring</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Frequency</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Account</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Next Due</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Auto Post</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: item.category ? `${item.category.color}22` : '#f3f4f6' }}
                      >
                        {item.category?.icon ?? '💸'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.payee}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {FREQUENCY_LABELS[item.frequency]}
                    {item.frequency === 'custom' && item.custom_interval_days && (
                      <span className="text-gray-400"> ({item.custom_interval_days}d)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.account_name}</td>
                  <td className="px-4 py-3 text-gray-600">{item.next_due_date}</td>
                  <td className="px-4 py-3">
                    <Badge color={item.auto_post ? '#22c55e' : '#f59e0b'}>
                      {item.auto_post ? 'Auto' : 'Manual'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        item.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold" style={{ color: typeColor(item.type) }}>
                      {formatCurrency(item.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(item.id)}
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Recurring Transaction' : 'Add Recurring Transaction'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Monthly Rent"
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
              placeholder="e.g. Landlord"
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

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Frequency"
              value={form.frequency}
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}
              options={FREQUENCY_OPTIONS}
            />
            {form.frequency === 'custom' && (
              <Input
                label="Interval (days)"
                type="number"
                min={1}
                value={form.custom_interval_days}
                onChange={e => setForm(f => ({ ...f, custom_interval_days: e.target.value }))}
                placeholder="e.g. 14"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            />
            <Input
              label="Next Due Date"
              type="date"
              value={form.next_due_date}
              onChange={e => setForm(f => ({ ...f, next_due_date: e.target.value }))}
            />
          </div>

          <Input
            label="End Date (optional)"
            type="date"
            value={form.end_date}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            hint="Leave blank for no end date"
          />

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.auto_post}
                onChange={e => setForm(f => ({ ...f, auto_post: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Auto-post on due date</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>

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
                    style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
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
              disabled={!form.name || !form.amount || !form.account_id}
            >
              {editing ? 'Save Changes' : 'Create Recurring'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Recurring Transaction"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure? This won't delete already-posted transactions.
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
