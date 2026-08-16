import { useState, useEffect } from 'react';

/**
 * A ticking clock as state.
 *
 * Anything that counts (rest remaining, session elapsed) needs the current time
 * during render, but reading `Date.now()` in a render body is impure — the
 * value changes on renders that had nothing to do with time passing. Holding
 * "now" in state makes the clock an explicit input instead.
 *
 * `active` gates the interval so an idle screen isn't re-rendering four times a
 * second for nothing, and the visibility listener resyncs the moment the phone
 * comes back from a locked screen rather than up to one interval later.
 */
export default function useNow(active = true, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    // `now` was last written whenever the clock was previously running, which
    // may be minutes ago — resync on the next tick rather than synchronously in
    // the effect body, which would cascade a second render.
    const sync = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVisible = () => document.visibilityState === 'visible' && setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(sync);
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, intervalMs]);

  return now;
}
