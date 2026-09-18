import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  FavoriteRounded,
  AddRounded,
  ArrowBackRounded,
  ExpandMoreRounded,
} from '@mui/icons-material';
import { cardioApi } from '../api/cardio';
import { Label, SectionHeader, EmptyState, ListSkeleton, Stat } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';
import DurationField from '../components/cardio/DurationField';
import RpeSelector from '../components/cardio/RpeSelector';
import CircuitLogger from '../components/cardio/CircuitLogger';
import CircuitBuilder from '../components/cardio/CircuitBuilder';
import { ink } from '../theme';
import { todayInputValue, clock, km, pace, relativeDay } from '../lib/format';

const DRAFT_KEY = 'liftlog-cardio-draft';

/** Blank form state for an activity. */
function emptyEntry() {
  return { minutes: '', seconds: '', distanceKm: '', rpe: null, notes: '', splits: {} };
}

/** mm:ss pair from a splits row into whole seconds, or null if left blank. */
function splitSeconds(split) {
  const total = (parseInt(split?.minutes, 10) || 0) * 60 + (parseInt(split?.seconds, 10) || 0);
  return total > 0 ? total : null;
}

export default function CardioPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [recent, setRecent] = useState([]);

  const [activity, setActivity] = useState(null);
  const [entry, setEntry] = useState(emptyEntry);
  const [date, setDate] = useState(todayInputValue());
  const [metaOpen, setMetaOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState('distance');
  const [builderOpen, setBuilderOpen] = useState(false);

  useEffect(() => {
    Promise.all([cardioApi.activities(), cardioApi.list(1, 3).catch(() => null)])
      .then(([list, history]) => {
        setActivities(list);
        setRecent(history?.items ?? []);
      })
      .catch((err) => setLoadError(err.message || 'Could not load cardio activities.'))
      .finally(() => setLoading(false));
  }, []);

  // A half-filled entry survives a reload or an accidental back-swipe, the same
  // way a lifting session does. Only the numbers are kept — the chosen activity
  // is cheap to re-tap and pinning it would be more confusing than helpful.
  useEffect(() => {
    if (!activity) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ activityId: activity.id, entry, date }));
    } catch {
      /* storage full or blocked — the form still works in memory */
    }
  }, [activity, entry, date]);

  useEffect(() => {
    if (activities.length === 0) return;
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      const match = draft && activities.find((a) => a.id === draft.activityId);
      if (match) {
        setActivity(match);
        setEntry({ ...emptyEntry(), ...draft.entry });
        setDate(draft.date || todayInputValue());
      }
    } catch {
      /* corrupt draft — start clean */
    }
  }, [activities]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* nothing to clean up */
    }
  }, []);

  const patch = (key, value) => setEntry((prev) => ({ ...prev, [key]: value }));

  const durationSeconds =
    (parseInt(entry.minutes, 10) || 0) * 60 + (parseInt(entry.seconds, 10) || 0);
  const distanceMeters = entry.distanceKm ? Math.round(parseFloat(entry.distanceKm) * 1000) : null;
  const livePace =
    activity?.mode === 'distance' ? pace(durationSeconds, distanceMeters) : null;

  const back = () => {
    setActivity(null);
    setEntry(emptyEntry());
    setDate(todayInputValue());
    clearDraft();
  };

  const save = async () => {
    if (durationSeconds <= 0) {
      toast.error('How long was it?');
      return;
    }
    setSaving(true);
    try {
      const saved = await cardioApi.create(
        {
          cardioActivityId: activity.id,
          date,
          durationSeconds,
          distanceMeters: activity.mode === 'distance' ? distanceMeters : null,
          rpe: entry.rpe,
          notes: entry.notes.trim() || null,
          // Sent for every station, split or not: the row has to exist for the
          // attempt comparison to line up station against station.
          segments:
            activity.mode === 'circuit'
              ? activity.steps.map((step, i) => ({
                  cardioActivityId: step.activityId,
                  durationSeconds: splitSeconds(entry.splits[i]),
                  distanceMeters: step.targetDistanceMeters ?? null,
                  reps: step.targetReps ?? null,
                }))
              : [],
        },
        { activityName: activity.name, activityMode: activity.mode },
      );
      clearDraft();
      toast.success(
        saved?.pendingSync
          ? `${activity.name} saved on this device — it uploads when you're back online.`
          : `${activity.name} logged — ${clock(durationSeconds)}${livePace ? ` at ${livePace}/km` : ''}`,
      );
      navigate('/workouts');
    } catch (err) {
      toast.error(err.message || 'Could not save that session.');
    } finally {
      setSaving(false);
    }
  };

  const addActivity = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await cardioApi.createActivity({ name, mode: newMode });
      setActivities((prev) =>
        prev.some((a) => a.id === created.id) ? prev : [created, ...prev],
      );
      setActivity(created);
      setNewOpen(false);
      setNewName('');
    } catch (err) {
      toast.error(err.message || 'Could not add that activity.');
    }
  };

  const grouped = useMemo(() => {
    const plain = activities.filter((a) => a.mode !== 'circuit');
    return {
      circuits: activities.filter((a) => a.mode === 'circuit'),
      used: plain.filter((a) => a.lastUsed),
      rest: plain.filter((a) => !a.lastUsed),
    };
  }, [activities]);

  const addCircuit = async (payload) => {
    const created = await cardioApi.createCircuit(payload);
    setActivities((prev) => [created, ...prev]);
    setBuilderOpen(false);
    setActivity(created);
  };

  if (loading) return <ListSkeleton count={3} lines={3} />;

  if (loadError) {
    return (
      <EmptyState
        icon={<FavoriteRounded />}
        title="Couldn't load cardio"
        description={loadError}
      />
    );
  }

  // ---- Step 2: log the chosen activity ------------------------------------
  if (activity) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <IconButton onClick={back} size="small" sx={{ ml: -0.5 }} aria-label="Back to activities">
            <ArrowBackRounded />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Label>Logging</Label>
            <Typography variant="h4" sx={{ fontSize: '1.5rem' }} noWrap>
              {activity.name}
            </Typography>
          </Box>
        </Stack>

        {activity.mode === 'circuit' ? (
          <CircuitLogger steps={activity.steps} value={entry} onChange={setEntry} />
        ) : (
        <Card sx={{ p: 2, mb: 2 }}>
          <Stack spacing={2.5}>
            <Box>
              <Label sx={{ mb: 0.75 }}>Duration</Label>
              <DurationField
                minutes={entry.minutes}
                seconds={entry.seconds}
                onChange={patch}
                autoFocus
              />
            </Box>

            {activity.mode === 'distance' && (
              <Box>
                <Label sx={{ mb: 0.75 }}>Distance</Label>
                <TextField
                  fullWidth
                  type="number"
                  value={entry.distanceKm}
                  onChange={(e) => patch('distanceKm', e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  inputProps={{
                    inputMode: 'decimal',
                    step: '0.01',
                    min: 0,
                    style: { fontSize: '1.4rem', fontWeight: 700 },
                  }}
                  InputProps={{ endAdornment: <Label>km</Label> }}
                />
              </Box>
            )}

            <RpeSelector value={entry.rpe} onChange={(rpe) => patch('rpe', rpe)} />
          </Stack>
        </Card>
        )}

        {/* The number the session is actually judged on, shown while typing so
            you can see it land rather than working it out afterwards. */}
        {livePace && (
          <Card sx={{ p: 2, mb: 2, borderColor: ink.lineBright }}>
            <Stack direction="row" spacing={3}>
              <Stat label="Pace" value={livePace} unit="/km" accent />
              <Stat label="Time" value={clock(durationSeconds)} />
              {distanceMeters > 0 && <Stat label="Distance" value={km(distanceMeters)} />}
            </Stack>
          </Card>
        )}

        <Card sx={{ mb: 2 }}>
          <Button
            fullWidth
            onClick={() => setMetaOpen((o) => !o)}
            endIcon={
              <ExpandMoreRounded
                sx={{ transform: metaOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
              />
            }
            sx={{ justifyContent: 'space-between', px: 2, py: 1.25, color: 'text.secondary' }}
          >
            <Label>Date and notes</Label>
          </Button>
          <Collapse in={metaOpen}>
            <Stack spacing={2} sx={{ p: 2, pt: 0 }}>
              <TextField
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Notes"
                value={entry.notes}
                onChange={(e) => patch('notes', e.target.value)}
                placeholder="Treadmill, 1% incline"
                multiline
                minRows={2}
                fullWidth
              />
            </Stack>
          </Collapse>
        </Card>

        <Button
          fullWidth
          size="large"
          variant="contained"
          disabled={saving || durationSeconds <= 0}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Log session'}
        </Button>
      </Box>
    );
  }

  // ---- Step 1: pick an activity -------------------------------------------
  const tile = (a) => (
    <Card
      key={a.id}
      onClick={() => setActivity(a)}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        '&:hover': { borderColor: ink.lineBright },
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }} noWrap>
        {a.name}
      </Typography>
      <Label sx={{ mt: 0.25, color: a.lastUsed ? 'text.secondary' : ink.lineBright }}>
        {a.lastUsed ? relativeDay(a.lastUsed) : a.mode === 'distance' ? 'Distance' : 'Time'}
      </Label>
    </Card>
  );

  return (
    <Box>
      <SectionHeader
        action={
          <Button size="small" startIcon={<AddRounded />} onClick={() => setNewOpen(true)}>
            New
          </Button>
        }
      >
        Cardio
      </SectionHeader>

      {recent.length > 0 && (
        <Card sx={{ p: 1.5, mb: 2 }}>
          <Label sx={{ mb: 0.75 }}>Last sessions</Label>
          <Stack spacing={0.5}>
            {recent.map((s) => (
              <Stack key={s.id} direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, minWidth: 0 }} noWrap>
                  {s.activityName}
                </Typography>
                <Label sx={{ whiteSpace: 'nowrap' }}>
                  {clock(s.durationSeconds)}
                  {s.distanceMeters > 0 ? ` · ${km(s.distanceMeters)}` : ''}
                </Label>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Label>Circuits</Label>
        <Button size="small" onClick={() => setBuilderOpen(true)} sx={{ color: 'text.secondary' }}>
          Build one
        </Button>
      </Stack>
      {grouped.circuits.length === 0 ? (
        <Card sx={{ p: 1.5, mb: 2.5 }}>
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            A circuit is an ordered set of stations — a Hyrox, or your own run/sled sequence. Build
            one once and every attempt is comparable.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1} sx={{ mb: 2.5 }}>
          {grouped.circuits.map((c) => (
            <Card
              key={c.id}
              onClick={() => setActivity(c)}
              sx={{ p: 1.5, cursor: 'pointer', '&:hover': { borderColor: ink.lineBright } }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                <Typography sx={{ fontWeight: 800 }} noWrap>
                  {c.name}
                </Typography>
                <Label sx={{ whiteSpace: 'nowrap' }}>
                  {c.lastUsed ? relativeDay(c.lastUsed) : `${c.steps.length} stations`}
                </Label>
              </Stack>
              <Label sx={{ mt: 0.25, color: 'text.secondary' }} component="div">
                {c.steps
                  .slice(0, 4)
                  .map((step) => step.activityName)
                  .join(' → ')}
                {c.steps.length > 4 ? ` → +${c.steps.length - 4}` : ''}
              </Label>
            </Card>
          ))}
        </Stack>
      )}

      {grouped.used.length > 0 && (
        <>
          <Label sx={{ mb: 1 }}>Recent</Label>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2.5 }}>
            {grouped.used.map(tile)}
          </Box>
        </>
      )}

      <Label sx={{ mb: 1 }}>{grouped.used.length > 0 ? 'Everything else' : 'Pick an activity'}</Label>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {grouped.rest.map(tile)}
      </Box>

      <CircuitBuilder
        open={builderOpen}
        activities={activities}
        onClose={() => setBuilderOpen(false)}
        onCreate={addCircuit}
      />

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New activity</DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              fullWidth
            />
            <Box>
              <Label sx={{ mb: 0.75 }}>How is it measured?</Label>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={newMode}
                onChange={(_, v) => v && setNewMode(v)}
                size="small"
              >
                <ToggleButton value="distance">Distance</ToggleButton>
                <ToggleButton value="time">Time only</ToggleButton>
              </ToggleButtonGroup>
              <Typography sx={{ mt: 0.75, fontSize: '0.76rem', color: 'text.secondary' }}>
                {newMode === 'distance'
                  ? 'Records distance too, so progress can be tracked as pace.'
                  : 'Duration only — for anything that does not cover ground.'}
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={addActivity} disabled={!newName.trim()}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
