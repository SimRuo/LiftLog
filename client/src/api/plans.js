import { api } from './client';

export const plansApi = {
  get: () => api.get('/plans'),
  getAll: () => api.get('/plans/all'),
  create: (data) => api.post('/plans', data),
  update: (data) => api.put('/plans', data),
  activate: (id) => api.put(`/plans/${id}/activate`),
  delete: () => api.delete('/plans'),
};
