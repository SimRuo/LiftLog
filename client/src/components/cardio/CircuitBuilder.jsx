import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  Stack,
  TextField,
  Typography,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AddRounded,
  DeleteOutlineRounded,
  ArrowUpwardRounded,
  ArrowDownwardRounded,
} from '@mui/icons-material';
import { Label } from '../ui/Bits';
import { ink } from '../../theme';

/**
 * Builds a circuit: a name and an ordered list of stations.
 *
 * Each station is measured in distance or in reps, chosen per row rather than
 * per activity — the same sled push is 50 metres in a Hyrox and "10 laps" in
 * someone's own conditioning session, and both have to be sayable.
 *
 * Repeating blocks (a Hyrox is run/station eight times over) are handled by the
 * duplicate button rather than a loop construct. Nesting rounds inside a
 * circuit would be a second concept to learn for something two taps already do.
 */
export default function CircuitBuilder({ open, activities, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // A circuit is built out of plain activities; nesting one inside another
  // would make "total time" ambiguous.
  const stations = activities.filter((a) => a.mode !== 'circuit');

  const reset = () => {
    setName('');
    setSteps([]);
    setError('');
  };

  const addStep = () =>
    setSteps((prev) => [
      ...prev,
      { activity: stations[0] ?? null, measure: 'distance', distanceKm: '', reps: '' },
    ]);

  const patch = (i, next) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...next } : s)));

  const remove = (i) => setSteps((prev) => prev.filter((_, j) => j !== i));

  const duplicate = (i) =>
    setSteps((prev) => [...prev.slice(0, i + 1), { ...prev[i] }, ...prev.slice(i + 1)]);

  const move = (i, delta) =>
    setSteps((prev) => {
      const next = [...prev];
      const target = i + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });

  const submit = async () => {
    if (!name.trim() || steps.length === 0) return;
    if (steps.some((s) => !s.activity)) {
      setError('Every station needs an activity.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onCreate({
        name: name.trim(),
        steps: steps.map((s) => ({
          activityId: s.activity.id,
          targetDistanceMeters:
            s.measure === 'distance' && s.distanceKm
              ? Math.round(parseFloat(s.distanceKm) * 1000)
              : null,
          targetReps: s.measure === 'reps' && s.reps ? parseInt(s.reps, 10) : null,
        })),
      });
      reset();
    } catch (err) {
      setError(err.message || 'Could not create that circuit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>New circuit</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hyrox sim"
            autoFocus
            fullWidth
          />

          {steps.length === 0 && (
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
              Add the stations in the order you do them. Repeats are fine — a run between every
              station is just the run added again.
            </Typography>
          )}

          {steps.map((step, i) => (
            <Card key={i} sx={{ p: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <Label sx={{ width: 20, color: ink.lineBright }}>{i + 1}</Label>
                <Autocomplete
                  options={stations}
                  value={step.activity}
                  onChange={(_, v) => patch(i, { activity: v })}
                  getOptionLabel={(o) => o.name}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  renderInput={(params) => <TextField {...params} label="Station" size="small" />}
                  sx={{ flex: 1 }}
                />
                <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUpwardRounded fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  aria-label="Move down"
                >
                  <ArrowDownwardRounded fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={() => remove(i)} aria-label="Remove station">
                  <DeleteOutlineRounded fontSize="small" />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={step.measure}
                  onChange={(_, v) => v && patch(i, { measure: v })}
                >
                  <ToggleButton value="distance">Distance</ToggleButton>
                  <ToggleButton value="reps">Reps / laps</ToggleButton>
                </ToggleButtonGroup>

                {step.measure === 'distance' ? (
                  <TextField
                    size="small"
                    type="number"
                    value={step.distanceKm}
                    onChange={(e) => patch(i, { distanceKm: e.target.value })}
                    placeholder="1.0"
                    inputProps={{ inputMode: 'decimal', step: '0.01', min: 0 }}
                    InputProps={{ endAdornment: <Label>km</Label> }}
                    sx={{ width: 110 }}
                  />
                ) : (
                  <TextField
                    size="small"
                    type="number"
                    value={step.reps}
                    onChange={(e) => patch(i, { reps: e.target.value })}
                    placeholder="10"
                    inputProps={{ inputMode: 'numeric', min: 0 }}
                    sx={{ width: 110 }}
                  />
                )}

                <Button size="small" onClick={() => duplicate(i)} sx={{ color: 'text.secondary' }}>
                  Duplicate
                </Button>
              </Stack>
            </Card>
          ))}

          <Button startIcon={<AddRounded />} onClick={addStep} disabled={stations.length === 0}>
            Add station
          </Button>

          {error && (
            <Typography sx={{ fontSize: '0.8rem', color: 'primary.main' }}>{error}</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            reset();
            onClose();
          }}
          sx={{ color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={saving || !name.trim() || steps.length === 0}
        >
          {saving ? 'Creating…' : `Create (${steps.length})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
