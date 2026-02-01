import { api } from './client';

export const exercisesApi = {
  list: () => api.get('/exercises'),
  create: (name, category) => api.post('/exercises', { name, category }),
};
