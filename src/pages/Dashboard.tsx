import React, { useEffect, useState } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
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

export const Dashboard: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [categorySpending, setCategorySpending] = useState<{ name: string; icon: string; color: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addTxnOpen, setAddTxnOpen] = useState(false);

  const currentMonth = format(new Date(), 'yyyy-MM');

  const fetchData = async () => {
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

      // Last 6 months bar chart
      const months: { month: string; income: number; expenses: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const s = await transactionsApi.summary(format(d, 'yyyy-MM'));
        months.push({ month: format(d, 'MMM'), income: s.total_income, expenses: s.total_expenses });
      }
      setMonthlyData(months);

      // Category spending donut
      const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const end = format(new Date(), 'yyyy-MM-dd');
      const allTxns = await transactionsApi.list({ type: 'expense', date_from: start, date_to: end, limit: 200 });
      const catMap: Record<string, { name: string; icon: string; color: string; amount: number }> = {};
      for (const t of allTxns) {
        if (t.category) {
          if (!catMap[t.category.id]) {
            catMap[t.category.id] = { name: t.category.name, icon: t.category.icon, color: t.category.color, amount: 0 };
          }
          catMap[t.category.id].amount += t.amount;
        }
      }
      setCategorySpending(Object.values(catMap).sort((a, b) => b.amount - a.amount).slice(0, 6));
    } catch (err) {
      console.error('Dashboard load error', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

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
            const spent = budget.spent ?? 0;
            const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
            const over = pct > 100;
            const warn = pct > 75 && !over;
            const barColor = over ? 'bg-error' : warn ? 'bg-yellow-400' : 'bg-secondary';
            const textColor = over ? 'text-error' : warn ? 'text-yellow-400' : 'text-secondary';
            return (
              <Card key={budget.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{budget.category?.icon ?? '📦'}</span>
                  <span className="text-xs font-medium text-on-surface-variant uppercase tracking-widest truncate">{budget.category?.name}</span>
                </div>
                <div className="mb-3">
                  <div className="h-1 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
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
              <div key={account.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: account.color }} />
                  <div>
                    <p className="text-sm font-medium text-on-surface">{account.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{account.type.replace('_', ' ')} · {account.currency}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold font-headline ${account.balance < 0 ? 'text-error' : 'text-white'}`}>
                  {getCurrencySymbol(account.currency)}{fmt(account.balance)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest mb-4">Recent Transactions</h2>
          <div className="space-y-3">
            {recentTransactions.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No transactions yet</p>
            )}
            {recentTransactions.map(txn => (
              <div key={txn.id} className="flex items-center justify-between py-1">
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
                    {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                    {fmt(txn.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card glass>
          <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest mb-4">Income vs Expenses (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6b7280', textTransform: 'uppercase' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip
                formatter={(value: number) => fmt(value)}
                contentStyle={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, backgroundColor: '#171f33', color: '#dae2fd' }}
              />
              <Bar dataKey="income" name="Income" fill="#4edea3" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ffb4ab" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card glass>
          <h2 className="font-headline text-sm font-bold text-white uppercase tracking-widest mb-4">Spending by Category (This Month)</h2>
          {categorySpending.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-slate-500">
              No expense data for this month
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categorySpending} dataKey="amount" nameKey="name"
                  cx="40%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {categorySpending.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)}
                  contentStyle={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)', fontSize: 12, backgroundColor: '#171f33', color: '#dae2fd' }} />
                <Legend layout="vertical" align="right" verticalAlign="middle"
                  formatter={v => <span style={{ fontSize: 11, color: '#bdc8d1' }}>{v}</span>} />
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
        onSaved={fetchData}
      />
    </div>
  );
};
