import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Button, TextField, Card, CardContent,
  IconButton, Stack, Alert, CircularProgress, Autocomplete
} from '@mui/material';
import {
  AddRounded, DeleteRounded, SaveRounded, DragIndicatorRounded,
  ArrowUpwardRounded, ArrowDownwardRounded
} from '@mui/icons-material';
import { plansApi } from '../api/plans';
import { exercisesApi } from '../api/exercises';

export default function PlanEditPage() {
  const navigate = useNavigate();
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    Promise.all([
      exercisesApi.list().catch(() => []),
      plansApi.get().catch(() => null),
    ]).then(([categories, plan]) => {
      const exercises = categories.flatMap(c =>
        c.exercises.map(ex => ({ ...ex, category: c.category }))
      );
      setAllExercises(exercises);

      if (plan) {
        setIsEdit(true);
        setPlanName(plan.name);
        setDays(plan.days.map(d => ({
          name: d.name,
          exercises: d.exercises.map(e => ({
            exerciseId: e.exerciseId,
            exerciseName: e.exerciseName,
            exerciseCategory: e.exerciseCategory,
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            notes: e.notes || '',
          })),
        })));
      }
    }).finally(() => setLoading(false));
  }, []);

  const addDay = () => {
    setDays(prev => [...prev, { name: '', exercises: [] }]);
  };

  const removeDay = (dayIdx) => {
    setDays(prev => prev.filter((_, i) => i !== dayIdx));
  };

  const moveDayUp = (dayIdx) => {
    if (dayIdx === 0) return;
    setDays(prev => {
      const arr = [...prev];
      [arr[dayIdx - 1], arr[dayIdx]] = [arr[dayIdx], arr[dayIdx - 1]];
      return arr;
    });
  };

  const moveDayDown = (dayIdx) => {
    setDays(prev => {
      if (dayIdx >= prev.length - 1) return prev;
      const arr = [...prev];
      [arr[dayIdx], arr[dayIdx + 1]] = [arr[dayIdx + 1], arr[dayIdx]];
      return arr;
    });
  };

  const updateDayName = (dayIdx, name) => {
    setDays(prev => prev.map((d, i) => i === dayIdx ? { ...d, name } : d));
  };

  const addExercise = (dayIdx, exercise) => {
    if (!exercise) return;
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return {
        ...d,
        exercises: [...d.exercises, {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          exerciseCategory: exercise.category,
          sets: 3,
          reps: '8',
          weight: 0,
          notes: '',
        }],
      };
    }));
  };

  const removeExercise = (dayIdx, exIdx) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return { ...d, exercises: d.exercises.filter((_, j) => j !== exIdx) };
    }));
  };

  const updateExercise = (dayIdx, exIdx, field, value) => {
    setDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      return {
        ...d,
        exercises: d.exercises.map((e, j) =>
          j === exIdx ? { ...e, [field]: value } : e
        ),
      };
    }));
  };

  const handleSave = async () => {
    if (!planName.trim()) {
      setError('Plan name is required');
      return;
    }
    if (days.length === 0) {
      setError('Add at least one day');
      return;
    }
    for (const day of days) {
      if (!day.name.trim()) {
        setError('All days must have a name');
        return;
      }
      if (day.exercises.length === 0) {
        setError(`Day "${day.name}" needs at least one exercise`);
        return;
      }
    }

    setError('');
    setSaving(true);
    try {
      const payload = {
        name: planName.trim(),
        days: days.map((d, i) => ({
          name: d.name.trim(),
          order: i,
          exercises: d.exercises.map((e, j) => ({
            exerciseId: e.exerciseId,
            order: j,
            sets: parseInt(e.sets) || 1,
            reps: e.reps || '1',
            weight: parseFloat(e.weight) || 0,
            notes: e.notes || null,
          })),
        })),
      };

      if (isEdit) {
        await plansApi.update(payload);
      } else {
        await plansApi.create(payload);
      }
      navigate('/plan');
    } catch (err) {
      setError(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
        {isEdit ? 'Edit Plan' : 'Create Plan'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField fullWidth label="Plan Name" value={planName}
        onChange={e => setPlanName(e.target.value)}
        placeholder="e.g. Upper Lower Split"
        sx={{ mb: 3 }} />

      {days.map((day, dayIdx) => (
        <Card key={dayIdx} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <DragIndicatorRounded color="disabled" />
              <TextField size="small" label={`Day ${dayIdx + 1} Name`} value={day.name}
                onChange={e => updateDayName(dayIdx, e.target.value)}
                placeholder="e.g. Upper A" sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => moveDayUp(dayIdx)} disabled={dayIdx === 0}>
                <ArrowUpwardRounded fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => moveDayDown(dayIdx)} disabled={dayIdx === days.length - 1}>
                <ArrowDownwardRounded fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" onClick={() => removeDay(dayIdx)}>
                <DeleteRounded fontSize="small" />
              </IconButton>
            </Box>

            {day.exercises.map((ex, exIdx) => (
              <Box key={exIdx} sx={{ mb: 1.5, pl: 1, borderLeft: 2, borderColor: 'primary.main' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>{ex.exerciseName}</Typography>
                  <IconButton size="small" onClick={() => removeExercise(dayIdx, exIdx)}>
                    <DeleteRounded fontSize="small" />
                  </IconButton>
                </Box>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" label="Sets" type="number" sx={{ width: 70 }}
                    value={ex.sets}
                    onChange={e => updateExercise(dayIdx, exIdx, 'sets', e.target.value)}
                    inputProps={{ min: 1 }} />
                  <TextField size="small" label="Reps" sx={{ width: 80 }}
                    value={ex.reps}
                    onChange={e => updateExercise(dayIdx, exIdx, 'reps', e.target.value)}
                    placeholder="8" />
                  <TextField size="small" label="Weight (kg)" type="number" sx={{ width: 110 }}
                    value={ex.weight}
                    onChange={e => updateExercise(dayIdx, exIdx, 'weight', e.target.value)}
                    inputProps={{ min: 0, step: 0.5 }} />
                  <TextField size="small" label="Notes" sx={{ flex: 1 }}
                    value={ex.notes}
                    onChange={e => updateExercise(dayIdx, exIdx, 'notes', e.target.value)} />
                </Stack>
              </Box>
            ))}

            <Autocomplete
              options={allExercises}
              getOptionLabel={opt => opt.name}
              groupBy={opt => opt.category}
              onChange={(_, val) => addExercise(dayIdx, val)}
              value={null}
              blurOnSelect
              renderInput={(params) => (
                <TextField {...params} size="small" label="Add exercise..." />
              )}
              sx={{ mt: 1 }}
            />
          </CardContent>
        </Card>
      ))}

      <Button fullWidth variant="outlined" startIcon={<AddRounded />}
        onClick={addDay} sx={{ mb: 2 }}>
        Add Day
      </Button>

      <Button fullWidth variant="contained" startIcon={<SaveRounded />}
        onClick={handleSave} disabled={saving} size="large">
        {saving ? 'Saving...' : 'Save Plan'}
      </Button>
    </Box>
  );
}
