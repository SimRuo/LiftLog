import { useState, useMemo } from 'react';
import { Box, Card, Stack, TextField, Typography, Divider } from '@mui/material';
import { Label, Stat } from '../ui/Bits';
import DurationField from './DurationField';
import RpeSelector from './RpeSelector';
import { ink } from '../../theme';
import { clock, km } from '../../lib/format';

/** What a station prescribes, e.g. "1 km" or "100 reps". */
function target(step) {
  if (step.targetDistanceMeters) return km(step.targetDistanceMeters);
  if (step.targetReps) return `${step.targetReps} reps`;
  return '—';
}

/**
 * Logging one run at a circuit.
 *
 * The total is the only required number. Splits are per-station and optional,
 * because typing sixteen of them on a phone after a Hyrox is not something
 * anyone does twice — but the ones you do fill in are what later tell you which
 * station cost you the time.
 *
 * Splits are entered as mm:ss per station rather than as a running clock: a
 * cumulative clock is quicker to read off a watch, but one mistyped row shifts
 * every split after it, and a half-filled column of them would be worse than
 * none.
 */
export default function CircuitLogger({ steps, value, onChange }) {
  const [focused, setFocused] = useState(null);

  const setTotal = (key, v) => onChange({ ...value, [key]: v });

  const setSplit = (index, key, v) => {
    const splits = { ...value.splits, [index]: { ...value.splits[index], [key]: v } };
    onChange({ ...value, splits });
  };

  const totalSeconds =
    (parseInt(value.minutes, 10) || 0) * 60 + (parseInt(value.seconds, 10) || 0);

  // What the filled-in splits account for, so a total that clearly disagrees
  // with them is visible before saving rather than discovered in a chart.
  const accounted = useMemo(
    () =>
      Object.values(value.splits).reduce(
        (sum, s) => sum + (parseInt(s?.minutes, 10) || 0) * 60 + (parseInt(s?.seconds, 10) || 0),
        0,
      ),
    [value.splits],
  );

  const filled = Object.values(value.splits).filter(
    (s) => (parseInt(s?.minutes, 10) || 0) + (parseInt(s?.seconds, 10) || 0) > 0,
  ).length;

  return (
    <Box>
      <Card sx={{ p: 2, mb: 2 }}>
        <Label sx={{ mb: 0.75 }}>Total time</Label>
        <DurationField
          minutes={value.minutes}
          seconds={value.seconds}
          onChange={setTotal}
          autoFocus
        />
        <Divider sx={{ my: 2 }} />
        <RpeSelector value={value.rpe} onChange={(rpe) => onChange({ ...value, rpe })} />
      </Card>

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Label>Splits — optional</Label>
        <Label sx={{ color: 'text.secondary' }}>
          {filled > 0 ? `${filled}/${steps.length} · ${clock(accounted)} of ${clock(totalSeconds)}` : `${steps.length} stations`}
        </Label>
      </Stack>

      <Card>
        {steps.map((step, i) => {
          const split = value.splits[i] || {};
          const isFocused = focused === i;
          return (
            <Stack
              key={i}
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                px: 1.5,
                py: 1,
                borderTop: i ? `1px solid ${ink.line}` : 'none',
                bgcolor: isFocused ? ink.raised : 'transparent',
              }}
            >
              <Label sx={{ width: 22, flexShrink: 0, color: ink.lineBright }}>{i + 1}</Label>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }} noWrap>
                  {step.activityName}
                </Typography>
                <Label>{target(step)}</Label>
              </Box>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                <TextField
                  size="small"
                  type="number"
                  placeholder="––"
                  value={split.minutes ?? ''}
                  onChange={(e) => setSplit(i, 'minutes', e.target.value)}
                  onFocus={(e) => {
                    setFocused(i);
                    e.target.select();
                  }}
                  onBlur={() => setFocused(null)}
                  inputProps={{
                    inputMode: 'numeric',
                    min: 0,
                    max: 999,
                    'aria-label': `${step.activityName} minutes`,
                    style: { textAlign: 'right', padding: '6px 6px', width: 34 },
                  }}
                />
                <Typography sx={{ fontWeight: 800, color: 'text.secondary' }}>:</Typography>
                <TextField
                  size="small"
                  type="number"
                  placeholder="––"
                  value={split.seconds ?? ''}
                  onChange={(e) => setSplit(i, 'seconds', e.target.value)}
                  onFocus={(e) => {
                    setFocused(i);
                    e.target.select();
                  }}
                  onBlur={() => setFocused(null)}
                  inputProps={{
                    inputMode: 'numeric',
                    min: 0,
                    max: 59,
                    'aria-label': `${step.activityName} seconds`,
                    style: { textAlign: 'right', padding: '6px 6px', width: 34 },
                  }}
                />
              </Stack>
            </Stack>
          );
        })}
      </Card>

      {/* Only worth flagging once the splits are complete — a partial column is
          supposed to add up to less than the total. */}
      {filled === steps.length && totalSeconds > 0 && Math.abs(accounted - totalSeconds) > 60 && (
        <Typography sx={{ mt: 1, fontSize: '0.76rem', color: 'text.secondary' }}>
          Your splits add up to {clock(accounted)}, which is{' '}
          {clock(Math.abs(accounted - totalSeconds))}{' '}
          {accounted > totalSeconds ? 'more' : 'less'} than the total. Transitions count, so a small
          gap is normal.
        </Typography>
      )}

      {totalSeconds > 0 && (
        <Card sx={{ p: 2, mt: 2, borderColor: ink.lineBright }}>
          <Stack direction="row" spacing={3}>
            <Stat label="Total" value={clock(totalSeconds)} accent />
            <Stat label="Stations" value={steps.length} />
            {filled > 0 && <Stat label="Splits" value={`${filled}/${steps.length}`} />}
          </Stack>
        </Card>
      )}
    </Box>
  );
}
