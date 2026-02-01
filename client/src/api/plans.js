import { api } from './client';

export const plansApi = {
  get: () => api.get('/plans'),
  create: (data) => api.post('/plans', data),
  update: (data) => api.put('/plans', data),
  delete: () => api.delete('/plans'),
};
