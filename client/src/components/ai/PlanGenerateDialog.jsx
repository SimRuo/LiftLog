import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  LinearProgress,
  Typography,
  Box,
  Stack,
} from '@mui/material';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { aiApi } from '../../api/ai';
import { Label } from '../ui/Bits';
import useNow from '../../hooks/useNow';
import { formatDuration } from '../../lib/format';
import { ink } from '../../theme';

/**
 * Generation moved from a hosted 70B to a 4B running on the server's own CPU,
 * which took the wait from about three seconds to a minute or two. That is
 * fine for something you press when you change programme — but only if the
 * dialog looks like it's working rather than wedged, so the wait gets a
 * running clock and copy that changes as it goes.
 */
const STAGES = [
  { after: 0, text: 'Waking the model up…' },
  { after: 12, text: 'Reading your exercise list…' },
  { after: 30, text: 'Building the plan…' },
  { after: 75, text: 'Still going — long plans take a while on the server.' },
  { after: 150, text: 'Nearly there. This is the slow part of self-hosting.' },
];

export default function PlanGenerateDialog({ open, onClose, onGenerate }) {
  const [description, setDescription] = useState('');
  const [startedAt, setStartedAt] = useState(null);
  const [error, setError] = useState('');

  const loading = startedAt !== null;
  const now = useNow(loading);
  const elapsed = loading ? (now - startedAt) / 1000 : 0;
  const stage = [...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0];

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setError('');
    setStartedAt(Date.now());
    try {
      const plan = await aiApi.generatePlan(description.trim());
      onGenerate(plan);
      setDescription('');
      onClose();
    } catch (err) {
      setError(err.message || 'Could not generate a plan.');
    } finally {
      setStartedAt(null);
    }
  };

  const handleClose = () => {
    if (loading) return;
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeRounded color="primary" fontSize="small" />
        Generate a plan
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Describe what you want and it gets built from your exercise list. Runs on your own server,
          so give it a minute or two.
        </Typography>

        <TextField
          fullWidth
          multiline
          minRows={3}
          label="What do you want?"
          placeholder={
            'e.g. "6 day split, one all-out set per exercise, cutting"\n' +
            '"Upper/lower 4x a week, strength focus, 5s on compounds"\n' +
            '"Full body 3x a week, beginner"'
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          autoFocus
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ mt: 2, border: `1px solid ${ink.line}`, p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
              <Typography variant="body2">{stage.text}</Typography>
              <Label sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatDuration(elapsed)}</Label>
            </Stack>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              The first run after a restart is slower — the model has to load from disk.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleGenerate} disabled={loading || !description.trim()}>
          {loading ? 'Generating…' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
