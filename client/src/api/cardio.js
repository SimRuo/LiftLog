import { api } from './client';
import {
  readThrough,
  cacheKeys,
  isOffline,
  NoDataOfflineError,
  enqueue,
  pending,
  pendingToSummary,
  invalidateCardioReads,
  OUTBOX_CARDIO,
} from '../offline/store';
import { isLocalId } from './workouts';

/** The raw endpoint, with no offline behaviour — what the sync loop replays. */
export const cardioRemote = {
  create: (data) => api.post('/cardio', data),
};

export const cardioApi = {
  /**
   * The activity list. Read through the mirror like the exercise catalogue is:
   * you can't log cardio offline without knowing what you're logging, and this
   * list changes about twice a year.
   */
  activities: () => readThrough(cacheKeys.cardioActivities, () => api.get('/cardio/activities')),

  createActivity: (data) => api.post('/cardio/activities', data),

  /** A circuit and its ordered stations, written together. */
  createCircuit: (data) => api.post('/cardio/circuits', data),

  /**
   * Recent attempts at one circuit with their splits — the comparison that
   * says which station a faster or slower total actually came from.
   */
  attempts: (activityId, take = 5) =>
    api.get(`/cardio/circuits/${activityId}/attempts?take=${take}`),

  list: (page = 1, pageSize = 20) =>
    readThrough(cacheKeys.cardioPage(page, pageSize), () =>
      api.get(`/cardio?page=${page}&pageSize=${pageSize}`),
    ),

  get: async (id) => {
    // A local id only ever exists in the outbox; there is nothing to fetch.
    if (isLocalId(id)) {
      const entry = (await pending()).find((p) => p.localId === id);
      if (!entry) throw new NoDataOfflineError();
      return pendingToSummary(entry);
    }
    return readThrough(cacheKeys.cardioSession(id), () => api.get(`/cardio/${id}`));
  },

  /**
   * `display` carries the activity's name and mode so a session queued offline
   * can render a history card before it has ever reached the server — there is
   * no row to read the name back from, same reasoning as a queued workout.
   */
  create: async (data, display) => {
    try {
      const saved = await cardioRemote.create(data);
      await invalidateCardioReads();
      return saved;
    } catch (err) {
      if (!isOffline(err)) throw err;
      const entry = await enqueue(OUTBOX_CARDIO, data, display);
      return pendingToSummary(entry);
    }
  },

  delete: async (id) => {
    const result = await api.delete(`/cardio/${id}`);
    await invalidateCardioReads();
    return result;
  },

  progress: (activityId, metric) =>
    readThrough(cacheKeys.cardioProgress(activityId, metric), () =>
      api.get(`/cardio/progress/${activityId}?metric=${metric}`),
    ),
};
