import api from './client';
import { Transaction, TransactionSummary } from '../types';
import { enqueueTransaction, isNetworkError, newId } from '../offline/sync';

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

export interface SplitPayload {
  amount: number;
  category_id?: string;
  notes?: string;
  project_ids?: string[];
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
  project_ids?: string[];
  splits?: SplitPayload[];
}

export const transactionsApi = {
  list: (filters?: TransactionFilters) =>
    api.get<Transaction[]>('/transactions', { params: filters }).then(r => r.data),
  get: (id: string) => api.get<Transaction>(`/transactions/${id}`).then(r => r.data),
  /** Resolves to null when offline: the transaction is queued and sent once the connection returns. */
  create: async (data: TransactionPayload): Promise<Transaction | null> => {
    // The id is chosen here so a resend after a lost response can't create a duplicate
    const payload = { ...data, id: newId() };
    try {
      return (await api.post<Transaction>('/transactions', payload, { timeout: 15000 })).data;
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      enqueueTransaction(payload);
      return null;
    }
  },
  update: (id: string, data: Partial<TransactionPayload>) =>
    api.put<Transaction>(`/transactions/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/transactions/${id}`).then(r => r.data),
  summary: (month: string, account_id?: string) =>
    api.get<TransactionSummary>('/transactions/summary', { params: { month, account_id } }).then(r => r.data),
};
