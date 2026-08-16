import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  TextField,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Autocomplete,
  LinearProgress,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  HotelRounded,
  AddRounded,
  EventNoteRounded,
  DeleteSweepRounded,
  ExpandMoreRounded,
} from '@mui/icons-material';
import { workoutsApi } from '../api/workouts';
import { exercisesApi } from '../api/exercises';
import ExerciseBlock from '../components/workout/ExerciseBlock';
import { Label, Stat, EmptyState, ListSkeleton } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';
import { useRestTimer } from '../context/rest-timer-context';
import useNow from '../hooks/useNow';
import { ink } from '../theme';
import { volume, volumeLabel, formatDuration, todayInputValue } from '../lib/format';

const DRAFT_KEY = 'liftlog-workout-draft';
const DEFAULT_REST = 120;

let setIdSeq = 0;
const nextSetId = () => `s${Date.now()}_${setIdSeq++}`;

/** Turn an API plan day into the working session shape. */
function buildSession(day) {
  return day.exercises.map((ex) => ({
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName,
    exerciseCategory: ex.exerciseCategory,
    plannedSets: ex.sets,
    plannedReps: ex.reps,
    plannedWeight: ex.weight,
    notes: ex.notes || '',
    lastSessionSets: ex.lastSessionSets || [],
    restSeconds: DEFAULT_REST,
    sets: Array.from({ length: ex.sets }, (_, i) => {
      const prev = ex.lastSessionSets?.[i];
      return {
        id: nextSetId(),
        // Seed from last session where we have it — that's what you're actually
        // trying to match or beat. Fall back to the plan's prescription.
        weight: prev ? Number(prev.weight) : Number(ex.weight) || 0,
        reps: prev ? Number(prev.reps) : parseInt(ex.reps, 10) || 0,
        notes: '',
        done: false,
      };
    }),
  }));
}

export default function LogWorkoutPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const rest = useRestTimer();

  const [nextDay, setNextDay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noPlan, setNoPlan] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([]);
  const [startedAt, setStartedAt] = useState(null);

  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [catalogue, setCatalogue] = useState([]);

  const hydrated = useRef(false);

  useEffect(() => {
    workoutsApi
      .next()
      .then((day) => {
        setNextDay(day);
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          try {
            const draft = JSON.parse(saved);
            if (draft.planDayId === day.planDayId && draft.exercises?.length) {
              setDate(draft.date || todayInputValue());
              setNotes(draft.notes || '');
              setExercises(draft.exercises);
              setStartedAt(draft.startedAt || null);
              setRestored(true);
              return;
            }
          } catch {
            /* corrupt draft — fall through to a fresh session */
          }
        }
        setExercises(buildSession(day));
      })
      .catch((err) => {
        if (err.status === 404) setNoPlan(true);
        else setLoadError(err.message || 'Could not load your next workout.');
      })
      .finally(() => {
        setLoading(false);
        hydrated.current = true;
      });
  }, []);

  // Autosave. Guarded on `hydrated` so the initial empty state can't overwrite
  // a good draft before the fetch resolves.
  useEffect(() => {
    if (!hydrated.current || !nextDay || !exercises.length) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          date,
          notes,
          exercises,
          startedAt,
          planDayId: nextDay.planDayId,
          dayName: nextDay.dayName,
        }),
      );
    } catch {
      /* storage full or blocked — the session still works in memory */
    }
  }, [date, notes, exercises, startedAt, nextDay]);

  const doneCount = useMemo(
    () => exercises.reduce((n, ex) => n + ex.sets.filter((s) => s.done).length, 0),
    [exercises],
  );
  const totalCount = useMemo(() => exercises.reduce((n, ex) => n + ex.sets.length, 0), [exercises]);
  const totalVolume = useMemo(
    () => exercises.reduce((sum, ex) => sum + volume(ex.sets.filter((s) => s.done)), 0),
    [exercises],
  );

  // Elapsed clock, ticking only once work has actually started.
  const now = useNow(!!startedAt);
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;

  // Native "leave site?" prompt if a tab is closed with completed-but-unsaved
  // sets. The draft means nothing is lost either way, but a closed tab is the
  // one exit where we can't say so afterwards.
  useEffect(() => {
    if (doneCount === 0) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [doneCount]);

  const patchExercise = useCallback((exIdx, fn) => {
    setExercises((prev) => prev.map((ex, i) => (i === exIdx ? fn(ex) : ex)));
  }, []);

  const updateSet = useCallback(
    (exIdx, setIdx, patch) => {
      patchExercise(exIdx, (ex) => ({
        ...ex,
        sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)),
      }));
    },
    [patchExercise],
  );

  const toggleDone = useCallback(
    (exIdx, setIdx) => {
      let becameDone = false;
      let restFor = DEFAULT_REST;

      setExercises((prev) =>
        prev.map((ex, i) => {
          if (i !== exIdx) return ex;
          restFor = ex.restSeconds;
          return {
            ...ex,
            sets: ex.sets.map((s, j) => {
              if (j !== setIdx) return s;
              becameDone = !s.done;
              return { ...s, done: becameDone, justLanded: becameDone };
            }),
          };
        }),
      );

      if (becameDone) {
        setStartedAt((t) => t ?? Date.now());
        rest.start(restFor);
        navigator.vibrate?.(15);
      }
      // Drop the one-shot flash flag so re-renders don't replay the animation.
      setTimeout(() => updateSet(exIdx, setIdx, { justLanded: false }), 500);
    },
    [rest, updateSet],
  );

  const addSet = useCallback(
    (exIdx) => {
      patchExercise(exIdx, (ex) => {
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            { id: nextSetId(), weight: last?.weight ?? 0, reps: last?.reps ?? 0, notes: '', done: false },
          ],
        };
      });
    },
    [patchExercise],
  );

  const removeSet = useCallback(
    (exIdx, setIdx) => {
      patchExercise(exIdx, (ex) => ({ ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }));
    },
    [patchExercise],
  );

  const openAddExercise = async () => {
    setAddOpen(true);
    if (catalogue.length) return;
    try {
      const categories = await exercisesApi.list();
      setCatalogue(
        categories.flatMap((c) => c.exercises.map((ex) => ({ ...ex, category: c.category }))),
      );
    } catch {
      toast.error('Could not load the exercise list.');
    }
  };

  const addExercise = (option) => {
    if (!option) return;
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: option.id,
        exerciseName: option.name,
        exerciseCategory: option.category,
        plannedSets: 3,
        plannedReps: '',
        plannedWeight: 0,
        notes: '',
        lastSessionSets: [],
        restSeconds: DEFAULT_REST,
        sets: [{ id: nextSetId(), weight: 0, reps: 0, notes: '', done: false }],
      },
    ]);
    setAddOpen(false);
  };

  const handleSave = async () => {
    setFinishOpen(false);
    setSaving(true);
    try {
      // Only completed sets are submitted. The old screen sent every prefilled
      // row whether or not you did it, so a session you cut short still logged
      // as if you'd finished it — which quietly poisons every chart downstream.
      const sets = exercises.flatMap((ex) =>
        ex.sets
          .filter((s) => s.done)
          .map((s, i) => ({
            exerciseId: ex.exerciseId,
            setNumber: i + 1,
            reps: parseInt(s.reps, 10) || 0,
            weight: parseFloat(s.weight) || 0,
            notes: s.notes?.trim() || null,
          })),
      );

      await workoutsApi.create({
        date,
        notes: notes.trim() || null,
        planDayId: nextDay.planDayId,
        sets,
      });
      localStorage.removeItem(DRAFT_KEY);
      rest.stop();
      toast.success(`${nextDay.dayName} logged — ${sets.length} sets, ${volumeLabel(totalVolume)}`);
      navigate('/workouts');
    } catch (err) {
      toast.error(err.message || 'Could not save the workout. Your session is still here.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestDay = async () => {
    setSaving(true);
    try {
      await workoutsApi.logRest({
        date,
        notes: notes.trim() || null,
        planDayId: nextDay?.planDayId || null,
      });
      localStorage.removeItem(DRAFT_KEY);
      toast.success('Rest day logged.');
      navigate('/workouts');
    } catch (err) {
      toast.error(err.message || 'Could not log the rest day.');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    localStorage.removeItem(DRAFT_KEY);
    rest.stop();
    setExercises(buildSession(nextDay));
    setNotes('');
    setStartedAt(null);
    setRestored(false);
    setDiscardOpen(false);
    toast.info('Session reset.');
  };

  if (loading) return <ListSkeleton count={3} lines={4} />;

  if (noPlan) {
    return (
      <EmptyState
        icon={<EventNoteRounded />}
        title="No active plan"
        description="LiftLog logs against a plan so it knows which day comes next and what you lifted last time."
        action={
          <Button variant="contained" onClick={() => navigate('/plan/edit')}>
            Create a plan
          </Button>
        }
      />
    );
  }

  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load"
        description={loadError}
        action={
          <Button variant="outlined" onClick={() => window.location.reload()}>
            Try again
          </Button>
        }
      />
    );
  }

  const pct = totalCount ? (doneCount / totalCount) * 100 : 0;

  return (
    // Extra bottom room so the finish button clears the rest timer bar when
    // one is running.
    <Box sx={{ pb: 10 }}>
      {/* Sticky session header: what day, how far in, how long, how much.
          Pinned because these are the numbers you glance at between sets. */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          bgcolor: ink.ground,
          borderBottom: `1px solid ${ink.line}`,
          mx: -2,
          px: 2,
          pt: 0.5,
          pb: 1,
          mb: 2,
        }}
      >
        <Stack direction="row" alignItems="baseline" justifyContent="space-between">
          <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
            {nextDay.dayName}
          </Typography>
          <IconButton size="small" onClick={() => setMetaOpen((o) => !o)} aria-label="Date and session notes">
            <ExpandMoreRounded
              sx={{ transform: metaOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}
            />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={3} sx={{ mt: 1 }}>
          <Stat label="Sets" value={`${doneCount}/${totalCount}`} accent={doneCount > 0} />
          <Stat label="Volume" value={volumeLabel(totalVolume)} />
          <Stat label="Elapsed" value={startedAt ? formatDuration(elapsed) : '—'} />
        </Stack>

        <LinearProgress variant="determinate" value={pct} sx={{ mt: 1 }} />

        <Collapse in={metaOpen}>
          <Stack spacing={1.5} sx={{ mt: 2, mb: 0.5 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              size="small"
              label="Session notes"
              placeholder="Sleep, food, how it felt"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={2}
            />
          </Stack>
        </Collapse>
      </Box>

      {restored && (
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 2, p: 1, border: `1px solid ${ink.line}`, bgcolor: ink.surface }}
        >
          <Label sx={{ flex: 1 }}>Resumed where you left off</Label>
          <Button size="small" onClick={() => setDiscardOpen(true)}>
            Start over
          </Button>
        </Stack>
      )}

      {exercises.map((ex, i) => (
        <ExerciseBlock
          key={`${ex.exerciseId}-${i}`}
          exercise={ex}
          onUpdateSet={(setIdx, patch) => updateSet(i, setIdx, patch)}
          onToggleDone={(setIdx) => toggleDone(i, setIdx)}
          onAddSet={() => addSet(i)}
          onRemoveSet={(setIdx) => removeSet(i, setIdx)}
          onRemoveExercise={() => setExercises((prev) => prev.filter((_, j) => j !== i))}
          onSetRest={(s) => patchExercise(i, (e) => ({ ...e, restSeconds: s }))}
        />
      ))}

      <Button fullWidth variant="outlined" startIcon={<AddRounded />} onClick={openAddExercise} sx={{ mb: 2 }}>
        Add exercise
      </Button>

      <Stack spacing={1}>
        <Button
          fullWidth
          size="large"
          variant="contained"
          disabled={saving || doneCount === 0}
          onClick={() => setFinishOpen(true)}
        >
          {doneCount === 0 ? 'Complete a set to finish' : `Finish — ${doneCount} sets`}
        </Button>
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<HotelRounded />}
            onClick={handleRestDay}
            disabled={saving}
          >
            Rest day
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<DeleteSweepRounded />}
            onClick={() => setDiscardOpen(true)}
            disabled={saving}
          >
            Reset
          </Button>
        </Stack>
      </Stack>

      <Dialog open={finishOpen} onClose={() => setFinishOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Finish {nextDay.dayName}?</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
            <Stat label="Sets" value={doneCount} accent />
            <Stat label="Volume" value={volumeLabel(totalVolume)} />
            <Stat label="Time" value={startedAt ? formatDuration(elapsed) : '—'} />
          </Stack>
          {doneCount < totalCount && (
            <DialogContentText sx={{ fontSize: '0.85rem' }}>
              {totalCount - doneCount} planned {totalCount - doneCount === 1 ? 'set is' : 'sets are'} unticked
              and won't be logged.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFinishOpen(false)}>Keep going</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Finish'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)}>
        <DialogTitle>Reset this session?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.9rem' }}>
            Everything you've ticked is cleared and the day resets to its planned sets. Nothing already
            saved is affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDiscardOpen(false)}>Cancel</Button>
          <Button color="primary" onClick={discard}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add exercise</DialogTitle>
        <DialogContent>
          <Autocomplete
            autoFocus
            options={catalogue}
            groupBy={(o) => o.category}
            getOptionLabel={(o) => o.name}
            onChange={(_, v) => addExercise(v)}
            renderInput={(params) => (
              <TextField {...params} label="Search" placeholder="Type to filter" sx={{ mt: 1 }} />
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            Added for this session only — your plan isn't changed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
