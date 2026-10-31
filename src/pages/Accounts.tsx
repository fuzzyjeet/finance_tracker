import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, CreditCard, PiggyBank, Landmark, Wallet, TrendingUp, ChevronRight, ChevronDown } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { AccountDetail } from '../components/accounts/AccountDetail';
import { accountsApi } from '../api/accounts';
import { onDataChanged, emitDataChanged } from '../lib/events';
import { useHideFab } from '../contexts/QuickAddContext';
import { Account, AccountType, CURRENCY_OPTIONS } from '../types';

export const formatAmount = (value: number, currency: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);

export const ACCOUNT_TYPES: { value: AccountType; label: string; group: string }[] = [
  { value: 'checking', label: 'Current account', group: 'Current accounts' },
  { value: 'savings', label: 'Savings', group: 'Savings' },
  { value: 'credit_card', label: 'Credit card', group: 'Credit cards' },
  { value: 'cash', label: 'Cash', group: 'Cash' },
  { value: 'investment', label: 'Investment', group: 'Investments' },
];
export const typeLabel = (t: AccountType) => ACCOUNT_TYPES.find(x => x.value === t)?.label ?? t;

const ACCOUNT_COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6366f1',
];

export const AccountIcon: React.FC<{ account: Pick<Account, 'type' | 'color'>; size?: 'sm' | 'md' }> = ({ account, size = 'md' }) => {
  const px = size === 'sm' ? 14 : 18;
  const Icon = account.type === 'credit_card' ? CreditCard
    : account.type === 'savings' ? PiggyBank
    : account.type === 'investment' ? TrendingUp
    : account.type === 'cash' ? Wallet
    : Landmark;
  return (
    <span
      className={`${size === 'sm' ? 'w-7 h-7 rounded-md' : 'w-9 h-9 rounded-lg'} flex items-center justify-center shrink-0`}
      style={{ background: account.color }}
    >
      <Icon size={px} style={{ color: 'var(--text)' }} />
    </span>
  );
};

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

interface AccountFormData {
  name: string;
  type: string;
  color: string;
  billing_cycle_day: string;
  currency: string;
  opening_amount: string;
  opening_is_debt: boolean;
  parent_id: string;
  is_active: boolean;
}

const emptyForm: AccountFormData = {
  name: '',
  type: 'checking',
  color: '#3b82f6',
  billing_cycle_day: '',
  currency: 'EUR',
  opening_amount: '',
  opening_is_debt: false,
  parent_id: '',
  is_active: true,
};

const cardStyle = { background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' };

export const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const detailId = params.get('account');
  const savedScroll = useRef(0);
  const hideFab = useHideFab();

  // No + button for new entries here
  useEffect(() => { hideFab(true); return () => hideFab(false); }, [hideFab]);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    try {
      setAccounts(await accountsApi.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onDataChanged(load), [load]);

  // An account opens inside this page; back returns to the list as you left it
  const main = () => document.querySelector('main');
  const openAccount = (id: string, from?: string) => {
    if (!detailId) savedScroll.current = main()?.scrollTop ?? 0;
    setParams({ account: id }, { state: { fromAccounts: true, backLabel: from ?? 'Accounts' } });
  };
  const closeAccount = () => {
    if ((location.state as { fromAccounts?: boolean } | null)?.fromAccounts) navigate(-1);
    else setParams({}, { replace: true });
  };
  useEffect(() => {
    const el = main();
    if (!el) return;
    if (detailId) el.scrollTo({ top: 0 });
    else requestAnimationFrame(() => el.scrollTo({ top: savedScroll.current }));
  }, [detailId]);

  const openCreate = (parent?: Account) => {
    setEditing(null);
    setForm(parent
      ? { ...emptyForm, parent_id: parent.id, currency: parent.currency, type: 'savings', color: parent.color }
      : emptyForm);
    setSaveError('');
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
      opening_amount: account.opening_balance ? Math.abs(account.opening_balance).toString().replace('.', ',') : '',
      opening_is_debt: account.opening_balance < 0,
      parent_id: account.parent_id ?? '',
      is_active: account.is_active !== false,
    });
    setSaveError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const payload: any = {
        name: form.name,
        type: form.type as Account['type'],
        color: form.color,
        billing_cycle_day: form.billing_cycle_day ? parseInt(form.billing_cycle_day) : undefined,
        currency: form.currency,
        opening_balance: Math.abs(parseFloat(form.opening_amount.replace(',', '.')) || 0) * (form.opening_is_debt ? -1 : 1),
        parent_id: form.parent_id || null,
        is_active: form.is_active,
      };
      if (editing) {
        await accountsApi.update(editing.id, payload);
      } else {
        await accountsApi.create(payload);
      }
      setModalOpen(false);
      await load();
      emitDataChanged();
    } catch (e: any) {
      setSaveError(e?.response?.data?.detail ?? 'Could not save the account');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (account: Account) => {
    await accountsApi.delete(account.id);
    setDeleteConfirm(null);
    setModalOpen(false);
    if (detailId === account.id) closeAccount();
    await load();
    emitDataChanged();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const active = accounts.filter(a => a.is_active !== false);
  const inactive = accounts.filter(a => a.is_active === false);
  const childrenOf = (id: string) => active.filter(a => a.parent_id === id);
  const allChildrenOf = (id: string) => accounts.filter(a => a.parent_id === id);
  const isMain = (a: Account) => !a.parent_id || !accounts.some(p => p.id === a.parent_id);
  // A main account's figure includes its sub-accounts: it's the money at that bank
  const combined = (a: Account) => a.balance + allChildrenOf(a.id).reduce((s, c) => s + c.balance, 0);

  const detail = detailId ? accounts.find(a => a.id === detailId) : undefined;
  const editingHasChildren = !!editing && allChildrenOf(editing.id).length > 0;
  const parentOptions = accounts.filter(a => isMain(a) && a.id !== editing?.id && a.currency === form.currency);

  const accountRow = (a: Account, opts: { child?: boolean; dim?: boolean } = {}) => {
    const kids = childrenOf(a.id);
    const total = opts.child ? a.balance : combined(a);
    const sub = [
      kids.length > 0 && `Own ${formatAmount(a.balance, a.currency)}`,
      opts.dim && a.parent_id && accounts.find(p => p.id === a.parent_id) && `Part of ${accounts.find(p => p.id === a.parent_id)!.name}`,
      !opts.child && a.type === 'credit_card' && a.billing_cycle_day && `Closes on the ${ordinal(a.billing_cycle_day)}`,
      a.currency !== 'EUR' && a.currency,
    ].filter(Boolean).join(' · ');
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => openAccount(a.id)}
        className={`w-full flex items-center gap-3 text-left ${opts.child ? 'min-h-[44px] py-1.5 pl-6' : 'min-h-[56px] py-2'}`}
        style={{ opacity: opts.dim ? 0.7 : 1 }}
      >
        {opts.child && <span className="w-3 h-5 -ml-3 shrink-0 rounded-bl-md" style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', borderBottom: '1px solid rgba(255,255,255,0.15)', marginTop: -14 }} />}
        <AccountIcon account={a} size={opts.child ? 'sm' : 'md'} />
        <span className="flex-1 min-w-0">
          <span className={`block truncate ${opts.child ? 'text-sm' : 'text-[15px] font-medium'}`} style={{ color: 'var(--text)' }}>{a.name}</span>
          {sub && <span className="block text-xs truncate" style={{ color: 'var(--muted)' }}>{sub}</span>}
        </span>
        <span className={`tabular-nums shrink-0 ${opts.child ? 'text-sm' : 'text-[15px] font-semibold'}`}
          style={{ color: total < 0 ? 'var(--expense)' : 'var(--text)' }}>
          {formatAmount(total, a.currency)}
        </span>
        <ChevronRight size={16} className="shrink-0" style={{ color: 'var(--faint)' }} />
      </button>
    );
  };

  const groups = ACCOUNT_TYPES
    .map(t => ({ ...t, mains: active.filter(a => isMain(a) && a.type === t.value) }))
    .filter(g => g.mains.length);

  return (
    <div className="pb-4">
      {detail && (
        <AccountDetail
          account={detail}
          accounts={accounts}
          backLabel={(location.state as { backLabel?: string } | null)?.backLabel ?? 'Accounts'}
          onBack={closeAccount}
          onOpen={id => openAccount(id, detail.name)}
          onEdit={() => openEdit(detail)}
          onAddSub={() => openCreate(detail)}
        />
      )}

      {/* Kept mounted while an account is open, so the list is as you left it */}
      <div className={detail ? 'hidden' : undefined}>
        <Header
          title="Accounts"
          subtitle="Tap an account to see its entries"
          actions={<Button onClick={() => openCreate()}><Plus size={16} /> Account</Button>}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {groups.map(g => {
            const currencies = new Set(g.mains.map(a => a.currency));
            const total = g.mains.reduce((s, a) => s + combined(a), 0);
            return (
              <section key={g.value} className="rounded-xl px-4 py-3" style={cardStyle}>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>{g.group}</h2>
                  {currencies.size === 1 && g.mains.length > 1 && (
                    <span className="text-sm tabular-nums" style={{ color: 'var(--text-2)' }}>{formatAmount(total, [...currencies][0])}</span>
                  )}
                </div>
                <div className="mt-1 divide-y divide-white/5">
                  {g.mains.map(a => (
                    <div key={a.id}>
                      {accountRow(a)}
                      {childrenOf(a.id).map(c => accountRow(c, { child: true }))}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {inactive.length > 0 && (
            <section className="rounded-xl px-4 py-1" style={cardStyle}>
              <button
                type="button"
                onClick={() => setShowInactive(s => !s)}
                aria-expanded={showInactive}
                className="w-full flex items-center justify-between min-h-[48px] text-left"
              >
                <span className="text-[15px] font-semibold" style={{ color: 'var(--text-2)' }}>
                  Inactive accounts <span className="font-normal" style={{ color: 'var(--muted)' }}>· {inactive.length}</span>
                </span>
                <ChevronDown size={18} className="transition-transform" style={{ color: 'var(--muted)', transform: showInactive ? 'rotate(180deg)' : undefined }} />
              </button>
              {showInactive && (
                <div className="pb-2 divide-y divide-white/5">
                  {inactive.map(a => accountRow(a, { dim: true }))}
                </div>
              )}
            </section>
          )}

          {accounts.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>No accounts yet. Add your first one to start.</p>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit account' : form.parent_id ? 'Add sub-account' : 'Add account'}
      >
        <div className="space-y-4">
          <Input
            label="Account name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={form.parent_id ? 'e.g. Holiday pot' : 'e.g. Girokonto'}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Type"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              options={ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label }))}
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              options={CURRENCY_OPTIONS.map(c => ({ value: c.value, label: c.label }))}
              disabled={!!form.parent_id}
            />
          </div>
          <div>
            <Select
              label="Part of"
              value={form.parent_id}
              onChange={e => {
                const parent = accounts.find(a => a.id === e.target.value);
                setForm(f => ({ ...f, parent_id: e.target.value, currency: parent?.currency ?? f.currency }));
              }}
              options={[
                { value: '', label: 'Nothing (main account)' },
                ...parentOptions.map(a => ({ value: a.id, label: a.name })),
              ]}
              disabled={editingHasChildren}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              {editingHasChildren
                ? 'This account has sub-accounts, so it stays a main account.'
                : 'A sub-account sets money aside within a main account, like a pot at the same bank. Move money in and out with transfers.'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">Colour</label>
            <div className="flex flex-wrap gap-2">
              {ACCOUNT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Colour ${c}`}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    form.color === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {form.type === 'credit_card' && (
            <Input
              label="Statement closing day"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={form.billing_cycle_day}
              onChange={e => setForm(f => ({ ...f, billing_cycle_day: e.target.value }))}
              placeholder="Day of month (1-31)"
              hint="The day the billing cycle closes each month"
            />
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-on-surface-variant">Opening balance</label>
              <div className="flex rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                {[{ debt: false, label: 'Balance' }, { debt: true, label: 'Debt' }].map(opt => {
                  const on = form.opening_is_debt === opt.debt;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, opening_is_debt: opt.debt }))}
                      className="px-3 h-8 rounded-md text-xs font-semibold transition-colors"
                      style={{
                        background: on ? (opt.debt ? 'rgb(var(--expense-rgb) / 0.15)' : 'rgb(var(--income-rgb) / 0.15)') : 'transparent',
                        color: on ? (opt.debt ? 'var(--expense)' : 'var(--income)') : 'var(--muted)',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <Input
              inputMode="decimal"
              value={form.opening_amount}
              onChange={e => setForm(f => ({ ...f, opening_amount: e.target.value }))}
              placeholder="0,00"
              hint={form.opening_is_debt
                ? 'Amount owed when you started tracking. Not counted as income or expense.'
                : 'Amount held when you started tracking. Not counted as income or expense.'}
            />
          </div>
          {editing && (
            <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
              <input
                type="checkbox"
                checked={!form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: !e.target.checked }))}
                className="mt-1 w-5 h-5 accent-[var(--accent)]"
              />
              <span>
                <span className="block text-sm font-medium" style={{ color: 'var(--text)' }}>Inactive</span>
                <span className="block text-xs" style={{ color: 'var(--muted)' }}>
                  Folded away in lists and left out when adding entries. Its history stays.
                </span>
              </span>
            </label>
          )}
          {saveError && <p className="text-sm" style={{ color: 'var(--expense)' }}>{saveError}</p>}
          <div className="flex items-center gap-2 pt-2">
            {editing && (
              <Button variant="ghost" onClick={() => setDeleteConfirm(editing)}>
                <span style={{ color: 'var(--expense)' }}>Delete</span>
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name}>
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete account"
        size="sm"
      >
        <p className="text-sm text-on-surface-variant mb-4">
          Delete {deleteConfirm?.name}? This also deletes all its entries.
          {deleteConfirm && allChildrenOf(deleteConfirm.id).length > 0 && ' Its sub-accounts become main accounts.'}
          {' '}To keep the history, mark it inactive instead.
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
