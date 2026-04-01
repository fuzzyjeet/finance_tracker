import api from './client';
import { Category } from '../types';

export interface CategoryPayload {
  name: string;
  icon: string;
  color: string;
  type: string;
}

export const categoriesApi = {
  list: () => api.get<Category[]>('/categories').then(r => r.data),
  get: (id: string) => api.get<Category>(`/categories/${id}`).then(r => r.data),
  create: (data: CategoryPayload) => api.post<Category>('/categories', data).then(r => r.data),
  update: (id: string, data: Partial<CategoryPayload>) =>
    api.put<Category>(`/categories/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/categories/${id}`).then(r => r.data),
};
