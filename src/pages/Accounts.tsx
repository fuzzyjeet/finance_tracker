import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, CreditCard, PiggyBank, Landmark, Wallet, TrendingUp } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { accountsApi } from '../api/accounts';
import { Account, AccountType, CURRENCY_OPTIONS } from '../types';

const formatAmount = (value: number, currency: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investment' },
];

const ACCOUNT_COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1',
];

const AccountIcon = ({ type }: { type: AccountType }) => {
  const props = { size: 24, className: 'text-white' };
  if (type === 'credit_card') return <CreditCard {...props} />;
  if (type === 'savings') return <PiggyBank {...props} />;
  if (type === 'investment') return <TrendingUp {...props} />;
  if (type === 'cash') return <Wallet {...props} />;
  return <Landmark {...props} />;
};

interface AccountFormData {
  name: string;
  type: string;
  color: string;
  billing_cycle_day: string;
  currency: string;
  starting_balance: string;
}

const emptyForm: AccountFormData = {
  name: '',
  type: 'checking',
  color: '#3b82f6',
  billing_cycle_day: '',
  currency: 'EUR',
  starting_balance: '',
};

export const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setAccounts(await accountsApi.list());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (account: Account) => {
    setEditing(account);
    setForm({
      name: account.name,
      type: account.type,
      color: account.color,
      billing_cycle_day: account.billing_cycle_day?.toString() ?? '',
      currency: account.currency ?? 'EUR',
      starting_balance: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        type: form.type as Account['type'],
        color: form.color,
        billing_cycle_day: form.billing_cycle_day ? parseInt(form.billing_cycle_day) : undefined,
        currency: form.currency,
      };
      if (editing) {
        await accountsApi.update(editing.id, payload);
      } else {
        if (form.starting_balance) {
          payload.starting_balance = parseFloat(form.starting_balance);
        }
        await accountsApi.create(payload);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await accountsApi.delete(id);
    setDeleteConfirm(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Accounts"
        subtitle="Total balance across non-credit accounts"
        actions={<Button onClick={openCreate}><Plus size={16} /> Add Account</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(account => (
          <Card
            key={account.id}
            className="relative group cursor-pointer hover:border-white/10 transition-colors"
            onClick={() => navigate(`/transactions?account_id=${account.id}`)}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: account.color }}
              >
                <AccountIcon type={account.type} />
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={e => { e.stopPropagation(); openEdit(account); }}
                  className="p-1.5 text-slate-500 hover:text-on-surface hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(account.id); }}
                  className="p-1.5 text-slate-500 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <p className="font-headline font-semibold text-white">{account.name}</p>
            <div className="flex items-center gap-2 mt-1 mb-3">
              <Badge color={account.color}>
                {account.type.replace('_', ' ')}
              </Badge>
              <span className="text-xs text-slate-500 font-medium">{account.currency}</span>
              {account.type === 'credit_card' && account.billing_cycle_day && (
                <span className="text-xs text-slate-500">· Closes day {account.billing_cycle_day}</span>
              )}
            </div>

            <p
              className={`font-headline text-2xl font-bold ${
                account.balance < 0 ? 'text-error' : 'text-white'
              }`}
            >
              {formatAmount(account.balance, account.currency)}
            </p>
          </Card>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Account' : 'Add Account'}
      >
        <div className="space-y-4">
          <Input
            label="Account Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Chase Checking"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Account Type"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              options={ACCOUNT_TYPE_OPTIONS}
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              options={CURRENCY_OPTIONS.map(c => ({ value: c.value, label: c.label }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    form.color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {form.type === 'credit_card' && (
            <Input
              label="Billing Cycle Day"
              type="number"
              min={1}
              max={31}
              value={form.billing_cycle_day}
              onChange={e => setForm(f => ({ ...f, billing_cycle_day: e.target.value }))}
              placeholder="Day of month (1-31)"
              hint="The day the billing cycle closes each month"
            />
          )}
          {!editing && (
            <Input
              label="Starting Balance (optional)"
              type="number"
              step="0.01"
              value={form.starting_balance}
              onChange={e => setForm(f => ({ ...f, starting_balance: e.target.value }))}
              placeholder="0.00"
              hint="Initial balance when this account was opened"
            />
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name}>
              {editing ? 'Save Changes' : 'Create Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Account"
        size="sm"
      >
        <p className="text-sm text-on-surface-variant mb-4">
          Are you sure you want to delete this account? This will also delete all associated transactions.
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
