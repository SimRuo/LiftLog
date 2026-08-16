import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Card,
  IconButton,
  Stack,
  Typography,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Skeleton,
} from '@mui/material';
import {
  AddRounded,
  DeleteOutlineRounded,
  ArrowUpwardRounded,
  ArrowDownwardRounded,
} from '@mui/icons-material';
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded';
import { plansApi } from '../api/plans';
import { exercisesApi } from '../api/exercises';
import PlanGenerateDialog from '../components/ai/PlanGenerateDialog';
import NumberField from '../components/ui/NumberField';
import { Label } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';
import { ink } from '../theme';

export default function PlanEditPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [planName, setPlanName] = useState('');
  const [days, setDays] = useState([]);
  const [allExercises, setAllExercises] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEdit, setIsEdit] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const [createDialog, setCreateDialog] = useState({ open: false, name: '', dayIdx: -1 });
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    Promise.all([exercisesApi.list().catch(() => []), plansApi.get().catch(() => null)])
      .then(([categories, plan]) => {
        setAllExercises(
          categories.flatMap((c) => c.exercises.map((ex) => ({ ...ex, category: c.category }))),
        );
        if (plan) {
          setIsEdit(true);
          setPlanName(plan.name);
          setDays(
            plan.days.map((d) => ({
              name: d.name,
              exercises: d.exercises.map((e) => ({
                exerciseId: e.exerciseId,
                exerciseName: e.exerciseName,
                exerciseCategory: e.exerciseCategory,
                sets: e.sets,
                reps: e.reps,
                weight: e.weight,
                notes: e.notes || '',
              })),
            })),
          );
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(allExercises.map((e) => e.category))].sort();

  const patchDay = (dayIdx, fn) => setDays((prev) => prev.map((d, i) => (i === dayIdx ? fn(d) : d)));

  const move = (list, from, to) => {
    if (to < 0 || to >= list.length) return list;
    const arr = [...list];
    [arr[from], arr[to]] = [arr[to], arr[from]];
    return arr;
  };

  const addExerciseToDay = (dayIdx, exercise) => {
    patchDay(dayIdx, (d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          exerciseCategory: exercise.category,
          sets: 3,
          reps: '8',
          weight: 0,
          notes: '',
        },
      ],
    }));
  };

  const handlePick = (dayIdx, value) => {
    if (!value) return;
    if (typeof value === 'string' || value.isCreate) {
      setCreateDialog({ open: true, name: value.isCreate ? value.name : value, dayIdx });
      setNewCategory('');
      return;
    }
    addExerciseToDay(dayIdx, value);
  };

  const handleCreateExercise = async () => {
    const category = newCategory.trim();
    if (!category) return;
    try {
      const created = await exercisesApi.create(createDialog.name.trim(), category);
      const newEx = { id: created.id, name: created.name, category: created.category };
      setAllExercises((prev) => [...prev, newEx]);
      addExerciseToDay(createDialog.dayIdx, newEx);
      setCreateDialog({ open: false, name: '', dayIdx: -1 });
    } catch (err) {
      toast.error(err.message || 'Could not create that exercise.');
    }
  };

  const updateExercise = (dayIdx, exIdx, field, value) =>
    patchDay(dayIdx, (d) => ({
      ...d,
      exercises: d.exercises.map((e, j) => (j === exIdx ? { ...e, [field]: value } : e)),
    }));

  const handleSave = async () => {
    if (!planName.trim()) return toast.error('Give the plan a name.');
    if (days.length === 0) return toast.error('Add at least one day.');
    for (const day of days) {
      if (!day.name.trim()) return toast.error('Every day needs a name.');
      if (day.exercises.length === 0) return toast.error(`"${day.name}" has no exercises.`);
    }

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
            sets: parseInt(e.sets, 10) || 1,
            reps: String(e.reps || '1'),
            weight: parseFloat(e.weight) || 0,
            notes: e.notes?.trim() || null,
          })),
        })),
      };
      if (isEdit) await plansApi.update(payload);
      else await plansApi.create(payload);
      toast.success(isEdit ? 'Plan updated.' : 'Plan created.');
      navigate('/plan');
    } catch (err) {
      toast.error(err.message || 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAiGenerate = async (plan) => {
    // Generation can create exercises that didn't exist when this page loaded —
    // that's the point of it — so the catalogue has to be re-read before the
    // ids in the plan are turned back into names. Without this, anything newly
    // created renders as "Exercise #57".
    let catalogue = allExercises;
    try {
      const categories = await exercisesApi.list();
      catalogue = categories.flatMap((c) => c.exercises.map((ex) => ({ ...ex, category: c.category })));
      setAllExercises(catalogue);
    } catch {
      // Fall back to what we already have; worst case a new exercise shows
      // its id until the page is reloaded.
    }

    setPlanName(plan.name);
    setDays(
      plan.days.map((d) => ({
        name: d.name,
        exercises: (d.exercises || []).map((e) => {
          const match = catalogue.find((ex) => ex.id === e.exerciseId);
          return {
            exerciseId: e.exerciseId,
            exerciseName: match?.name ?? `Exercise #${e.exerciseId}`,
            exerciseCategory: match?.category ?? '',
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            notes: e.notes || '',
          };
        }),
      })),
    );
    toast.info('Generated — review it before saving.');
  };

  const filterOptions = (options, { inputValue }) => {
    const input = inputValue.toLowerCase().trim();
    const filtered = options.filter((o) => o.name.toLowerCase().includes(input));
    if (input && !options.some((o) => o.name.toLowerCase() === input)) {
      filtered.push({ isCreate: true, name: inputValue.trim(), category: 'New' });
    }
    return filtered;
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h5">{isEdit ? 'Edit plan' : 'New plan'}</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoAwesomeRounded />}
          onClick={() => setAiDialogOpen(true)}
        >
          Generate
        </Button>
      </Stack>

      <TextField
        fullWidth
        label="Plan name"
        value={planName}
        onChange={(e) => setPlanName(e.target.value)}
        placeholder="e.g. PSMF cut — 6 day"
        sx={{ mb: 3 }}
      />

      {days.map((day, dayIdx) => (
        <Card key={dayIdx} sx={{ mb: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ p: 1.25, borderBottom: `1px solid ${ink.line}` }}
          >
            <TextField
              size="small"
              value={day.name}
              onChange={(e) => patchDay(dayIdx, (d) => ({ ...d, name: e.target.value }))}
              placeholder={`Day ${dayIdx + 1} name`}
              sx={{ flex: 1 }}
            />
            <IconButton
              size="small"
              disabled={dayIdx === 0}
              onClick={() => setDays((prev) => move(prev, dayIdx, dayIdx - 1))}
              aria-label="Move day up"
            >
              <ArrowUpwardRounded fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              disabled={dayIdx === days.length - 1}
              onClick={() => setDays((prev) => move(prev, dayIdx, dayIdx + 1))}
              aria-label="Move day down"
            >
              <ArrowDownwardRounded fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setDays((prev) => prev.filter((_, i) => i !== dayIdx))}
              aria-label="Remove day"
            >
              <DeleteOutlineRounded fontSize="small" />
            </IconButton>
          </Stack>

          {day.exercises.map((ex, exIdx) => (
            <Box key={exIdx} sx={{ p: 1.25, borderBottom: `1px solid ${ink.line}` }}>
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }} noWrap>
                    {ex.exerciseName}
                  </Typography>
                  <Label>{ex.exerciseCategory}</Label>
                </Box>
                <IconButton
                  size="small"
                  disabled={exIdx === 0}
                  onClick={() =>
                    patchDay(dayIdx, (d) => ({ ...d, exercises: move(d.exercises, exIdx, exIdx - 1) }))
                  }
                  aria-label="Move exercise up"
                >
                  <ArrowUpwardRounded sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={exIdx === day.exercises.length - 1}
                  onClick={() =>
                    patchDay(dayIdx, (d) => ({ ...d, exercises: move(d.exercises, exIdx, exIdx + 1) }))
                  }
                  aria-label="Move exercise down"
                >
                  <ArrowDownwardRounded sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() =>
                    patchDay(dayIdx, (d) => ({
                      ...d,
                      exercises: d.exercises.filter((_, j) => j !== exIdx),
                    }))
                  }
                  aria-label="Remove exercise"
                >
                  <DeleteOutlineRounded sx={{ fontSize: 16 }} />
                </IconButton>
              </Stack>

              <Stack direction="row" spacing={0.75} alignItems="flex-end">
                <NumberField
                  label="sets"
                  value={ex.sets}
                  onChange={(v) => updateExercise(dayIdx, exIdx, 'sets', v)}
                  min={1}
                  max={20}
                  width={96}
                />
                {/* Reps stays free text: a plan legitimately says "5-8",
                    "AMRAP" or "8 each side", none of which is a number. */}
                <TextField
                  size="small"
                  label="Reps"
                  value={ex.reps}
                  onChange={(e) => updateExercise(dayIdx, exIdx, 'reps', e.target.value)}
                  placeholder="8"
                  sx={{ width: 84 }}
                  InputLabelProps={{ shrink: true }}
                />
                <NumberField
                  label="kg"
                  value={ex.weight}
                  onChange={(v) => updateExercise(dayIdx, exIdx, 'weight', v)}
                  step={2.5}
                  max={999}
                />
              </Stack>

              <TextField
                fullWidth
                size="small"
                placeholder="Note — cue, tempo, stopping rule"
                value={ex.notes}
                onChange={(e) => updateExercise(dayIdx, exIdx, 'notes', e.target.value)}
                sx={{ mt: 1 }}
              />
            </Box>
          ))}

          <Box sx={{ p: 1.25 }}>
            <Autocomplete
              options={allExercises}
              getOptionLabel={(o) => (o.isCreate ? `Create "${o.name}"` : o.name)}
              groupBy={(o) => o.category}
              filterOptions={filterOptions}
              onChange={(_, val) => handlePick(dayIdx, val)}
              value={null}
              blurOnSelect
              clearOnBlur
              renderInput={(params) => (
                <TextField {...params} size="small" placeholder="Add exercise — search or type a new name" />
              )}
            />
          </Box>
        </Card>
      ))}

      <Button
        fullWidth
        variant="outlined"
        startIcon={<AddRounded />}
        onClick={() => setDays((prev) => [...prev, { name: '', exercises: [] }])}
        sx={{ mb: 2 }}
      >
        Add day
      </Button>

      <Button fullWidth size="large" variant="contained" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create plan'}
      </Button>

      <PlanGenerateDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        onGenerate={handleAiGenerate}
      />

      <Dialog
        open={createDialog.open}
        onClose={() => setCreateDialog({ open: false, name: '', dayIdx: -1 })}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>New exercise: {createDialog.name}</DialogTitle>
        <DialogContent>
          {/* One freeSolo field rather than the old pair of a Select and a
              text box bound to the same state — two controls that fought each
              other and made it unclear which one counted. */}
          <Autocomplete
            freeSolo
            options={categories}
            value={newCategory}
            onChange={(_, v) => setNewCategory(v || '')}
            onInputChange={(_, v) => setNewCategory(v)}
            renderInput={(params) => (
              <TextField {...params} label="Category" placeholder="Chest, Back, Legs…" sx={{ mt: 1 }} autoFocus />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog({ open: false, name: '', dayIdx: -1 })}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateExercise} disabled={!newCategory.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
