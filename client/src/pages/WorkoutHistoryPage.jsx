import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, Stack, Typography, Tooltip } from '@mui/material';
import { PlayArrowRounded, ListAltRounded } from '@mui/icons-material';
import WorkoutCard from '../components/workout/WorkoutCard';
import { Label, SectionHeader, EmptyState, ListSkeleton, Stat } from '../components/ui/Bits';
import { workoutsApi } from '../api/workouts';
import { useToast } from '../components/ui/toast-context';
import { ink } from '../theme';
import { summariseSets, volumeLabel, relativeDay } from '../lib/format';

const PAGE_SIZE = 20;

/** Last seven days as dots. The cheapest possible "am I actually showing up". */
function WeekStrip({ workouts }) {
  const days = useMemo(() => {
    const byDay = new Map();
    for (const w of workouts) {
      const d = new Date(w.date);
      byDay.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, w);
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const hit = byDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      return {
        letter: d.toLocaleDateString(undefined, { weekday: 'narrow' }),
        date: d,
        session: hit,
      };
    });
  }, [workouts]);

  const trained = days.filter((d) => d.session && !d.session.isRestDay).length;

  return (
    <Card sx={{ p: 1.5, mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Stat label="Sessions / 7d" value={trained} accent={trained > 0} sx={{ flexShrink: 0 }} />
        <Stack direction="row" spacing={0.75} sx={{ pt: 0.5 }}>
          {days.map((d, i) => {
            const trainedDay = d.session && !d.session.isRestDay;
            const restDay = d.session?.isRestDay;
            return (
              <Tooltip
                key={i}
                title={d.session ? d.session.planDayName || 'Logged' : d.date.toLocaleDateString()}
              >
                <Box sx={{ textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      border: `1px solid ${trainedDay ? ink.accent : ink.line}`,
                      bgcolor: trainedDay ? ink.accent : restDay ? ink.lineBright : 'transparent',
                    }}
                  />
                  <Label sx={{ fontSize: '0.55rem', mt: 0.25, letterSpacing: '0.05em' }}>{d.letter}</Label>
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}

/** What's next, with last session's numbers already visible. */
function UpNext() {
  const navigate = useNavigate();
  const [day, setDay] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    workoutsApi
      .next()
      .then((d) => {
        setDay(d);
        setState('ready');
      })
      .catch(() => setState('none'));
  }, []);

  if (state === 'loading') return <ListSkeleton count={1} lines={4} />;
  if (state === 'none' || !day) {
    return (
      <Card sx={{ p: 2, mb: 3 }}>
        <Label>No plan yet</Label>
        <Typography sx={{ fontWeight: 700, mt: 0.5, mb: 1.5 }}>
          Set up a plan and LiftLog handles the rest.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/plan/edit')}>
          Create a plan
        </Button>
      </Card>
    );
  }

  return (
    <Card sx={{ mb: 3, borderColor: ink.lineBright }}>
      <Box sx={{ p: 2, pb: 1.5 }}>
        <Label sx={{ color: 'primary.main' }}>Up next</Label>
        <Typography variant="h4" sx={{ fontSize: '1.6rem', mt: 0.5, mb: 1.5 }}>
          {day.dayName}
        </Typography>

        <Stack spacing={0.75}>
          {day.exercises.map((ex, i) => {
            const last = summariseSets(ex.lastSessionSets);
            return (
              <Stack key={i} direction="row" justifyContent="space-between" alignItems="baseline" spacing={1}>
                <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, minWidth: 0 }} noWrap>
                  {ex.exerciseName}
                </Typography>
                <Label sx={{ whiteSpace: 'nowrap', color: last ? 'text.secondary' : ink.lineBright }}>
                  {last || `${ex.sets}×${ex.reps}`}
                </Label>
              </Stack>
            );
          })}
        </Stack>
      </Box>
      <Button
        fullWidth
        size="large"
        variant="contained"
        startIcon={<PlayArrowRounded />}
        onClick={() => navigate('/workouts/log')}
      >
        Start
      </Button>
    </Card>
  );
}

export default function WorkoutHistoryPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    workoutsApi
      .list(page, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        // Append rather than replace: paging back to the top to read older
        // sessions is a desktop-table idea, not a phone one.
        setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
        setTotal(data.totalCount);
      })
      .catch((err) => !cancelled && toast.error(err.message || 'Could not load your history.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // toast is stable for the life of the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalVolume = useMemo(
    () => items.slice(0, 30).reduce((sum, w) => sum + Number(w.volume || 0), 0),
    [items],
  );

  const hasMore = items.length < total;

  return (
    <Box>
      <UpNext />

      {items.length > 0 && <WeekStrip workouts={items} />}

      <SectionHeader
        action={
          items.length > 0 ? (
            <Label sx={{ whiteSpace: 'nowrap' }}>{total} logged</Label>
          ) : null
        }
      >
        History
      </SectionHeader>

      {loading && page === 1 ? (
        <ListSkeleton count={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ListAltRounded />}
          title="Nothing logged yet"
          description="Your first session shows up here the moment you finish it."
        />
      ) : (
        <>
          {items.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}

          {hasMore && (
            <Button fullWidth variant="outlined" disabled={loading} onClick={() => setPage((p) => p + 1)} sx={{ mt: 1 }}>
              {loading ? 'Loading…' : `Load older (${total - items.length} left)`}
            </Button>
          )}

          {totalVolume > 0 && (
            <Typography sx={{ mt: 2, textAlign: 'center', color: 'text.secondary', fontSize: '0.75rem' }}>
              {volumeLabel(totalVolume)} moved across your last {Math.min(items.length, 30)} sessions
              {items[0] && ` · most recent ${relativeDay(items[0].date).toLowerCase()}`}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
