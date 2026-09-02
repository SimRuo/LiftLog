import { api } from './client';
import { readThrough, cacheKeys, invalidatePlanReads } from '../offline/store';

/**
 * Only the reads are offline-capable. Editing a plan needs a connection on
 * purpose: a plan edited against a stale offline copy and replayed later would
 * silently overwrite whatever else had changed in the meantime, and unlike a
 * logged workout there is no safe way to merge two versions of it.
 *
 * Every write drops the mirror rather than patching it — a plan change moves
 * the rotation and every read derived from it, and refetching once is cheaper
 * to reason about than keeping five cached shapes consistent by hand.
 */
export const plansApi = {
  get: () => readThrough(cacheKeys.plan, () => api.get('/plans')),
  getAll: () => readThrough(cacheKeys.plans, () => api.get('/plans/all')),

  create: async (data) => {
    const result = await api.post('/plans', data);
    await invalidatePlanReads();
    return result;
  },

  update: async (data) => {
    const result = await api.put('/plans', data);
    await invalidatePlanReads();
    return result;
  },

  activate: async (id) => {
    const result = await api.put(`/plans/${id}/activate`);
    await invalidatePlanReads();
    return result;
  },

  delete: async () => {
    const result = await api.delete('/plans');
    await invalidatePlanReads();
    return result;
  },
};
