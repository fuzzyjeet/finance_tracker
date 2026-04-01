import api from './client';
import { Transaction, TransactionSummary } from '../types';

export interface TransactionFilters {
  account_id?: string;
  category_id?: string;
  type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  tag_ids?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionPayload {
  date: string;
  billing_date?: string;
  amount: number;
  type: string;
  category_id?: string;
  account_id: string;
  to_account_id?: string;
  payee: string;
  notes?: string;
  tag_ids?: string[];
}

export const transactionsApi = {
  list: (filters?: TransactionFilters) =>
    api.get<Transaction[]>('/transactions', { params: filters }).then(r => r.data),
  get: (id: string) => api.get<Transaction>(`/transactions/${id}`).then(r => r.data),
  create: (data: TransactionPayload) =>
    api.post<Transaction>('/transactions', data).then(r => r.data),
  update: (id: string, data: Partial<TransactionPayload>) =>
    api.put<Transaction>(`/transactions/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/transactions/${id}`).then(r => r.data),
  summary: (month: string, account_id?: string) =>
    api.get<TransactionSummary>('/transactions/summary', { params: { month, account_id } }).then(r => r.data),
};
