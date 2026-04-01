export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  createdAt: string;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export interface Transaction {
  id: string;
  date: string; // ISO date string
  amount: number; // always positive
  type: TransactionType;
  categoryId: string;
  accountId: string;
  toAccountId?: string; // for transfers
  payee: string;
  notes?: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string; // emoji
  color: string;
  type: 'income' | 'expense' | 'both';
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number; // monthly budget
  month: string; // YYYY-MM format
}

export interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export interface CategorySpending {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  amount: number;
}

export interface NetWorthPoint {
  date: string;
  netWorth: number;
}
