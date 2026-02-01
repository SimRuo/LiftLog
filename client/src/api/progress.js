import { api } from './client';

export const progressApi = {
  get: (exerciseId, metric = 'maxWeight') =>
    api.get(`/progress/${exerciseId}?metric=${metric}`),
};
