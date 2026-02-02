import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Button, TextField, Card, CardContent,
  Stack, Alert, CircularProgress, Chip, IconButton
} from '@mui/material';
import {
  SaveRounded, HotelRounded, DeleteRounded, AddRounded
} from '@mui/icons-material';
import { workoutsApi } from '../api/workouts';

export default function LogWorkoutPage() {
  const navigate = useNavigate();
  const [nextDay, setNextDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noPlan, setNoPlan] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    workoutsApi.next()
      .then(data => {
        setNextDay(data);
        setExercises(data.exercises.map(ex => ({
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          exerciseCategory: ex.exerciseCategory,
          plannedSets: ex.sets,
          plannedReps: ex.reps,
          plannedWeight: ex.weight,
          lastSessionSets: ex.lastSessionSets || [],
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: parseInt(ex.reps) || 0,
            weight: ex.weight,
            notes: '',
          })),
        })));
      })
      .catch(err => {
        if (err.message.includes('404') || err.message.includes('Not Found')) {
          setNoPlan(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const updateSet = (exIdx, setIdx, field, value) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return {
        ...ex,
        sets: ex.sets.map((s, j) =>
          j === setIdx ? { ...s, [field]: value } : s
        ),
      };
    }));
  };

  const addSet = (exIdx) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [...ex.sets, {
          setNumber: ex.sets.length + 1,
          reps: lastSet?.reps || 0,
          weight: lastSet?.weight || 0,
          notes: '',
        }],
      };
    }));
  };

  const removeSet = (exIdx, setIdx) => {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex;
      return {
        ...ex,
        sets: ex.sets.filter((_, j) => j !== setIdx)
          .map((s, j) => ({ ...s, setNumber: j + 1 })),
      };
    }));
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const allSets = exercises.flatMap(ex =>
        ex.sets.map(s => ({
          exerciseId: ex.exerciseId,
          setNumber: s.setNumber,
          reps: parseInt(s.reps) || 0,
          weight: parseFloat(s.weight) || 0,
          notes: s.notes || null,
        }))
      );
      await workoutsApi.create({
        date,
        notes: notes || null,
        planDayId: nextDay.planDayId,
        sets: allSets,
      });
      navigate('/workouts');
    } catch (err) {
      setError(err.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  const handleRestDay = async () => {
    setError('');
    setSaving(true);
    try {
      await workoutsApi.logRest({
        date,
        notes: notes || null,
        planDayId: nextDay?.planDayId || null,
      });
      navigate('/workouts');
    } catch (err) {
      setError(err.message || 'Failed to log rest day');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  if (noPlan) {
    return (
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>No Plan Found</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Create a workout plan first to start logging workouts.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/plan')}>
          Go to Plan
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Log Workout</Typography>
        <Chip label={nextDay.dayName} color="primary" size="small" />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField fullWidth type="date" label="Date" value={date}
        onChange={e => setDate(e.target.value)}
        sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />

      <TextField fullWidth label="Notes (optional)" value={notes}
        onChange={e => setNotes(e.target.value)}
        multiline rows={2} sx={{ mb: 2 }} />

      {exercises.map((ex, exIdx) => (
        <Card key={exIdx} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>{ex.exerciseName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Planned: {ex.plannedSets} x {ex.plannedReps}
                  {ex.plannedWeight > 0 ? ` @ ${ex.plannedWeight} kg` : ''}
                </Typography>
                {ex.lastSessionSets.length > 0 && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Last: {(() => {
                      const sets = ex.lastSessionSets;
                      const reps = sets.map(s => s.reps);
                      const weight = sets[0].weight;
                      const allSameReps = reps.every(r => r === reps[0]);
                      const allSameWeight = sets.every(s => s.weight === weight);
                      if (allSameReps && allSameWeight) {
                        return `${reps.length}x${reps[0]}${weight > 0 ? ` @ ${weight}kg` : ''}`;
                      }
                      return sets.map(s => `${s.reps}${s.weight > 0 ? `@${s.weight}` : ''}`).join(', ');
                    })()}
                  </Typography>
                )}
              </Box>
              <Chip label={ex.exerciseCategory} size="small" variant="outlined" />
            </Box>

            {ex.sets.map((set, setIdx) => (
              <Stack key={setIdx} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>
                  {setIdx + 1}
                </Typography>
                <TextField size="small" label="Weight" type="number" sx={{ width: 90 }}
                  value={set.weight}
                  onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value) || 0)}
                  inputProps={{ min: 0, step: 0.5 }} />
                <TextField size="small" label="Reps" type="number" sx={{ width: 75 }}
                  value={set.reps}
                  onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value) || 0)}
                  inputProps={{ min: 0 }} />
                <IconButton size="small" onClick={() => removeSet(exIdx, setIdx)}
                  disabled={ex.sets.length <= 1}>
                  <DeleteRounded fontSize="small" />
                </IconButton>
              </Stack>
            ))}

            <Button size="small" startIcon={<AddRounded />} onClick={() => addSet(exIdx)}>
              Add Set
            </Button>
          </CardContent>
        </Card>
      ))}

      <Stack spacing={1.5}>
        <Button fullWidth variant="contained" startIcon={<SaveRounded />}
          onClick={handleSave} disabled={saving} size="large">
          {saving ? 'Saving...' : 'Save Workout'}
        </Button>
        <Button fullWidth variant="outlined" startIcon={<HotelRounded />}
          onClick={handleRestDay} disabled={saving} color="secondary">
          Log Rest Day Instead
        </Button>
      </Stack>
    </Box>
  );
}
