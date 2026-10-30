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

export const statsApi = {
  trends: (params: { months: number; category_id?: string; payee?: string }) =>
    api.get<Trends>('/stats/trends', { params: { ...params, today: localISODate() } }).then(r => r.data),
};
