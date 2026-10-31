export type AccountType = 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment';
export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund';
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
  opening_balance: number;
  /** Set on a sub-account: the main account it partitions */
  parent_id?: string | null;
  /** Inactive accounts are folded away in lists and left out of pickers */
  is_active: boolean;
  /** The bank's logo as an image data URL */
  logo?: string | null;
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

export type ProjectStatus = 'planned' | 'active' | 'completed' | 'on_hold';

export interface ProjectSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  created_at: string;
}

export interface TransactionSplit {
  id: string;
  amount: number;
  category_id?: string;
  notes?: string;
  category?: Category;
  projects?: ProjectSummary[];
}

/** One refund↔original allocation, seen from either side. */
export interface RefundLink {
  id: string;
  transaction_id: string;
  amount: number;
  payee: string;
  date: string;
  transaction_amount: number;
  account_name?: string;
}

export interface Transaction {
  id: string;
  date: string;
  time?: string;
  billing_date?: string;
  amount: number;
  type: TransactionType;
  category_id?: string;
  account_id: string;
  to_account_id?: string;
  payee: string;
  notes?: string;
  /** Expense: the part spent on other people. Only the rest counts as my spending. */
  for_others?: number;
  /** Income: money someone paid me back; not counted as income. */
  paid_back?: boolean;
  recurring_id?: string;
  created_at: string;
  // nested
  category?: Category;
  tags?: Tag[];
  splits?: TransactionSplit[];
  projects?: ProjectSummary[];
  account_name?: string;
  to_account_name?: string;
  // refund fields
  refund_for?: RefundLink[];
  refunds?: RefundLink[];
  refunded_amount?: number;
  refund_surplus?: number;
  is_fully_refunded?: boolean;
  /** Set when this expense is more than 2x its category's median over the last 90 days */
  typical_amount?: number | null;
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

/** Money set aside in a month for a project; that month its spending counts here, not in category budgets */
export interface Provision {
  id: string;
  project_id: string;
  amount: number;
  month: string;
  spent: number;
  project?: Pick<Project, 'id' | 'name' | 'icon' | 'color'>;
}

export interface CategorySpend {
  category_id: string | null;
  name: string;
  icon: string;
  color: string;
  spent: number;
}

export interface BudgetOverview {
  month: string;
  days_in_month: number;
  /** How far through the month we are, 0..1 (1 for past months, 0 for future ones) */
  pace: number;
  budgets: Budget[];
  provisions: Provision[];
  categories: CategorySpend[];
  total_spent: number;
  unbudgeted_spent: number;
  carried_from: string | null;
  previous_month: string | null;
}

export interface BudgetSuggestion {
  category_id: string;
  amount: number;
  average: number;
}

export interface TransactionTotals {
  count: number;
  income: number;
  expenses: number;
  refunds: number;
  net: number;
  transfers: number;
  for_others: number;
  paid_back: number;
}

export interface TransactionSummary {
  total_income: number;
  total_expenses: number;
  total_refunds: number;
  net: number;
  for_others?: number;
  paid_back?: number;
}
