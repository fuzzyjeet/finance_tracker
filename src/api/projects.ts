import api from './client';
import { Project } from '../types';

export interface ProjectPayload {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
}

export interface ProjectSpending {
  project: {
    id: string;
    name: string;
    icon: string;
    color: string;
    status: string;
    start_date?: string;
    end_date?: string;
    budget?: number;
    description?: string;
  };
  total_spent: number;
  by_category: {
    category_id?: string;
    name: string;
    icon: string;
    color: string;
    amount: number;
  }[];
  transactions: {
    id: string;
    date: string;
    payee: string;
    amount: number;
    type: string;
    account_name?: string;
    category?: { name: string; icon: string; color: string };
    notes?: string;
    tags: { id: string; name: string; color: string }[];
    splits: {
      id: string;
      amount: number;
      notes?: string;
      category?: { name: string; icon: string; color: string };
      in_project: boolean;
    }[];
  }[];
}

export const projectsApi = {
  list: () => api.get<Project[]>('/projects').then(r => r.data),
  get: (id: string) => api.get<Project>(`/projects/${id}`).then(r => r.data),
  create: (data: ProjectPayload) => api.post<Project>('/projects', data).then(r => r.data),
  update: (id: string, data: Partial<ProjectPayload>) =>
    api.put<Project>(`/projects/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/projects/${id}`).then(r => r.data),
  spending: (id: string) => api.get<ProjectSpending>(`/projects/${id}/spending`).then(r => r.data),
};
