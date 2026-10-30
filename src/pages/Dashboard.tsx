import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { accountsApi } from '../api/accounts';
import { transactionsApi } from '../api/transactions';
import { budgetsApi } from '../api/budgets';
import { Account, Transaction, Budget, getCurrencySymbol } from '../types';
import { onDataChanged } from '../lib/events';

const fmt = (value: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const TransactionTypeIcon = ({ type }: { type: string }) => {
  if (type === 'income') return <ArrowDownLeft size={14} className="text-secondary" />;
  if (type === 'expense') return <ArrowUpRight size={14} className="text-error" />;
  return <ArrowLeftRight size={14} className="text-transfer" />;
};

// ── Custom tooltips ────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const income   = payload.find((p: any) => p.dataKey === 'income')?.value   ?? 0;
  const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value ?? 0;
  const net = income - expenses;
  return (
    <div style={{
      background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 160,
    }}>
      <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 8, fontSize: 12 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--income)' }}>Income</span>
          <span style={{ color: 'var(--income)', fontWeight: 700 }}>+{fmt(income)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--expense)' }}>Expenses</span>
          <span style={{ color: 'var(--expense)', fontWeight: 700 }}>−{fmt(expenses)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2 }}>
          <span style={{ color: 'var(--text-2)' }}>Net</span>
          <span style={{ color: net >= 0 ? 'var(--income)' : 'var(--expense)', fontWeight: 700 }}>
            {net >= 0 ? '+' : ''}{fmt(net)}
          </span>
        </div>
      </div>
    </div>
  );
};

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--surface-raised)', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '8px 14px', fontSize: 12,
    }}>
      <p style={{ color: 'var(--text)', fontWeight: 700, marginBottom: 2 }}>{d.name}</p>
      <p style={{ color: 'var(--expense)', fontWeight: 700 }}>{fmt(d.value as number)}</p>
    </div>
  );
};

// ── Period nav control ─────────────────────────────────────
type RangeMode = 'month' | 'custom';

interface PeriodControlProps {
  chartDate: Date;
  onPrev: () => void;
  onNext: () => void;
  rangeMode: RangeMode;
  customFrom: string;
  customTo: string;
  onCustomFrom: (v: string) => void;
  onCustomTo: (v: string) => void;
  onToggleMode: () => void;
}

const PeriodControl: React.FC<PeriodControlProps> = ({
  chartDate, onPrev, onNext, rangeMode, customFrom, customTo,
  onCustomFrom, onCustomTo, onToggleMode,
}) => {
  const isCurrentMonth = isSameMonth(chartDate, new Date());
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onToggleMode}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
        style={{
          background: rangeMode === 'custom' ? 'rgb(var(--accent-rgb) / 0.15)' : 'rgba(255,255,255,0.05)',
          color: rangeMode === 'custom' ? 'var(--accent)' : 'var(--muted)',
          border: `1px solid ${rangeMode === 'custom' ? 'rgb(var(--accent-rgb) / 0.3)' : 'transparent'}`,
        }}
      >
        <Calendar size={11} />
        {rangeMode === 'custom' ? 'Custom' : 'Custom range'}
      </button>

      {rangeMode === 'month' ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            className="p-1 rounded transition-colors hover:bg-white/5"
            style={{ color: 'var(--muted)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold w-20 text-center" style={{ color: 'var(--text)' }}>
            {format(chartDate, 'MMM yyyy')}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={isCurrentMonth}
            className="p-1 rounded transition-colors hover:bg-white/5 disabled:opacity-30"
            style={{ color: 'var(--muted)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customFrom}
            onChange={e => onCustomFrom(e.target.value)}
            className="bg-transparent text-xs outline-none px-2 py-1 rounded-lg"
            style={{ color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
          />
          <span style={{ color: 'var(--faint)', fontSize: 11 }}>–</span>
          <input
            type="date"
            value={customTo}
            onChange={e => onCustomTo(e.target.value)}
            className="bg-transparent text-xs outline-none px-2 py-1 rounded-lg"
            style={{ color: 'var(--text)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
          />
        </div>
      )}
    </div>
  );
};

// ── Types ──────────────────────────────────────────────────
interface CatSpend { id: string; name: string; icon: string; color: string; amount: number }

// ── Main component ─────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Static data (account balances, recent txns, budgets)
  const [accounts, setAccounts]             = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets]               = useState<Budget[]>([]);
  const [loading, setLoading]               = useState(true);

  // Bar chart state (fixed: always last 6 months from today)
  const [monthlyData, setMonthlyData]   = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [barLoading, setBarLoading]     = useState(false);

  // Donut chart period state (independent)
  const [pieDate, setPieDate]           = useState(new Date());
  const [pieRangeMode, setPieRangeMode] = useState<RangeMode>('month');
  const [pieCustomFrom, setPieCustomFrom] = useState('');
  const [pieCustomTo, setPieCustomTo]   = useState('');
  const [categorySpending, setCategorySpending] = useState<CatSpend[]>([]);
  const [pieLoading, setPieLoading]     = useState(false);

  const currentMonth = format(new Date(), 'yyyy-MM');

  // ── Load static data (balances, recent txns, budgets) ──
  const loadStatic = useCallback(async () => {
    try {
      const [accts, txns, buds] = await Promise.all([
        accountsApi.list(),
        transactionsApi.list({ limit: 5 }),
        budgetsApi.list(currentMonth),
      ]);
      setAccounts(accts);
      setRecentTransactions(txns);
      setBudgets(buds.slice(0, 4));
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => { loadStatic(); }, [loadStatic]);

  // ── Load bar chart (last 6 months from today, independent) ──
  const loadBarChart = useCallback(async () => {
    setBarLoading(true);
    try {
      const months: { month: string; income: number; expenses: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const s = await transactionsApi.summary(format(d, 'yyyy-MM'));
        months.push({ month: format(d, 'MMM yy'), income: s.total_income, expenses: s.total_expenses - (s.total_refunds ?? 0) });
      }
      setMonthlyData(months);
    } catch (err) {
      console.error('Bar chart load error', err);
    } finally {
      setBarLoading(false);
    }
  }, []);

  useEffect(() => { loadBarChart(); }, [loadBarChart]);

  // ── Load donut chart when pie period changes ───────────
  const loadPieChart = useCallback(async () => {
    setPieLoading(true);
    try {
      const from = pieRangeMode === 'custom' && pieCustomFrom
        ? pieCustomFrom
        : format(startOfMonth(pieDate), 'yyyy-MM-dd');
      const to = pieRangeMode === 'custom' && pieCustomTo
        ? pieCustomTo
        : format(endOfMonth(pieDate), 'yyyy-MM-dd');

      const inRange = await transactionsApi.list({
        type: 'expense', date_from: from, date_to: to, limit: 5000,
      });

      const catMap: Record<string, CatSpend> = {};
      for (const t of inRange) {
        // Refunds linked to this expense reduce its spend proportionally across categories
        // True cost: leave out refunds and the part spent on others
        const netFactor = t.amount > 0 ? Math.max(0, 1 - ((t.refunded_amount ?? 0) + (t.for_others ?? 0)) / t.amount) : 1;
        if (t.category) {
          if (!catMap[t.category.id]) {
            catMap[t.category.id] = { id: t.category.id, name: t.category.name, icon: t.category.icon, color: t.category.color, amount: 0 };
          }
          catMap[t.category.id].amount += t.amount * netFactor;
        }
        // also tally split categories
        if (t.splits?.length) {
          for (const sp of t.splits) {
            if (sp.category) {
              if (!catMap[sp.category.id]) {
                catMap[sp.category.id] = { id: sp.category.id, name: sp.category.name, icon: sp.category.icon, color: sp.category.color, amount: 0 };
              }
              catMap[sp.category.id].amount += sp.amount * netFactor;
            }
          }
        }
      }
      setCategorySpending(Object.values(catMap).filter(c => c.amount > 0.005).sort((a, b) => b.amount - a.amount).slice(0, 6));
    } catch (err) {
      console.error('Pie chart load error', err);
    } finally {
      setPieLoading(false);
    }
  }, [pieDate, pieRangeMode, pieCustomFrom, pieCustomTo]);

  useEffect(() => { loadPieChart(); }, [loadPieChart]);

  useEffect(() => onDataChanged(() => { loadStatic(); loadBarChart(); loadPieChart(); }), [loadStatic, loadBarChart, loadPieChart]);

  // ── Donut period navigation ────────────────────────────
  const prevPieMonth = () => setPieDate(d => subMonths(d, 1));
  const nextPieMonth = () => {
    if (!isSameMonth(pieDate, new Date())) setPieDate(d => addMonths(d, 1));
  };
  const togglePieMode = () => {
    setPieRangeMode(m => {
      if (m === 'month') {
        setPieCustomFrom(format(startOfMonth(pieDate), 'yyyy-MM-dd'));
        setPieCustomTo(format(endOfMonth(pieDate), 'yyyy-MM-dd'));
        return 'custom';
      }
      return 'month';
    });
  };

  const piePeriodLabel = pieRangeMode === 'custom'
    ? (pieCustomFrom && pieCustomTo ? `${pieCustomFrom} – ${pieCustomTo}` : 'Custom range')
    : format(pieDate, 'MMMM yyyy');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="relative pb-20 space-y-6">
      <Header title="Dashboard" />

      {/* Budget Category Cards */}
      {budgets.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {budgets.map(budget => {
            const spent  = budget.spent ?? 0;
            const pct    = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const over   = pct > 100;
            const warn   = pct > 75 && !over;
            const barColor  = over ? 'bg-error' : warn ? 'bg-warn' : 'bg-secondary';
            const textColor = over ? 'text-error' : warn ? 'text-warn' : 'text-secondary';
            return (
              <Card
                key={budget.id}
                className="cursor-pointer hover:border-white/10 transition-colors"
                onClick={() => navigate(`/transactions?category_id=${budget.category_id}`)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{budget.category?.icon ?? '📦'}</span>
                  <span className="text-xs font-medium text-on-surface-variant truncate">{budget.category?.name}</span>
                </div>
                <div className="mb-3">
                  <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
                  <div>
                    <p className="font-headline text-lg font-bold text-on-surface">{fmt(spent)}</p>
                    <p className="text-xs text-muted">of {fmt(budget.amount)}</p>
                  </div>
                  <span className={`text-xs font-bold ${textColor}`}>
                    {over ? `+${fmt(spent - budget.amount)} over` : `${fmt(budget.amount - spent)} left`}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 text-sm text-primary">
          No budgets set for this month — add some in the <strong>Budgets</strong> page to track spending here.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Balances */}
        <Card>
          <h2 className="font-headline text-sm font-bold text-on-surface mb-4">Account Balances</h2>
          <div className="space-y-3">
            {accounts.map(account => (
              <button
                key={account.id}
                className="flex items-center justify-between w-full hover:bg-white/5 -mx-2 px-2 py-1 rounded-lg transition-colors"
                onClick={() => navigate(`/transactions?account_id=${account.id}`)}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-on-surface">{account.name}</p>
                    <p className="text-xs text-muted capitalize">{account.type.replace('_', ' ')} · {account.currency}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold font-headline ${account.balance < 0 ? 'text-error' : 'text-on-surface'}`}>
                  {getCurrencySymbol(account.currency)}{fmt(account.balance)}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline text-sm font-bold text-on-surface">Recent Transactions</h2>
            <button
              onClick={() => navigate('/transactions')}
              className="text-xs font-semibold transition-colors hover:text-on-surface"
              style={{ color: 'var(--accent)' }}
            >
              View all →
            </button>
          </div>
          <div className="space-y-1">
            {recentTransactions.length === 0 && (
              <p className="text-sm text-muted text-center py-4">No transactions yet</p>
            )}
            {recentTransactions.map(txn => (
              <button
                key={txn.id}
                className="flex items-center justify-between w-full py-2 px-2 -mx-2 rounded-lg transition-colors hover:bg-white/5 text-left"
                onClick={() => navigate('/transactions')}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: txn.category ? `${txn.category.color}22` : 'rgba(255,255,255,0.05)' }}
                  >
                    {txn.category?.icon ?? '💸'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{txn.payee}</p>
                    <p className="text-xs text-muted">{txn.account_name} · {txn.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <TransactionTypeIcon type={txn.type} />
                  <span className={`text-sm font-semibold font-headline ${
                    txn.type === 'income' ? 'text-secondary' : txn.type === 'expense' ? 'text-error' : 'text-transfer'
                  }`}>
                    {txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : ''}
                    {fmt(txn.amount)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <Card glass>
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <h2 className="font-headline text-sm font-bold text-on-surface">Income vs Expenses</h2>
            <span className="text-xs" style={{ color: 'var(--faint)' }}>Last 6 months</span>
          </div>
          {barLoading ? (
            <div className="h-[240px] flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : monthlyData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barGap={4} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="income" name="Income" fill="var(--income)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Donut chart */}
        <Card glass>
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-headline text-sm font-bold text-on-surface">Spending by Category</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--faint)' }}>{piePeriodLabel}</p>
            </div>
            <PeriodControl
              chartDate={pieDate}
              onPrev={prevPieMonth}
              onNext={nextPieMonth}
              rangeMode={pieRangeMode}
              customFrom={pieCustomFrom}
              customTo={pieCustomTo}
              onCustomFrom={setPieCustomFrom}
              onCustomTo={setPieCustomTo}
              onToggleMode={togglePieMode}
            />
          </div>
          {pieLoading ? (
            <div className="h-[220px] flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : categorySpending.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted">
              No expense data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categorySpending}
                  dataKey="amount"
                  nameKey="name"
                  cx="40%" cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  cursor="pointer"
                  onClick={(entry: CatSpend) => {
                    navigate(`/transactions?category_id=${entry.id}`);
                  }}
                >
                  {categorySpending.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.color}
                      style={{ filter: 'brightness(1)', transition: 'filter 0.15s' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={v => <span style={{ fontSize: 11, color: 'var(--text-2)', cursor: 'pointer' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

    </div>
  );
};
