import { Stack, TextField, Typography } from '@mui/material';

/**
 * Duration as two boxes rather than one.
 *
 * A single "minutes" field loses the seconds that make a 5k time worth
 * recording, and a free-text "mm:ss" field means parsing whatever gets typed.
 * Two numeric inputs keep the phone keypad numeric and the value unambiguous.
 */
export default function DurationField({ minutes, seconds, onChange, autoFocus }) {
  const box = (label, value, key, max) => (
    <TextField
      label={label}
      type="number"
      value={value}
      autoFocus={autoFocus && key === 'minutes'}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return onChange(key, '');
        const n = Math.max(0, Math.min(max, parseInt(raw, 10) || 0));
        onChange(key, n);
      }}
      onFocus={(e) => e.target.select()}
      inputProps={{ inputMode: 'numeric', min: 0, max, style: { fontSize: '1.4rem', fontWeight: 700 } }}
      sx={{ flex: 1 }}
    />
  );

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {box('Minutes', minutes, 'minutes', 1440)}
      <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color: 'text.secondary' }}>:</Typography>
      {box('Seconds', seconds, 'seconds', 59)}
    </Stack>
  );
}
