import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ChevronDown, Plus, X, ArrowDown, ArrowUp, ArrowLeftRight, Tag as TagIcon, Split, Undo2,
  CalendarDays, MessageSquare, FolderOpen, CheckCircle2, Trash2, Users, HandCoins,
} from 'lucide-react';
import { CustomSelect } from '../ui/CustomSelect';
import { RefundLinkPicker, remainingRefundable } from './RefundLinkPicker';
import { transactionsApi, TransactionPayload, SplitPayload } from '../../api/transactions';
import { createTransaction, isNetworkError } from '../../lib/offlineQueue';
import { accountsApi } from '../../api/accounts';
import { categoriesApi } from '../../api/categories';
import { tagsApi } from '../../api/tags';
import { projectsApi } from '../../api/projects';
import { Account, Category, Tag, Transaction, Project } from '../../types';
import { localISODate } from '../../lib/dates';
import { pickable, accountLabel } from '../../lib/accounts';

const TAG_COLORS = [
  '#6366f1', '#22c55e', '#f97316', '#ef4444', '#3b82f6',
  '#ec4899', '#f59e0b', '#14b8a6', '#8b5cf6', '#84cc16',
];

const CATEGORY_COLORS = TAG_COLORS;
const CATEGORY_ICONS = ['🛒', '🍔', '🚗', '🏠', '💊', '🎮', '✈️', '📚', '💼', '💰', '🎁', '⚡', '📱', '🏋️', '🎨'];

// ── Color palette ─────────────────────────────────────────
const SURFACE    = 'var(--surface)';
const SURFACE_HI = 'var(--surface-hi)';
const BORDER     = 'rgba(255,255,255,0.06)';

const TYPE_COLORS = {
  income:   { text: 'var(--income)', bg: 'rgb(var(--income-rgb) / 0.15)',  border: 'rgb(var(--income-rgb) / 0.4)'  },
  expense:  { text: 'var(--expense)', bg: 'rgb(var(--expense-rgb) / 0.15)', border: 'rgb(var(--expense-rgb) / 0.4)' },
  transfer: { text: 'var(--transfer)', bg: 'rgb(var(--transfer-rgb) / 0.15)', border: 'rgb(var(--transfer-rgb) / 0.4)' },
  refund:   { text: 'var(--refund)', bg: 'rgb(var(--refund-rgb) / 0.15)', border: 'rgb(var(--refund-rgb) / 0.4)' },
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
  /** Small note beside the label, e.g. where a prefilled value came from */
  hint?: string;
}

const FieldRow: React.FC<FieldRowProps> = ({ icon, label, value, placeholder, extra, select, noBorder, error, hint }) => (
  <div
    className="relative flex items-center justify-between px-4 py-3 group cursor-pointer transition-colors hover:bg-white/[0.03]"
    style={{
      borderBottom: noBorder ? 'none' : `1px solid ${BORDER}`,
      background: error ? 'rgb(var(--expense-rgb) / 0.05)' : undefined,
    }}
  >
    <div className="flex items-center gap-3 min-w-0">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm transition-colors"
        style={{ background: error ? 'rgb(var(--expense-rgb) / 0.12)' : 'rgba(255,255,255,0.04)' }}
      >
        {error ? <AlertCircle size={14} style={{ color: 'var(--expense)' }} /> : icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs leading-none mb-0.5"
          style={{ color: error ? 'var(--expense)' : 'var(--muted)' }}>
          {label}
          {hint && <span className="normal-case tracking-normal" style={{ color: 'var(--accent)' }}> · {hint}</span>}
        </p>
        <p className="text-sm font-medium truncate" style={{ color: value ? 'var(--text)' : error ? 'var(--expense)' : 'var(--faint)' }}>
          {value || (error ? 'Required' : placeholder)}
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0 ml-2">
      {extra}
      <ChevronDown size={15} style={{ color: error ? 'var(--expense)' : 'var(--faint)' }} />
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
  for_others: string;   // expense: the part spent on other people
  paid_back: boolean;   // income: someone paying me back
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

// Amounts are typed as text with a euro decimal comma ("12,50"): keep digits and one comma, max 2 decimals.
const cleanAmountInput = (raw: string) => {
  const digits = raw.replace(/[^\d.,]/g, '');
  // "12.50" -> "12,50"; with a comma present, dots are thousands separators ("1.234,56")
  const s = digits.includes(',') ? digits.replace(/\./g, '') : digits.replace('.', ',');
  const i = s.search(/[.,]/);
  return i === -1 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/[.,]/g, '').slice(0, 2);
};

const parseAmount = (s: string) => parseFloat(s.replace(',', '.')) || 0;
// A stored amount as the form shows it: "12,50", or "12" when whole
const toAmountInput = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));
const fmtAmount = (v: number) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const todayISO = () => localISODate();

const SHARED_LOOKBACK_DAYS = 120;
const shortDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** What this payee's latest expense and income looked like, for suggestions. */
interface PayeeHistory {
  payee: string;                                       // lower-case
  others?: { ratio: number; date: string };            // share of the last expense for others
  paidBack?: string;                                   // date of the last income, if it was paid back
}

function historyOf(payee: string, txns: Transaction[]): PayeeHistory {
  const own = txns.filter(t => t.payee.trim().toLowerCase() === payee);
  const expense = own.find(t => t.type === 'expense');
  const income = own.find(t => t.type === 'income');
  return {
    payee,
    others: expense && expense.amount > 0 && (expense.for_others ?? 0) > 0
      ? { ratio: expense.for_others! / expense.amount, date: expense.date } : undefined,
    paidBack: income?.paid_back ? income.date : undefined,
  };
}

/** "½" when my share was a half, and so on; otherwise a percentage. */
function shareLabel(myRatio: number) {
  for (const [f, label] of [[1 / 2, '½'], [1 / 3, '⅓'], [1 / 4, '¼']] as const) {
    if (Math.abs(myRatio - f) < 0.01) return label;
  }
  return `${Math.round(myRatio * 100)}%`;
}

/** A recent expense whose part for others (whole, or one person's even share) equals the amount. */
function matchSharedExpense(amount: number, payee: string, expenses: Transaction[]) {
  if (amount <= 0) return null;
  for (const t of expenses) {
    const others = t.for_others ?? 0;
    const people = Math.max(1, Math.round(t.amount / Math.max(0.01, t.amount - others)) - 1);
    if (Math.abs(others - amount) < 0.005) return { txn: t, why: 'amount' as const };
    if (people > 1 && Math.abs(others / people - amount) < 0.005) return { txn: t, why: 'share' as const };
  }
  const name = payee.trim().toLowerCase();
  if (!name) return null;
  const tagged = expenses.find(t => t.tags?.some(tag => tag.name.trim().toLowerCase() === name));
  return tagged ? { txn: tagged, why: 'tag' as const } : null;
}

// The account used for the previous new transaction is the default for the next one
const LAST_ACCOUNT_KEY = 'last_account_id';
const readLastAccount = () => {
  try { return localStorage.getItem(LAST_ACCOUNT_KEY) ?? ''; } catch { return ''; }
};
const rememberAccount = (id: string) => {
  try { localStorage.setItem(LAST_ACCOUNT_KEY, id); } catch { /* storage unavailable */ }
};

type DetailPanel = 'note' | 'tags' | 'projects' | 'others';

const emptyForm = (): TxnForm => ({
  date: todayISO(),
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
  for_others: '',
  paid_back: false,
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Transaction | null;
  refundOf?: Transaction | null;
  /** Prefills the date of a new transaction (e.g. backfilling a missed day). */
  defaultDate?: string;
  /** Shown as header actions while editing (the only way to reach them on a phone) */
  onDelete?: () => void;
  onRefund?: () => void;
}

export const TransactionFormModal: React.FC<Props> = ({ isOpen, onClose, onSaved, editing, refundOf, defaultDate, onDelete, onRefund }) => {
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

  // Optional details: which one is expanded, and whether split mode is on
  const [openPanel, setOpenPanel] = useState<DetailPanel | null>(null);
  const [splitOpen, setSplitOpen] = useState(false);

  // Category/account prefilled from the payee's last transaction, until the user picks one
  const [autoFilled, setAutoFilled] = useState({ category: false, account: false });
  const [touched, setTouched]       = useState({ category: false, account: false });

  // Suggestions for "for others" / "paid back": offered, never filled in on their own
  const [payeeHistory, setPayeeHistory] = useState<PayeeHistory | null>(null);
  const [sharedExpenses, setSharedExpenses] = useState<Transaction[] | null>(null);
  const [dismissedHints, setDismissedHints] = useState<string[]>([]);

  // "Add & next" confirmation, e.g. "REWE · 12,40"
  const [lastSaved, setLastSaved] = useState('');

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

  const amountRef      = useRef<HTMLInputElement>(null);
  const payeeInputRef  = useRef<HTMLInputElement>(null);
  const formRef        = useRef(form);
  formRef.current      = form;
  // Payee confirmed with Enter; a second Enter on the same payee saves
  const confirmedPayee = useRef('');

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
    confirmedPayee.current = name;
    autofillFromPayee(name);
  };

  const onPayeeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter on a new payee confirms it (and fills the rest) instead of saving straight away
    if (e.key === 'Enter' && payeeHighlight < 0 && form.payee.trim() && confirmedPayee.current !== form.payee) {
      e.preventDefault();
      setShowPayeeSug(false);
      confirmedPayee.current = form.payee;
      autofillFromPayee(form.payee);
      return;
    }
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
        amount: toAmountInput(editing.amount),
        type: editing.type,
        category_id: editing.category_id ?? '',
        account_id: editing.account_id,
        to_account_id: editing.to_account_id ?? '',
        payee: editing.payee,
        notes: editing.notes ?? '',
        tag_ids: editing.tags?.map(t => t.id) ?? [],
        project_ids: editing.projects?.map(p => p.id) ?? [],
        for_others: editing.for_others ? editing.for_others.toFixed(2).replace('.', ',') : '',
        paid_back: !!editing.paid_back,
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
      // A backfilled day has no meaningful "now" time, so leave it blank
      const base = { ...emptyForm(), account_id: readLastAccount() };
      // Don't start on an account that has since been made inactive
      if (base.account_id) accountsApi.get(base.account_id).then(a => {
        if (!a.is_active) setForm(f => (f.account_id === a.id ? { ...f, account_id: '' } : f));
      }).catch(() => {});
      setForm(defaultDate ? { ...base, date: defaultDate, time: '' } : base);
      setLinks([]);
      setSplitOpen(false);
      setSplits([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);
    }
    setShowErrors(false);
    setSaveError('');
    setOpenPanel(null);
    setAutoFilled({ category: false, account: false });
    setTouched({ category: false, account: false });
    setPayeeHistory(null);
    setSharedExpenses(null);
    setDismissedHints([]);
    setLastSaved('');
    confirmedPayee.current = '';
  }, [editing, isOpen, refundOf, defaultDate]);

  // Amount comes first: focus it (and raise the number keypad) when adding
  useEffect(() => {
    if (!isOpen || editing) return;
    // Right away (keeps the keyboard a tap raised), and once more after the sheet settles
    amountRef.current?.focus();
    const id = setTimeout(() => amountRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [isOpen, editing]);

  // Recent expenses partly for others, to spot money being paid back
  const wantShared = isOpen && !editing && form.type === 'income' && sharedExpenses === null;
  useEffect(() => {
    if (!wantShared) return;
    const from = new Date();
    from.setDate(from.getDate() - SHARED_LOOKBACK_DAYS);
    transactionsApi.list({ type: 'expense', date_from: localISODate(from), limit: 1000 })
      .then(txns => setSharedExpenses(txns.filter(t => (t.for_others ?? 0) > 0)))
      .catch(() => setSharedExpenses([]));
  }, [wantShared]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Derived ───────────────────────────────────────────────
  const totalAmount     = parseAmount(form.amount);
  const allocatedAmount = splits.reduce((s, r) => s + (parseFloat(String(r.amount)) || 0), 0);
  const remaining       = totalAmount - allocatedAmount;
  const splitBalanced   = Math.abs(remaining) < 0.005;
  const othersAmount    = form.type === 'expense' ? parseAmount(form.for_others) : 0;
  const othersTooBig    = othersAmount > totalAmount + 0.005;

  // One suggestion at a time; it only fills anything in when tapped
  const payeeKey = form.payee.trim().toLowerCase();
  const history  = payeeHistory && payeeHistory.payee === payeeKey ? payeeHistory : null;
  let hint: { key: string; icon: React.ReactNode; text: React.ReactNode; action: string; apply: () => void } | null = null;
  if (!editing && form.type === 'expense' && othersAmount === 0 && totalAmount > 0 && history?.others) {
    const { ratio, date } = history.others;
    const value = Math.round(totalAmount * ratio * 100) / 100;
    hint = {
      key: `others:${payeeKey}`,
      icon: <Users size={14} />,
      text: <>On {shortDate(date)} at {form.payee.trim()}, your share was {shareLabel(1 - ratio)}.</>,
      action: `For others ${fmtAmount(value)}`,
      apply: () => setForm(f => ({ ...f, for_others: toAmountInput(value) })),
    };
  } else if (!editing && form.type === 'income' && !form.paid_back) {
    const markPaidBack = () => setForm(f => ({ ...f, paid_back: true }));
    const match = history?.paidBack ? null : matchSharedExpense(totalAmount, form.payee, sharedExpenses ?? []);
    if (history?.paidBack) {
      hint = {
        key: `paidback:${payeeKey}`,
        icon: <HandCoins size={14} />,
        text: <>The last money from {form.payee.trim()} ({shortDate(history.paidBack)}) was paid back to you.</>,
        action: 'Paid back',
        apply: markPaidBack,
      };
    } else if (match) {
      const t = match.txn;
      hint = {
        key: `paidback:${t.id}:${match.why}`,
        icon: <HandCoins size={14} />,
        text: match.why === 'amount'
          ? <>Matches the {fmtAmount(totalAmount)} you paid for others at {t.payee} on {shortDate(t.date)}.</>
          : match.why === 'share'
          ? <>Matches one person's share of the {fmtAmount(t.for_others ?? 0)} you paid for others at {t.payee} on {shortDate(t.date)}.</>
          : <>{form.payee.trim()} is tagged on {t.payee} ({shortDate(t.date)}), where {fmtAmount(t.for_others ?? 0)} was for others.</>,
        action: 'Paid back',
        apply: markPaidBack,
      };
    }
  }
  if (hint && dismissedHints.includes(hint.key)) hint = null;

  const typeColor         = TYPE_COLORS[form.type as keyof typeof TYPE_COLORS] ?? TYPE_COLORS.expense;
  const selectedAccount   = accounts.find(a => a.id === form.account_id);
  const selectedCategory  = categories.find(c => c.id === form.category_id);
  const selectedToAccount = accounts.find(a => a.id === form.to_account_id);
  const selectedTags      = tags.filter(t => form.tag_ids.includes(t.id));
  const selectedProjects  = projects.filter(p => form.project_ids.includes(p.id));

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

  const canSave = totalAmount > 0 && !!selectedAccount && !!form.payee && !timeInvalid &&
    (!splitOpen || splitBalanced) && !overAllocated && !badLinkAmount && !othersTooBig;

  const addLinks = (txns: Transaction[]) => {
    setLinks(prev => [...prev, ...txns.filter(t => !prev.some(l => l.id === t.id)).map(draftFromTxn)]);
    if (!form.payee && txns.length === 1) setForm(f => ({ ...f, payee: txns[0].payee }));
  };
  const updateLinkAmount = (id: string, amount: string) =>
    setLinks(prev => prev.map(l => l.id === id ? { ...l, amount } : l));
  const removeLink = (id: string) => setLinks(prev => prev.filter(l => l.id !== id));

  // Fill category and account from this payee's most recent transaction,
  // without overriding anything the user picked themselves.
  async function autofillFromPayee(name: string) {
    const payee = name.trim().toLowerCase();
    if (editing || !payee) return;
    let last: Transaction | undefined;
    let matches: Transaction[];
    try {
      // Enough history that an exact match isn't crowded out by longer names ("Rewe Mitte" for "Rewe")
      matches = (await transactionsApi.list({ search: name.trim(), limit: 300 })).filter(t => t.type !== 'transfer');
    } catch {
      return;
    }
    const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
    last = matches.find(t => norm(t.payee) === norm(payee));
    if (!last) {
      // Typed a shorter name: take the most used payee that starts with it
      const counts = new Map<string, number>();
      for (const t of matches) if (norm(t.payee).startsWith(norm(payee))) counts.set(norm(t.payee), (counts.get(norm(t.payee)) ?? 0) + 1);
      const best = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
      last = best ? matches.find(t => norm(t.payee) === best) : undefined;
    }
    const f = formRef.current;
    if (!last || f.payee.trim().toLowerCase() !== payee) return;
    setPayeeHistory(historyOf(payee, matches));

    const fitsType = filteredCategories(f.type).some(c => c.id === last!.category_id);
    const fillCategory = !touched.category && !splitOpen && fitsType && !!last.category_id;
    const fillAccount  = !touched.account && f.type !== 'transfer' && !!last.account_id &&
      accounts.find(a => a.id === last!.account_id)?.is_active !== false;
    setForm(cur => ({
      ...cur,
      category_id: fillCategory ? last!.category_id! : cur.category_id,
      account_id:  fillAccount  ? last!.account_id   : cur.account_id,
    }));
    setAutoFilled(a => ({ category: fillCategory || a.category, account: fillAccount || a.account }));
  }

  const focusFirstMissing = () => {
    if (!totalAmount) amountRef.current?.focus();
    else if (!form.payee) payeeInputRef.current?.focus();
  };

  // Enter in any field saves once the required fields are filled; otherwise it jumps to
  // the first missing one. Shift+Enter is "Add & next".
  const onFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.defaultPrevented || (e.target as HTMLElement).tagName !== 'INPUT') return;
    e.preventDefault();
    if (!canSave) { focusFirstMissing(); if (totalAmount && form.payee) setShowErrors(true); return; }
    handleSave(e.shiftKey && !editing);
  };

  // ── Actions ───────────────────────────────────────────────
  const handleSave = async (andNext = false) => {
    if (!canSave) { setShowErrors(true); focusFirstMissing(); return; }
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
        for_others: form.type === 'expense' ? Math.min(parseAmount(form.for_others), totalAmount) : 0,
        paid_back: form.type === 'income' && form.paid_back,
      };
      let queued = false;
      if (editing) {
        await transactionsApi.update(editing.id, payload);
      } else {
        queued = (await createTransaction(payload)).queued;
        rememberAccount(form.account_id);
      }
      onSaved();
      if (andNext && !editing) {
        startNext(queued);
      } else {
        onClose();
      }
    } catch (err: any) {
      setSaveError(isNetworkError(err)
        ? "You're offline. New transactions are saved offline, but edits need a connection."
        : err?.response?.data?.detail ?? 'Could not save the transaction');
    } finally {
      setSaving(false);
    }
  };

  // Clear the entry for the next one, keeping account, date and type (handy for backfilling a day)
  const startNext = (queued = false) => {
    setLastSaved(`${form.payee} · ${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(totalAmount)}${queued ? ' (offline, will sync)' : ''}`);
    setForm(f => ({
      ...emptyForm(),
      type: f.type === 'refund' ? 'expense' : f.type,
      account_id: f.account_id,
      date: f.date,
      time: f.date === todayISO() ? nowHHMM() : '',
    }));
    setLinks([]);
    setSplitOpen(false);
    setSplits([{ amount: 0, category_id: '', notes: '', project_ids: [] }]);
    setOpenPanel(null);
    setAutoFilled({ category: false, account: false });
    setTouched(t => ({ ...t, category: false }));
    setPayeeHistory(null);
    setDismissedHints([]);
    setShowErrors(false);
    confirmedPayee.current = '';
    amountRef.current?.focus();
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div
        className="relative w-full md:max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94dvh] md:max-h-[90vh]"
        style={{ background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.06)' }}
        onKeyDown={onFormKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 md:px-6 pt-4 md:pt-5 pb-3 md:pb-4 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-on-surface" style={{ letterSpacing: '-0.02em' }}>
              {editing ? 'Edit Transaction' : form.type === 'refund' ? 'New Refund' : 'New Transaction'}
            </h2>
            {lastSaved && (
              <p className="flex items-center gap-1 text-xs mt-0.5 truncate" style={{ color: 'var(--income)' }}>
                <CheckCircle2 size={12} className="shrink-0" /> Saved {lastSaved}
              </p>
            )}
          </div>
          {/* 40px tinted buttons so they stand out from the fields below */}
          <div className="flex items-center gap-2 shrink-0">
          {editing && onRefund && (
            <button
              type="button"
              onClick={onRefund}
              className="flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold"
              style={{ color: 'var(--refund)', background: 'rgb(var(--refund-rgb) / 0.12)' }}
            >
              <Undo2 size={17} /> Refund
            </button>
          )}
          {editing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-10 h-10 flex items-center justify-center rounded-xl"
              style={{ color: 'var(--expense)', background: 'rgb(var(--expense-rgb) / 0.12)' }}
              aria-label="Delete transaction"
            >
              <Trash2 size={19} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          </div>
        </div>

        <div className="overflow-y-auto overscroll-contain flex-1 px-5 md:px-6 pb-4 space-y-4">

          {/* ── 1. Type toggle ──────────────────────────────── */}
          <div className="grid grid-cols-4 gap-1.5">
            {(['expense', 'income', 'transfer', 'refund'] as const).map(t => {
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
                  onClick={() => {
                    setForm(f => ({ ...f, type: t, category_id: '', to_account_id: '' }));
                    setAutoFilled(a => ({ ...a, category: false }));
                  }}
                  className="rounded-lg border py-2 text-xs font-semibold flex items-center justify-center gap-1 transition-all"
                  style={{
                    background:  active ? c.bg    : 'transparent',
                    color:       active ? c.text  : 'var(--muted)',
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
            const amtError = showErrors && !totalAmount;
            return (
              <div
                className="rounded-xl px-6 py-4 text-center relative transition-all"
                style={{
                  background: SURFACE,
                  border: amtError ? '1px solid rgb(var(--expense-rgb) / 0.45)' : '1px solid transparent',
                  boxShadow: amtError ? '0 0 0 3px rgb(var(--expense-rgb) / 0.08)' : 'none',
                }}
              >
                {amtError && (
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <AlertCircle size={13} style={{ color: 'var(--expense)' }} />
                    <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--expense)' }}>Required</span>
                  </div>
                )}
                <p className="text-xs mb-1" style={{ color: amtError ? 'var(--expense)' : 'var(--muted)' }}>Amount</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-bold" style={{ color: 'var(--faint-2)' }}>€</span>
                  {/* Text + inputMode so phones show the decimal keypad and "12,50" works */}
                  <input
                    ref={amountRef}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    autoComplete="off"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: cleanAmountInput(e.target.value) }))}
                    placeholder="0,00"
                    className="bg-transparent border-none outline-none text-4xl font-bold text-center w-40"
                    style={{ color: typeColor.text, caretColor: typeColor.text }}
                  />
                </div>
                {showSuggestion && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, amount: toAmountInput(linkedTotal) }))}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:brightness-125"
                    style={{ background: 'rgb(var(--refund-rgb) / 0.12)', color: 'var(--refund)', border: '1px solid rgb(var(--refund-rgb) / 0.3)' }}
                  >
                    <Undo2 size={11} />
                    Use €{fmtAmount(linkedTotal)}
                    <span style={{ color: 'var(--refund)' }}>
                      · {links.length > 1 ? `sum of ${links.length} linked` : 'linked amount'}
                    </span>
                  </button>
                )}
              </div>
            );
          })()}

          {/* ── 3b. Covered transactions (refund only) ──────── */}
          {isRefund && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'rgb(var(--refund-rgb) / 0.05)', border: '1px solid rgb(var(--refund-rgb) / 0.18)' }}
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Undo2 size={15} style={{ color: 'var(--refund)' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--refund)' }}>Refund for</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {links.length === 0 ? 'Link the expenses this covers — unlinked amounts count as income'
                        : `${links.length} transaction${links.length > 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs font-bold tracking-tight px-2.5 py-1 rounded-full"
                  style={{ color: 'var(--refund)', border: '1px solid rgb(var(--refund-rgb) / 0.35)', background: 'rgb(var(--refund-rgb) / 0.1)' }}
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
                        style={{ borderTop: '1px solid rgb(var(--refund-rgb) / 0.1)' }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: 'rgba(255,255,255,0.04)' }}>
                          {l.categoryIcon ?? '🧾'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{l.payee || '—'}</p>
                          <p className="text-xs" style={{ color: exceeds ? 'var(--warn)' : 'var(--muted)' }}>
                            {new Date(l.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' · of '}{fmtAmount(l.total)}
                            {exceeds && ` · only ${fmtAmount(l.remaining)} unrefunded`}
                          </p>
                        </div>
                        <div
                          className="flex items-center rounded-lg px-2 py-1 shrink-0"
                          style={{
                            background: SURFACE_HI,
                            border: `1px solid ${invalid && showErrors ? 'rgb(var(--expense-rgb) / 0.5)' : 'rgba(255,255,255,0.08)'}`,
                          }}
                        >
                          <span className="text-xs mr-1" style={{ color: 'var(--faint)' }}>€</span>
                          <input
                            type="number" inputMode="decimal" min={0} step="0.01"
                            value={l.amount}
                            onChange={e => updateLinkAmount(l.id, e.target.value)}
                            className="w-16 bg-transparent text-sm text-right outline-none tabular-nums"
                            style={{ color: 'var(--refund)' }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLink(l.id)}
                          className="p-1 transition-colors hover:text-[var(--expense)]"
                          style={{ color: 'var(--faint)' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Allocation bar */}
                  <div
                    className="flex items-center justify-between px-4 py-2"
                    style={{ borderTop: '1px solid rgb(var(--refund-rgb) / 0.1)' }}
                  >
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      Offsets {fmtAmount(linkedTotal)} of expenses
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        background: overAllocated ? 'rgb(var(--expense-rgb) / 0.15)'
                          : !totalAmount ? 'rgba(255,255,255,0.05)'
                          : Math.abs(unallocated) < 0.005 ? 'rgb(var(--refund-rgb) / 0.15)' : 'rgb(var(--income-rgb) / 0.15)',
                        color: overAllocated ? 'var(--expense)'
                          : !totalAmount ? 'var(--muted)'
                          : Math.abs(unallocated) < 0.005 ? 'var(--refund)' : 'var(--income)',
                      }}
                    >
                      {!totalAmount
                        ? 'Enter refund amount'
                        : overAllocated
                        ? `Over by ${fmtAmount(Math.abs(unallocated))}`
                        : Math.abs(unallocated) < 0.005
                        ? '✓ Fully allocated'
                        : `+${fmtAmount(unallocated)} booked as income`}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── 3. Payee ────────────────────────────────────── */}
          {(() => {
            const payeeError = showErrors && !form.payee;
            return (
              <div ref={payeeRef} className="relative">
                <div
                  className="rounded-xl px-4 py-2.5 transition-all"
                  style={{
                    background: SURFACE,
                    border: payeeError ? '1px solid rgb(var(--expense-rgb) / 0.45)' : '1px solid transparent',
                    boxShadow: payeeError ? '0 0 0 3px rgb(var(--expense-rgb) / 0.08)' : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs" style={{ color: payeeError ? 'var(--expense)' : 'var(--muted)' }}>Payee</p>
                    {payeeError && <AlertCircle size={12} style={{ color: 'var(--expense)' }} />}
                  </div>
                  <input
                    ref={payeeInputRef}
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text)' }}
                    placeholder={payeeError ? 'Required' : 'e.g. REWE'}
                    autoCapitalize="words"
                    autoComplete="off"
                    enterKeyHint="next"
                    value={form.payee}
                    onChange={e => {
                      setForm(f => ({ ...f, payee: e.target.value }));
                      setShowPayeeSug(true);
                      setPayeeHighlight(-1);
                    }}
                    onFocus={() => setShowPayeeSug(true)}
                    onBlur={() => setTimeout(() => {
                      setShowPayeeSug(false);
                      autofillFromPayee(formRef.current.payee);
                    }, 120)}
                    onKeyDown={onPayeeKeyDown}
                  />
                </div>
                {/* Suggestions dropdown */}
                {showPayeeSug && filteredPayees.length > 0 && (
                  <div
                    className="absolute left-0 right-0 z-50 rounded-xl overflow-hidden mt-1"
                    style={{ background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                  >
                    {filteredPayees.map((name, i) => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); selectPayee(name); }}
                        className="w-full text-left px-3 py-2 text-sm transition-colors"
                        style={{
                          color: 'var(--text)',
                          background: i === payeeHighlight ? 'rgb(var(--accent-rgb) / 0.1)' : 'transparent',
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

          {/* ── 4. Field rows card ──────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ background: SURFACE }}>

            {/* Category (or split notice), skipped for transfers */}
            {form.type === 'transfer' ? null : splitOpen ? (
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgb(var(--accent-rgb) / 0.08)' }}>
                  <Split size={13} style={{ color: 'var(--accent)' }} />
                </div>
                <p className="text-sm" style={{ color: 'var(--accent)' }}>Categories set per split below</p>
              </div>
            ) : (
              <FieldRow
                icon={<span>{selectedCategory?.icon ?? '🗂️'}</span>}
                label="Category"
                hint={autoFilled.category ? 'from last time' : undefined}
                value={selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name}` : ''}
                placeholder="Select category"
                extra={
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setShowCategoryInput(v => !v); }}
                    className="text-xs font-bold tracking-tight px-2 py-0.5 rounded-full transition-colors z-10 relative"
                    style={{ color: 'var(--accent)', border: '1px solid rgb(var(--accent-rgb) / 0.3)', background: 'rgb(var(--accent-rgb) / 0.08)' }}
                  >
                    + New
                  </button>
                }
                select={
                  <CustomSelect
                    invisible
                    value={form.category_id}
                    onChange={v => {
                      setForm(f => ({ ...f, category_id: v }));
                      setTouched(t => ({ ...t, category: true }));
                      setAutoFilled(a => ({ ...a, category: false }));
                    }}
                    options={[
                      { value: '', label: 'No category' },
                      ...filteredCategories().map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })),
                    ]}
                  />
                }
              />
            )}

            {/* Account row */}
            <FieldRow
              icon={<span>{accountIcon(selectedAccount?.type)}</span>}
              label={form.type === 'transfer' ? 'From account' : 'Account'}
              hint={autoFilled.account ? 'from last time' : undefined}
              value={selectedAccount ? `${accountLabel(selectedAccount, accounts)} (${selectedAccount.currency})` : ''}
              placeholder="Select account"
              error={showErrors && !selectedAccount}
              select={
                <CustomSelect
                  invisible
                  value={form.account_id}
                  onChange={v => {
                    setForm(f => ({ ...f, account_id: v }));
                    setTouched(t => ({ ...t, account: true }));
                    setAutoFilled(a => ({ ...a, account: false }));
                  }}
                  options={[
                    { value: '', label: 'Select account' },
                    ...pickable(accounts, [form.account_id]).map(a => ({ value: a.id, label: `${accountLabel(a, accounts)} (${a.currency})` })),
                  ]}
                />
              }
            />

            {/* To account (transfers only) */}
            {form.type === 'transfer' && (
              <FieldRow
                icon={<ArrowLeftRight size={14} style={{ color: 'var(--accent)' }} />}
                label="To Account"
                value={selectedToAccount ? accountLabel(selectedToAccount, accounts) : ''}
                placeholder="Select destination"
                select={
                  <CustomSelect
                    invisible
                    value={form.to_account_id}
                    onChange={v => setForm(f => ({ ...f, to_account_id: v }))}
                    options={[
                      { value: '', label: 'Select account' },
                      ...pickable(accounts, [form.to_account_id]).filter(a => a.id !== form.account_id).map(a => ({ value: a.id, label: accountLabel(a, accounts) })),
                    ]}
                  />
                }
              />
            )}

            {/* Date & time */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: timeInvalid && showErrors ? 'rgb(var(--expense-rgb) / 0.12)' : 'rgba(255,255,255,0.04)' }}>
                <CalendarDays size={14} style={{ color: timeInvalid && showErrors ? 'var(--expense)' : 'var(--muted)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs leading-none mb-1" style={{ color: timeInvalid && showErrors ? 'var(--expense)' : 'var(--muted)' }}>
                  Date &amp; time
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none"
                    style={{ color: 'var(--text)', colorScheme: 'dark' }}
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                  <input
                    inputMode="numeric"
                    enterKeyHint="done"
                    aria-label="Time (24h)"
                    placeholder="HH:MM"
                    maxLength={5}
                    className="w-[4.5rem] shrink-0 bg-transparent text-sm font-medium outline-none tabular-nums pl-2"
                    style={{ color: timeInvalid ? 'var(--expense)' : 'var(--text)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
                    value={form.time}
                    onChange={e => setForm(f => ({ ...f, time: formatTimeInput(e.target.value) }))}
                  />
                </div>
              </div>
            </div>

            {/* Billing date (credit card only) */}
            {selectedAccount?.type === 'credit_card' && (
              <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  🧾
                </div>
                <div className="flex-1">
                  <p className="text-xs mb-0.5" style={{ color: 'var(--muted)' }}>Billing Date (optional)</p>
                  <input
                    type="date"
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text)', colorScheme: 'dark' }}
                    value={form.billing_date}
                    onChange={e => setForm(f => ({ ...f, billing_date: e.target.value }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Inline new category form */}
          {showCategoryInput && form.type !== 'transfer' && !splitOpen && (
            <div className="rounded-xl p-3 space-y-2.5" style={{ background: SURFACE, border: '1px solid rgb(var(--accent-rgb) / 0.2)' }}>
              <div className="flex items-center gap-2">
                <input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } }}
                  placeholder="Category name"
                  autoFocus
                  className="flex-1 text-sm px-2 py-1.5 rounded-lg outline-none"
                  style={{ background: SURFACE_HI, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)' }}
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={!newCatName.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg font-bold disabled:opacity-40 whitespace-nowrap"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  Add
                </button>
                <button type="button" onClick={() => setShowCategoryInput(false)}>
                  <X size={14} style={{ color: 'var(--muted)' }} />
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
                        background: newCatIcon === icon ? 'rgb(var(--accent-rgb) / 0.15)' : 'transparent',
                        outline: newCatIcon === icon ? '1px solid rgb(var(--accent-rgb) / 0.4)' : 'none',
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

          {/* ── 5. Optional details: one line that shows what's set ── */}
          {(() => {
            const chip = (key: string, icon: React.ReactNode, text: string, set: boolean, active: boolean, onClick: () => void) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                className="flex items-center gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                style={{
                  background:  set ? 'rgb(var(--accent-rgb) / 0.08)' : 'transparent',
                  color:       set ? 'var(--text)' : 'var(--muted)',
                  borderColor: active ? 'rgb(var(--accent-rgb) / 0.6)' : set ? 'rgb(var(--accent-rgb) / 0.25)' : 'rgba(255,255,255,0.1)',
                  borderStyle: set || active ? 'solid' : 'dashed',
                }}
              >
                <span className="shrink-0" style={{ color: set ? 'var(--accent)' : 'var(--muted)' }}>{icon}</span>
                <span className="truncate">{text}</span>
              </button>
            );
            const togglePanel = (p: DetailPanel) => setOpenPanel(cur => cur === p ? null : p);
            const showProjects = form.type !== 'transfer' && !splitOpen && projects.length > 0;
            const showSplit    = form.type === 'expense' || form.type === 'income';
            return (
              <div className="flex flex-wrap gap-2">
                {chip('note', <MessageSquare size={12} />, form.notes || '+ Note', !!form.notes, openPanel === 'note', () => togglePanel('note'))}
                {chip('tags', <TagIcon size={12} />,
                  selectedTags.length ? selectedTags.map(t => t.name).join(', ') : '+ Tags',
                  selectedTags.length > 0, openPanel === 'tags', () => togglePanel('tags'))}
                {showProjects && chip('projects', <FolderOpen size={12} />,
                  selectedProjects.length ? selectedProjects.map(p => `${p.icon} ${p.name}`).join(', ') : '+ Project',
                  selectedProjects.length > 0, openPanel === 'projects', () => togglePanel('projects'))}
                {showSplit && chip('split', <Split size={12} />,
                  splitOpen ? `Split · ${splits.length} parts` : '+ Split',
                  splitOpen, false, toggleSplitOpen)}
                {form.type === 'expense' && chip('others', <Users size={12} />,
                  othersAmount > 0 ? `For others · ${fmtAmount(othersAmount)}` : '+ For others',
                  othersAmount > 0, openPanel === 'others', () => togglePanel('others'))}
                {form.type === 'income' && chip('paidback', <HandCoins size={12} />,
                  form.paid_back ? 'Paid back to me' : '+ Paid back',
                  form.paid_back, false, () => setForm(f => ({ ...f, paid_back: !f.paid_back })))}
              </div>
            );
          })()}

          {hint && (
            <div
              className="flex items-center gap-2 rounded-xl pl-3 pr-1 py-1"
              style={{ background: 'rgb(var(--accent-rgb) / 0.06)', border: '1px dashed rgb(var(--accent-rgb) / 0.3)' }}
            >
              <span className="shrink-0" style={{ color: 'var(--accent)' }}>{hint.icon}</span>
              <p className="flex-1 min-w-0 text-xs py-1.5" style={{ color: 'var(--text-2)' }}>{hint.text}</p>
              <button
                type="button"
                onClick={hint.apply}
                className="shrink-0 h-10 px-3 rounded-lg text-sm font-semibold whitespace-nowrap"
                style={{ color: 'var(--accent)' }}
              >
                {hint.action}
              </button>
              <button
                type="button"
                aria-label="Dismiss suggestion"
                onClick={() => setDismissedHints(d => [...d, hint!.key])}
                className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg"
                style={{ color: 'var(--muted)' }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {form.type === 'income' && form.paid_back && (
            <p className="text-xs -mt-1 px-1" style={{ color: 'var(--muted)' }}>
              Money someone paid you back: it lowers what you're still owed and doesn't count as income.
            </p>
          )}

          {openPanel === 'others' && form.type === 'expense' && (
            <div className="rounded-xl px-4 py-3 space-y-3" style={{ background: SURFACE }}>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>How much of this was for other people?</p>
              <div className="flex flex-wrap gap-2">
                {[{ label: '½', f: 1 / 2 }, { label: '⅓', f: 2 / 3 }, { label: '¼', f: 3 / 4 }].map(o => {
                  // ½ = I paid for two; ⅓ = for three (my share is a third); ¼ = for four
                  const value = Math.round(totalAmount * o.f * 100) / 100;
                  const active = totalAmount > 0 && Math.abs(value - othersAmount) < 0.005;
                  return (
                    <button
                      key={o.label}
                      type="button"
                      disabled={!totalAmount}
                      onClick={() => setForm(f => ({ ...f, for_others: value.toFixed(2).replace('.', ',') }))}
                      className="h-10 min-w-[3.5rem] px-3 rounded-lg text-sm font-semibold disabled:opacity-40"
                      style={{
                        background: active ? 'rgb(var(--accent-rgb) / 0.15)' : 'rgba(255,255,255,0.05)',
                        color: active ? 'var(--accent)' : 'var(--text)',
                        border: `1px solid ${active ? 'rgb(var(--accent-rgb) / 0.5)' : 'transparent'}`,
                      }}
                    >
                      Mine {o.label}
                    </button>
                  );
                })}
                <div className="flex items-center gap-1 h-10 px-3 rounded-lg flex-1 min-w-[7rem]" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-xs shrink-0" style={{ color: 'var(--muted)' }}>For others</span>
                  <input
                    inputMode="decimal"
                    enterKeyHint="done"
                    className="w-full min-w-0 bg-transparent text-base text-right outline-none tabular-nums"
                    style={{ color: 'var(--text)' }}
                    placeholder="0,00"
                    value={form.for_others}
                    onChange={e => setForm(f => ({ ...f, for_others: cleanAmountInput(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: othersTooBig ? 'var(--expense)' : 'var(--muted)' }}>
                  {othersTooBig ? 'More than the amount' : <>Your share: <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtAmount(Math.max(0, totalAmount - othersAmount))}</span></>}
                </span>
                {othersAmount > 0 && (
                  <button type="button" className="text-xs font-semibold h-8 px-2" style={{ color: 'var(--muted)' }}
                    onClick={() => setForm(f => ({ ...f, for_others: '' }))}>
                    Clear
                  </button>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--faint)' }}>
                Only your share counts as spending and against budgets. Add their names as tags if you want to keep track.
              </p>
            </div>
          )}

          {openPanel === 'note' && (
            <div className="rounded-xl px-4 py-3" style={{ background: SURFACE }}>
              <input
                autoFocus
                enterKeyHint="done"
                className="w-full bg-transparent text-sm outline-none"
                style={{ color: 'var(--text)' }}
                placeholder="Add a note…"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>
          )}

          {openPanel === 'tags' && (
            <div className="rounded-xl px-4 pb-4 pt-1" style={{ background: SURFACE }}>
              <div className="flex items-center justify-end mb-2 mt-1">
                <button
                  type="button"
                  onClick={() => setShowTagInput(v => !v)}
                  className="text-xs font-bold tracking-tight px-2 py-0.5 rounded-full transition-colors"
                  style={{ color: 'var(--accent)', border: '1px solid rgb(var(--accent-rgb) / 0.3)', background: 'rgb(var(--accent-rgb) / 0.08)' }}
                >
                  + New tag
                </button>
              </div>
              {showTagInput && (
                <div className="flex items-center gap-2 mb-3 p-2 rounded-lg" style={{ background: SURFACE_HI }}>
                  <input
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateTag(); } }}
                    placeholder="Tag name"
                    autoFocus
                    className="flex-1 text-sm border rounded px-2 py-1 outline-none bg-transparent"
                    style={{ color: 'var(--text)', borderColor: 'rgba(255,255,255,0.12)' }}
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
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontWeight: 700 }}
                  >
                    Add
                  </button>
                  <button type="button" onClick={() => setShowTagInput(false)}>
                    <X size={13} style={{ color: 'var(--muted)' }} />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {tags.length === 0 && !showTagInput && (
                  <span className="text-xs self-center" style={{ color: 'var(--faint)' }}>No tags yet</span>
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
            </div>
          )}

          {openPanel === 'projects' && form.type !== 'transfer' && !splitOpen && (
            <div className="rounded-xl px-4 py-3" style={{ background: SURFACE }}>
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

          {/* ── 6. Split editor (when split is on) ──────────── */}
          {splitOpen && form.type !== 'transfer' && form.type !== 'refund' && (
            <div className="rounded-xl overflow-hidden" style={{ background: SURFACE }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'rgb(var(--accent-rgb) / 0.08)' }}>
                    <Split size={13} style={{ color: 'var(--accent)' }} />
                  </div>
                  <p className="text-sm" style={{ color: 'var(--accent)' }}>Split transaction</p>
                </div>
                <button
                  type="button"
                  onClick={toggleSplitOpen}
                  className="text-xs font-semibold"
                  style={{ color: 'var(--muted)' }}
                >
                  Remove split
                </button>
              </div>
              <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: `1px solid ${BORDER}` }}>
                  {splits.map((split, i) => (
                    <div key={i} className="space-y-1.5 pb-3"
                      style={{ borderBottom: i < splits.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div className="flex items-start gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={split.amount || ''}
                          onChange={e => updateSplit(i, 'amount', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="w-24 shrink-0 px-2 py-1.5 text-sm rounded-lg outline-none"
                          style={{ background: SURFACE_HI, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)' }}
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
                          style={{ background: SURFACE_HI, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text)' }}
                        />
                        {splits.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeSplit(i)}
                            className="mt-1 p-1 transition-colors"
                            style={{ color: 'var(--faint)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--expense)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--faint)')}
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
                      style={{ color: 'var(--accent)' }}
                    >
                      <Plus size={12} /> Add split
                    </button>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        background: splitBalanced
                          ? 'rgb(var(--income-rgb) / 0.15)'
                          : remaining > 0
                          ? 'rgb(var(--warn-rgb) / 0.15)'
                          : 'rgb(var(--expense-rgb) / 0.15)',
                        color: splitBalanced ? 'var(--income)' : remaining > 0 ? 'var(--warn)' : 'var(--expense)',
                      }}
                    >
                      {splitBalanced
                        ? `✓ ${fmtAmount(allocatedAmount)} balanced`
                        : remaining > 0
                        ? `${fmtAmount(allocatedAmount)} / ${fmtAmount(totalAmount)} — ${fmtAmount(remaining)} left`
                        : `Over by ${fmtAmount(Math.abs(remaining))}`}
                    </span>
                  </div>
              </div>
            </div>
          )}

        </div>

        {/* ── 7. Action buttons: pinned so they stay reachable above the keyboard / home bar ── */}
        <div
          className="shrink-0 px-5 md:px-6 pt-3 space-y-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {(saveError || (showErrors && (overAllocated || badLinkAmount || timeInvalid))) && (
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
              style={{ background: 'rgb(var(--expense-rgb) / 0.08)', border: '1px solid rgb(var(--expense-rgb) / 0.3)', color: 'var(--expense)' }}
            >
              <AlertCircle size={13} className="shrink-0" />
              {saveError
                || (timeInvalid ? 'Time must be in 24-hour HH:MM format, e.g. 09:30 or 18:45'
                : overAllocated ? 'Linked amounts exceed the refund amount'
                : 'Each linked transaction needs an amount greater than zero')}
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-xl text-sm font-bold transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-2)', background: 'transparent' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              Cancel
            </button>
            {!editing && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                title="Save and start another (Shift+Enter)"
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
                style={{
                  border: '1px solid rgb(var(--accent-rgb) / 0.5)',
                  color: 'var(--accent)',
                  background: 'rgb(var(--accent-rgb) / 0.08)',
                  opacity: (!canSave && !showErrors) ? 0.4 : 1,
                }}
              >
                Add &amp; next
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              title="Save (Enter)"
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                opacity: (!canSave && !showErrors) ? 0.4 : 1,
              }}
            >
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add'}
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
