import { api } from './client';
import {
  readThrough,
  cacheKeys,
  isOffline,
  NoDataOfflineError,
  enqueue,
  pending,
  discardPending,
  pendingToSummary,
  invalidateWorkoutReads,
  OUTBOX_WORKOUT,
  OUTBOX_REST,
} from '../offline/store';
import { rememberNext, advanceCachedNext, nextFromCache } from '../offline/rotation';

/** Ids minted on the device for a workout that hasn't reached the server yet. */
export const isLocalId = (id) => typeof id === 'string' && id.startsWith('local-');

/** The raw endpoints, with no offline behaviour — what the sync loop replays. */
export const workoutsRemote = {
  create: (data) => api.post('/workouts', data),
  logRest: (data) => api.post('/workouts/rest', data),
};

export const workoutsApi = {
  list: (page = 1, pageSize = 20) =>
    readThrough(cacheKeys.workoutPage(page, pageSize), () =>
      api.get(`/workouts?page=${page}&pageSize=${pageSize}`),
    ),

  /** Pending writes, as history cards, newest first. */
  pendingSummaries: async () => (await pending()).map(pendingToSummary).reverse(),

  get: async (id) => {
    // A local id only ever exists in the outbox; there is nothing to fetch.
    if (isLocalId(id)) {
      const entry = (await pending()).find((p) => p.localId === id);
      if (!entry) throw new NoDataOfflineError();
      return {
        ...pendingToSummary(entry),
        sets: (entry.payload.sets || []).map((s, i) => ({
          id: `${id}-${i}`,
          exerciseId: s.exerciseId,
          exerciseName: entry.display?.exerciseNamesById?.[s.exerciseId] || 'Exercise',
          exerciseCategory: '',
          setNumber: s.setNumber,
          reps: s.reps,
          weight: s.weight,
          notes: s.notes,
        })),
      };
    }
    return readThrough(cacheKeys.workout(id), () => api.get(`/workouts/${id}`));
  },

  /**
   * The server owns the rotation; the device only answers when it can't be
   * reached. Every successful response re-seeds the cache, so the mirrored copy
   * can never drift for longer than one online visit.
   */
  next: async () => {
    try {
      const day = await api.get('/workouts/next');
      await rememberNext(day);
      return day;
    } catch (err) {
      if (!isOffline(err)) throw err;
      const cached = await nextFromCache();
      if (!cached) throw new NoDataOfflineError();
      return cached;
    }
  },

  create: async (data, display) => {
    try {
      const saved = await workoutsRemote.create(data);
      await invalidateWorkoutReads();
      return saved;
    } catch (err) {
      if (!isOffline(err)) throw err;
      const entry = await enqueue(OUTBOX_WORKOUT, data, display);
      if (data.planDayId) await advanceCachedNext(data.planDayId, data.sets);
      return { ...pendingToSummary(entry), sets: data.sets };
    }
  },

  logRest: async (data) => {
    try {
      const saved = await workoutsRemote.logRest(data);
      await invalidateWorkoutReads();
      return saved;
    } catch (err) {
      if (!isOffline(err)) throw err;
      // No advanceCachedNext — a rest day isn't a slot in the routine, so the
      // same day is still up next. Same rule the server follows in LogRestDay.
      const entry = await enqueue(OUTBOX_REST, data);
      return pendingToSummary(entry);
    }
  },

  /**
   * Tell the server a workout is open, so it can nudge if it's still open
   * hours from now. Called when the first set lands and again whenever a draft
   * is restored; the server keeps the earliest start, so re-asserting is free.
   *
   * Deliberately not queued in the outbox on failure. A reminder is only worth
   * anything while the workout is actually open, and replaying "I started at
   * 14:00" during tomorrow's sync would nudge about a session long since saved.
   * Offline, the push couldn't be delivered anyway.
   */
  beginActive: async (startedAt) => {
    try {
      await api.post('/workouts/active', { startedAt: new Date(startedAt).toISOString() });
    } catch {
      /* best effort — never let a reminder get in the way of logging */
    }
  },

  /** The workout is closed: saved, rested, or discarded. */
  endActive: async () => {
    try {
      await api.delete('/workouts/active');
    } catch {
      /* best effort; the row also ages out on its own */
    }
  },

  delete: async (id) => {
    if (isLocalId(id)) {
      const entry = (await pending()).find((p) => p.localId === id);
      if (entry) await discardPending(entry.seq);
      return null;
    }
    const result = await api.delete(`/workouts/${id}`);
    await invalidateWorkoutReads();
    return result;
  },
};
