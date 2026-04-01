import api from './client';
import { RecurringTransaction } from '../types';

export interface RecurringPayload {
  name: string;
  amount: number;
  type: string;
  category_id?: string;
  account_id: string;
  to_account_id?: string;
  payee: string;
  notes?: string;
  frequency: string;
  custom_interval_days?: number;
  start_date: string;
  end_date?: string;
  next_due_date: string;
  is_active: boolean;
  auto_post: boolean;
  tag_ids?: string[];
}

export const recurringApi = {
  list: () => api.get<RecurringTransaction[]>('/recurring').then(r => r.data),
  pending: () => api.get<RecurringTransaction[]>('/recurring/pending').then(r => r.data),
  get: (id: string) => api.get<RecurringTransaction>(`/recurring/${id}`).then(r => r.data),
  create: (data: RecurringPayload) =>
    api.post<RecurringTransaction>('/recurring', data).then(r => r.data),
  update: (id: string, data: Partial<RecurringPayload>) =>
    api.put<RecurringTransaction>(`/recurring/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/recurring/${id}`).then(r => r.data),
  postNow: (id: string) =>
    api.post<RecurringTransaction>(`/recurring/${id}/post-now`).then(r => r.data),
};
