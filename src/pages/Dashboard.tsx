import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth, addMonths, isSameMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { TransactionFormModal } from '../components/transactions/TransactionFormModal';
import { accountsApi } from '../api/accounts';
import { transactionsApi } from '../api/transactions';
import { budgetsApi } from '../api/budgets';
import { Account, Transaction, Budget, getCurrencySymbol } from '../types';

const fmt = (value: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const TransactionTypeIcon = ({ type }: { type: string }) => {
  if (type === 'income') return <ArrowDownLeft size={14} className="text-secondary" />;
  if (type === 'expense') return <ArrowUpRight size={14} className="text-error" />;
  return <ArrowLeftRight size={14} className="text-primary" />;
};

// ── Custom tooltips ────────────────────────────────────────
const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const income   = payload.find((p: any) => p.dataKey === 'income')?.value   ?? 0;
  const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value ?? 0;
  const net = income - expenses;
  return (
    <div style={{
      background: '#131c30', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 160,
    }}>
      <p style={{ color: '#dae2fd', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#4edea3' }}>Income</span>
          <span style={{ color: '#4edea3', fontWeight: 700 }}>+{fmt(income)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#ffb4ab' }}>Expenses</span>
          <span style={{ color: '#ffb4ab', fontWeight: 700 }}>−{fmt(expenses)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 2 }}>
          <span style={{ color: '#bdc8d1' }}>Net</span>
          <span style={{ color: net >= 0 ? '#4edea3' : '#ffb4ab', fontWeight: 700 }}>
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
      background: '#131c30', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10, padding: '8px 14px', fontSize: 12,
    }}>
      <p style={{ color: '#dae2fd', fontWeight: 700, marginBottom: 2 }}>{d.name}</p>
      <p style={{ color: '#ffb4ab', fontWeight: 700 }}>{fmt(d.value as number)}</p>
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
          background: rangeMode === 'custom' ? 'rgba(142,213,255,0.15)' : 'rgba(255,255,255,0.05)',
          color: rangeMode === 'custom' ? '#8ed5ff' : '#6b7280',
          border: `1px solid ${rangeMode === 'custom' ? 'rgba(142,213,255,0.3)' : 'transparent'}`,
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
            style={{ color: '#6b7280' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold w-20 text-center" style={{ color: '#dae2fd' }}>
            {format(chartDate, 'MMM yyyy')}
          </span>
          <button
            type="button"
            onClick={onNext}
            disabled={isCurrentMonth}
            className="p-1 rounded transition-colors hover:bg-white/5 disabled:opacity-30"
            style={{ color: '#6b7280' }}
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
            style={{ color: '#dae2fd', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
          />
          <span style={{ color: '#4b5563', fontSize: 11 }}>–</span>
          <input
            type="date"
            value={customTo}
            onChange={e => onCustomTo(e.target.value)}
            className="bg-transparent text-xs outline-none px-2 py-1 rounded-lg"
            style={{ color: '#dae2fd', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
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
  const [addTxnOpen, setAddTxnOpen]         = useState(false);

  // Chart period state
  const [chartDate, setChartDate]         = useState(new Date());
  const [rangeMode, setRangeMode]         = useState<RangeMode>('month');
  const [customFrom, setCustomFrom]       = useState('');
  const [customTo, setCustomTo]           = useState('');
  const [chartsLoading, setChartsLoading] = useState(false);

  // Chart data
  const [monthlyData, setMonthlyData]         = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [categorySpending, setCategorySpending] = useState<CatSpend[]>([]);

  const currentMonth = format(new Date(), 'yyyy-MM');

  // ── Load static data once ──────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);
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
    };
    init();
  }, []);

  // ── Load chart data when period changes ───────────────
  const loadCharts = useCallback(async () => {
    setChartsLoading(true);
    try {
      // Bar chart: 6 months ending at chartDate (or ending at customTo)
      const months: { month: string; income: number; expenses: number }[] = [];
      const anchorDate = rangeMode === 'custom' && customTo
        ? new Date(customTo)
        : chartDate;

      for (let i = 5; i >= 0; i--) {
        const d = subMonths(anchorDate, i);
        const s = await transactionsApi.summary(format(d, 'yyyy-MM'));
        months.push({ month: format(d, 'MMM yy'), income: s.total_income, expenses: s.total_expenses });
      }
      setMonthlyData(months);

      // Donut: category spending for selected period
      const from = rangeMode === 'custom' && customFrom
        ? customFrom
        : format(startOfMonth(chartDate), 'yyyy-MM-dd');
      const to = rangeMode === 'custom' && customTo
        ? customTo
        : format(endOfMonth(chartDate), 'yyyy-MM-dd');

      const allTxns = await transactionsApi.list({ type: 'expense', date_from: from, date_to: to, limit: 500 });
      const catMap: Record<string, CatSpend> = {};
      for (const t of allTxns) {
        if (t.category) {
          if (!catMap[t.category.id]) {
            catMap[t.category.id] = { id: t.category.id, name: t.category.name, icon: t.category.icon, color: t.category.color, amount: 0 };
          }
          catMap[t.category.id].amount += t.amount;
        }
      }
      setCategorySpending(Object.values(catMap).sort((a, b) => b.amount - a.amount).slice(0, 6));
    } catch (err) {
      console.error('Chart load error', err);
    } finally {
      setChartsLoading(false);
    }
  }, [chartDate, rangeMode, customFrom, customTo]);

  useEffect(() => { loadCharts(); }, [loadCharts]);

  // ── Period navigation ──────────────────────────────────
  const prevMonth = () => setChartDate(d => subMonths(d, 1));
  const nextMonth = () => {
    if (!isSameMonth(chartDate, new Date())) setChartDate(d => addMonths(d, 1));
  };
  const toggleMode = () => {
    setRangeMode(m => {
      if (m === 'month') {
        // Pre-fill custom range with selected month
        setCustomFrom(format(startOfMonth(chartDate), 'yyyy-MM-dd'));
        setCustomTo(format(endOfMonth(chartDate), 'yyyy-MM-dd'));
        return 'custom';
      }
      return 'month';
    });
  };

  const periodLabel = rangeMode === 'custom'
    ? (customFrom && customTo ? `${customFrom} – ${customTo}` : 'Custom range')
    : format(chartDate, 'MMMM yyyy');

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
            const barColor  = over ? 'bg-error' : warn ? 'bg-yellow-400' : 'bg-secondary';
            const textColor = over ? 'text-error' : warn ? 'text-yellow-400' : 'text-secondary';
            return (
              <Card
                key={budget.id}
                className="cursor-pointer hover:border-white/10 transition-colors"
                onClick={() => navigate(`/transactions?category_id=${budget.category_id}`)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{budget.category?.icon ?? '📦'}</span>
                  <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest truncate">{budget.category?.name}</span>
                </div>
                <div className="mb-3">
                  <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="font-headline text-lg font-bold text-white">{fmt(spent)}</p>
                    <p className="text-xs text-slate-500">of {fmt(budget.amount)}</p>
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
          <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest mb-4">Account Balances</h2>
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
                    <p className="text-xs text-slate-500 capitalize">{account.type.replace('_', ' ')} · {account.currency}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold font-headline ${account.balance < 0 ? 'text-error' : 'text-white'}`}>
                  {getCurrencySymbol(account.currency)}{fmt(account.balance)}
                </span>
              </button>
            ))}
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest">Recent Transactions</h2>
            <button
              onClick={() => navigate('/transactions')}
              className="text-xs font-semibold transition-colors hover:text-white"
              style={{ color: '#8ed5ff' }}
            >
              View all →
            </button>
          </div>
          <div className="space-y-1">
            {recentTransactions.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No transactions yet</p>
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
                    <p className="text-xs text-slate-500">{txn.account_name} · {txn.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <TransactionTypeIcon type={txn.type} />
                  <span className={`text-sm font-semibold font-headline ${
                    txn.type === 'income' ? 'text-secondary' : txn.type === 'expense' ? 'text-error' : 'text-primary'
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
            <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest">Income vs Expenses</h2>
            <PeriodControl
              chartDate={chartDate}
              onPrev={prevMonth}
              onNext={nextMonth}
              rangeMode={rangeMode}
              customFrom={customFrom}
              customTo={customTo}
              onCustomFrom={setCustomFrom}
              onCustomTo={setCustomTo}
              onToggleMode={toggleMode}
            />
          </div>
          {chartsLoading ? (
            <div className="h-[240px] flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} barGap={4} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="income" name="Income" fill="#4edea3" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ffb4ab" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Donut chart */}
        <Card glass>
          <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest">Spending by Category</h2>
              <p className="text-[10px] mt-0.5" style={{ color: '#4b5563' }}>{periodLabel}</p>
            </div>
          </div>
          {chartsLoading ? (
            <div className="h-[220px] flex items-center justify-center">
              <div className="animate-spin w-6 h-6 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : categorySpending.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-500">
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
                  formatter={v => <span style={{ fontSize: 11, color: '#bdc8d1', cursor: 'pointer' }}>{v}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setAddTxnOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary-container text-on-primary-container rounded-full shadow-lg flex items-center justify-center transition-all hover:brightness-110 active:scale-95 z-40"
        title="Add Transaction"
      >
        <Plus size={24} />
      </button>

      <TransactionFormModal
        isOpen={addTxnOpen}
        onClose={() => setAddTxnOpen(false)}
        onSaved={() => { loadCharts(); }}
      />
    </div>
  );
};
