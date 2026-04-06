import React, { useEffect, useState } from 'react';
import { Plus, X, Split } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { transactionsApi, TransactionPayload, SplitPayload } from '../../api/transactions';
import { accountsApi } from '../../api/accounts';
import { categoriesApi } from '../../api/categories';
import { tagsApi } from '../../api/tags';
import { projectsApi } from '../../api/projects';
import { Account, Category, Tag, Transaction, Project } from '../../types';

const TAG_COLORS = [
  '#6366f1', '#22c55e', '#f97316', '#ef4444', '#3b82f6',
  '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6', '#84cc16',
];

const CATEGORY_COLORS = TAG_COLORS;
const CATEGORY_ICONS = ['🛒', '🍔', '🚗', '🏠', '💊', '🎮', '✈️', '📚', '💼', '💰', '🎁', '⚡', '📱', '🏋️', '🎨'];

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
  project_ids: string[];
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
  project_ids: [],
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<TxnForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [showTagInput, setShowTagInput] = useState(false);

  // New category inline creation
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState(CATEGORY_ICONS[0]);
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);

  // Split state
  const [splitMode, setSplitMode] = useState(false);
  const [splits, setSplits] = useState<SplitPayload[]>([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([accountsApi.list(), categoriesApi.list(), tagsApi.list(), projectsApi.list()]).then(
      ([accts, cats, tgs, projs]) => { setAccounts(accts); setCategories(cats); setTags(tgs); setProjects(projs); }
    );
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
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
        project_ids: editing.projects?.map(p => p.id) ?? [],
      });
      if (editing.splits && editing.splits.length > 0) {
        setSplitMode(true);
        setSplits(editing.splits.map(s => ({
          amount: s.amount,
          category_id: s.category_id ?? '',
          notes: s.notes ?? '',
          project_ids: s.projects?.map(p => p.id) ?? [],
        })));
      } else {
        setSplitMode(false);
        setSplits([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);
      }
    } else {
      setForm(emptyForm());
      setSplitMode(false);
      setSplits([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);
    }
  }, [editing, isOpen]);

  const totalAmount = parseFloat(form.amount) || 0;
  const allocatedAmount = splits.reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
  const remaining = totalAmount - allocatedAmount;
  const splitBalanced = Math.abs(remaining) < 0.005;

  const handleSave = async () => {
    if (splitMode && !splitBalanced) return;
    setSaving(true);
    try {
      const payload: TransactionPayload = {
        date: form.date,
        billing_date: form.billing_date || undefined,
        amount: totalAmount,
        type: form.type,
        category_id: splitMode ? undefined : (form.category_id || undefined),
        account_id: form.account_id,
        to_account_id: form.to_account_id || undefined,
        payee: form.payee,
        notes: form.notes || undefined,
        tag_ids: form.tag_ids,
        project_ids: splitMode ? [] : form.project_ids,
        splits: splitMode
          ? splits.map(s => ({
              amount: parseFloat(String(s.amount)) || 0,
              category_id: s.category_id || undefined,
              notes: s.notes || undefined,
              project_ids: s.project_ids ?? [],
            }))
          : undefined,
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

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const catType = form.type === 'income' ? 'income' : form.type === 'expense' ? 'expense' : 'both';
    const cat = await categoriesApi.create({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor, type: catType });
    setCategories(prev => [...prev, cat]);
    setForm(f => ({ ...f, category_id: cat.id }));
    setNewCatName('');
    setShowCategoryInput(false);
  };

  const toggleSplitMode = () => {
    if (!splitMode) {
      setSplits([
        { amount: totalAmount, category_id: form.category_id, notes: '', project_ids: [] },
        { amount: 0, category_id: '', notes: '', project_ids: [] },
      ]);
    }
    setSplitMode(v => !v);
  };

  const updateSplit = (i: number, field: keyof SplitPayload, value: string | number | string[]) => {
    setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const toggleSplitProject = (splitIdx: number, projectId: string) => {
    setSplits(prev => prev.map((s, idx) => {
      if (idx !== splitIdx) return s;
      const ids = s.project_ids ?? [];
      return { ...s, project_ids: ids.includes(projectId) ? ids.filter(id => id !== projectId) : [...ids, projectId] };
    }));
  };

  const addSplit = () => setSplits(prev => [...prev, { amount: remaining > 0 ? remaining : 0, category_id: '', notes: '', project_ids: [] }]);
  const removeSplit = (i: number) => setSplits(prev => prev.filter((_, idx) => idx !== i));

  const filteredCategories = (type?: string) => {
    const t = type ?? form.type;
    return categories.filter(c => {
      if (t === 'income') return c.type === 'income' || c.type === 'both';
      if (t === 'expense') return c.type === 'expense' || c.type === 'both';
      return false;
    });
  };

  const selectedAccount = accounts.find(a => a.id === form.account_id);
  const canSave = !!form.amount && !!form.account_id && !!form.payee &&
    (!splitMode || splitBalanced);

  const splitInputCls = "w-full px-2 py-1.5 text-sm border border-white/10 rounded-lg bg-surface-container-highest text-on-surface placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? 'Edit Transaction' : 'Add Transaction'} size="lg">
      <div className="space-y-4">
        {/* Row 1: Date + Type */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          <Select label="Type" value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value, category_id: '', to_account_id: '' }))}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
              { value: 'transfer', label: 'Transfer' },
            ]} />
        </div>

        {/* Row 2: Amount + Payee */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount" type="number" min={0} step="0.01" value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          <Input label="Payee" value={form.payee}
            onChange={e => setForm(f => ({ ...f, payee: e.target.value }))} placeholder="e.g. REWE" />
        </div>

        {/* Row 3: Account + Category/ToAccount */}
        <div className="grid grid-cols-2 gap-3">
          <Select label={form.type === 'transfer' ? 'From Account' : 'Account'} value={form.account_id}
            onChange={e => setForm(f => ({ ...f, account_id: e.target.value }))}
            options={accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` }))}
            placeholder="Select account" />
          {form.type === 'transfer' ? (
            <Select label="To Account" value={form.to_account_id}
              onChange={e => setForm(f => ({ ...f, to_account_id: e.target.value }))}
              options={accounts.filter(a => a.id !== form.account_id).map(a => ({ value: a.id, label: a.name }))}
              placeholder="Select account" />
          ) : !splitMode ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">Category</label>
                <button type="button" onClick={() => setShowCategoryInput(v => !v)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary">
                  <Plus size={12} /> New
                </button>
              </div>
              <select value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="block w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-on-surface bg-surface-container-highest focus:outline-none focus:ring-1 focus:ring-primary/50 hover:border-white/20 transition-colors">
                <option value="">Select category</option>
                {filteredCategories().map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex flex-col justify-end">
              <div className="h-[38px] flex items-center px-3 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary font-medium">
                Categories set per split below
              </div>
            </div>
          )}
        </div>

        {/* Inline new category form */}
        {showCategoryInput && form.type !== 'transfer' && !splitMode && (
          <div className="p-3 bg-surface-container-highest rounded-lg border border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                placeholder="Category name" autoFocus
                className="flex-1 text-sm border border-white/10 rounded px-2 py-1.5 bg-surface-container text-on-surface placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <button type="button" onClick={handleCreateCategory} disabled={!newCatName.trim()}
                className="text-xs bg-primary-container text-on-primary-container px-3 py-1.5 rounded font-bold disabled:opacity-40 whitespace-nowrap">
                Add
              </button>
              <button type="button" onClick={() => setShowCategoryInput(false)}>
                <X size={14} className="text-slate-500" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-wrap gap-1">
                {CATEGORY_ICONS.map(icon => (
                  <button key={icon} type="button" onClick={() => setNewCatIcon(icon)}
                    className={`w-7 h-7 rounded text-sm flex items-center justify-center transition-all ${
                      newCatIcon === icon ? 'bg-primary/20 ring-1 ring-primary/50' : 'hover:bg-white/10'
                    }`}>
                    {icon}
                  </button>
                ))}
              </div>
              <div className="flex gap-1 shrink-0">
                {CATEGORY_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewCatColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${newCatColor === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Billing date for credit cards */}
        {selectedAccount?.type === 'credit_card' && (
          <Input label="Billing Date (optional)" type="date" value={form.billing_date}
            onChange={e => setForm(f => ({ ...f, billing_date: e.target.value }))}
            hint="Billing date if different from transaction date" />
        )}

        <Input label="Notes (optional)" value={form.notes}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Add a note..." />

        {/* Split Section */}
        {form.type !== 'transfer' && (
          <div className={`rounded-xl border transition-colors ${splitMode ? 'border-primary/20 bg-primary/5' : 'border-transparent'}`}>
            {/* Toggle */}
            <button
              type="button"
              onClick={toggleSplitMode}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full ${
                splitMode
                  ? 'text-primary hover:text-primary'
                  : 'text-slate-500 hover:text-on-surface-variant hover:bg-white/5'
              }`}
            >
              <Split size={14} />
              {splitMode ? 'Split mode on — click to disable' : 'Split transaction across categories'}
            </button>

            {splitMode && (
              <div className="px-3 pb-3 space-y-3">
                {splits.map((split, i) => (
                  <div key={i} className="space-y-1.5 pb-2 border-b border-primary/10 last:border-0">
                    <div className="flex items-start gap-2">
                      <div className="w-28 shrink-0">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={split.amount || ''}
                          onChange={e => updateSplit(i, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className={splitInputCls}
                        />
                      </div>
                      <div className="flex-1">
                        <select
                          value={split.category_id}
                          onChange={e => updateSplit(i, 'category_id', e.target.value)}
                          className={splitInputCls}
                        >
                          <option value="">No category</option>
                          {filteredCategories().map(c => (
                            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={split.notes ?? ''}
                          onChange={e => updateSplit(i, 'notes', e.target.value)}
                          placeholder="Note (optional)"
                          className={splitInputCls}
                        />
                      </div>
                      {splits.length > 2 && (
                        <button type="button" onClick={() => removeSplit(i)}
                          className="mt-1 p-1 text-slate-500 hover:text-error transition-colors">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                    {projects.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-1">
                        {projects.map(p => {
                          const active = (split.project_ids ?? []).includes(p.id);
                          return (
                            <button key={p.id} type="button"
                              onClick={() => toggleSplitProject(i, p.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                                active ? 'border-current' : 'border-transparent opacity-40'
                              }`}
                              style={{ backgroundColor: `${p.color}22`, color: p.color }}>
                              {p.icon} {p.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Running total */}
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={addSplit}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary font-medium">
                    <Plus size={12} /> Add split
                  </button>
                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-tight ${
                    splitBalanced
                      ? 'bg-secondary/10 text-secondary'
                      : remaining > 0
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-error/10 text-error'
                  }`}>
                    {splitBalanced
                      ? `✓ ${allocatedAmount.toFixed(2)} balanced`
                      : remaining > 0
                      ? `${allocatedAmount.toFixed(2)} / ${totalAmount.toFixed(2)} — ${remaining.toFixed(2)} unallocated`
                      : `Over by ${Math.abs(remaining).toFixed(2)}`}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-on-surface-variant uppercase tracking-widest">Tags</label>
            <button type="button" onClick={() => setShowTagInput(v => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary">
              <Plus size={12} /> New tag
            </button>
          </div>
          {showTagInput && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-surface-container-highest rounded-lg border border-white/10">
              <input value={newTagName} onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                placeholder="Tag name" autoFocus
                className="flex-1 text-sm border border-white/10 rounded px-2 py-1 bg-surface-container text-on-surface placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50" />
              <div className="flex gap-1">
                {TAG_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewTagColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? 'border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <button type="button" onClick={handleCreateTag} disabled={!newTagName.trim()}
                className="text-xs bg-primary-container text-on-primary-container px-2 py-1 rounded font-bold disabled:opacity-40">Add</button>
              <button type="button" onClick={() => setShowTagInput(false)}>
                <X size={14} className="text-slate-500" />
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 min-h-[32px]">
            {tags.length === 0 && !showTagInput && (
              <span className="text-xs text-slate-500 self-center">No tags yet — create one above</span>
            )}
            {tags.map(tag => (
              <button key={tag.id} type="button"
                onClick={() => setForm(f => ({
                  ...f,
                  tag_ids: f.tag_ids.includes(tag.id)
                    ? f.tag_ids.filter(id => id !== tag.id)
                    : [...f.tag_ids, tag.id],
                }))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border-2 ${
                  form.tag_ids.includes(tag.id) ? 'border-current' : 'border-transparent opacity-50'
                }`}
                style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>
                {tag.name}
              </button>
            ))}
          </div>
        </div>

        {/* Projects (non-split) */}
        {form.type !== 'transfer' && !splitMode && projects.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-on-surface-variant uppercase tracking-widest mb-1.5">Projects</label>
            <div className="flex flex-wrap gap-1.5">
              {projects.map(p => {
                const active = form.project_ids.includes(p.id);
                return (
                  <button key={p.id} type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      project_ids: active
                        ? f.project_ids.filter(id => id !== p.id)
                        : [...f.project_ids, p.id],
                    }))}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                      active ? 'border-current' : 'border-transparent opacity-50'
                    }`}
                    style={{ backgroundColor: `${p.color}22`, color: p.color }}>
                    {p.icon} {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!canSave}>
            {editing ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
