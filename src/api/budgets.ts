import api from './client';
import { localISODate } from '../lib/dates';
import { Budget, BudgetOverview, BudgetSuggestion, Provision } from '../types';

export interface BudgetPayload {
  category_id: string;
  amount: number;
  month: string;
}

export const budgetsApi = {
  list: (month?: string, excludeProjectIds?: string[]) =>
    api.get<Budget[]>('/budgets', {
      params: {
        ...(month ? { month } : {}),
        ...(excludeProjectIds && excludeProjectIds.length > 0 ? { exclude_project_ids: excludeProjectIds.join(',') } : {}),
      },
    }).then(r => r.data),
  overview: (month: string) => api.get<BudgetOverview>('/budgets/overview', { params: { month, today: localISODate() } }).then(r => r.data),
  suggestions: (month: string) =>
    api.get<BudgetSuggestion[]>('/budgets/suggestions', { params: { month } }).then(r => r.data),
  copy: (month: string, source: string) =>
    api.post<Budget[]>('/budgets/copy', null, { params: { month, source } }).then(r => r.data),
  create: (data: BudgetPayload) => api.post<Budget>('/budgets', data).then(r => r.data),
  update: (id: string, data: { amount?: number; month?: string }) =>
    api.put<Budget>(`/budgets/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/budgets/${id}`).then(r => r.data),
  createProvision: (data: { project_id: string; amount: number; month: string }) =>
    api.post<Provision>('/budgets/provisions', data).then(r => r.data),
  updateProvision: (id: string, amount: number) =>
    api.put<Provision>(`/budgets/provisions/${id}`, { amount }).then(r => r.data),
  deleteProvision: (id: string) => api.delete(`/budgets/provisions/${id}`).then(r => r.data),
};
