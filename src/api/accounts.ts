import api from './client';
import { Account } from '../types';

export const accountsApi = {
  list: () => api.get<Account[]>('/accounts').then(r => r.data),
  get: (id: string) => api.get<Account>(`/accounts/${id}`).then(r => r.data),
  create: (data: Omit<Account, 'id' | 'balance' | 'created_at'>) =>
    api.post<Account>('/accounts', data).then(r => r.data),
  update: (id: string, data: Partial<Omit<Account, 'id' | 'balance' | 'created_at'>>) =>
    api.put<Account>(`/accounts/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/accounts/${id}`).then(r => r.data),
};
