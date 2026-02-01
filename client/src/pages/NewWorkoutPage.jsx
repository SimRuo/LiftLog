import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography, Box, Button, TextField, Alert
} from '@mui/material';
import { AddRounded, SaveRounded } from '@mui/icons-material';
import ExerciseSelector from '../components/workout/ExerciseSelector';
import ExerciseSetForm from '../components/workout/ExerciseSetForm';
import { workoutsApi } from '../api/workouts';

export default function NewWorkoutPage() {
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addExercise = (exercise) => {
    setExercises(prev => [...prev, {
      exercise,
      sets: [{ setNumber: 1, reps: 0, weight: 0, notes: '' }],
    }]);
  };

  const updateSets = (idx, sets) => {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, sets } : e));
  };

  const removeExercise = (idx) => {
    setExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (exercises.length === 0) {
      setError('Add at least one exercise');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const allSets = exercises.flatMap(({ exercise, sets }) =>
        sets.map(s => ({
          exerciseId: exercise.id,
          setNumber: s.setNumber,
          reps: s.reps,
          weight: s.weight,
          notes: s.notes || null,
        }))
      );
      await workoutsApi.create({ date, notes: notes || null, sets: allSets });
      navigate('/workouts');
    } catch (err) {
      setError(err.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>New Workout</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TextField fullWidth type="date" label="Date" value={date}
        onChange={e => setDate(e.target.value)}
        sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />

      <TextField fullWidth label="Notes (optional)" value={notes}
        onChange={e => setNotes(e.target.value)}
        multiline rows={2} sx={{ mb: 2 }} />

      {exercises.map((item, idx) => (
        <ExerciseSetForm
          key={`${item.exercise.id}-${idx}`}
          exercise={item.exercise}
          sets={item.sets}
          onChange={(sets) => updateSets(idx, sets)}
          onRemoveExercise={() => removeExercise(idx)}
        />
      ))}

      <Button fullWidth variant="outlined" startIcon={<AddRounded />}
        onClick={() => setSelectorOpen(true)} sx={{ mb: 2 }}>
        Add Exercise
      </Button>

      <Button fullWidth variant="contained" startIcon={<SaveRounded />}
        onClick={handleSave} disabled={saving} size="large">
        {saving ? 'Saving...' : 'Save Workout'}
      </Button>

      <ExerciseSelector
        open={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={addExercise}
      />
    </Box>
  );
}
