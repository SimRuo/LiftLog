import { api } from './client';

export const workoutsApi = {
  list: (page = 1, pageSize = 20) => api.get(`/workouts?page=${page}&pageSize=${pageSize}`),
  get: (id) => api.get(`/workouts/${id}`),
  next: () => api.get('/workouts/next'),
  create: (data) => api.post('/workouts', data),
  logRest: (data) => api.post('/workouts/rest', data),
  delete: (id) => api.delete(`/workouts/${id}`),
};
