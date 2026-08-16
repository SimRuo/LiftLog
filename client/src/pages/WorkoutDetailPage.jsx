import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Stack,
  Chip,
} from '@mui/material';
import { DeleteOutlineRounded, ArrowBackRounded, HotelRounded } from '@mui/icons-material';
import { workoutsApi } from '../api/workouts';
import { Label, Stat, ListSkeleton, EmptyState } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';
import { ink, MONO } from '../theme';
import { volume, volumeLabel, e1rm, kg, weekdayDate, relativeDay } from '../lib/format';

export default function WorkoutDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    workoutsApi
      .get(id)
      .then(setWorkout)
      .catch((err) => toast.error(err.message || 'Could not load that workout.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const grouped = useMemo(() => {
    if (!workout?.sets) return [];
    const map = new Map();
    for (const set of workout.sets) {
      if (!map.has(set.exerciseName)) {
        map.set(set.exerciseName, { name: set.exerciseName, category: set.exerciseCategory, sets: [] });
      }
      map.get(set.exerciseName).sets.push(set);
    }
    return [...map.values()];
  }, [workout]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await workoutsApi.delete(id);
      toast.success('Workout deleted.');
      navigate('/workouts');
    } catch (err) {
      toast.error(err.message || 'Could not delete that workout.');
      setDeleting(false);
    }
  };

  if (loading) return <ListSkeleton count={3} lines={4} />;
  if (!workout) {
    return (
      <EmptyState
        title="Not found"
        description="That workout no longer exists."
        action={
          <Button variant="outlined" onClick={() => navigate('/workouts')}>
            Back to history
          </Button>
        }
      />
    );
  }

  const totalVolume = volume(workout.sets);

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/workouts')} aria-label="Back" sx={{ ml: -1, mt: -0.5 }}>
          <ArrowBackRounded />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Label>
            {relativeDay(workout.date)} · {weekdayDate(workout.date)}
          </Label>
          <Typography variant="h5" sx={{ mt: 0.25 }}>
            {workout.planDayName || (workout.isRestDay ? 'Rest day' : 'Workout')}
          </Typography>
        </Box>
        <IconButton onClick={() => setDeleteOpen(true)} aria-label="Delete workout" sx={{ mt: -0.5 }}>
          <DeleteOutlineRounded />
        </IconButton>
      </Stack>

      {workout.isRestDay ? (
        <Card sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
            <HotelRounded fontSize="small" />
            <Typography sx={{ fontWeight: 600 }}>Logged as a rest day</Typography>
          </Stack>
        </Card>
      ) : (
        <Card sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={3}>
            <Stat label="Sets" value={workout.sets.length} accent />
            <Stat label="Lifts" value={grouped.length} />
            <Stat label="Volume" value={volumeLabel(totalVolume)} />
          </Stack>
        </Card>
      )}

      {workout.notes && (
        <Card sx={{ p: 1.5, mb: 2, borderLeft: `2px solid ${ink.accent}` }}>
          <Label sx={{ mb: 0.5 }}>Notes</Label>
          <Typography sx={{ fontSize: '0.9rem' }}>{workout.notes}</Typography>
        </Card>
      )}

      {grouped.map((group) => {
        // The set that actually mattered, by estimated 1RM rather than by
        // weight — 100x3 outranks 105x1 and the highlight should say so.
        const top = group.sets.reduce((best, s) =>
          e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps) ? s : best,
        );

        return (
          <Card key={group.name} sx={{ mb: 1.5 }}>
            <Box sx={{ px: 1.5, pt: 1.5, pb: 1 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Typography sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}>{group.name}</Typography>
                <Chip size="small" label={group.category} variant="outlined" />
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                <Label>{volumeLabel(volume(group.sets))}</Label>
                <Label>e1RM {kg(e1rm(top.weight, top.reps))} kg</Label>
              </Stack>
            </Box>

            {group.sets.map((s) => {
              const isTop = s.id === top.id;
              return (
                <Box
                  key={s.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.5,
                    py: 0.85,
                    borderTop: `1px solid ${ink.line}`,
                    bgcolor: isTop ? 'rgba(255,77,23,0.05)' : 'transparent',
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: '0.72rem',
                      color: isTop ? 'primary.main' : 'text.secondary',
                      width: 16,
                    }}
                  >
                    {s.setNumber}
                  </Typography>
                  <Typography sx={{ fontFamily: MONO, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {kg(s.weight)}
                    <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.75rem', mx: 0.5 }}>
                      kg ×
                    </Typography>
                    {s.reps}
                  </Typography>
                  {s.notes && (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', flex: 1 }} noWrap>
                      {s.notes}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Card>
        );
      })}

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete this workout?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.9rem' }}>
            {workout.isRestDay
              ? 'The rest day is removed from your history.'
              : `${workout.sets.length} sets are permanently removed and will disappear from your progress charts.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button color="primary" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
