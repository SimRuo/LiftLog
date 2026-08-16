/** Shared number/date formatting. Kept in one place so a weight is written the
 *  same way on the log screen, the history card and the chart tooltip. */

/** Drop trailing zeros: 42.5 -> "42.5", 100.0 -> "100". */
export function kg(value) {
  const n = Number(value) || 0;
  return `${Math.round(n * 100) / 100}`;
}

export function volume(sets) {
  return sets.reduce((sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight) || 0), 0);
}

/** Compact volume — 12,450 kg becomes "12.5t", which fits in a chip. */
export function volumeLabel(kgTotal) {
  if (kgTotal >= 10000) return `${(kgTotal / 1000).toFixed(1)}t`;
  return `${Math.round(kgTotal).toLocaleString()} kg`;
}

/**
 * Epley estimated 1RM. Used as a progress metric because on a cut your top
 * weight often holds while reps fall — a max-weight chart shows a flat line
 * through a period you were measurably getting weaker, and vice versa.
 * Meaningless above ~12 reps, so it's capped rather than extrapolated.
 */
export function e1rm(weight, reps) {
  const w = Number(weight) || 0;
  const r = Math.min(Number(reps) || 0, 12);
  if (!w || !r) return 0;
  return Math.round(w * (1 + r / 30) * 10) / 10;
}

export function bestSet(sets) {
  if (!sets?.length) return null;
  return sets.reduce((best, s) => (e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps) ? s : best));
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export function shortDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function weekdayDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "Today" / "Yesterday" / "4 days ago" / a date. Cheap orientation. */
export function relativeDay(value) {
  const then = new Date(value);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(then)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return `${days} days ago`;
  return weekdayDate(value);
}

/** A local YYYY-MM-DD, which is what <input type="date"> wants.
 *  toISOString() would shift the day for anyone east of UTC in the evening. */
export function todayInputValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Summarise a set list the way a lifter says it out loud: "3x8 @ 80kg". */
export function summariseSets(sets) {
  if (!sets?.length) return null;
  const reps = sets.map((s) => Number(s.reps));
  const weight = Number(sets[0].weight);
  const sameReps = reps.every((r) => r === reps[0]);
  const sameWeight = sets.every((s) => Number(s.weight) === weight);
  if (sameReps && sameWeight) {
    return `${reps.length}x${reps[0]}${weight > 0 ? ` @ ${kg(weight)}kg` : ''}`;
  }
  return sets.map((s) => `${s.reps}${s.weight > 0 ? `@${kg(s.weight)}` : ''}`).join(', ');
}
