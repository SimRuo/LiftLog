import {
  Card, CardContent, Typography, IconButton, TextField, Box, Button, Stack
} from '@mui/material';
import { DeleteRounded, AddRounded } from '@mui/icons-material';

export default function ExerciseSetForm({ exercise, sets, onChange, onRemoveExercise }) {
  const addSet = () => {
    const lastSet = sets[sets.length - 1];
    onChange([...sets, {
      setNumber: sets.length + 1,
      reps: lastSet?.reps || 0,
      weight: lastSet?.weight || 0,
      notes: '',
    }]);
  };

  const updateSet = (idx, field, value) => {
    const updated = sets.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    onChange(updated);
  };

  const removeSet = (idx) => {
    const updated = sets.filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, setNumber: i + 1 }));
    onChange(updated);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>{exercise.name}</Typography>
            <Typography variant="caption" color="text.secondary">{exercise.category}</Typography>
          </Box>
          <IconButton size="small" color="error" onClick={onRemoveExercise}>
            <DeleteRounded />
          </IconButton>
        </Box>

        {sets.map((set, idx) => (
          <Stack key={idx} direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>
              {idx + 1}
            </Typography>
            <TextField size="small" label="Weight" type="number"
              value={set.weight} sx={{ width: 90 }}
              onChange={e => updateSet(idx, 'weight', parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 0.5 }} />
            <TextField size="small" label="Reps" type="number"
              value={set.reps} sx={{ width: 75 }}
              onChange={e => updateSet(idx, 'reps', parseInt(e.target.value) || 0)}
              inputProps={{ min: 0 }} />
            <IconButton size="small" onClick={() => removeSet(idx)}
              disabled={sets.length <= 1}>
              <DeleteRounded fontSize="small" />
            </IconButton>
          </Stack>
        ))}

        <Button size="small" startIcon={<AddRounded />} onClick={addSet}>
          Add Set
        </Button>
      </CardContent>
    </Card>
  );
}
