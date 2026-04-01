import api from './client';
import { Budget } from '../types';

export interface BudgetPayload {
  category_id: string;
  amount: number;
  month: string;
}

export const budgetsApi = {
  list: (month?: string) =>
    api.get<Budget[]>('/budgets', { params: month ? { month } : {} }).then(r => r.data),
  create: (data: BudgetPayload) => api.post<Budget>('/budgets', data).then(r => r.data),
  update: (id: string, data: { amount?: number; month?: string }) =>
    api.put<Budget>(`/budgets/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/budgets/${id}`).then(r => r.data),
};
