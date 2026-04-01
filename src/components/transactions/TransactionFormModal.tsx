import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { transactionsApi, TransactionPayload } from '../../api/transactions';
import { accountsApi } from '../../api/accounts';
import { categoriesApi } from '../../api/categories';
import { tagsApi } from '../../api/tags';
import { Account, Category, Tag, Transaction } from '../../types';

const TAG_COLORS = [
  '#6366f1', '#22c55e', '#f97316', '#ef4444', '#3b82f6',
  '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6', '#84cc16',
];

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Transaction | null;
}

export const TransactionFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, editing }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [form, setForm] = useState<TxnForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([accountsApi.list(), categoriesApi.list(), tagsApi.list()]).then(
      ([accts, cats, tgs]) => {
        setAccounts(accts);
        setCategories(cats);
        setTags(tgs);
      }
    );
  }, [isOpen]);

  useEffect(() => {
    if (editing) {
      setForm({
        date: editing.date,
        billing_date: editing.billing_date ?? '',
        amount: editing.amount.toString(),
        type: editing.type,
        category_id: editing.category_id ?? '',
        account_id: editing.account_id,
        to_account_id: editing.to_account_id ?? '',
        payee: editing.payee,
        notes: editing.notes ?? '',
        tag_ids: editing.tags?.map(t => t.id) ?? [],
      });
    } else {
      setForm(emptyForm());
    }
  }, [editing, isOpen]);

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
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const tag = await tagsApi.create({ name: newTagName.trim(), color: newTagColor });
    setTags(prev => [...prev, tag]);
    setForm(f => ({ ...f, tag_ids: [...f.tag_ids, tag.id] }));
    setNewTagName('');
    setShowTagInput(false);
  };

  const filteredCategories = categories.filter(c => {
    if (form.type === 'income') return c.type === 'income' || c.type === 'both';
    if (form.type === 'expense') return c.type === 'expense' || c.type === 'both';
    return false;
  });

  const selectedAccount = accounts.find(a => a.id === form.account_id);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
            placeholder="e.g. REWE"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Account"
            value={form.account_id}
            onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
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
            hint="Billing date if different from transaction date"
          />
        )}

        <Input
          label="Notes (optional)"
          value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
          placeholder="Add a note..."
        />

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-gray-700">Tags</label>
            <button
              type="button"
              onClick={() => setShowTagInput(v => !v)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
            >
              <Plus size={12} /> New tag
            </button>
          </div>

          {showTagInput && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
              <input
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                placeholder="Tag name"
                className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-1">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? 'border-gray-700 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded disabled:opacity-40"
              >
                Add
              </button>
              <button type="button" onClick={() => setShowTagInput(false)}>
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5 min-h-[32px]">
            {tags.length === 0 && !showTagInput && (
              <span className="text-xs text-gray-400 self-center">No tags yet — create one above</span>
            )}
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
                  form.tag_ids.includes(tag.id) ? 'border-current' : 'border-transparent opacity-50'
                }`}
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
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
  );
};
