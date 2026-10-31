import api from './client';
import { localISODate } from '../lib/dates';

export interface TrendSeries {
  id: string;
  name: string;
  icon: string;
  color: string;
  amounts: number[];
}

export interface Trends {
  months: string[];          // YYYY-MM, oldest first
  spending: number[];        // filtered by category/payee when given
  income: number[];
  expenses: number[];
  net: number[];
  for_others: number[];
  paid_back: number[];
  categories: TrendSeries[]; // every category, unfiltered
  payees: { payee: string; amounts: number[] }[]; // only with a category
  so_far_last_month: number | null;
  day_of_month: number | null;
}

export interface HealthAccount {
  id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit_card' | 'cash' | 'investment';
  color: string;
  balance: number;
  parent_id: string | null;
  is_active: boolean;
}

export interface Health {
  currency: string;
  accounts: HealthAccount[];          // only accounts in the base currency
  left_out: string[];                 // currencies of accounts not counted yet
  months: string[];                   // YYYY-MM, oldest first; the last is this month
  worth: number[];                    // total across accounts at each month end (today for this month)
  moved_to_savings: Record<string, number>; // YYYY-MM -> net transfers into savings and investments
  fixed_monthly: number;              // active recurring expenses, per month
}

export const statsApi = {
  health: (months = 24) =>
    api.get<Health>('/stats/health', { params: { months, today: localISODate() } }).then(r => r.data),
  trends: (params: { months: number; category_id?: string; payee?: string }) =>
    api.get<Trends>('/stats/trends', { params: { ...params, today: localISODate() } }).then(r => r.data),
};
