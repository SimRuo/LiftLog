import { Box, Button, IconButton, Typography, LinearProgress } from '@mui/material';
import { CloseRounded } from '@mui/icons-material';
import { useRestTimer } from '../../context/rest-timer-context';
import { MONO, ink } from '../../theme';
import { Label } from '../ui/Bits';

/**
 * Sits above the bottom nav whenever a rest is running, on every screen — so
 * flicking to Progress to check last week's numbers mid-rest doesn't lose the
 * clock.
 */
export default function RestTimerBar() {
  const { running, remaining, duration, stop, adjust } = useRestTimer();
  if (!running) return null;

  const secs = Math.ceil(remaining);
  const mins = Math.floor(secs / 60);
  const urgent = secs <= 10;
  const pct = Math.max(0, Math.min(100, (remaining / duration) * 100));

  return (
    <Box
      className="hatch-bg"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(60px + env(safe-area-inset-bottom))',
        zIndex: 1150,
        bgcolor: ink.surface,
        borderTop: `1px solid ${ink.line}`,
        borderBottom: `1px solid ${ink.line}`,
      }}
    >
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{ '& .MuiLinearProgress-bar': { bgcolor: urgent ? 'primary.main' : ink.lineBright } }}
      />
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, maxWidth: 560, mx: 'auto' }}
      >
        <Box sx={{ minWidth: 92 }}>
          <Label>Rest</Label>
          <Typography
            className={urgent ? 'rest-urgent' : undefined}
            sx={{
              fontFamily: MONO,
              fontSize: '1.5rem',
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color: urgent ? 'primary.main' : 'text.primary',
            }}
          >
            {mins}:{String(secs % 60).padStart(2, '0')}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={() => adjust(-30)} sx={{ minWidth: 56 }}>
          −30
        </Button>
        <Button size="small" variant="outlined" onClick={() => adjust(30)} sx={{ minWidth: 56 }}>
          +30
        </Button>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={stop} aria-label="Skip rest">
          <CloseRounded />
        </IconButton>
      </Box>
    </Box>
  );
}
