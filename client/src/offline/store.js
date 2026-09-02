/**
 * Read-through caching and the write outbox.
 *
 * Reads: try the network, mirror what comes back, and fall back to the mirror
 * only when the failure was a transport failure. A 401/403/500 is an answer —
 * serving stale data in its place would hide a real problem.
 *
 * Writes: when the network is gone the request is parked in the outbox and
 * replayed later. Only workout logging is queued. Everything else (editing a
 * plan, changing a password, generating a plan with the AI) still fails
 * offline on purpose — those are rare, deliberate actions where being told
 * "not now" is honest, and queueing them would create merge problems far worse
 * than the inconvenience.
 */

import { ApiError } from '../api/client';
import { currentUserId } from '../auth/session';
import {
  cacheGet,
  cacheGetEntry,
  cacheSet,
  cacheDelete,
  cacheDeletePrefix,
  cacheClearUser,
  outboxAdd,
  outboxAll,
  outboxDelete,
} from './db';

/** A transport failure — the only case where cached data is the right answer. */
export const isOffline = (err) => err instanceof ApiError && err.status === 0;

/** Raised when we have neither a network nor anything cached to show. */
export class NoDataOfflineError extends ApiError {
  constructor() {
    super("You're offline and this hasn't been saved to this device yet.", 0);
    this.name = 'NoDataOfflineError';
  }
}

/** Best-effort: a failed mirror write must never fail the read it came from. */
async function quietly(promise) {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/**
 * Fetch, mirror the result, and fall back to the mirror when offline.
 * `key` identifies the row in the cache and is scoped to the current user.
 */
export async function readThrough(key, fetcher) {
  const userId = currentUserId();
  try {
    const data = await fetcher();
    await quietly(cacheSet(userId, key, data));
    return data;
  } catch (err) {
    if (!isOffline(err)) throw err;
    const cached = await quietly(cacheGet(userId, key));
    if (cached === null || cached === undefined) throw new NoDataOfflineError();
    return cached;
  }
}

/** When the cached copy was written, or null if there isn't one. */
export async function cachedAt(key) {
  const entry = await quietly(cacheGetEntry(currentUserId(), key));
  return entry?.savedAt ?? null;
}

export const cacheKeys = {
  plan: 'plan',
  plans: 'plans',
  next: 'next',
  exercises: 'exercises',
  workoutPage: (page, pageSize) => `workouts:${pageSize}:${page}`,
  workout: (id) => `workout:${id}`,
  progress: (exerciseId) => `progress:${exerciseId}`,
};

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export const OUTBOX_WORKOUT = 'workout';
export const OUTBOX_REST = 'rest';

// The queue is written from the API layer but displayed by the shell, and the
// two never meet in the React tree. A plain listener set keeps the pending
// badge honest without threading a callback through every call site.
const outboxListeners = new Set();

export function onOutboxChange(fn) {
  outboxListeners.add(fn);
  return () => outboxListeners.delete(fn);
}

function notifyOutboxChange() {
  for (const fn of outboxListeners) fn();
}

/**
 * A pending write carries the exact request body plus enough denormalised
 * detail to render a history card from it, because until it syncs there is no
 * server row to read one from.
 */
export async function enqueue(kind, payload, display) {
  const userId = currentUserId();
  if (!userId) throw new ApiError('Not signed in.', 401);

  const entry = {
    userId,
    kind,
    payload,
    display,
    localId: `local-${crypto.randomUUID()}`,
    createdAt: Date.now(),
  };
  entry.seq = await outboxAdd(entry);
  notifyOutboxChange();
  return entry;
}

/** Pending writes for the signed-in user, oldest first. */
export async function pending() {
  const rows = await quietly(outboxAll(currentUserId()));
  return (rows || []).sort((a, b) => a.seq - b.seq);
}

export async function discardPending(seq) {
  await outboxDelete(seq);
  notifyOutboxChange();
}

/**
 * Shape a queued write like a WorkoutSummaryResponse so the history list can
 * render it beside real ones. `pendingSync` is what the card keys its badge
 * off, and the local id keeps React happy without colliding with server ids.
 */
export function pendingToSummary(entry) {
  const { payload, display } = entry;
  const sets = payload.sets || [];
  return {
    id: entry.localId,
    seq: entry.seq,
    pendingSync: true,
    date: payload.date,
    notes: payload.notes ?? null,
    createdAt: new Date(entry.createdAt).toISOString(),
    planDayName: entry.kind === OUTBOX_REST ? null : display?.planDayName ?? null,
    isRestDay: entry.kind === OUTBOX_REST,
    setCount: sets.length,
    exerciseCount: new Set(sets.map((s) => s.exerciseId)).size,
    volume: sets.reduce((sum, s) => sum + Number(s.weight || 0) * Number(s.reps || 0), 0),
    exerciseNames: display?.exerciseNames ?? null,
  };
}

/**
 * Replay the outbox.
 *
 * Ordered by workout date, not by queue order: CreateWorkout ends with
 * `UPDATE pe SET pe.Weight = MAX(...)` for the session's plan day, so whichever
 * session is sent last wins that day's plan weights. Replaying two offline
 * sessions in the order they were queued would be right by luck; replaying them
 * oldest-workout-first is right by construction.
 *
 * Stops at the first transport failure so the queue keeps its order. A write
 * the server actively rejects (a 4xx — a deleted plan day, a validation change)
 * is dropped rather than retried forever, and reported so it isn't silent.
 */
export async function flush(sendWorkout, sendRest) {
  const items = await pending();
  if (items.length === 0) return { sent: 0, failed: [], stopped: false };

  const ordered = [...items].sort((a, b) => {
    const byDate = String(a.payload.date).localeCompare(String(b.payload.date));
    return byDate !== 0 ? byDate : a.seq - b.seq;
  });

  let sent = 0;
  const failed = [];

  for (const entry of ordered) {
    try {
      if (entry.kind === OUTBOX_REST) await sendRest(entry.payload);
      else await sendWorkout(entry.payload);
      await outboxDelete(entry.seq);
      notifyOutboxChange();
      sent += 1;
    } catch (err) {
      if (isOffline(err)) return { sent, failed, stopped: true };
      if (err instanceof ApiError && err.status === 401) return { sent, failed, stopped: true };
      await outboxDelete(entry.seq);
      notifyOutboxChange();
      failed.push({ entry, message: err.message });
    }
  }

  return { sent, failed, stopped: false };
}

/**
 * A workout was written — drop the reads derived from history, `next` included:
 * a trained session moves the rotation on, so the mirrored answer is stale the
 * moment the write lands. The `nextDay:` hints are kept, since last session's
 * numbers for a day don't change just because a different day was logged.
 */
export async function invalidateWorkoutReads() {
  const userId = currentUserId();
  await quietly(cacheDelete(userId, cacheKeys.next));
  await quietly(cacheDeletePrefix(userId, 'workouts:'));
  await quietly(cacheDeletePrefix(userId, 'progress:'));
}

/**
 * The plan changed, which moves the rotation and invalidates the mirrored day
 * payloads keyed by plan day id. Drop everything derived and let it refetch —
 * a stale `next` here would offer a day that no longer exists.
 */
export async function invalidatePlanReads() {
  const userId = currentUserId();
  await quietly(cacheDeletePrefix(userId, 'plan'));
  await quietly(cacheDeletePrefix(userId, 'next'));
  await quietly(cacheDeletePrefix(userId, 'workouts:'));
  await quietly(cacheDeletePrefix(userId, 'progress:'));
}

/**
 * Wipe the read mirror on sign-out so the next account on this device can't be
 * shown the last one's data.
 *
 * The outbox is deliberately left alone: it holds workouts that exist nowhere
 * else yet, and it is keyed by user id, so it stays invisible to anyone else
 * and uploads when its owner signs back in.
 */
export async function clearCachedReads(userId) {
  await quietly(cacheClearUser(userId ?? currentUserId()));
}
