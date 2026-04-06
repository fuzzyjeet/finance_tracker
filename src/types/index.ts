export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type CategoryType = 'income' | 'expense' | 'both';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  color: string;
  billing_cycle_day?: number;
  currency: string;
  created_at: string;
}

export const CURRENCY_OPTIONS = [
  { value: 'EUR', label: '€ Euro',              symbol: '€' },
  { value: 'USD', label: '$ US Dollar',          symbol: '$' },
  { value: 'GBP', label: '£ British Pound',      symbol: '£' },
  { value: 'CHF', label: 'CHF Swiss Franc',      symbol: 'CHF' },
  { value: 'JPY', label: '¥ Japanese Yen',       symbol: '¥' },
  { value: 'CAD', label: 'CA$ Canadian Dollar',  symbol: 'CA$' },
  { value: 'AUD', label: 'A$ Australian Dollar', symbol: 'A$' },
  { value: 'INR', label: '₹ Indian Rupee',       symbol: '₹' },
  { value: 'SEK', label: 'kr Swedish Krona',     symbol: 'kr' },
  { value: 'PLN', label: 'zł Polish Zloty',      symbol: 'zł' },
];

export const getCurrencySymbol = (currency: string): string =>
  CURRENCY_OPTIONS.find(c => c.value === currency)?.symbol ?? currency;

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: CategoryType;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface TransactionSplit {
  id: string;
  amount: number;
  category_id?: string;
  notes?: string;
  category?: Category;
}

export interface Transaction {
  id: string;
  date: string;
  billing_date?: string;
  amount: number;
  type: TransactionType;
  category_id?: string;
  account_id: string;
  to_account_id?: string;
  payee: string;
  notes?: string;
  recurring_id?: string;
  created_at: string;
  // nested
  category?: Category;
  tags?: Tag[];
  splits?: TransactionSplit[];
  account_name?: string;
  to_account_name?: string;
}

export interface RecurringTransaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  category_id?: string;
  account_id: string;
  to_account_id?: string;
  payee: string;
  notes?: string;
  frequency: RecurrenceFrequency;
  custom_interval_days?: number;
  start_date: string;
  end_date?: string;
  next_due_date: string;
  is_active: boolean;
  auto_post: boolean;
  created_at: string;
  category?: Category;
  tags?: Tag[];
  account_name?: string;
  to_account_name?: string;
}

export interface Budget {
  id: string;
  category_id: string;
  amount: number;
  month: string;
  spent?: number;
  category?: Category;
}

export interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  net: number;
}
