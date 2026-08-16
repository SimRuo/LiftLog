import { Box, IconButton, InputBase, Typography } from '@mui/material';
import { RemoveRounded, AddRounded } from '@mui/icons-material';
import { MONO, ink } from '../../theme';

/**
 * The number control the whole app logs with.
 *
 * A bare <TextField type="number"> is the single worst thing about logging on a
 * phone: the native spinners are ~10px targets, tapping the field opens the
 * full keyboard and puts the caret wherever you touched (so you end up with
 * "4025" instead of "40"), and changing 40 to 42.5 takes four taps.
 *
 * So: big -/+ steppers either side, one tap per plate jump, and the field
 * itself selects everything on focus so typing overwrites instead of inserting.
 * `inputMode="decimal"` gets the numeric keypad without `type=number`'s habit
 * of silently discarding a partially-typed value like "42.".
 */
export default function NumberField({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  label,
  width,
  flex = 1,
  disabled = false,
  'aria-label': ariaLabel,
}) {
  const clamp = (n) => Math.min(max, Math.max(min, n));

  const nudge = (delta) => {
    const next = clamp(Math.round(((Number(value) || 0) + delta) * 100) / 100);
    onChange(next);
    // A short tick confirms the change without needing to look at the screen.
    navigator.vibrate?.(8);
  };

  return (
    // `flex` lets a row of these share the available width instead of being
    // pinned to pixel widths — a 42.5 must not clip on a 360px phone.
    <Box sx={{ width, flex: width ? undefined : flex, minWidth: 0 }}>
      {label && (
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.6rem',
            letterSpacing: '0.12em',
            color: 'text.secondary',
            textTransform: 'uppercase',
            mb: 0.25,
            textAlign: 'center',
          }}
        >
          {label}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          border: `1px solid ${ink.line}`,
          bgcolor: ink.raised,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <IconButton
          size="small"
          disabled={disabled}
          onClick={() => nudge(-step)}
          aria-label={`Decrease ${ariaLabel || label || 'value'}`}
          sx={{ borderRadius: 0, width: 28, flexShrink: 0, color: 'text.secondary' }}
        >
          <RemoveRounded sx={{ fontSize: 16 }} />
        </IconButton>
        <InputBase
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value.replace(',', '.');
            if (raw === '') return onChange('');
            if (!/^\d*\.?\d*$/.test(raw)) return;
            onChange(raw);
          }}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) ? clamp(n) : min);
          }}
          inputProps={{
            inputMode: 'decimal',
            enterKeyHint: 'done',
            'aria-label': ariaLabel || label,
            style: { textAlign: 'center', padding: 0 },
          }}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 42,
            fontFamily: MONO,
            fontSize: '0.95rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <IconButton
          size="small"
          disabled={disabled}
          onClick={() => nudge(step)}
          aria-label={`Increase ${ariaLabel || label || 'value'}`}
          sx={{ borderRadius: 0, width: 28, flexShrink: 0, color: 'text.secondary' }}
        >
          <AddRounded sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
