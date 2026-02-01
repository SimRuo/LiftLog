import { api } from './client';

export const exercisesApi = {
  list: () => api.get('/exercises'),
};
