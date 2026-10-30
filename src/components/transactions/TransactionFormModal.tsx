import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, Plus, X, ArrowDown, ArrowUp, ArrowLeftRight, Tag as TagIcon, Split, Undo2 } from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { RefundLinkPicker, remainingRefundable } from './RefundLinkPicker';
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

// ── Color palette ─────────────────────────────────────────
const SURFACE    = '#171f33';
const SURFACE_HI = '#222a3d';
const BORDER     = 'rgba(255,255,255,0.06)';

const TYPE_COLORS = {
  income:   { text: '#4edea3', bg: 'rgba(78,222,163,0.15)',  border: 'rgba(78,222,163,0.4)'  },
  expense:  { text: '#ffb4ab', bg: 'rgba(255,180,171,0.15)', border: 'rgba(255,180,171,0.4)' },
  transfer: { text: '#8ed5ff', bg: 'rgba(142,213,255,0.15)', border: 'rgba(142,213,255,0.4)' },
  refund:   { text: '#c4b5fd', bg: 'rgba(196,181,253,0.15)', border: 'rgba(196,181,253,0.4)' },
};

// ── Helpers ────────────────────────────────────────────────
function accountIcon(type?: string) {
  if (type === 'credit_card') return '💳';
  if (type === 'savings')     return '🏦';
  if (type === 'investment')  return '📈';
  if (type === 'cash')        return '💵';
  return '🏧';
}

// ── FieldRow sub-component ─────────────────────────────────
interface FieldRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  placeholder?: string;
  extra?: React.ReactNode;
  select?: React.ReactNode;
  noBorder?: boolean;
  error?: boolean;
}

const FieldRow: React.FC<FieldRowProps> = ({ icon, label, value, placeholder, extra, select, noBorder, error }) => (
  <div
    className="relative flex items-center justify-between px-4 py-3 group cursor-pointer transition-colors hover:bg-white/[0.03]"
    style={{
      borderBottom: noBorder ? 'none' : `1px solid ${BORDER}`,
      background: error ? 'rgba(255,100,100,0.05)' : undefined,
    }}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm transition-colors"
        style={{ background: error ? 'rgba(255,100,100,0.12)' : 'rgba(255,255,255,0.04)' }}
      >
        {error ? <AlertCircle size={14} style={{ color: '#ffb4ab' }} /> : icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest leading-none mb-0.5"
          style={{ color: error ? '#ffb4ab' : '#6b7280' }}>{label}</p>
        <p className="text-sm font-medium truncate" style={{ color: value ? '#dae2fd' : error ? '#ff8a80' : '#4b5563' }}>
          {value || (error ? 'Required' : placeholder)}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0 ml-2">
      {extra}
      <ChevronDown size={15} style={{ color: error ? '#ffb4ab' : '#4b5563' }} />
    </div>
    {select && (
      <div className="absolute inset-0 opacity-0 overflow-hidden">
        {select}
      </div>
    )}
  </div>
);

// ── Form state ─────────────────────────────────────────────
interface TxnForm {
  date: string;
  time: string;
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

interface LinkDraft {
  id: string;
  payee: string;
  date: string;
  total: number;
  remaining: number;
  categoryIcon?: string;
  amount: string;
}

const draftFromTxn = (t: Transaction): LinkDraft => {
  const remaining = remainingRefundable(t);
  return {
    id: t.id, payee: t.payee, date: t.date, total: t.amount, remaining,
    categoryIcon: t.category?.icon, amount: remaining.toFixed(2),
  };
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// Accepts free typing ("930", "9:3", "0930") and formats toward HH:MM.
const formatTimeInput = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
};

const emptyForm = (): TxnForm => ({
  date: new Date().toISOString().split('T')[0],
  time: nowHHMM(),
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
  refundOf?: Transaction | null;
}

export const TransactionFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, editing, refundOf }) => {
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags]             = useState<Tag[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [form, setForm]             = useState<TxnForm>(emptyForm());
  const [saving, setSaving]         = useState(false);

  // Tag creation
  const [newTagName, setNewTagName]     = useState('');
  const [newTagColor, setNewTagColor]   = useState(TAG_COLORS[0]);
  const [showTagInput, setShowTagInput] = useState(false);

  // Category inline creation
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCatName, setNewCatName]   = useState('');
  const [newCatIcon, setNewCatIcon]   = useState(CATEGORY_ICONS[0]);
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0]);

  // Collapsible sections
  const [tagsOpen, setTagsOpen]   = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  // Validation
  const [showErrors, setShowErrors] = useState(false);

  // Split state
  const [splits, setSplits] = useState<SplitPayload[]>([
    { amount: 0, category_id: '', notes: '', project_ids: [] },
  ]);

  // Refund links
  const [links, setLinks]           = useState<LinkDraft[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveError, setSaveError]   = useState('');

  const amountRef = useRef<HTMLInputElement>(null);

  // ── Payee autocomplete ─────────────────────────────────
  const [payeeSuggestions, setPayeeSuggestions] = useState<string[]>([]);
  const [showPayeeSug, setShowPayeeSug]         = useState(false);
  const [payeeHighlight, setPayeeHighlight]     = useState(-1);
  const payeeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    transactionsApi.list({ limit: 300 }).then(txns => {
      const fromTxns = [...new Set(txns.map(t => t.payee).filter(Boolean))];
      const custom: string[] = JSON.parse(localStorage.getItem('custom_payees') || '[]');
      setPayeeSuggestions([...new Set([...custom, ...fromTxns])].sort());
    }).catch(() => {});
  }, [isOpen]);

  const filteredPayees = payeeSuggestions.filter(p =>
    form.payee.length > 0 &&
    p.toLowerCase().includes(form.payee.toLowerCase()) &&
    p.toLowerCase() !== form.payee.toLowerCase()
  ).slice(0, 8);

  const selectPayee = (name: string) => {
    setForm(f => ({ ...f, payee: name }));
    setShowPayeeSug(false);
    setPayeeHighlight(-1);
  };

  const onPayeeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPayeeSug || filteredPayees.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setPayeeHighlight(h => Math.min(h + 1, filteredPayees.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setPayeeHighlight(h => Math.max(h - 1, -1));
    } else if (e.key === 'Enter' && payeeHighlight >= 0) {
      e.preventDefault();
      selectPayee(filteredPayees[payeeHighlight]);
    } else if (e.key === 'Escape') {
      setShowPayeeSug(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([accountsApi.list(), categoriesApi.list(), tagsApi.list(), projectsApi.list()]).then(
      ([accts, cats, tgs, projs]) => {
        setAccounts(accts); setCategories(cats); setTags(tgs); setProjects(projs);
      }
    );
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setForm({
        date: editing.date,
        time: editing.time ?? '',
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
      setLinks((editing.refund_for ?? []).map(l => ({
        id: l.transaction_id, payee: l.payee, date: l.date, total: l.transaction_amount,
        remaining: l.transaction_amount, amount: l.amount.toFixed(2),
      })));
      if (editing.splits && editing.splits.length > 0) {
        setSplitOpen(true);
        setSplits(editing.splits.map(s => ({
          amount: s.amount,
          category_id: s.category_id ?? '',
          notes: s.notes ?? '',
          project_ids: s.projects?.map(p => p.id) ?? [],
        })));
      } else {
        setSplitOpen(false);
        setSplits([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);
      }
    } else if (refundOf) {
      setForm({
        ...emptyForm(),
        type: 'refund',
        payee: refundOf.payee,
        category_id: refundOf.category_id ?? '',
      });
      setLinks([draftFromTxn(refundOf)]);
      setSplitOpen(false);
      setSplits([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);
    } else {
      setForm(emptyForm());
      setLinks([]);
      setSplitOpen(false);
      setSplits([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);
    }
    setShowErrors(false);
    setSaveError('');
  }, [editing, isOpen, refundOf]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Derived ───────────────────────────────────────────────
  const totalAmount     = parseFloat(form.amount) || 0;
  const allocatedAmount = splits.reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
  const remaining       = totalAmount - allocatedAmount;
  const splitBalanced   = Math.abs(remaining) < 0.005;

  const typeColor         = TYPE_COLORS[form.type as keyof typeof TYPE_COLORS] ?? TYPE_COLORS.expense;
  const selectedAccount   = accounts.find(a => a.id === form.account_id);
  const selectedCategory  = categories.find(c => c.id === form.category_id);
  const selectedToAccount = accounts.find(a => a.id === form.to_account_id);
  const selectedTags      = tags.filter(t => form.tag_ids.includes(t.id));

  const filteredCategories = (type?: string) => {
    const t = type ?? form.type;
    return categories.filter(c => {
      if (t === 'income')  return c.type === 'income'  || c.type === 'both';
      if (t === 'expense' || t === 'refund') return c.type === 'expense' || c.type === 'both';
      return false;
    });
  };

  const isRefund        = form.type === 'refund';
  const linkAmounts     = links.map(l => parseFloat(l.amount) || 0);
  const linkedTotal     = linkAmounts.reduce((s, a) => s + a, 0);
  const unallocated     = totalAmount - linkedTotal;
  const overAllocated   = isRefund && unallocated < -0.005;
  const badLinkAmount   = isRefund && linkAmounts.some(a => a <= 0);
  const showSuggestion  = isRefund && linkedTotal > 0 && totalAmount < linkedTotal - 0.005;

  const timeInvalid = !!form.time && !TIME_RE.test(form.time);

  const canSave = !!form.amount && !!form.account_id && !!form.payee && !timeInvalid &&
    (!splitOpen || splitBalanced) && !overAllocated && !badLinkAmount;

  const addLinks = (txns: Transaction[]) => {
    setLinks(prev => [...prev, ...txns.filter(t => !prev.some(l => l.id === t.id)).map(draftFromTxn)]);
    if (!form.payee && txns.length === 1) setForm(f => ({ ...f, payee: txns[0].payee }));
  };
  const updateLinkAmount = (id: string, amount: string) =>
    setLinks(prev => prev.map(l => l.id === id ? { ...l, amount } : l));
  const removeLink = (id: string) => setLinks(prev => prev.filter(l => l.id !== id));

  // ── Actions ───────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave) { setShowErrors(true); return; }
    if (splitOpen && !splitBalanced) return;
    setSaving(true);
    setSaveError('');
    try {
      const payload: TransactionPayload = {
        date: form.date,
        time: form.time || null,
        billing_date: form.billing_date || undefined,
        amount: totalAmount,
        type: form.type,
        category_id: splitOpen ? undefined : (form.category_id || undefined),
        account_id: form.account_id,
        to_account_id: form.to_account_id || undefined,
        payee: form.payee,
        notes: form.notes || undefined,
        tag_ids: form.tag_ids,
        project_ids: splitOpen ? [] : form.project_ids,
        splits: splitOpen
          ? splits.map(s => ({
              amount: parseFloat(String(s.amount)) || 0,
              category_id: s.category_id || undefined,
              notes: s.notes || undefined,
              project_ids: s.project_ids ?? [],
            }))
          : undefined,
        refund_links: isRefund
          ? links.map(l => ({ original_id: l.id, amount: parseFloat(l.amount) || 0 }))
          : editing ? [] : undefined,
      };
      if (editing) {
        await transactionsApi.update(editing.id, payload);
      } else {
        await transactionsApi.create(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail ?? 'Could not save the transaction');
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

  const toggleSplitOpen = () => {
    if (!splitOpen) {
      setSplits([
        { amount: totalAmount, category_id: form.category_id, notes: '', project_ids: [] },
        { amount: 0, category_id: '', notes: '', project_ids: [] },
      ]);
    }
    setSplitOpen(v => !v);
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

  const addSplit    = () => setSplits(prev => [...prev, { amount: remaining > 0 ? remaining : 0, category_id: '', notes: '', project_ids: [] }]);
  const removeSplit = (i: number) => setSplits(prev => prev.filter((_, idx) => idx !== i));

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#0f1829', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
          <h2 className="text-lg font-bold text-white" style={{ letterSpacing: '-0.02em' }}>
            {editing ? 'Edit Transaction' : form.type === 'refund' ? 'New Refund' : 'New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#6b7280' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#dae2fd'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-4">

          {/* ── 1. Type toggle ──────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2">
            {(['income', 'expense', 'transfer', 'refund'] as const).map(t => {
              const c = TYPE_COLORS[t];
              const active = form.type === t;
              const icons = {
                income:   <ArrowUp size={12} strokeWidth={2.5} />,
                expense:  <ArrowDown size={12} strokeWidth={2.5} />,
                transfer: <ArrowLeftRight size={12} strokeWidth={2.5} />,
                refund:   <Undo2 size={12} strokeWidth={2.5} />,
              };
              const labels = {
                income: 'Income', expense: 'Expense', transfer: 'Transfer', refund: 'Refund',
              };
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: t, category_id: '', to_account_id: '' }))}
                  className="rounded-xl border py-2.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
                  style={{
                    background:  active ? c.bg    : 'transparent',
                    color:       active ? c.text  : '#4b5563',
                    borderColor: active ? c.border : 'rgba(255,255,255,0.07)',
                  }}
                >
                  {icons[t]}
                  {labels[t]}
                </button>
              );
            })}
          </div>

          {/* ── 2. Hero amount ──────────────────────────────── */}
          {(() => {
            const amtError = showErrors && !form.amount;
            return (
              <div
                className="rounded-xl px-6 py-4 text-center relative transition-all"
                style={{
                  background: SURFACE,
                  border: amtError ? '1px solid rgba(255,100,100,0.45)' : '1px solid transparent',
                  boxShadow: amtError ? '0 0 0 3px rgba(255,100,100,0.08)' : 'none',
                }}
              >
                {amtError && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <AlertCircle size={13} style={{ color: '#ffb4ab' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#ffb4ab' }}>Required</span>
                  </div>
                )}
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: amtError ? '#ffb4ab' : '#6b7280' }}>Amount</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold" style={{ color: '#374151' }}>€</span>
                  <input
                    ref={amountRef}
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    className="bg-transparent border-none outline-none text-4xl font-bold text-center w-40"
                    style={{ color: typeColor.text, caretColor: typeColor.text }}
                  />
                </div>
                {showSuggestion && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, amount: linkedTotal.toFixed(2) }))}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:brightness-125"
                    style={{ background: 'rgba(196,181,253,0.12)', color: '#c4b5fd', border: '1px solid rgba(196,181,253,0.3)' }}
                  >
                    <Undo2 size={11} />
                    Use €{linkedTotal.toFixed(2)}
                    <span style={{ color: '#8b7fc7' }}>
                      · {links.length > 1 ? `sum of ${links.length} linked` : 'linked amount'}
                    </span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* ── 3. Payee + Date ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const payeeError = showErrors && !form.payee;
              return (
                <div ref={payeeRef} className="relative">
                  <div
                    className="rounded-xl px-3 py-2.5 transition-all"
                    style={{
                      background: SURFACE,
                      border: payeeError ? '1px solid rgba(255,100,100,0.45)' : '1px solid transparent',
                      boxShadow: payeeError ? '0 0 0 3px rgba(255,100,100,0.08)' : 'none',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] uppercase tracking-widest" style={{ color: payeeError ? '#ffb4ab' : '#6b7280' }}>Payee</p>
                      {payeeError && <AlertCircle size={12} style={{ color: '#ffb4ab' }} />}
                    </div>
                    <input
                      className="w-full bg-transparent text-sm outline-none"
                      style={{ color: '#dae2fd' }}
                      placeholder={payeeError ? 'Required' : 'e.g. REWE'}
                      value={form.payee}
                      onChange={e => {
                        setForm(f => ({ ...f, payee: e.target.value }));
                        setShowPayeeSug(true);
                        setPayeeHighlight(-1);
                      }}
                      onFocus={() => setShowPayeeSug(true)}
                      onBlur={() => setTimeout(() => setShowPayeeSug(false), 120)}
                      onKeyDown={onPayeeKeyDown}
                    />
                  </div>
                  {/* Suggestions dropdown */}
                  {showPayeeSug && filteredPayees.length > 0 && (
                    <div
                      className="absolute left-0 right-0 z-50 rounded-xl overflow-hidden mt-1"
                      style={{ background: '#131c30', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                    >
                      {filteredPayees.map((name, i) => (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); selectPayee(name); }}
                          className="w-full text-left px-3 py-2 text-sm transition-colors"
                          style={{
                            color: '#dae2fd',
                            background: i === payeeHighlight ? 'rgba(142,213,255,0.1)' : 'transparent',
                            borderBottom: i < filteredPayees.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            <div
              className="rounded-xl px-3 py-2.5 transition-all"
              style={{
                background: SURFACE,
                border: timeInvalid && showErrors ? '1px solid rgba(255,100,100,0.45)' : '1px solid transparent',
              }}
            >
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: timeInvalid && showErrors ? '#ffb4ab' : '#6b7280' }}>
                Date &amp; time
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                  style={{ color: '#dae2fd', colorScheme: 'dark' }}
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                />
                <input
                  inputMode="numeric"
                  aria-label="Time (24h)"
                  placeholder="HH:MM"
                  maxLength={5}
                  className="w-[3.25rem] shrink-0 bg-transparent text-sm outline-none tabular-nums pl-2"
                  style={{ color: timeInvalid ? '#ffb4ab' : '#dae2fd', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: formatTimeInput(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* ── 3b. Covered transactions (refund only) ──────── */}
          {isRefund && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(196,181,253,0.05)', border: '1px solid rgba(196,181,253,0.18)' }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Undo2 size={15} style={{ color: '#c4b5fd' }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: '#c4b5fd' }}>Refund for</p>
                    <p className="text-xs" style={{ color: '#6b7280' }}>
                      {links.length === 0 ? 'Link the expenses this covers — unlinked amounts count as income'
                        : `${links.length} transaction${links.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-[10px] font-bold uppercase tracking-tight px-2.5 py-1 rounded-full"
                  style={{ color: '#c4b5fd', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(196,181,253,0.1)' }}
                >
                  + Link
                </button>
              </div>

              {links.length > 0 && (
                <>
                  {links.map(l => {
                    const amt = parseFloat(l.amount) || 0;
                    const exceeds = amt > l.remaining + 0.005;
                    const invalid = amt <= 0;
                    return (
                      <div
                        key={l.id}
                        className="flex items-center gap-2.5 px-4 py-2"
                        style={{ borderTop: '1px solid rgba(196,181,253,0.1)' }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          {l.categoryIcon ?? '🧾'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: '#dae2fd' }}>{l.payee || '—'}</p>
                          <p className="text-[11px]" style={{ color: exceeds ? '#f59e0b' : '#6b7280' }}>
                            {new Date(l.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' · of '}{l.total.toFixed(2)}
                            {exceeds && ` · only ${l.remaining.toFixed(2)} unrefunded`}
                          </p>
                        </div>
                        <div
                          className="flex items-center rounded-lg px-2 py-1 shrink-0"
                          style={{
                            background: SURFACE_HI,
                            border: `1px solid ${invalid && showErrors ? 'rgba(255,100,100,0.5)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          <span className="text-xs mr-1" style={{ color: '#4b5563' }}>€</span>
                          <input
                            type="number" min={0} step="0.01"
                            value={l.amount}
                            onChange={e => updateLinkAmount(l.id, e.target.value)}
                            className="w-16 bg-transparent text-sm text-right outline-none tabular-nums"
                            style={{ color: '#c4b5fd' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLink(l.id)}
                          className="p-1 transition-colors hover:text-[#ffb4ab]"
                          style={{ color: '#4b5563' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Allocation bar */}
                  <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{ borderTop: '1px solid rgba(196,181,253,0.1)' }}
                  >
                    <span className="text-[11px]" style={{ color: '#6b7280' }}>
                      Offsets {linkedTotal.toFixed(2)} of expenses
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        background: overAllocated ? 'rgba(255,180,171,0.15)'
                          : !totalAmount ? 'rgba(255,255,255,0.05)'
                          : Math.abs(unallocated) < 0.005 ? 'rgba(196,181,253,0.15)' : 'rgba(78,222,163,0.15)',
                        color: overAllocated ? '#ffb4ab'
                          : !totalAmount ? '#6b7280'
                          : Math.abs(unallocated) < 0.005 ? '#c4b5fd' : '#4edea3',
                      }}
                    >
                      {!totalAmount
                        ? 'Enter refund amount'
                        : overAllocated
                        ? `Over by ${Math.abs(unallocated).toFixed(2)}`
                        : Math.abs(unallocated) < 0.005
                        ? '✓ Fully allocated'
                        : `+${unallocated.toFixed(2)} booked as income`}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 4. Field rows card ──────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ background: SURFACE }}>

            {/* Account row */}
            <FieldRow
              icon={<span>{accountIcon(selectedAccount?.type)}</span>}
              label="Account"
              value={selectedAccount ? `${selectedAccount.name} (${selectedAccount.currency})` : ''}
              placeholder="Select account"
              error={showErrors && !form.account_id}
              select={
                <CustomSelect
                  invisible
                  value={form.account_id}
                  onChange={v => setForm(f => ({ ...f, account_id: v }))}
                  options={[
                    { value: '', label: 'Select account' },
                    ...accounts.map(a => ({ value: a.id, label: `${a.name} (${a.currency})` })),
                  ]}
                />
              }
            />

            {/* Category / To Account row */}
            {form.type === 'transfer' ? (
              <FieldRow
                icon={<ArrowLeftRight size={14} style={{ color: '#8ed5ff' }} />}
                label="To Account"
                value={selectedToAccount?.name ?? ''}
                placeholder="Select destination"
                noBorder
                select={
                  <CustomSelect
                    invisible
                    value={form.to_account_id}
                    onChange={v => setForm(f => ({ ...f, to_account_id: v }))}
                    options={[
                      { value: '', label: 'Select account' },
                      ...accounts.filter(a => a.id !== form.account_id).map(a => ({ value: a.id, label: a.name })),
                    ]}
                  />
                }
              />
            ) : splitOpen ? (
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(142,213,255,0.08)' }}>
                  <Split size={13} style={{ color: '#8ed5ff' }} />
                </div>
                <p className="text-sm" style={{ color: '#8ed5ff' }}>Categories set per split below</p>
              </div>
            ) : (
              <FieldRow
                icon={<span>{selectedCategory?.icon ?? '🗂️'}</span>}
                label="Category"
                value={selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : ''}
                placeholder="Select category"
                noBorder
                extra={
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setShowCategoryInput(v => !v); }}
                    className="text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full transition-colors z-10 relative"
                    style={{ color: '#8ed5ff', border: '1px solid rgba(142,213,255,0.3)', background: 'rgba(142,213,255,0.08)' }}
                  >
                    + New
                  </button>
                }
                select={
                  <CustomSelect
                    invisible
                    value={form.category_id}
                    onChange={v => setForm(f => ({ ...f, category_id: v }))}
                    options={[
                      { value: '', label: 'No category' },
                      ...filteredCategories().map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })),
                    ]}
                  />
                }
              />
            )}

            {/* Notes row */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <input
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: '#bdc8d1' }}
                placeholder="Add a note…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Billing date (credit card only) */}
            {selectedAccount?.type === 'credit_card' && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  📅
                </div>
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: '#6b7280' }}>Billing Date (optional)</p>
                  <input
                    type="date"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: '#dae2fd', colorScheme: 'dark' }}
                    value={form.billing_date}
                    onChange={e => setForm(f => ({ ...f, billing_date: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Inline new category form */}
          {showCategoryInput && form.type !== 'transfer' && !splitOpen && (
            <div className="rounded-xl p-3 space-y-2.5" style={{ background: SURFACE, border: '1px solid rgba(142,213,255,0.2)' }}>
              <div className="flex items-center gap-2">
                <input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                  placeholder="Category name"
                  autoFocus
                  className="flex-1 text-sm px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: SURFACE_HI, border: '1px solid rgba(255,255,255,0.08)', color: '#dae2fd' }}
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={!newCatName.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 whitespace-nowrap"
                  style={{ background: '#38bdf8', color: '#004965' }}
                >
                  Add
                </button>
                <button type="button" onClick={() => setShowCategoryInput(false)}>
                  <X size={14} style={{ color: '#6b7280' }} />
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-wrap gap-1">
                  {CATEGORY_ICONS.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setNewCatIcon(icon)}
                      className="w-7 h-7 rounded text-sm flex items-center justify-center transition-all"
                      style={{
                        background: newCatIcon === icon ? 'rgba(142,213,255,0.15)' : 'transparent',
                        outline: newCatIcon === icon ? '1px solid rgba(142,213,255,0.4)' : 'none',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 shrink-0">
                  {CATEGORY_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatColor(c)}
                      className="w-4 h-4 rounded-full border-2 transition-all"
                      style={{ background: c, borderColor: newCatColor === c ? '#fff' : 'transparent' }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 5. Tags collapsible ─────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ background: SURFACE }}>
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.03]"
              onClick={() => setTagsOpen(v => !v)}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <TagIcon size={13} style={{ color: '#6b7280' }} />
                </div>
                <p className="text-sm" style={{ color: '#6b7280' }}>Tags</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedTags.length > 0 ? (
                  <div className="flex gap-1 items-center">
                    {selectedTags.slice(0, 3).map(t => (
                      <span key={t.id} className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                    ))}
                    {selectedTags.length > 3 && (
                      <span className="text-[10px]" style={{ color: '#6b7280' }}>+{selectedTags.length - 3}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: '#4b5563' }}>None</span>
                )}
                <ChevronDown
                  size={15}
                  style={{ color: '#4b5563', transform: tagsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                />
              </div>
            </button>

            {tagsOpen && (
              <div className="px-4 pb-4 pt-1" style={{ borderTop: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-end mb-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setShowTagInput(v => !v)}
                    className="text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full transition-colors"
                    style={{ color: '#8ed5ff', border: '1px solid rgba(142,213,255,0.3)', background: 'rgba(142,213,255,0.08)' }}
                  >
                    + New tag
                  </button>
                </div>
                {showTagInput && (
                  <div className="flex items-center gap-2 mb-3 p-2 rounded-lg" style={{ background: SURFACE_HI }}>
                    <input
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateTag()}
                      placeholder="Tag name"
                      autoFocus
                      className="flex-1 text-sm border rounded px-2 py-1 outline-none bg-transparent"
                      style={{ color: '#dae2fd', borderColor: 'rgba(255,255,255,0.12)' }}
                    />
                    <div className="flex gap-1">
                      {TAG_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setNewTagColor(c)}
                          className="w-4 h-4 rounded-full border-2 transition-all"
                          style={{ background: c, borderColor: newTagColor === c ? '#fff' : 'transparent' }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                      className="text-xs px-2 py-1 rounded disabled:opacity-40"
                      style={{ background: '#38bdf8', color: '#004965', fontWeight: 700 }}
                    >
                      Add
                    </button>
                    <button type="button" onClick={() => setShowTagInput(false)}>
                      <X size={13} style={{ color: '#6b7280' }} />
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {tags.length === 0 && !showTagInput && (
                    <span className="text-xs self-center" style={{ color: '#4b5563' }}>No tags yet</span>
                  )}
                  {tags.map(tag => {
                    const active = form.tag_ids.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          tag_ids: active
                            ? f.tag_ids.filter(id => id !== tag.id)
                            : [...f.tag_ids, tag.id],
                        }))}
                        className="px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all"
                        style={{
                          background: `${tag.color}22`,
                          color: tag.color,
                          borderColor: active ? tag.color : 'transparent',
                          opacity: active ? 1 : 0.45,
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>

                {/* Projects (non-split) */}
                {form.type !== 'transfer' && projects.length > 0 && (
                  <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                    <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#6b7280' }}>Projects</p>
                    <div className="flex flex-wrap gap-1.5">
                      {projects.map(p => {
                        const active = form.project_ids.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setForm(f => ({
                              ...f,
                              project_ids: active
                                ? f.project_ids.filter(id => id !== p.id)
                                : [...f.project_ids, p.id],
                            }))}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all"
                            style={{
                              background: `${p.color}22`,
                              color: p.color,
                              borderColor: active ? p.color : 'transparent',
                              opacity: active ? 1 : 0.45,
                            }}
                          >
                            {p.icon} {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 6. Split collapsible ────────────────────────── */}
          {form.type !== 'transfer' && form.type !== 'refund' && (
            <div className="rounded-xl overflow-hidden" style={{ background: SURFACE }}>
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.03]"
                onClick={toggleSplitOpen}
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: splitOpen ? 'rgba(142,213,255,0.08)' : 'rgba(255,255,255,0.04)' }}>
                    <Split size={13} style={{ color: splitOpen ? '#8ed5ff' : '#6b7280' }} />
                  </div>
                  <p className="text-sm" style={{ color: splitOpen ? '#8ed5ff' : '#6b7280' }}>Split transaction</p>
                </div>
                <ChevronDown
                  size={15}
                  style={{ color: '#4b5563', transform: splitOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                />
              </button>

              {splitOpen && (
                <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  {splits.map((split, i) => (
                    <div key={i} className="space-y-1.5 pb-3"
                      style={{ borderBottom: i < splits.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div className="flex items-start gap-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={split.amount || ''}
                          onChange={e => updateSplit(i, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="0.00"
                          className="w-24 shrink-0 px-2 py-1.5 text-sm rounded-lg outline-none"
                          style={{ background: SURFACE_HI, border: '1px solid rgba(255,255,255,0.08)', color: '#dae2fd' }}
                        />
                        <CustomSelect
                          value={split.category_id ?? ''}
                          onChange={v => updateSplit(i, 'category_id', v)}
                          options={[
                            { value: '', label: 'No category' },
                            ...filteredCategories().map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })),
                          ]}
                          placeholder="No category"
                          className="flex-1 py-1.5 text-sm"
                        />
                        <input
                          type="text"
                          value={split.notes ?? ''}
                          onChange={e => updateSplit(i, 'notes', e.target.value)}
                          placeholder="Note…"
                          className="flex-1 px-2 py-1.5 text-sm rounded-lg outline-none"
                          style={{ background: SURFACE_HI, border: '1px solid rgba(255,255,255,0.08)', color: '#dae2fd' }}
                        />
                        {splits.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeSplit(i)}
                            className="mt-1 p-1 transition-colors"
                            style={{ color: '#4b5563' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ffb4ab')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#4b5563')}
                          >
                            <X size={14} />
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
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all"
                                style={{
                                  background: `${p.color}22`,
                                  color: p.color,
                                  borderColor: active ? p.color : 'transparent',
                                  opacity: active ? 1 : 0.4,
                                }}>
                                {p.icon} {p.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Balance bar */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={addSplit}
                      className="flex items-center gap-1 text-xs font-semibold"
                      style={{ color: '#8ed5ff' }}
                    >
                      <Plus size={12} /> Add split
                    </button>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        background: splitBalanced
                          ? 'rgba(78,222,163,0.15)'
                          : remaining > 0
                          ? 'rgba(245,158,11,0.15)'
                          : 'rgba(255,180,171,0.15)',
                        color: splitBalanced ? '#4edea3' : remaining > 0 ? '#f59e0b' : '#ffb4ab',
                      }}
                    >
                      {splitBalanced
                        ? `✓ ${allocatedAmount.toFixed(2)} balanced`
                        : remaining > 0
                        ? `${allocatedAmount.toFixed(2)} / ${totalAmount.toFixed(2)} — ${remaining.toFixed(2)} left`
                        : `Over by ${Math.abs(remaining).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 7. Action buttons ───────────────────────────── */}
          {(saveError || (showErrors && (overAllocated || badLinkAmount || timeInvalid))) && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
              style={{ background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.3)', color: '#ffb4ab' }}
            >
              <AlertCircle size={13} className="shrink-0" />
              {saveError
                || (timeInvalid ? 'Time must be in 24-hour HH:MM format, e.g. 09:30 or 18:45'
                : overAllocated ? 'Linked amounts exceed the refund amount'
                : 'Each linked transaction needs an amount greater than zero')}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#bdc8d1', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: '#38bdf8',
                color: '#004965',
                opacity: (!canSave && !showErrors) ? 0.4 : 1,
              }}
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>

        </div>
      </div>

      <RefundLinkPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={addLinks}
        excludeIds={[...links.map(l => l.id), ...(editing ? [editing.id] : [])]}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
};
