import { useState, useEffect, useCallback, useRef } from 'react';
import { OfflineContext } from './offline-context';
import { useAuth } from './auth-context';
import { useToast } from '../components/ui/toast-context';
import { pending, flush, onOutboxChange, invalidateWorkoutReads } from '../offline/store';
import { workoutsRemote } from '../api/workouts';
import { cardioRemote } from '../api/cardio';

/** How often to retry a non-empty queue. Long enough to be invisible on a
 *  battery, short enough that a session isn't still "pending" after a set. */
const RETRY_INTERVAL_MS = 60_000;

/**
 * Owns connectivity state and the outbox replay.
 *
 * `navigator.onLine` is the trigger, not the truth — it reports a link, not a
 * working route to the server, and it lies constantly on captive gym wifi. So
 * the flush is attempted rather than assumed, and a transport failure simply
 * leaves the queue intact for the next attempt.
 */
export function OfflineProvider({ children }) {
  const { isAuthenticated, readOnly } = useAuth();
  const toast = useToast();

  const [online, setOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  // Guards against two flushes overlapping — a reconnect event and a manual
  // tap can land together, and the same workout must not be posted twice.
  const flushing = useRef(false);

  const refreshCount = useCallback(async () => {
    setPendingCount((await pending()).length);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setPendingCount(0);
      return undefined;
    }
    refreshCount();
    return onOutboxChange(refreshCount);
  }, [isAuthenticated, refreshCount]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const sync = useCallback(
    async ({ silent = false } = {}) => {
      // A read-only session's token has already expired, so replaying now would
      // just 401 the whole queue. It waits for a real sign-in.
      if (flushing.current || !isAuthenticated || readOnly) return null;

      flushing.current = true;
      setSyncing(true);
      try {
        const result = await flush({
          sendWorkout: workoutsRemote.create,
          sendRest: workoutsRemote.logRest,
          sendCardio: cardioRemote.create,
        });
        if (result.sent > 0) {
          await invalidateWorkoutReads();
          if (!silent) {
            toast.success(
              `${result.sent} ${result.sent === 1 ? 'session' : 'sessions'} uploaded.`,
            );
          }
        }
        for (const failure of result.failed) {
          // Dropped rather than retried forever, so say so — this is data the
          // user believed was saved.
          toast.error(`A queued session couldn't be saved: ${failure.message}`);
        }
        await refreshCount();
        return result;
      } catch {
        return null;
      } finally {
        flushing.current = false;
        setSyncing(false);
      }
    },
    [isAuthenticated, readOnly, toast, refreshCount],
  );

  // Replay on reconnect, on sign-in, and when the app returns to the
  // foreground — the phone case, where coming back into signal usually looks
  // like unlocking the screen rather than an `online` event.
  useEffect(() => {
    if (!online || !isAuthenticated || readOnly) return undefined;
    sync({ silent: false });
    const onVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) sync({ silent: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [online, isAuthenticated, readOnly, sync]);

  // ...and keep retrying while anything is queued.
  //
  // Every trigger above is an edge: an `online` event, a sign-in, a return to
  // the foreground. None of them fire in the case this whole feature exists
  // for — gym wifi that associates, so `navigator.onLine` is true and stays
  // true, while nothing actually routes. A session logged there would sit in
  // the queue untouched until the app was next backgrounded or reloaded, which
  // is precisely when someone would decide it hadn't saved. So while the queue
  // is non-empty, attempt it on a timer; a failed attempt costs one request and
  // leaves the queue exactly as it was.
  useEffect(() => {
    if (!isAuthenticated || readOnly || pendingCount === 0) return undefined;
    const id = setInterval(() => {
      if (navigator.onLine) sync({ silent: true });
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isAuthenticated, readOnly, pendingCount, sync]);

  const value = { online, pendingCount, syncing, sync, refreshCount };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}
