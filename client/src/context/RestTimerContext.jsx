import { useState, useRef, useCallback, useEffect } from 'react';
import { RestTimerContext } from './rest-timer-context';
import useNow from '../hooks/useNow';

const STORAGE_KEY = 'liftlog.rest';

/**
 * The rest timer.
 *
 * Two things make this harder than `setInterval(() => n--)`:
 *
 * 1. Phones throttle or freeze timers in backgrounded tabs, and the screen
 *    locks while you rest. So state is an absolute `endsAt` timestamp and the
 *    displayed number is derived from a ticking clock. Come back after ninety
 *    seconds with the screen off and it reads correctly, or has already
 *    finished — rather than having lost the time it spent frozen.
 *
 * 2. The alert has to fire when you're *not* looking at the page, which is
 *    exactly when JS is least likely to run on time. The beep is therefore
 *    scheduled on the audio clock the instant the timer starts, not triggered
 *    by a callback at zero — the audio graph keeps running when the main
 *    thread is throttled.
 */
export function RestTimerProvider({ children }) {
  const [endsAt, setEndsAt] = useState(() => {
    // Survive a reload mid-rest.
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved && saved > Date.now() ? saved : null;
  });
  const [duration, setDuration] = useState(120);
  const audioRef = useRef(null);
  const scheduledRef = useRef(null);

  const now = useNow(!!endsAt, 250);
  const remaining = endsAt ? Math.max(0, (endsAt - now) / 1000) : 0;
  const running = !!endsAt && remaining > 0;

  // Clear the countdown the moment it lands, and fire the haptic. The haptic is
  // best-effort — it only plays if the page happens to be foregrounded — which
  // is why the audible cue is scheduled separately, below.
  useEffect(() => {
    if (!endsAt) return;
    const id = setTimeout(
      () => {
        navigator.vibrate?.([120, 60, 120]);
        setEndsAt(null);
        localStorage.removeItem(STORAGE_KEY);
      },
      Math.max(0, endsAt - Date.now()),
    );
    return () => clearTimeout(id);
  }, [endsAt]);

  const cancelScheduledBeep = useCallback(() => {
    if (scheduledRef.current) {
      try {
        scheduledRef.current.stop();
        scheduledRef.current.disconnect();
      } catch {
        /* already stopped */
      }
      scheduledRef.current = null;
    }
  }, []);

  const scheduleBeep = useCallback(
    (seconds) => {
      cancelScheduledBeep();
      try {
        // Created lazily inside the tap that starts the timer, which is the
        // user gesture browsers require before audio is allowed to play.
        if (!audioRef.current) {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) return;
          audioRef.current = new Ctx();
        }
        const ctx = audioRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const at = ctx.currentTime + seconds;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        // Envelope the tone — a square-edged beep clicks on phone speakers.
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(0.25, at + 0.02);
        gain.gain.setValueAtTime(0.25, at + 0.18);
        gain.gain.linearRampToValueAtTime(0, at + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.35);
        scheduledRef.current = osc;
      } catch {
        // No audio available; the haptic and the on-screen bar still work.
      }
    },
    [cancelScheduledBeep],
  );

  const start = useCallback(
    (seconds) => {
      const secs = Math.max(5, seconds || duration);
      const end = Date.now() + secs * 1000;
      setDuration(secs);
      setEndsAt(end);
      localStorage.setItem(STORAGE_KEY, String(end));
      scheduleBeep(secs);
    },
    [duration, scheduleBeep],
  );

  const stop = useCallback(() => {
    cancelScheduledBeep();
    setEndsAt(null);
    localStorage.removeItem(STORAGE_KEY);
  }, [cancelScheduledBeep]);

  /** Add or subtract time without restarting — the "+30s" on the bar. */
  const adjust = useCallback(
    (delta) => {
      setEndsAt((prev) => {
        if (!prev) return prev;
        const next = Math.max(Date.now() + 1000, prev + delta * 1000);
        localStorage.setItem(STORAGE_KEY, String(next));
        scheduleBeep((next - Date.now()) / 1000);
        return next;
      });
    },
    [scheduleBeep],
  );

  const value = { running, remaining, duration, start, stop, adjust, setDuration };
  return <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>;
}
