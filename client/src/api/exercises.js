import { api } from './client';
import { readThrough, cacheKeys } from '../offline/store';

export const exercisesApi = {
  /** Mirrored so the "add exercise" picker still works in a dead spot. */
  list: () => readThrough(cacheKeys.exercises, () => api.get('/exercises')),
  create: (name, category) => api.post('/exercises', { name, category }),
};
