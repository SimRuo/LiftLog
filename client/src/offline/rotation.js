/**
 * The rotation, mirrored on the device.
 *
 * `GET /workouts/next` decides which plan day comes next from the last *trained*
 * session's `PlanDay.Order` — rest days carry no PlanDayId and never advance it.
 * Offline there is nobody to ask, and "what am I doing today" is the one screen
 * you open standing in the gym, so the same rule has to exist here.
 *
 * This is a deliberate second copy of a server rule, which is a real risk: the
 * two can drift. It is kept honest two ways. The server stays authoritative —
 * every successful `next` response overwrites what's cached here, so a
 * disagreement survives only until the next time there's signal. And the rule
 * is reduced to one line (`advance`) that mirrors the server's modulo, rather
 * than being re-derived from history the way the server does it.
 */

import { currentUserId } from '../auth/session';
import { cacheGet, cacheSet } from './db';
import { cacheKeys } from './store';

/** Cached per-day exercise payloads, so an advanced-to day keeps its numbers. */
const dayKey = (planDayId) => `nextDay:${planDayId}`;

/** The server's rule: the day after this one, wrapping at the end of the plan. */
const advance = (order, dayCount) => (order + 1) % dayCount;

const sortedDays = (plan) => [...(plan?.days || [])].sort((a, b) => a.order - b.order);

/**
 * Turn a plan day into the shape `GET /workouts/next` returns, seeding each
 * exercise's `lastSessionSets` from whatever we know: the numbers logged for
 * that day while offline, else the last payload the server sent for it. When
 * there's neither, the field is empty and LogWorkoutPage falls back to the
 * plan's prescribed weight, which is exactly what it does for a day you have
 * never trained.
 */
function toNextResponse(day, hints) {
  return {
    planDayId: day.id,
    dayName: day.name,
    dayOrder: day.order,
    exercises: (day.exercises || []).map((ex) => ({
      id: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      exerciseCategory: ex.exerciseCategory,
      order: ex.order,
      sets: ex.sets,
      reps: ex.reps,
      weight: ex.weight,
      notes: ex.notes,
      lastSessionSets: hints?.[ex.exerciseId] || [],
    })),
  };
}

/** Sets from a queued workout, indexed by exercise, in the server's shape. */
function hintsFromSets(sets) {
  const byExercise = {};
  for (const set of sets || []) {
    (byExercise[set.exerciseId] ||= []).push({
      exerciseId: set.exerciseId,
      setNumber: set.setNumber,
      reps: set.reps,
      weight: set.weight,
    });
  }
  for (const list of Object.values(byExercise)) list.sort((a, b) => a.setNumber - b.setNumber);
  return byExercise;
}

/**
 * Store a server `next` payload: the response itself, so the log screen has an
 * answer offline, and its per-exercise numbers, so the day still shows real
 * weights when the rotation comes back round to it.
 */
export async function rememberNext(next) {
  const userId = currentUserId();
  if (!userId || !next?.planDayId) return;

  const hints = {};
  for (const ex of next.exercises || []) {
    if (ex.lastSessionSets?.length) hints[ex.exerciseId] = ex.lastSessionSets;
  }
  await cacheSet(userId, dayKey(next.planDayId), hints);
  await cacheSet(userId, cacheKeys.next, next);
}

/**
 * Move the cached rotation on after a workout has been queued offline, so the
 * next visit to the log screen offers the next day rather than repeating the
 * one just finished. Rest days call nothing — that's the whole point of them.
 */
export async function advanceCachedNext(planDayId, sets) {
  const userId = currentUserId();
  if (!userId) return;

  // The day just trained keeps the numbers actually lifted, so coming back
  // round to it shows real weights instead of the plan's prescription.
  await cacheSet(userId, dayKey(planDayId), hintsFromSets(sets));

  const plan = await cacheGet(userId, cacheKeys.plan);
  const days = sortedDays(plan);
  if (days.length === 0) return;

  const trained = days.find((d) => d.id === planDayId);
  if (!trained) return;

  const nextDay = days.find((d) => d.order === advance(trained.order, days.length)) || days[0];
  const hints = (await cacheGet(userId, dayKey(nextDay.id))) || {};
  await cacheSet(userId, cacheKeys.next, toNextResponse(nextDay, hints));
}

/**
 * What to train, offline. Prefers the cached `next` response; falls back to the
 * first day of the cached plan so someone who has a plan but has never opened
 * the log screen online still gets a session rather than an error.
 */
export async function nextFromCache() {
  const userId = currentUserId();
  if (!userId) return null;

  const cached = await cacheGet(userId, cacheKeys.next);
  if (cached?.planDayId) return cached;

  const plan = await cacheGet(userId, cacheKeys.plan);
  const days = sortedDays(plan);
  if (days.length === 0) return null;

  const hints = (await cacheGet(userId, dayKey(days[0].id))) || {};
  return toNextResponse(days[0], hints);
}
