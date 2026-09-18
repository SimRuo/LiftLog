import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, Stack, Typography, Tooltip } from '@mui/material';
import { PlayArrowRounded, ListAltRounded } from '@mui/icons-material';
import WorkoutCard from '../components/workout/WorkoutCard';
import CardioCard from '../components/cardio/CardioCard';
import { Label, SectionHeader, EmptyState, ListSkeleton, Stat } from '../components/ui/Bits';
import { workoutsApi } from '../api/workouts';
import { onOutboxChange } from '../offline/store';
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
                title={
                  d.session
                    ? d.session.activityName || d.session.planDayName || 'Logged'
                    : d.date.toLocaleDateString()
                }
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

/** What's next, with last session's numbers already visible.
 *  `refreshKey` changes when the outbox does, because a session uploading is
 *  exactly the thing that moves this card on to the following day. */
function UpNext({ refreshKey }) {
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
      // A dead connection isn't a missing plan. Telling someone to create one
      // they already have is worse than saying nothing useful is on the device.
      .catch((err) => setState(err.status === 0 ? 'offline' : 'none'));
  }, [refreshKey]);

  if (state === 'loading') return <ListSkeleton count={1} lines={4} />;
  if (state === 'offline') {
    return (
      <Card sx={{ p: 2, mb: 3 }}>
        <Label>Offline</Label>
        <Typography sx={{ fontWeight: 700, mt: 0.5 }}>
          Your plan hasn't been saved to this device yet.
        </Typography>
        <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mt: 0.5 }}>
          Open LiftLog once with a connection and it'll be here next time.
        </Typography>
      </Card>
    );
  }
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
  const [pendingItems, setPendingItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);

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
        setLoadFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadFailed(true);
        toast.error(err.message || 'Could not load your history.');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // toast is stable for the life of the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reload]);

  // Sessions logged on this device that haven't uploaded yet, kept in step with
  // the queue itself rather than polled.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      workoutsApi.pendingSummaries().then((rows) => !cancelled && setPendingItems(rows));

    load();
    const unsubscribe = onOutboxChange(() => {
      load();
      // A session that just uploaded now exists on the server, so the list it
      // was merged into is stale. Start the window over rather than append to
      // it — appending a refetched page 3 onto pages 1-3 would duplicate rows.
      setPage(1);
      setReload((n) => n + 1);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Pending writes belong in the same list as everything else — a session you
  // just finished is the one you most want to see, and hiding it until it
  // uploads reads as if it wasn't saved. Sorted with the rest by date, and
  // ahead of a server row on the same day since it is by definition newer.
  const visible = useMemo(() => {
    const merged = [...pendingItems, ...items];
    return merged.sort((a, b) => {
      const byDate = String(b.date).localeCompare(String(a.date));
      if (byDate !== 0) return byDate;
      return (b.pendingSync ? 1 : 0) - (a.pendingSync ? 1 : 0);
    });
  }, [pendingItems, items]);

  const lifted = useMemo(
    () => visible.filter((w) => Number(w.volume || 0) > 0).slice(0, 30),
    [visible],
  );
  const totalVolume = useMemo(
    () => lifted.reduce((sum, w) => sum + Number(w.volume), 0),
    [lifted],
  );

  // Nothing more to page through once the server list is exhausted — or once
  // it has failed, where paging would only produce the same error again.
  const hasMore = !loadFailed && items.length < total;

  return (
    <Box>
      <UpNext refreshKey={reload} />

      {visible.length > 0 && <WeekStrip workouts={visible} />}

      <SectionHeader
        action={
          visible.length > 0 ? (
            <Label sx={{ whiteSpace: 'nowrap' }}>{total + pendingItems.length} logged</Label>
          ) : null
        }
      >
        History
      </SectionHeader>

      {loading && page === 1 ? (
        <ListSkeleton count={4} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ListAltRounded />}
          title="Nothing logged yet"
          description="Your first session shows up here the moment you finish it."
        />
      ) : (
        <>
          {visible.map((w) =>
            w.kind === 'cardio' ? (
              <CardioCard key={`cardio-${w.id}`} session={w} />
            ) : (
              <WorkoutCard key={`lift-${w.id}`} workout={w} />
            ),
          )}

          {hasMore && (
            <Button fullWidth variant="outlined" disabled={loading} onClick={() => setPage((p) => p + 1)} sx={{ mt: 1 }}>
              {loading ? 'Loading…' : `Load older (${total - items.length} left)`}
            </Button>
          )}

          {totalVolume > 0 && (
            <Typography sx={{ mt: 2, textAlign: 'center', color: 'text.secondary', fontSize: '0.75rem' }}>
              {volumeLabel(totalVolume)} moved across your last {lifted.length} lifting sessions
              {items[0] && ` · most recent ${relativeDay(items[0].date).toLowerCase()}`}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
