import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Sparkles, Copy, FolderOpen, Check, X } from 'lucide-react';
import { format, addMonths, subMonths, parse } from 'date-fns';
import { Header } from '../components/layout/Header';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { budgetsApi } from '../api/budgets';
import { categoriesApi } from '../api/categories';
import { projectsApi } from '../api/projects';
import { onDataChanged } from '../lib/events';
import { Budget, BudgetOverview, BudgetSuggestion, Category, Project, Provision } from '../types';

const fmt = (v: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const parseAmount = (s: string) => parseFloat(s.replace(',', '.')) || 0;
const toInput = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','));
const monthName = (m: string) => format(parse(m, 'yyyy-MM', new Date()), 'MMMM');

const cardStyle = { background: 'var(--surface-low)', border: '1px solid rgba(255,255,255,0.05)' };
const inputCls = 'block w-full rounded-xl px-3 h-12 text-base tabular-nums focus:outline-none focus:ring-1';
const inputStyle = { background: 'var(--surface-highest)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)' };

/** Spent vs budget, with a line where spending should be by today. */
const PaceBar: React.FC<{ spent: number; budget: number; pace: number | null; color?: string }> = ({ spent, budget, pace, color }) => {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : spent > 0 ? 100 : 0;
  const fill = color ?? barColor(spent, budget, pace);
  return (
    <div className="relative h-2 mt-2">
      <div className="absolute inset-0 rounded-full overflow-hidden" style={{ background: 'var(--surface-highest)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: fill }} />
      </div>
      {pace !== null && pace > 0 && pace < 1 && (
        <div
          className="absolute -top-1 -bottom-1 w-0.5 rounded-full"
          style={{ left: `calc(${pace * 100}% - 1px)`, background: 'var(--text)' }}
          title="Where spending should be by today"
        />
      )}
    </div>
  );
};

function barColor(spent: number, budget: number, pace: number | null) {
  if (spent > budget + 0.005) return 'var(--expense)';
  if (pace !== null && pace > 0 && pace < 1 && spent > budget * pace + 0.005) return 'var(--warn)';
  return 'var(--accent)';
}

/** "12,00 left" / "Over by 3,00", coloured by how it's going. */
const LeftLabel: React.FC<{ spent: number; budget: number; pace: number | null }> = ({ spent, budget, pace }) => {
  const left = budget - spent;
  if (left < -0.005) {
    return <span className="font-semibold" style={{ color: 'var(--expense)' }}>Over by {fmt(-left)}</span>;
  }
  return <span className="font-semibold" style={{ color: barColor(spent, budget, pace) === 'var(--warn)' ? 'var(--warn)' : 'var(--text)' }}>{fmt(left)} left</span>;
};

type Sheet =
  | { kind: 'budget'; budget: Budget | null }
  | { kind: 'provision'; provision: Provision | null }
  | null;

export const Budgets: React.FC = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'budgets' | 'categories'>('budgets');
  const [data, setData] = useState<BudgetOverview | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [carriedSeen, setCarriedSeen] = useState(false);

  const month = format(currentDate, 'yyyy-MM');

  const load = useCallback(async () => {
    const [ov, sug] = await Promise.all([budgetsApi.overview(month), budgetsApi.suggestions(month)]);
    setData(ov);
    setSuggestions(sug);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    setLoading(true);
    setCarriedSeen(false);
    load();
  }, [load]);
  useEffect(() => onDataChanged(load), [load]);
  useEffect(() => {
    categoriesApi.list().then(cats => setCategories(cats.filter(c => c.type === 'expense' || c.type === 'both')));
    projectsApi.list().then(setProjects);
  }, []);

  // Pace only means something for the current month; past months are complete
  const pace = data ? (data.pace > 0 ? data.pace : null) : null;
  const budgeted = data ? data.budgets.reduce((s, b) => s + b.amount, 0) + data.provisions.reduce((s, p) => s + p.amount, 0) : 0;
  const spentInBudgets = data ? data.budgets.reduce((s, b) => s + (b.spent ?? 0), 0) + data.provisions.reduce((s, p) => s + p.spent, 0) : 0;
  const hasPlan = !!data && (data.budgets.length > 0 || data.provisions.length > 0);
  const suggestionFor = (categoryId: string) => suggestions.find(s => s.category_id === categoryId);

  const isCurrent = month === format(new Date(), 'yyyy-MM');
  const isPast = data ? data.pace >= 1 : false;
  const daysLeft = data && isCurrent ? data.days_in_month - Math.round(data.pace * data.days_in_month) + 1 : 0;

  return (
    <div>
      <Header title="Budgets" />

      {/* Month navigator */}
      <div className="flex items-center justify-between gap-2 mb-4 md:justify-start">
        <button
          onClick={() => setCurrentDate(d => subMonths(d, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-2)' }}
          aria-label="Previous month"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="font-headline text-base font-semibold min-w-[150px] text-center h-10"
          style={{ color: 'var(--text)' }}
        >
          {format(currentDate, 'MMMM yyyy')}
        </button>
        <button
          onClick={() => setCurrentDate(d => addMonths(d, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-2)' }}
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading || !data ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="max-w-2xl">
          {data.carried_from && !carriedSeen && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-3" style={{ background: 'rgb(var(--accent-rgb) / 0.1)' }}>
              <p className="flex-1 text-sm" style={{ color: 'var(--text)' }}>
                Your {monthName(data.carried_from)} budgets carried over. Tap any one to change it.
              </p>
              <button onClick={() => setCarriedSeen(true)} className="w-8 h-8 -my-1 -mr-1 flex items-center justify-center" style={{ color: 'var(--muted)' }} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          )}

          {hasPlan && (
            <LeftToSpend
              budgeted={budgeted}
              spent={spentInBudgets}
              pace={pace}
              isCurrent={isCurrent}
              isPast={isPast}
              daysLeft={daysLeft}
              unbudgeted={data.unbudgeted_spent}
            />
          )}

          {/* Budgets / By category */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--surface-low)' }}>
            {(['budgets', 'categories'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className="h-10 rounded-lg text-sm font-semibold transition-colors"
                style={view === v
                  ? { background: 'var(--surface-highest)', color: 'var(--text)' }
                  : { color: 'var(--muted)' }}
              >
                {v === 'budgets' ? 'Budgets' : 'By category'}
              </button>
            ))}
          </div>

          {view === 'budgets' ? (
            <>
              {data.budgets.length === 0 && (
                <StartPanel
                  month={month}
                  previousMonth={data.previous_month}
                  suggestions={suggestions}
                  categories={categories}
                  onDone={load}
                />
              )}

              {data.budgets.length > 0 && (
                <div className="rounded-xl overflow-hidden mb-3" style={cardStyle}>
                  {data.budgets.map((b, i) => (
                    <button
                      key={b.id}
                      onClick={() => setSheet({ kind: 'budget', budget: b })}
                      className="w-full text-left px-4 py-3 active:bg-white/5 hover:bg-white/5"
                      style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.05)' } : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                          style={{ background: `color-mix(in srgb, ${b.category?.color ?? '#9ca3af'} 15%, transparent)` }}>
                          {b.category?.icon ?? '📦'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--text)' }}>{b.category?.name ?? 'Unknown'}</p>
                            <p className="text-sm tabular-nums shrink-0"><LeftLabel spent={b.spent ?? 0} budget={b.amount} pace={pace} /></p>
                          </div>
                          <PaceBar spent={b.spent ?? 0} budget={b.amount} pace={pace} />
                          <p className="text-xs mt-1.5 tabular-nums" style={{ color: 'var(--muted)' }}>
                            {fmt(b.spent ?? 0)} of {fmt(b.amount)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {data.provisions.length > 0 && (
                <>
                  <p className="text-sm font-semibold mt-5 mb-2" style={{ color: 'var(--text-2)' }}>Set aside for projects</p>
                  <div className="rounded-xl overflow-hidden mb-3" style={cardStyle}>
                    {data.provisions.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => setSheet({ kind: 'provision', provision: p })}
                        className="w-full text-left px-4 py-3 active:bg-white/5 hover:bg-white/5"
                        style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.05)' } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                            style={{ background: `color-mix(in srgb, ${p.project?.color ?? '#9ca3af'} 15%, transparent)` }}>
                            {p.project?.icon ?? '📁'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--text)' }}>{p.project?.name ?? 'Project'}</p>
                              <p className="text-sm tabular-nums shrink-0"><LeftLabel spent={p.spent} budget={p.amount} pace={null} /></p>
                            </div>
                            <PaceBar spent={p.spent} budget={p.amount} pace={null} />
                            <p className="text-xs mt-1.5 tabular-nums" style={{ color: 'var(--muted)' }}>
                              {fmt(p.spent)} of {fmt(p.amount)} · counts here, not in categories
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3">
                <button
                  onClick={() => setSheet({ kind: 'budget', budget: null })}
                  className="h-12 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                >
                  <Plus size={16} /> Budget
                </button>
                <button
                  onClick={() => setSheet({ kind: 'provision', provision: null })}
                  className="h-12 rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text)' }}
                >
                  <FolderOpen size={16} /> For a project
                </button>
              </div>
              {data.budgets.length > 0 && (
                <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
                  Budgets carry over to the next month. Set aside money for a project and, that month, its spending counts against it instead of its categories.
                </p>
              )}
            </>
          ) : (
            <ByCategory data={data} pace={pace} onOpen={id => navigate(id ? `/transactions?category_id=${id}` : '/transactions')} />
          )}
        </div>
      )}

      {sheet?.kind === 'budget' && data && (
        <BudgetSheet
          budget={sheet.budget}
          month={month}
          categories={categories.filter(c => !data.budgets.some(b => b.category_id === c.id))}
          suggestionFor={suggestionFor}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); load(); }}
          onSeeTransactions={id => navigate(`/transactions?category_id=${id}`)}
        />
      )}
      {sheet?.kind === 'provision' && data && (
        <ProvisionSheet
          provision={sheet.provision}
          month={month}
          projects={projects.filter(p => !data.provisions.some(x => x.project_id === p.id))}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); load(); }}
        />
      )}
    </div>
  );
};

/** The headline: how much is left this month and whether spending is ahead of pace. */
const LeftToSpend: React.FC<{
  budgeted: number; spent: number; pace: number | null;
  isCurrent: boolean; isPast: boolean; daysLeft: number; unbudgeted: number;
}> = ({ budgeted, spent, pace, isCurrent, isPast, daysLeft, unbudgeted }) => {
  const left = budgeted - spent;
  const over = left < -0.005;
  const expected = pace !== null ? budgeted * pace : null;
  const ahead = expected !== null && isCurrent ? spent - expected : 0;

  let status: React.ReactNode = null;
  if (isCurrent && !over) {
    status = ahead > 0.5
      ? <span style={{ color: 'var(--warn)' }}>{fmt(ahead)} ahead of pace</span>
      : <span style={{ color: 'var(--income)' }}>On pace{ahead < -0.5 ? ` · ${fmt(-ahead)} under` : ''}</span>;
  }

  return (
    <div className="rounded-xl px-4 py-3.5 mb-4" style={cardStyle}>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        {over ? 'Over budget' : isPast ? 'Left over' : 'Left to spend'}
      </p>
      <p className="text-3xl font-bold tabular-nums mt-0.5" style={{ color: over ? 'var(--expense)' : 'var(--text)' }}>
        {fmt(Math.abs(left))}
      </p>
      <p className="text-xs mt-1 tabular-nums" style={{ color: 'var(--text-2)' }}>
        {fmt(spent)} of {fmt(budgeted)} spent
        {isCurrent && !over && daysLeft > 0 && ` · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left · about ${fmt(left / daysLeft)} a day`}
      </p>
      <PaceBar spent={spent} budget={budgeted} pace={isCurrent ? pace : null} />
      <div className="flex items-center justify-between gap-2 mt-2 text-xs">
        <span>{status}</span>
        {isCurrent && pace !== null && (
          <span className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
            <span className="inline-block w-0.5 h-3 rounded-full" style={{ background: 'var(--text)' }} /> today
          </span>
        )}
      </div>
      {unbudgeted > 0.005 && (
        <p className="text-xs mt-2 pt-2 tabular-nums" style={{ color: 'var(--muted)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          Plus <span style={{ color: 'var(--text-2)' }}>{fmt(unbudgeted)}</span> spent in categories without a budget
        </p>
      )}
    </div>
  );
};

/** Every category with spending this month: its share of all spending, and of its budget. */
const ByCategory: React.FC<{ data: BudgetOverview; pace: number | null; onOpen: (categoryId: string | null) => void }> = ({ data, pace, onOpen }) => {
  // Budgets go by real category here, so a category's provisioned project spending shows too
  const budgetFor = new Map(data.budgets.map(b => [b.category_id, b.amount]));
  const rows = [
    ...data.categories,
    ...data.budgets
      .filter(b => !data.categories.some(c => c.category_id === b.category_id))
      .map(b => ({ category_id: b.category_id, name: b.category?.name ?? 'Unknown', icon: b.category?.icon ?? '📦', color: b.category?.color ?? '#9ca3af', spent: 0 })),
  ];
  const total = data.total_spent;

  if (rows.length === 0) {
    return <p className="text-sm text-center py-10" style={{ color: 'var(--muted)' }}>No spending this month yet.</p>;
  }

  return (
    <>
      <p className="text-xs mb-2 tabular-nums" style={{ color: 'var(--muted)' }}>
        {fmt(total)} spent this month (your share, after refunds)
      </p>
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        {rows.map((c, i) => {
          const share = total > 0 ? (c.spent / total) * 100 : 0;
          const budget = budgetFor.get(c.category_id ?? '');
          return (
            <button
              key={c.category_id ?? 'none'}
              onClick={() => onOpen(c.category_id)}
              className="w-full text-left px-4 py-3 active:bg-white/5 hover:bg-white/5"
              style={i > 0 ? { borderTop: '1px solid rgba(255,255,255,0.05)' } : undefined}
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: `color-mix(in srgb, ${c.color} 15%, transparent)` }}>
                  {c.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--text)' }}>{c.name}</p>
                    <p className="text-sm font-semibold tabular-nums shrink-0" style={{ color: 'var(--text)' }}>{fmt(c.spent)}</p>
                  </div>
                  {budget !== undefined ? (
                    <PaceBar spent={c.spent} budget={budget} pace={pace} />
                  ) : (
                    <PaceBar spent={c.spent} budget={total} pace={null} color={`color-mix(in srgb, ${c.color} 70%, transparent)`} />
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs mt-1.5 tabular-nums" style={{ color: 'var(--muted)' }}>
                    <span>{Math.round(share)}% of spending</span>
                    {budget !== undefined ? (
                      <span style={{ color: c.spent > budget + 0.005 ? 'var(--expense)' : barColor(c.spent, budget, pace) === 'var(--warn)' ? 'var(--warn)' : 'var(--text-2)' }}>
                        {budget > 0 ? `${Math.round((c.spent / budget) * 100)}% of ${fmt(budget)}` : 'Budget 0'}
                      </span>
                    ) : (
                      <span>No budget</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
        Coloured bars: share of all spending. Bars with a line: share of the budget, and the line is where you'd be by today at an even pace.
      </p>
    </>
  );
};

/** First visit to a month with no budgets: start from the last 3 months, or copy a month. */
const StartPanel: React.FC<{
  month: string;
  previousMonth: string | null;
  suggestions: BudgetSuggestion[];
  categories: Category[];
  onDone: () => void;
}> = ({ month, previousMonth, suggestions, categories, onDone }) => {
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const usable = suggestions.filter(s => byId.has(s.category_id));

  useEffect(() => {
    setPicked(Object.fromEntries(usable.map(s => [s.category_id, toInput(s.amount)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, categories]);

  const chosen = Object.entries(picked).filter(([, v]) => parseAmount(v) > 0);
  const total = chosen.reduce((s, [, v]) => s + parseAmount(v), 0);

  const addAll = async () => {
    setBusy(true);
    try {
      for (const [category_id, v] of chosen) {
        await budgetsApi.create({ category_id, amount: parseAmount(v), month });
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!previousMonth) return;
    setBusy(true);
    try {
      await budgetsApi.copy(month, previousMonth);
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl px-4 py-4 mb-3" style={cardStyle}>
      {previousMonth && (
        <button
          onClick={copy}
          disabled={busy}
          className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold mb-4 disabled:opacity-50"
          style={{ background: 'rgb(var(--accent-rgb) / 0.15)', color: 'var(--accent)' }}
        >
          <Copy size={16} /> Copy {monthName(previousMonth)}'s budgets
        </button>
      )}
      <div className="flex items-center gap-2">
        <Sparkles size={18} style={{ color: 'var(--accent)' }} />
        <p className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          {previousMonth ? 'Or start from your spending' : 'Start from your spending'}
        </p>
      </div>
      {usable.length === 0 ? (
        <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
          Not enough spending in the last 3 months to suggest budgets. Add one yourself below.
        </p>
      ) : (
        <>
          <p className="text-sm mt-1 mb-3" style={{ color: 'var(--text-2)' }}>
            What you spent on average over the last 3 months, rounded up a little. Change any amount, or untick what you don't want to budget.
          </p>
          <div className="space-y-1">
            {usable.map(s => {
              const c = byId.get(s.category_id)!;
              const on = s.category_id in picked;
              return (
                <div key={s.category_id} className="flex items-center gap-2">
                  <button
                    onClick={() => setPicked(prev => {
                      const next = { ...prev };
                      if (on) delete next[s.category_id]; else next[s.category_id] = toInput(s.amount);
                      return next;
                    })}
                    className="flex items-center gap-2.5 flex-1 min-w-0 h-12 text-left"
                    aria-pressed={on}
                  >
                    <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: on ? 'var(--accent)' : 'transparent', border: on ? 'none' : '1.5px solid var(--faint-2)', color: 'var(--on-accent)' }}>
                      {on && <Check size={15} strokeWidth={3} />}
                    </span>
                    <span className="text-lg shrink-0">{c.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate" style={{ color: on ? 'var(--text)' : 'var(--faint)' }}>{c.name}</span>
                      <span className="block text-xs tabular-nums" style={{ color: 'var(--muted)' }}>avg {fmt(s.average)}</span>
                    </span>
                  </button>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={picked[s.category_id] ?? ''}
                    disabled={!on}
                    onChange={e => setPicked(prev => ({ ...prev, [s.category_id]: e.target.value }))}
                    className="w-24 rounded-xl px-3 h-11 text-base text-right tabular-nums focus:outline-none disabled:opacity-40"
                    style={inputStyle}
                    aria-label={`${c.name} budget`}
                  />
                </div>
              );
            })}
          </div>
          <Button className="w-full mt-4 h-12" loading={busy} disabled={chosen.length === 0} onClick={addAll}>
            Add {chosen.length} {chosen.length === 1 ? 'budget' : 'budgets'} · {fmt(total)}
          </Button>
        </>
      )}
    </div>
  );
};

const BudgetSheet: React.FC<{
  budget: Budget | null;
  month: string;
  categories: Category[];
  suggestionFor: (categoryId: string) => BudgetSuggestion | undefined;
  onClose: () => void;
  onSaved: () => void;
  onSeeTransactions: (categoryId: string) => void;
}> = ({ budget, month, categories, suggestionFor, onClose, onSaved, onSeeTransactions }) => {
  const [categoryId, setCategoryId] = useState(budget?.category_id ?? '');
  const [amount, setAmount] = useState(budget ? toInput(budget.amount) : '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const suggestion = categoryId ? suggestionFor(categoryId) : undefined;
  const category = budget?.category ?? categories.find(c => c.id === categoryId);

  const save = async () => {
    setBusy(true);
    try {
      if (budget) await budgetsApi.update(budget.id, { amount: parseAmount(amount) });
      else await budgetsApi.create({ category_id: categoryId, amount: parseAmount(amount), month });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!budget) return;
    setBusy(true);
    try {
      await budgetsApi.delete(budget.id);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={budget ? `${category?.icon ?? ''} ${category?.name ?? 'Budget'}` : 'Add a budget'} size="sm">
      <div className="space-y-4">
        {!budget && (
          <div>
            <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>Category</p>
            {categories.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Every expense category already has a budget.</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map(c => {
                  const on = c.id === categoryId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setCategoryId(c.id);
                        const s = suggestionFor(c.id);
                        if (s && !amount) setAmount(toInput(s.amount));
                      }}
                      className="flex items-center gap-2 h-11 px-2.5 rounded-xl text-sm text-left min-w-0"
                      style={on
                        ? { background: `color-mix(in srgb, ${c.color} 20%, transparent)`, color: 'var(--text)', boxShadow: `inset 0 0 0 1.5px ${c.color}` }
                        : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-2)' }}
                    >
                      <span className="shrink-0">{c.icon}</span>
                      <span className="truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div>
          <label htmlFor="budget-amount" className="block text-sm mb-2" style={{ color: 'var(--text-2)' }}>Monthly budget</label>
          <input
            id="budget-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className={inputCls}
            style={inputStyle}
          />
          {suggestion && (
            <button
              type="button"
              onClick={() => setAmount(toInput(suggestion.amount))}
              className="text-xs mt-2 tabular-nums"
              style={{ color: 'var(--muted)' }}
            >
              Last 3 months: avg {fmt(suggestion.average)} · <span style={{ color: 'var(--accent)' }}>use {fmt(suggestion.amount)}</span>
            </button>
          )}
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {budget ? 'Changes this month. Next month starts from this amount.' : 'Next month starts from this amount too.'}
          </p>
        </div>

        {budget && (
          <button
            type="button"
            onClick={() => onSeeTransactions(budget.category_id)}
            className="text-sm font-semibold h-10"
            style={{ color: 'var(--accent)' }}
          >
            See {category?.name ?? 'its'} transactions →
          </button>
        )}

        <div className="flex items-center gap-2 pt-1">
          {budget && (
            confirmDelete ? (
              <Button variant="danger" loading={busy} onClick={remove}>Remove budget</Button>
            ) : (
              <Button variant="secondary" onClick={() => setConfirmDelete(true)}>Remove</Button>
            )
          )}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!amount || (!budget && !categoryId)} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};

const ProvisionSheet: React.FC<{
  provision: Provision | null;
  month: string;
  projects: Project[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ provision, month, projects, onClose, onSaved }) => {
  const [projectId, setProjectId] = useState(provision?.project_id ?? '');
  const [amount, setAmount] = useState(provision ? toInput(provision.amount) : '');
  const [busy, setBusy] = useState(false);
  const project = provision?.project ?? projects.find(p => p.id === projectId);
  // Planned and active projects first; finished ones are rarely what you're setting money aside for
  const options = [...projects].sort((a, b) => Number(a.status === 'completed') - Number(b.status === 'completed'));

  const save = async () => {
    setBusy(true);
    try {
      if (provision) await budgetsApi.updateProvision(provision.id, parseAmount(amount));
      else await budgetsApi.createProvision({ project_id: projectId, amount: parseAmount(amount), month });
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!provision) return;
    setBusy(true);
    try {
      await budgetsApi.deleteProvision(provision.id);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={provision ? `${project?.icon ?? ''} ${project?.name ?? 'Project'}` : 'Set aside for a project'} size="sm">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>
          In {monthName(month)}, spending on {project ? <span className="font-semibold">{project.name}</span> : 'the project'} counts
          against this amount instead of its categories' budgets, so nothing is counted twice.
        </p>
        {!provision && (
          options.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No projects to pick. Create one in Projects first.</p>
          ) : (
            <div className="space-y-1">
              {options.map(p => {
                const on = p.id === projectId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProjectId(p.id)}
                    className="w-full flex items-center gap-3 h-12 px-3 rounded-xl text-left text-[15px]"
                    style={on
                      ? { background: `color-mix(in srgb, ${p.color} 20%, transparent)`, color: 'var(--text)', boxShadow: `inset 0 0 0 1.5px ${p.color}` }
                      : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-2)' }}
                  >
                    <span>{p.icon}</span>
                    <span className="flex-1 truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
          )
        )}
        <div>
          <label htmlFor="provision-amount" className="block text-sm mb-2" style={{ color: 'var(--text-2)' }}>Amount for {monthName(month)}</label>
          <input
            id="provision-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className={inputCls}
            style={inputStyle}
          />
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Only for this month: project money doesn't carry over.</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {provision && <Button variant="secondary" loading={busy} onClick={remove}>Remove</Button>}
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} disabled={!amount || (!provision && !projectId)} onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
};
