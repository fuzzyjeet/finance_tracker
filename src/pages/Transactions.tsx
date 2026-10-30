import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Pencil, Trash2, Search, ChevronLeft, ChevronRight,
  ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ChevronDown, X, Undo2, SlidersHorizontal, Check,
} from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { LogStatus } from '../components/transactions/LogStatus';
import { TotalsCard, periodLabel } from '../components/transactions/TotalsCard';
import { BulkBar } from '../components/transactions/BulkBar';
import { UnusualIcon, UnusualExplainer } from '../components/transactions/UnusualSpend';
import { useHideFab } from '../contexts/QuickAddContext';
import { useLongPress } from '../lib/useLongPress';
import { emitDataChanged, onDataChanged, onTabReselected } from '../lib/events';
import { CustomSelect } from '../components/ui/CustomSelect';
import { transactionsApi, BulkAction } from '../api/transactions';
import { accountsApi } from '../api/accounts';
import { categoriesApi } from '../api/categories';
import { tagsApi } from '../api/tags';
import { projectsApi } from '../api/projects';
import { Account, Category, Project, Tag, Transaction, TransactionTotals } from '../types';
import { localISODate } from '../lib/dates';

// Searches look across every month; this caps how many results come back
const SEARCH_LIMIT = 500;

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2 }).format(v);

function formatDateLabel(dateStr: string) {
  const today = localISODate();
  const d = new Date(dateStr + 'T00:00:00');
  const yesterday = localISODate(new Date(Date.now() - 86400000));
  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Split categories cell ──────────────────────────────────
const INLINE_LIMIT = 3;

function SplitCategoriesCell({
  txn,
  isExpanded,
  onToggle,
}: {
  txn: Transaction;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const splits = txn.splits ?? [];
  const count = splits.length;

  // All categories visible — no expand needed
  if (count <= INLINE_LIMIT) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {splits.map((s, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {s.category ? (
              <>
                <span>{s.category.icon}</span>
                <span style={{ color: 'var(--text-2)' }}>{s.category.name}</span>
              </>
            ) : (
              <span style={{ color: 'var(--faint)' }}>—</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  // Many splits → icon stack + count
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
    >
      <div className="flex -space-x-1.5">
        {splits.slice(0, 4).map((s, i) => (
          <div
            key={i}
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
            style={{ background: 'var(--surface-hi)', border: '1px solid rgba(255,255,255,0.08)', zIndex: 4 - i }}
          >
            {s.category?.icon ?? '·'}
          </div>
        ))}
        {count > 4 && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: 'var(--surface-hi)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)' }}
          >
            +{count - 4}
          </div>
        )}
      </div>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{count} splits</span>
      <ChevronDown
        size={11}
        style={{ color: 'var(--muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
      />
    </button>
  );
}

// ── Phone list: one tappable row per transaction ──────────
const AMOUNT_COLORS: Record<string, string> = {
  income: 'var(--income)', expense: 'var(--expense)', refund: 'var(--refund)', transfer: 'var(--transfer)',
};
const AMOUNT_SIGN: Record<string, string> = { income: '+', expense: '−', refund: '+', transfer: '' };

function MobileTransactionList({
  groups,
  rowProps,
  selected,
  onExplain,
}: {
  groups: { date: string; txns: Transaction[] }[];
  rowProps: (txn: Transaction) => React.HTMLAttributes<HTMLDivElement>;
  selected: Set<string> | null;
  onExplain: (txn: Transaction) => void;
}) {
  return (
    <div className="md:hidden">
      {groups.map(group => {
        const net = group.txns.reduce((s, t) =>
          s + (t.type === 'income' || t.type === 'refund' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
        return (
          <div key={group.date}>
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
            >
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{formatDateLabel(group.date)}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: net >= 0 ? 'var(--income)' : 'var(--expense)' }}>
                {net >= 0 ? '+' : '−'}{formatCurrency(Math.abs(net))}
              </span>
            </div>
            {group.txns.map(txn => {
              const splitCount = txn.splits?.length ?? 0;
              const what = txn.type === 'transfer'
                ? `${txn.account_name} → ${txn.to_account_name ?? ''}`
                : [
                    splitCount > 0 ? `${splitCount} splits` : txn.category?.name ?? 'No category',
                    txn.account_name,
                  ].filter(Boolean).join(' · ');
              const isSelected = selected?.has(txn.id) ?? false;
              return (
                <div
                  key={txn.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected ? isSelected : undefined}
                  {...rowProps(txn)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left select-none cursor-pointer active:bg-white/5"
                  style={{
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    background: isSelected ? 'rgb(var(--accent-rgb) / 0.1)' : undefined,
                    WebkitTouchCallout: 'none',
                  }}
                >
                  <div
                    className="relative w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                    style={{ background: isSelected ? 'var(--accent)' : txn.category ? `color-mix(in srgb, ${txn.category.color} 14%, transparent)` : 'rgba(255,255,255,0.05)' }}
                  >
                    {isSelected ? <Check size={20} strokeWidth={3} style={{ color: 'var(--on-accent)' }} />
                      : txn.type === 'transfer' ? <ArrowLeftRight size={16} style={{ color: 'var(--transfer)' }} />
                      : splitCount > 0 ? <span className="text-sm">✂️</span>
                      : txn.category?.icon ?? '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium truncate" style={{ color: 'var(--text)' }}>{txn.payee}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      {what}
                      {txn.notes ? ` · ${txn.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="flex items-center justify-end gap-0.5 text-[15px] font-semibold tabular-nums" style={{ color: AMOUNT_COLORS[txn.type] }}>
                      <UnusualIcon txn={txn} onExplain={onExplain} />
                      {AMOUNT_SIGN[txn.type]}{formatCurrency(txn.amount)}
                    </p>
                    <p className="text-xs tabular-nums" style={{ color: (txn.refunded_amount ?? 0) > 0 ? 'var(--refund)' : 'var(--muted)' }}>
                      {(txn.refunded_amount ?? 0) > 0
                        ? (txn.is_fully_refunded ? 'refunded' : `−${formatCurrency(txn.refunded_amount!)} refunded`)
                        : (txn.for_others ?? 0) > 0 ? `yours ${formatCurrency(txn.amount - txn.for_others!)}`
                        : txn.paid_back ? 'paid back'
                        : txn.time ?? ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** First and last day of the calendar month `d` is in, plus its name. */
function monthRange(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear(), m = d.getMonth() + 1;
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(last)}`,
    name: d.toLocaleDateString('en-GB', { month: 'long' }),
    long: d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  };
}

const shiftMonth = (d: Date, delta: number) => new Date(d.getFullYear(), d.getMonth() + delta, 1);

/** A link with date_from/date_to covering exactly one calendar month opens that month. */
function monthFromParams(params: URLSearchParams): Date | null {
  const from = params.get('date_from'), to = params.get('date_to');
  if (!from || !to || !from.endsWith('-01')) return null;
  const d = new Date(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, 1);
  return monthRange(d).to === to ? d : null;
}

// ── Desktop row checkbox ───────────────────────────────────
function SelectBox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="w-5 h-5 rounded-md flex items-center justify-center"
      style={{
        background: checked ? 'var(--accent)' : 'transparent',
        border: checked ? 'none' : '1.5px solid var(--faint-2)',
        color: 'var(--on-accent)',
      }}
    >
      {checked && <Check size={13} strokeWidth={3} />}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────
export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts]         = useState<Account[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);

  const location = useLocation();
  const _initParams = new URLSearchParams(location.search);
  // With a search too (a payee from the dashboard), the dates stay a range so the search keeps to them
  const _initMonth = _initParams.get('search') ? null : monthFromParams(_initParams);
  // The list shows one calendar month at a time
  const [month, setMonth]               = useState<Date>(() => _initMonth ?? shiftMonth(new Date(), 0));

  // Filters
  const [filterAccount, setFilterAccount]   = useState(_initParams.get('account_id') ?? '');
  const [filterCategory, setFilterCategory] = useState(_initParams.get('category_id') ?? '');
  const [filterType, setFilterType]         = useState('');
  // A custom date range replaces the month view; a link for a whole month just opens that month
  const [filterFrom, setFilterFrom]         = useState(_initMonth ? '' : _initParams.get('date_from') ?? '');
  const [filterTo, setFilterTo]             = useState(_initMonth ? '' : _initParams.get('date_to') ?? '');
  const [filterSearch, setFilterSearch]     = useState(_initParams.get('search') ?? '');
  const [searchInput, setSearchInput]       = useState(_initParams.get('search') ?? '');
  const [tags, setTags]                     = useState<Tag[]>([]);
  const [projects, setProjects]             = useState<Project[]>([]);
  const [totals, setTotals]                 = useState<TransactionTotals | null>(null);
  // null = not selecting; a set (even empty) = selection mode
  const [selected, setSelected]             = useState<Set<string> | null>(null);
  const [notice, setNotice]                 = useState<string | null>(null);
  const [explain, setExplain]               = useState<Transaction | null>(null);
  const hideFab = useHideFab();

  // Modal
  const [modalOpen, setModalOpen]           = useState(false);
  const [editing, setEditing]               = useState<Transaction | null>(null);
  const [refundOf, setRefundOf]             = useState<Transaction | null>(null);
  const [deleteConfirm, setDeleteConfirm]   = useState<string | null>(null);
  const [expandedSplits, setExpandedSplits] = useState<Set<string>>(new Set());

  const [expandedLinks, setExpandedLinks]   = useState<Set<string>>(new Set());
  // Phones: filters beyond search fold away behind a button
  const [filtersOpen, setFiltersOpen]       = useState(false);

  const toggleSplits = (id: string) =>
    setExpandedSplits(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleLinks = (id: string) =>
    setExpandedLinks(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const loadRefs = async () => {
    const [accts, cats, tgs, projs] = await Promise.all([
      accountsApi.list(), categoriesApi.list(), tagsApi.list(), projectsApi.list(),
    ]);
    setAccounts(accts);
    setCategories(cats);
    setTags(tgs);
    setProjects(projs);
  };

  // Month view unless a custom range is picked; a search looks across every month
  const mode: 'month' | 'range' | 'search' = filterFrom || filterTo ? 'range' : filterSearch ? 'search' : 'month';
  const range = monthRange(month);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    const inMonth = mode === 'month';
    const filters = {
      account_id:  filterAccount  || undefined,
      category_id: filterCategory || undefined,
      type:        filterType     || undefined,
      date_from:   inMonth ? range.from : filterFrom || undefined,
      date_to:     inMonth ? range.to   : filterTo   || undefined,
      search:      filterSearch   || undefined,
    };
    try {
      const [txns, tot] = await Promise.all([
        transactionsApi.list({ ...filters, limit: mode === 'search' ? SEARCH_LIMIT : 5000, offset: 0 }),
        transactionsApi.totals(filters).catch(() => null),
      ]);
      setTransactions(txns);
      setTotals(tot);
    } finally {
      setLoading(false);
    }
  }, [mode, range.from, range.to, filterAccount, filterCategory, filterType, filterFrom, filterTo, filterSearch]);

  // Search as you type, without a request per keystroke
  useEffect(() => {
    const t = window.setTimeout(() => setFilterSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // Selection: the bulk bar replaces the + button while it's open
  useEffect(() => { hideFab(selected !== null); }, [selected, hideFab]);
  useEffect(() => () => hideFab(false), [hideFab]);
  // A new page or new filters start a fresh selection
  useEffect(() => { setSelected(s => (s ? new Set() : s)); }, [transactions]);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const toggleSelected = (id: string) =>
    setSelected(prev => { const s = new Set(prev ?? []); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const allSelected = !!selected && transactions.length > 0 && transactions.every(t => selected.has(t.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(transactions.map(t => t.id)));

  const applyBulk = async (action: BulkAction) => {
    if (!selected || selected.size === 0) return;
    const n = selected.size;
    const res = await transactionsApi.bulk([...selected], action);
    setSelected(null);
    const noun = (k: number) => `${k} ${k === 1 ? 'entry' : 'entries'}`;
    setNotice(action.action === 'delete'
      ? `Deleted ${noun(n)}`
      : `Updated ${noun(res.updated)}${res.skipped ? ` · ${res.skipped} skipped (split or transfer)` : ''}`);
    emitDataChanged();
  };

  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { load(); }, [load]);
  // Entries added from the global + button or the pending-actions menu
  useEffect(() => onDataChanged(() => { load(true); loadRefs(); }), [load]);

  // Tapping Transactions in the tab bar while already here: clear every filter and
  // go back to this month, newest first
  useEffect(() => onTabReselected('/transactions', () => {
    setFilterAccount(''); setFilterCategory(''); setFilterType('');
    setFilterFrom(''); setFilterTo(''); setFilterSearch(''); setSearchInput('');
    setFiltersOpen(false);
    setSelected(null);
    setMonth(shiftMonth(new Date(), 0));
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }), []);

  // Moving to another month starts at its top
  const goMonth = (delta: number) => {
    setMonth(m => shiftMonth(m, delta));
    document.querySelector('main')?.scrollTo({ top: 0 });
  };
  // Phones: swipe sideways on the list to change month
  const swipe = React.useRef<{ x: number; y: number } | null>(null);
  const swipeProps = mode === 'month' ? {
    onTouchStart: (e: React.TouchEvent) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; },
    onTouchEnd: (e: React.TouchEvent) => {
      const start = swipe.current;
      swipe.current = null;
      if (!start || selected) return;
      const dx = e.changedTouches[0].clientX - start.x;
      const dy = e.changedTouches[0].clientY - start.y;
      if (Math.abs(dx) > 70 && Math.abs(dx) > 2 * Math.abs(dy)) goMonth(dx < 0 ? 1 : -1);
    },
  } : {};

  const openEdit   = (txn: Transaction) => { setEditing(txn); setRefundOf(null); setModalOpen(true); };
  // Phone rows: tap opens (or toggles while selecting), long-press starts selecting
  const rowProps = useLongPress<Transaction>(
    txn => setSelected(prev => new Set([...(prev ?? []), txn.id])),
    txn => (selected ? toggleSelected(txn.id) : openEdit(txn)),
  );
  const openRefund = (txn: Transaction) => { setEditing(null); setRefundOf(txn); setModalOpen(true); };

  const handleSaved = () => emitDataChanged();

  const handleDelete = async (id: string) => {
    await transactionsApi.delete(id);
    setDeleteConfirm(null);
    emitDataChanged();
  };


  const clearFilters = () => {
    setFilterAccount(''); setFilterCategory(''); setFilterType('');
    setFilterFrom(''); setFilterTo(''); setFilterSearch(''); setSearchInput('');
  };

  const activeFilterCount = [filterAccount, filterCategory, filterType, filterFrom, filterTo, filterSearch]
    .filter(Boolean).length;

  // ── Group transactions by date ────────────────────────────
  type DateGroup = { date: string; txns: Transaction[] };
  const dateGroups: DateGroup[] = transactions.reduce<DateGroup[]>((acc, txn) => {
    const last = acc[acc.length - 1];
    if (last && last.date === txn.date) {
      last.txns.push(txn);
    } else {
      acc.push({ date: txn.date, txns: [txn] });
    }
    return acc;
  }, []);

  // ── Shared styles ─────────────────────────────────────────
  const inputCls = [
    'text-sm border rounded-lg px-3 py-2 outline-none transition-colors',
    'bg-[var(--surface)] text-[var(--text)] placeholder-slate-500',
    'border-white/8 focus:border-white/20 focus:ring-1 focus:ring-primary/30',
  ].join(' ');

  const TYPE_OPTS = [
    { value: '',         label: 'All' },
    { value: 'income',   label: 'Income',   color: 'var(--income)' },
    { value: 'expense',  label: 'Expense',  color: 'var(--expense)' },
    { value: 'transfer', label: 'Transfer', color: 'var(--transfer)' },
    { value: 'refund',   label: 'Refund',   color: 'var(--refund)' },
  ];

  return (
    <div>
      <Header title="Transactions" />

      <LogStatus />

      {/* ── Filter bar ─────────────────────────────────────── */}
      <div
        className="rounded-xl mb-4 p-3"
        style={{ background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' }}
      >
        {/* Row 1: search + account + category */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--muted)' }} />
            <input
              type="search"
              enterKeyHint="search"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search everything…"
              className={`w-full pl-8 pr-3 ${inputCls}`}
            />
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            className="md:hidden flex items-center gap-1.5 px-3 rounded-lg text-sm font-medium"
            style={{
              color: activeFilterCount > (filterSearch ? 1 : 0) ? 'var(--accent)' : 'var(--text-2)',
              background: 'var(--surface)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <SlidersHorizontal size={14} />
            Filters{activeFilterCount - (filterSearch ? 1 : 0) > 0 ? ` · ${activeFilterCount - (filterSearch ? 1 : 0)}` : ''}
          </button>

          {/* On phones the rest only shows when "Filters" is open; on desktop the wrapper disappears */}
          <div className={`${filtersOpen ? 'flex' : 'hidden'} md:contents w-full flex-wrap gap-2`}>

          {/* Account */}
          <CustomSelect
            value={filterAccount}
            onChange={setFilterAccount}
            options={[
              { value: '', label: 'All Accounts' },
              ...accounts.map(a => ({ value: a.id, label: a.name })),
            ]}
            className="min-w-[130px]"
          />

          {/* Category */}
          <CustomSelect
            value={filterCategory}
            onChange={setFilterCategory}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` })),
            ]}
            className="min-w-[140px]"
          />

          {/* Date range */}
          <div
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              className="bg-transparent text-sm outline-none w-[118px]"
              style={{ color: filterFrom ? 'var(--text)' : 'var(--faint)', colorScheme: 'dark' }}
              title="From"
            />
            <span style={{ color: 'var(--faint-2)' }}>–</span>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              className="bg-transparent text-sm outline-none w-[118px]"
              style={{ color: filterTo ? 'var(--text)' : 'var(--faint)', colorScheme: 'dark' }}
              title="To"
            />
          </div>

          {/* Clear button */}
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{ color: 'var(--expense)', background: 'rgb(var(--expense-rgb) / 0.08)', border: '1px solid rgb(var(--expense-rgb) / 0.2)' }}
            >
              <X size={12} /> Clear
            </button>
          )}
          </div>
        </div>

        {/* Row 2: type toggle pills */}
        <div className={`${filtersOpen ? 'flex' : 'hidden'} md:flex items-center gap-1.5 mt-2.5 overflow-x-auto`}>
          <span className="text-xs mr-1" style={{ color: 'var(--faint)' }}>Type</span>
          {TYPE_OPTS.map(opt => {
            const active = filterType === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterType(opt.value)}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: active
                    ? (opt.color ? `color-mix(in srgb, ${opt.color} 14%, transparent)` : 'rgba(255,255,255,0.1)')
                    : 'transparent',
                  color: active
                    ? (opt.color ?? 'var(--text)')
                    : 'var(--faint)',
                  border: `1px solid ${active ? (opt.color ? `color-mix(in srgb, ${opt.color} 30%, transparent)` : 'rgba(255,255,255,0.2)') : 'transparent'}`,
                }}
              >
                {opt.label}
              </button>
            );
          })}
          {activeFilterCount > 0 && (
            <span
              className="hidden md:inline ml-auto text-xs"
              style={{ color: 'var(--faint)' }}
            >
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </span>
          )}
        </div>
      </div>

      {mode === 'month' ? (
        <div
          className="sticky top-0 z-20 -mx-4 px-4 md:mx-0 md:px-0 mb-3 flex items-center justify-between gap-2"
          style={{ background: 'var(--bg)', paddingTop: 'max(0.25rem, env(safe-area-inset-top))', paddingBottom: '0.25rem' }}
        >
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-2)' }}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => { setMonth(shiftMonth(new Date(), 0)); document.querySelector('main')?.scrollTo({ top: 0 }); }}
            className="h-10 px-3 font-headline text-base font-semibold"
            style={{ color: 'var(--text)' }}
            title="Back to this month"
          >
            {range.long}
          </button>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-2)' }}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-2 min-h-10">
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            {mode === 'search'
              ? <>Searching every month{transactions.length >= SEARCH_LIMIT ? ` · first ${SEARCH_LIMIT}` : ''}</>
              : 'Custom dates'}
          </p>
          <button
            type="button"
            onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterSearch(''); setSearchInput(''); }}
            className="h-10 px-3 text-sm font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            Back to {range.name}
          </button>
        </div>
      )}

      <TotalsCard
        totals={totals}
        label={mode === 'month' ? range.long : mode === 'range' ? periodLabel(filterFrom, filterTo) : 'All months'}
        filtered={!!(filterAccount || filterCategory || filterType || filterSearch)}
        onSelect={selected ? undefined : () => setSelected(new Set())}
      />

      {notice && (
        <div className="mb-3 rounded-xl px-4 py-2.5 text-sm" role="status"
          style={{ background: 'rgb(var(--income-rgb) / 0.1)', color: 'var(--income)', border: '1px solid rgb(var(--income-rgb) / 0.25)' }}>
          {notice}
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────── */}
      <div
        className={`rounded-xl overflow-hidden ${selected ? 'mb-40 md:mb-28' : ''}`}
        style={{ background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' }}
        {...swipeProps}
      >
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--faint)' }}>
            {mode === 'month' ? `Nothing logged in ${range.name}` : 'No transactions found'}
          </div>
        ) : (
          <>
          <MobileTransactionList groups={dateGroups} rowProps={rowProps} selected={selected} onExplain={setExplain} />
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
                  <th className="pl-4 py-3 w-8">
                    <SelectBox checked={allSelected} onChange={() => selected ? toggleAll() : setSelected(new Set(transactions.map(t => t.id)))} label="Select all" />
                  </th>
                  {['#', 'Payee', 'Category', 'Account', 'Tags', 'Amount', ''].map((h, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 text-xs font-medium ${i === 5 ? 'text-right' : 'text-left'}`}
                      style={{ color: 'var(--faint)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dateGroups.map(group => {
                  const surplus  = group.txns.reduce((s, t) => s + (t.refund_surplus ?? 0), 0);
                  const income   = group.txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) + surplus;
                  const expenses = group.txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
                  const refunds  = group.txns.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0) - surplus;
                  const net      = income - expenses + refunds;

                  return (
                    <React.Fragment key={group.date}>
                      {/* ── Date separator row ── */}
                      <tr style={{ background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td colSpan={5} className="px-4 py-1.5">
                          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                            {formatDateLabel(group.date)}
                          </span>
                        </td>
                        <td colSpan={3} className="px-4 py-1.5">
                          <div className="flex items-center justify-end gap-3">
                            {income > 0 && (
                              <span className="text-xs font-semibold" style={{ color: 'var(--income)' }}>
                                +{formatCurrency(income)}
                              </span>
                            )}
                            {expenses > 0 && (
                              <span className="text-xs font-semibold" style={{ color: 'var(--expense)' }}>
                                −{formatCurrency(expenses)}
                              </span>
                            )}
                            {refunds > 0 && (
                              <span className="text-xs font-semibold" style={{ color: 'var(--refund)' }}>
                                ↩{formatCurrency(refunds)}
                              </span>
                            )}
                            {(income > 0 || expenses > 0 || refunds > 0) && (
                              <span
                                className="text-xs font-semibold pl-2"
                                style={{
                                  color: net >= 0 ? 'var(--income)' : 'var(--expense)',
                                  borderLeft: '1px solid rgba(255,255,255,0.06)',
                                }}
                              >
                                {net >= 0 ? '+' : ''}{formatCurrency(net)}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ── Transactions for this date ── */}
                      {group.txns.map((txn, txnIdx) => {
                        const hasSplits = txn.splits && txn.splits.length > 0;
                        const isExpanded = expandedSplits.has(txn.id);
                        return (
                          <React.Fragment key={txn.id}>
                            <tr
                              className={`transition-colors ${selected?.has(txn.id) ? 'bg-primary/10' : 'hover:bg-white/[0.02]'}`}
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                            >
                              <td className="pl-4 py-3 w-8">
                                <SelectBox checked={!!selected?.has(txn.id)} onChange={() => toggleSelected(txn.id)} label={`Select ${txn.payee}`} />
                              </td>
                              {/* Day index */}
                              <td className="px-4 py-3 whitespace-nowrap text-center w-10">
                                <span
                                  className="text-xs font-semibold tabular-nums"
                                  style={{ color: 'var(--faint-2)' }}
                                >
                                  {txnIdx + 1}
                                </span>
                                {txn.time && (
                                  <div className="text-xs tabular-nums mt-0.5" style={{ color: 'var(--faint)' }}>{txn.time}</div>
                                )}
                                {txn.billing_date && (
                                  <div className="text-xs mt-0.5" style={{ color: 'var(--faint)' }}>📅</div>
                                )}
                              </td>

                              {/* Payee */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium" style={{ color: 'var(--text)' }}>{txn.payee}</span>
                                  {txn.refunds && txn.refunds.length > 0 && (
                                    <button
                                      onClick={() => toggleLinks(txn.id)}
                                      className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full hover:brightness-125"
                                      style={{ background: 'rgb(var(--refund-rgb) / 0.15)', color: 'var(--refund)', border: '1px solid rgb(var(--refund-rgb) / 0.3)' }}
                                      title={txn.is_fully_refunded ? 'Fully refunded' : `Partially refunded: ${txn.refunded_amount?.toFixed(2)}`}
                                    >
                                      <Undo2 size={9} />
                                      {txn.is_fully_refunded ? 'Refunded' : 'Partial'}
                                      {txn.refunds.length > 1 && ` ×${txn.refunds.length}`}
                                    </button>
                                  )}
                                </div>
                                {txn.type === 'refund' && txn.refund_for && txn.refund_for.length > 0 && (
                                  <button
                                    onClick={() => toggleLinks(txn.id)}
                                    className="text-xs mt-0.5 flex items-center gap-1 hover:underline"
                                    style={{ color: 'var(--refund)' }}
                                  >
                                    <Undo2 size={10} />
                                    <span>
                                      Refund of {txn.refund_for.length === 1
                                        ? txn.refund_for[0].payee
                                        : `${txn.refund_for.length} transactions`}
                                    </span>
                                    <ChevronDown
                                      size={10}
                                      style={{ transform: expandedLinks.has(txn.id) ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                                    />
                                  </button>
                                )}
                                {txn.notes && (
                                  <div className="text-xs truncate max-w-[180px]" style={{ color: 'var(--faint)' }}>{txn.notes}</div>
                                )}
                              </td>

                              {/* Category / Splits */}
                              <td className="px-4 py-3">
                                {hasSplits ? (
                                  <SplitCategoriesCell
                                    txn={txn}
                                    isExpanded={isExpanded}
                                    onToggle={() => toggleSplits(txn.id)}
                                  />
                                ) : txn.category ? (
                                  <span className="inline-flex items-center gap-1.5 text-sm">
                                    <span>{txn.category.icon}</span>
                                    <span style={{ color: 'var(--text-2)' }}>{txn.category.name}</span>
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--faint)' }}>—</span>
                                )}
                              </td>

                              {/* Account */}
                              <td className="px-4 py-3">
                                <div style={{ color: 'var(--text-2)' }}>{txn.account_name}</div>
                                {txn.to_account_name && (
                                  <div className="text-xs" style={{ color: 'var(--faint)' }}>→ {txn.to_account_name}</div>
                                )}
                              </td>

                              {/* Tags */}
                              <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {txn.tags?.map(tag => (
                                    <Badge key={tag.id} color={tag.color}>{tag.name}</Badge>
                                  ))}
                                </div>
                              </td>

                              {/* Amount */}
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <div
                                  className="flex items-center justify-end gap-1 font-bold"
                                  style={{ color: AMOUNT_COLORS[txn.type] }}
                                >
                                  <UnusualIcon txn={txn} onExplain={setExplain} />
                                  {txn.type === 'income'   ? <ArrowDownLeft size={14}  /> :
                                   txn.type === 'expense'  ? <ArrowUpRight size={14}   /> :
                                   txn.type === 'refund'   ? <Undo2 size={14}          /> :
                                                             <ArrowLeftRight size={14} />}
                                  {txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : txn.type === 'refund' ? '+' : ''}
                                  {formatCurrency(txn.amount)}
                                </div>
                                {txn.type === 'refund' && (txn.refund_surplus ?? 0) > 0.005 && (
                                  <div className="text-xs text-right" style={{ color: 'var(--income)' }}>
                                    {(txn.refund_for?.length ?? 0) > 0
                                      ? `+${formatCurrency(txn.refund_surplus!)} as income`
                                      : 'booked as income'}
                                  </div>
                                )}
                                {(txn.for_others ?? 0) > 0 && (
                                  <div className="text-xs text-right tabular-nums" style={{ color: 'var(--muted)' }}>
                                    yours {formatCurrency(txn.amount - txn.for_others!)}
                                  </div>
                                )}
                                {txn.paid_back && (
                                  <div className="text-xs text-right" style={{ color: 'var(--muted)' }}>paid back</div>
                                )}
                                {txn.type === 'expense' && (txn.refunded_amount ?? 0) > 0 && (
                                  <div className="text-xs text-right" style={{ color: 'var(--refund)' }}>
                                    −{formatCurrency(txn.refunded_amount ?? 0)} refunded
                                  </div>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  {txn.type === 'expense' && !txn.is_fully_refunded && (
                                    <button
                                      onClick={() => openRefund(txn)}
                                      className="p-1 rounded transition-colors"
                                      style={{ color: 'var(--faint)' }}
                                      title="Add refund / reimbursement"
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--refund)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgb(var(--refund-rgb) / 0.1)'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--faint)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                    >
                                      <Undo2 size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEdit(txn)}
                                    className="p-1 rounded transition-colors"
                                    style={{ color: 'var(--faint)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--faint)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(txn.id)}
                                    className="p-1 rounded transition-colors"
                                    style={{ color: 'var(--faint)' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--expense)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgb(var(--expense-rgb) / 0.1)'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--faint)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded splits detail */}
                            {hasSplits && isExpanded && (
                              <tr style={{ background: 'rgb(var(--accent-rgb) / 0.03)', borderBottom: '1px solid rgb(var(--accent-rgb) / 0.08)' }}>
                                <td colSpan={2} />
                                <td colSpan={4} className="px-4 py-2.5">
                                  <div className="space-y-1.5">
                                    {txn.splits!.map((split, si) => (
                                      <div key={si} className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-2)' }}>
                                        <span style={{ color: 'var(--faint)' }}>↳</span>
                                        {split.category ? (
                                          <span className="flex items-center gap-1">
                                            <span>{split.category.icon}</span>
                                            <span className="font-medium">{split.category.name}</span>
                                          </span>
                                        ) : (
                                          <span className="italic" style={{ color: 'var(--faint)' }}>No category</span>
                                        )}
                                        {split.notes && <span style={{ color: 'var(--faint)' }}>· {split.notes}</span>}
                                        <span className="ml-auto font-semibold" style={{ color: 'var(--expense)' }}>
                                          {formatCurrency(split.amount)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td />
                              </tr>
                            )}

                            {/* Expanded refund links (either direction) */}
                            {expandedLinks.has(txn.id) && (() => {
                              const linkRows = txn.type === 'refund' ? (txn.refund_for ?? []) : (txn.refunds ?? []);
                              if (linkRows.length === 0) return null;
                              return (
                                <tr style={{ background: 'rgb(var(--refund-rgb) / 0.04)', borderBottom: '1px solid rgb(var(--refund-rgb) / 0.1)' }}>
                                  <td colSpan={2} />
                                  <td colSpan={4} className="px-4 py-2.5">
                                    <p className="text-xs mb-1.5" style={{ color: 'var(--refund)' }}>
                                      {txn.type === 'refund' ? 'Covers' : 'Refunded by'}
                                    </p>
                                    <div className="space-y-1.5">
                                      {linkRows.map(l => (
                                        <div key={l.id} className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-2)' }}>
                                          <Undo2 size={11} style={{ color: 'var(--refund)' }} />
                                          <span className="font-medium">{l.payee || '—'}</span>
                                          <span style={{ color: 'var(--faint)' }}>
                                            {formatDateLabel(l.date)}{l.account_name ? ` · ${l.account_name}` : ''}
                                            {txn.type === 'refund' && ` · of ${formatCurrency(l.transaction_amount)}`}
                                          </span>
                                          <span className="ml-auto font-semibold tabular-nums" style={{ color: 'var(--refund)' }}>
                                            {formatCurrency(l.amount)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td />
                                </tr>
                              );
                            })()}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* End of the month: carry on into the one before or after */}
        {mode === 'month' && !loading && (
          <div
            className="grid grid-cols-2 gap-2 p-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="h-11 rounded-xl flex items-center justify-center gap-1 text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
            >
              <ChevronLeft size={16} /> {monthRange(shiftMonth(month, -1)).name}
            </button>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="h-11 rounded-xl flex items-center justify-center gap-1 text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
            >
              {monthRange(shiftMonth(month, 1)).name} <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      <TransactionFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setRefundOf(null); }}
        onSaved={handleSaved}
        editing={editing}
        refundOf={refundOf}
        onDelete={editing ? () => { setModalOpen(false); setDeleteConfirm(editing.id); } : undefined}
        onRefund={editing && editing.type === 'expense' && !editing.is_fully_refunded
          ? () => openRefund(editing) : undefined}
      />

      {selected && (
        <BulkBar
          count={selected.size}
          allSelected={allSelected}
          onToggleAll={toggleAll}
          onCancel={() => setSelected(null)}
          onApply={applyBulk}
          categories={categories}
          tags={tags}
          projects={projects}
        />
      )}

      <UnusualExplainer txn={explain} onClose={() => setExplain(null)} onOpen={openEdit} />

      {/* Delete confirm */}
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
