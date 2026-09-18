import { Box, Stack, Typography } from '@mui/material';
import { Label } from '../ui/Bits';
import { ink } from '../../theme';
import { rpeLabel } from '../../lib/format';

/**
 * Effort, 1-10, as a row of taps.
 *
 * This is the field that makes a pace chart mean anything: the same pace at a
 * lower effort is fitness, a faster one at maximum effort may just be a good
 * day. A slider was the obvious choice and the wrong one — dragging to a
 * precise value on a phone is fiddly, and there are only ten of them.
 *
 * Optional throughout. Tapping the selected value again clears it, so a session
 * logged days later isn't forced to invent a number.
 */
export default function RpeSelector({ value, onChange }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
        <Label>Effort</Label>
        <Label sx={{ color: value ? 'primary.main' : 'text.secondary' }}>
          {value ? `${value} — ${rpeLabel(value)}` : 'Optional'}
        </Label>
      </Stack>

      <Stack direction="row" spacing={0.5}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const selected = value === n;
          return (
            <Box
              key={n}
              role="button"
              aria-label={`Effort ${n}`}
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : n)}
              sx={{
                flex: 1,
                py: 0.9,
                textAlign: 'center',
                cursor: 'pointer',
                userSelect: 'none',
                border: `1px solid ${selected ? ink.accent : ink.line}`,
                bgcolor: selected ? ink.accent : 'transparent',
                color: selected ? ink.ground : 'text.secondary',
                fontWeight: selected ? 800 : 600,
                fontSize: '0.8rem',
                '&:hover': { borderColor: selected ? ink.accent : ink.lineBright },
              }}
            >
              <Typography sx={{ fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 1 }}>
                {n}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
