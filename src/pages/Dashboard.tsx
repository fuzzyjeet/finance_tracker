import React, { useEffect, useState } from 'react';
import { format, subMonths, startOfMonth } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { Card } from '../components/ui/Card';
import { accountsApi } from '../api/accounts';
import { transactionsApi } from '../api/transactions';
import { Account, Transaction, TransactionSummary } from '../types';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const TransactionTypeIcon = ({ type }: { type: string }) => {
  if (type === 'income') return <ArrowDownLeft size={14} className="text-green-600" />;
  if (type === 'expense') return <ArrowUpRight size={14} className="text-red-500" />;
  return <ArrowLeftRight size={14} className="text-blue-500" />;
};

export const Dashboard: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [currentSummary, setCurrentSummary] = useState<TransactionSummary | null>(null);
  const [monthlyData, setMonthlyData] = useState<{ month: string; income: number; expenses: number }[]>([]);
  const [categorySpending, setCategorySpending] = useState<{ name: string; icon: string; color: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = format(new Date(), 'yyyy-MM');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [accts, txns, summary] = await Promise.all([
          accountsApi.list(),
          transactionsApi.list({ limit: 5 }),
          transactionsApi.summary(currentMonth),
        ]);
        setAccounts(accts);
        setRecentTransactions(txns);
        setCurrentSummary(summary);

        // Build last 6 months data
        const months: { month: string; income: number; expenses: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(new Date(), i);
          const monthStr = format(d, 'yyyy-MM');
          const s = await transactionsApi.summary(monthStr);
          months.push({ month: format(d, 'MMM'), income: s.total_income, expenses: s.total_expenses });
        }
        setMonthlyData(months);

        // Category spending for current month
        const categoryMap: Record<string, { name: string; icon: string; color: string; amount: number }> = {};
        const start = format(startOfMonth(new Date()), 'yyyy-MM-dd');
        const end = format(new Date(), 'yyyy-MM-dd');
        const allTxns = await transactionsApi.list({ type: 'expense', date_from: start, date_to: end, limit: 200 });
        for (const t of allTxns) {
          if (t.category) {
            const key = t.category.id;
            if (!categoryMap[key]) {
              categoryMap[key] = { name: t.category.name, icon: t.category.icon, color: t.category.color, amount: 0 };
            }
            categoryMap[key].amount += t.amount;
          }
        }
        setCategorySpending(Object.values(categoryMap).sort((a, b) => b.amount - a.amount).slice(0, 6));
      } catch (err) {
        console.error('Dashboard load error', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalAssets = accounts
    .filter(a => a.type !== 'credit_card')
    .reduce((sum, a) => sum + a.balance, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <Header title="Dashboard" />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Net Worth</p>
              <p className={`text-2xl font-bold ${totalAssets >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                {formatCurrency(totalAssets)}
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Wallet size={20} className="text-blue-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Monthly Income</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(currentSummary?.total_income ?? 0)}
              </p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp size={20} className="text-green-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Monthly Expenses</p>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(currentSummary?.total_expenses ?? 0)}
              </p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg">
              <TrendingDown size={20} className="text-red-600" />
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Monthly Savings</p>
              <p className={`text-2xl font-bold ${(currentSummary?.net ?? 0) >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(currentSummary?.net ?? 0)}
              </p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg">
              <DollarSign size={20} className="text-purple-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Account Balances */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Account Balances</h2>
          <div className="space-y-3">
            {accounts.map(account => (
              <div key={account.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: account.color }}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{account.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{account.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    account.balance < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(account.balance)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Transactions</h2>
          <div className="space-y-3">
            {recentTransactions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No transactions yet</p>
            )}
            {recentTransactions.map(txn => (
              <div key={txn.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: txn.category ? `${txn.category.color}22` : '#f3f4f6' }}
                  >
                    {txn.category?.icon ?? '💸'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{txn.payee}</p>
                    <p className="text-xs text-gray-400">
                      {txn.account_name} · {txn.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <TransactionTypeIcon type={txn.type} />
                  <span
                    className={`text-sm font-semibold ${
                      txn.type === 'income'
                        ? 'text-green-600'
                        : txn.type === 'expense'
                        ? 'text-red-600'
                        : 'text-blue-600'
                    }`}
                  >
                    {txn.type === 'income' ? '+' : txn.type === 'expense' ? '-' : ''}
                    {formatCurrency(txn.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expenses Bar Chart */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Income vs Expenses (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Spending by Category Donut */}
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category (This Month)</h2>
          {categorySpending.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">
              No expense data for this month
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={categorySpending}
                  dataKey="amount"
                  nameKey="name"
                  cx="40%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {categorySpending.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  );
};
