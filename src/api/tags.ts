import api from './client';
import { Tag } from '../types';

export interface TagPayload {
  name: string;
  color: string;
}

export const tagsApi = {
  list: () => api.get<Tag[]>('/tags').then(r => r.data),
  get: (id: string) => api.get<Tag>(`/tags/${id}`).then(r => r.data),
  create: (data: TagPayload) => api.post<Tag>('/tags', data).then(r => r.data),
  update: (id: string, data: Partial<TagPayload>) =>
    api.put<Tag>(`/tags/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/tags/${id}`).then(r => r.data),
};
