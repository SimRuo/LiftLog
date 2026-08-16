import { useState, useEffect, useRef, useCallback } from 'react';
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

// Survives a reload or a wander to another tab mid-generation: the work is on
// the server, so all the client needs to find it again is the id.
const JOB_KEY = 'liftlog.planjob';

const POLL_MS = 2000;
const GIVE_UP_SECONDS = 600;

const STAGES = [
  { after: 0, text: 'Queued…' },
  { after: 8, text: 'Reading your exercise list…' },
  { after: 30, text: 'Building the plan…' },
  { after: 75, text: 'Still going — long plans take a while on the server.' },
  { after: 150, text: 'Nearly there. This is the slow part of self-hosting.' },
];

export default function PlanGenerateDialog({ open, onClose, onGenerate }) {
  const [description, setDescription] = useState('');
  const [jobId, setJobId] = useState(() => localStorage.getItem(JOB_KEY));
  const [startedAt, setStartedAt] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  // Guards against a poll that resolves after the dialog has gone.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Pick a running job back up when the dialog is reopened.
  //
  // The initial state above only reads storage once, at mount — which covers
  // arriving on the page fresh, but not the case the copy actually promises:
  // closing the dialog mid-generation and opening it again without ever
  // leaving the page. This component stays mounted throughout that, so
  // without a re-read on open the job would be forgotten while still running.
  useEffect(() => {
    if (!open) return;
    const stored = localStorage.getItem(JOB_KEY);
    if (stored) {
      // Deferred rather than set inline: a synchronous setState in an effect
      // body cascades an extra render.
      const t = setTimeout(() => alive.current && setJobId((current) => current ?? stored), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const working = !!jobId || starting;
  const now = useNow(working);
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const stage = [...STAGES].reverse().find((s) => elapsed >= s.after) ?? STAGES[0];

  const finish = useCallback((id) => {
    localStorage.removeItem(JOB_KEY);
    if (!alive.current) return;
    setJobId((current) => (current === id || id === undefined ? null : current));
    setStartedAt(null);
  }, []);

  // Poll while a job is outstanding. setTimeout rather than setInterval so a
  // slow response can never stack requests on top of each other.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer;

    const poll = async () => {
      try {
        const job = await aiApi.getPlanJob(jobId);
        if (cancelled || !alive.current) return;

        // Anchor the clock to the server's own elapsed time, so resuming an
        // in-flight job after a reload doesn't restart the counter at zero.
        setStartedAt((t) => t ?? Date.now() - (job.elapsedSeconds || 0) * 1000);

        if (job.status === 'done') {
          finish(jobId);
          onGenerate(job.plan);
          setDescription('');
          onClose();
          return;
        }
        if (job.status === 'failed') {
          setError(job.error || 'Plan generation failed.');
          finish(jobId);
          return;
        }
        if (job.elapsedSeconds > GIVE_UP_SECONDS) {
          setError('Generation is taking far longer than expected. Check the server.');
          finish(jobId);
          return;
        }
        timer = setTimeout(poll, POLL_MS);
      } catch (err) {
        if (cancelled || !alive.current) return;
        if (err.status === 404) {
          // Expired, or the backend restarted underneath it. Nothing to resume.
          setError('That generation is no longer running. Try again.');
          finish(jobId);
          return;
        }
        // A dropped connection mid-poll is not a failed generation — the
        // server is still working. Keep trying.
        timer = setTimeout(poll, POLL_MS * 2);
      }
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, finish, onGenerate, onClose]);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setError('');
    setStarting(true);
    try {
      const job = await aiApi.startPlan(description.trim());
      localStorage.setItem(JOB_KEY, job.id);
      setStartedAt(Date.now());
      setJobId(job.id);
    } catch (err) {
      setError(err.message || 'Could not start generation.');
    } finally {
      setStarting(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleCancel = () => {
    // The server keeps going — there's no cancel endpoint and a half-finished
    // generation isn't worth one. This just stops watching, and the job is
    // picked back up if the dialog is reopened before it expires.
    setError('');
    setJobId(null);
    setStartedAt(null);
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
          so give it a minute or two — you can close this and come back.
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
          disabled={working}
          autoFocus
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {working && (
          <Box sx={{ mt: 2, border: `1px solid ${ink.line}`, p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
              <Typography variant="body2">{stage.text}</Typography>
              <Label sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatDuration(elapsed)}</Label>
            </Stack>
            <LinearProgress />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              The first run after a restart is slower — the model loads from disk.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {working ? (
          <Button onClick={handleCancel}>Close and keep generating</Button>
        ) : (
          <Button onClick={handleClose}>Cancel</Button>
        )}
        <Button variant="contained" onClick={handleGenerate} disabled={working || !description.trim()}>
          {working ? 'Generating…' : 'Generate'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
