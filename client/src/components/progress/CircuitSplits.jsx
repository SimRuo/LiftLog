import { useState, useEffect, useMemo } from 'react';
import { Box, Card, Stack, Typography, Skeleton } from '@mui/material';
import { cardioApi } from '../../api/cardio';
import { Label, SectionHeader, Stat } from '../ui/Bits';
import { ink } from '../../theme';
import { clock, shortDate } from '../../lib/format';

/**
 * Latest attempt at a circuit against the one before it, station by station.
 *
 * The total time says whether you got faster; this says where it came from —
 * which is the only actionable thing a circuit log can tell you. A station
 * that's 40 seconds slower while everything else held is a training decision;
 * the same information buried in two totals is not.
 *
 * Stations are matched by position, not by name: a Hyrox runs eight separate
 * 1km legs and "Running" alone can't say which one drifted.
 */
export default function CircuitSplits({ activity }) {
  // The loaded id travels with the data rather than beside it, so "still
  // loading" is derived from a mismatch instead of held in its own state —
  // which keeps the effect free of a synchronous setState on every switch.
  const [loaded, setLoaded] = useState({ id: null, attempts: [] });

  useEffect(() => {
    let cancelled = false;
    cardioApi
      .attempts(activity.id, 5)
      .then((rows) => !cancelled && setLoaded({ id: activity.id, attempts: rows }))
      // A failure here costs the comparison, not the chart above it.
      .catch(() => !cancelled && setLoaded({ id: activity.id, attempts: [] }));
    return () => {
      cancelled = true;
    };
  }, [activity.id]);

  const loading = loaded.id !== activity.id;
  const attempts = loading ? [] : loaded.attempts;
  const [latest, previous] = attempts;

  const rows = useMemo(() => {
    if (!latest) return [];
    return latest.segments.map((seg, i) => {
      const before = previous?.segments?.[i];
      const comparable =
        seg.durationSeconds != null &&
        before?.durationSeconds != null &&
        before.cardioActivityId === seg.cardioActivityId;
      return {
        name: seg.activityName,
        now: seg.durationSeconds,
        delta: comparable ? seg.durationSeconds - before.durationSeconds : null,
      };
    });
  }, [latest, previous]);

  if (loading) return <Skeleton variant="rectangular" height={180} sx={{ mt: 2 }} />;
  if (!latest) return null;

  const totalDelta = previous ? latest.durationSeconds - previous.durationSeconds : null;
  // Only meaningful where something actually moved.
  const worst = rows.reduce(
    (found, r) => (r.delta != null && r.delta > (found?.delta ?? 0) ? r : found),
    null,
  );

  return (
    <Box>
      <SectionHeader>Last attempt</SectionHeader>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={3}>
          <Stat label={shortDate(new Date(latest.date))} value={clock(latest.durationSeconds)} accent />
          {previous && (
            <Stat
              label="vs previous"
              value={`${totalDelta > 0 ? '+' : ''}${clock(Math.abs(totalDelta))}`}
            />
          )}
          {latest.rpe && <Stat label="Effort" value={`${latest.rpe}/10`} />}
        </Stack>
        {worst && worst.delta > 0 && (
          <Typography sx={{ mt: 1, fontSize: '0.78rem', color: 'text.secondary' }}>
            Biggest loss was {worst.name}, {clock(worst.delta)} slower than last time.
          </Typography>
        )}
      </Card>

      <Card>
        {rows.map((row, i) => (
          <Stack
            key={i}
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ px: 1.5, py: 1, borderTop: i ? `1px solid ${ink.line}` : 'none' }}
          >
            <Label sx={{ width: 22, flexShrink: 0, color: ink.lineBright }}>{i + 1}</Label>
            <Typography sx={{ flex: 1, fontSize: '0.86rem', fontWeight: 600, minWidth: 0 }} noWrap>
              {row.name}
            </Typography>
            {row.delta != null && row.delta !== 0 && (
              <Label
                sx={{
                  whiteSpace: 'nowrap',
                  // Faster is the good direction, so the accent goes to a
                  // negative delta — the opposite of a lifting chart.
                  color: row.delta < 0 ? 'primary.main' : 'text.secondary',
                }}
              >
                {row.delta < 0 ? '−' : '+'}
                {clock(Math.abs(row.delta))}
              </Label>
            )}
            <Typography
              sx={{
                width: 62,
                textAlign: 'right',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: row.now != null ? 'text.primary' : ink.lineBright,
              }}
            >
              {row.now != null ? clock(row.now) : '––'}
            </Typography>
          </Stack>
        ))}
      </Card>

      {!previous && (
        <Typography sx={{ mt: 1, fontSize: '0.76rem', color: 'text.secondary' }}>
          Log this circuit again and each station gets compared against this attempt.
        </Typography>
      )}
    </Box>
  );
}
