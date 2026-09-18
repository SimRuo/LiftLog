import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { FavoriteRounded, DeleteOutlineRounded, ArrowBackRounded } from '@mui/icons-material';
import { cardioApi } from '../api/cardio';
import { Label, Stat, EmptyState, ListSkeleton } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';
import { ink } from '../theme';
import { clock, km, pace, rpeLabel, weekdayDate } from '../lib/format';

export default function CardioDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    cardioApi
      .get(id)
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [id]);

  const remove = async () => {
    setDeleting(true);
    try {
      await cardioApi.delete(id);
      toast.success('Session deleted.');
      navigate('/workouts');
    } catch (err) {
      toast.error(err.message || 'Could not delete that session.');
      setDeleting(false);
    }
  };

  if (loading) return <ListSkeleton count={1} lines={5} />;

  if (!session) {
    return (
      <EmptyState
        icon={<FavoriteRounded />}
        title="Session not found"
        description="It may have been deleted, or it hasn't reached this device."
        action={
          <Button variant="contained" onClick={() => navigate('/workouts')}>
            Back to history
          </Button>
        }
      />
    );
  }

  const perKm = pace(session.durationSeconds, session.distanceMeters);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          size="small"
          startIcon={<ArrowBackRounded />}
          onClick={() => navigate('/workouts')}
          sx={{ color: 'text.secondary', ml: -0.5 }}
        >
          History
        </Button>
      </Stack>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <FavoriteRounded sx={{ fontSize: 18, color: ink.accent }} />
        <Typography variant="h4" sx={{ fontSize: '1.6rem' }}>
          {session.activityName}
        </Typography>
      </Stack>
      <Label sx={{ mb: 2 }}>{weekdayDate(session.date)}</Label>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
          <Stat label="Time" value={clock(session.durationSeconds)} />
          {session.distanceMeters > 0 && <Stat label="Distance" value={km(session.distanceMeters)} />}
          {perKm && <Stat label="Pace" value={perKm} unit="/km" accent />}
          {session.rpe && <Stat label="Effort" value={session.rpe} unit={`— ${rpeLabel(session.rpe)}`} />}
        </Stack>
      </Card>

      {session.segments?.length > 0 && (
        <>
          <Label sx={{ mb: 1 }}>Stations</Label>
          <Card sx={{ mb: 2 }}>
            {session.segments.map((seg, i) => (
              <Stack
                key={seg.order}
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{ px: 1.5, py: 1, borderTop: i ? `1px solid ${ink.line}` : 'none' }}
              >
                <Label sx={{ width: 22, flexShrink: 0, color: ink.lineBright }}>{i + 1}</Label>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }} noWrap>
                    {seg.activityName}
                  </Typography>
                  <Label>
                    {seg.distanceMeters ? km(seg.distanceMeters) : seg.reps ? `${seg.reps} reps` : '—'}
                  </Label>
                </Box>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: seg.durationSeconds ? 'text.primary' : ink.lineBright,
                  }}
                >
                  {seg.durationSeconds ? clock(seg.durationSeconds) : '––'}
                </Typography>
              </Stack>
            ))}
          </Card>
        </>
      )}

      {session.notes && (
        <Card sx={{ p: 2, mb: 2 }}>
          <Label sx={{ mb: 0.5 }}>Notes</Label>
          <Typography sx={{ fontSize: '0.9rem' }}>{session.notes}</Typography>
        </Card>
      )}

      <Button
        fullWidth
        startIcon={<DeleteOutlineRounded />}
        onClick={() => setConfirmOpen(true)}
        sx={{ color: 'text.secondary' }}
      >
        Delete session
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete this session?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {session.activityName} on {weekdayDate(session.date)} will be removed from your history
            and from its progress chart.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: 'text.secondary' }}>
            Keep
          </Button>
          <Button color="primary" variant="contained" onClick={remove} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
