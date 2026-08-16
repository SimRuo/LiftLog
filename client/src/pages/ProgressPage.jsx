import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  Autocomplete,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Stack,
  Skeleton,
} from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { ShowChartRounded } from '@mui/icons-material';
import { exercisesApi } from '../api/exercises';
import { progressApi } from '../api/progress';
import { Label, Stat, EmptyState, SectionHeader } from '../components/ui/Bits';
import { useToast } from '../components/ui/toast-context';
import { ink } from '../theme';
import { kg, shortDate } from '../lib/format';

const METRICS = [
  { key: 'estimated1RM', label: 'Est. 1RM', unit: 'kg' },
  { key: 'maxWeight', label: 'Top set', unit: 'kg' },
  { key: 'totalVolume', label: 'Volume', unit: 'kg' },
];

const RANGES = [
  { key: 90, label: '3M' },
  { key: 180, label: '6M' },
  { key: 365, label: '1Y' },
  { key: 0, label: 'All' },
];

const LAST_KEY = 'liftlog.progress.exercise';

export default function ProgressPage() {
  const toast = useToast();
  const [exercises, setExercises] = useState([]);
  const [selected, setSelected] = useState(null);
  const [metric, setMetric] = useState('estimated1RM');
  const [range, setRange] = useState(180);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    exercisesApi
      .list()
      .then((categories) => {
        const flat = categories.flatMap((c) => c.exercises.map((ex) => ({ ...ex, category: c.category })));
        setExercises(flat);
        // Reopen on whatever you were last looking at. Re-picking your main
        // lift from a dropdown every single visit is pure friction.
        const lastId = Number(localStorage.getItem(LAST_KEY));
        setSelected(flat.find((ex) => ex.id === lastId) || null);
      })
      .catch((err) => toast.error(err.message || 'Could not load exercises.'))
      .finally(() => setInitialising(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    localStorage.setItem(LAST_KEY, String(selected.id));
    setLoading(true);
    progressApi
      .get(selected.id, metric)
      .then(setData)
      .catch((err) => toast.error(err.message || 'Could not load progress.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, metric]);

  const points = useMemo(() => {
    const cutoff = range ? Date.now() - range * 86_400_000 : 0;
    return data
      .map((d) => ({ date: new Date(d.date), value: Number(d.value) }))
      .filter((d) => d.date.getTime() >= cutoff)
      .sort((a, b) => a.date - b.date);
  }, [data, range]);

  const meta = METRICS.find((m) => m.key === metric);

  // Best, latest, and the change between first and last point in view. The
  // delta is the number you actually came here for; a line alone makes you
  // squint at two ends of a chart to work it out.
  const summary = useMemo(() => {
    if (points.length === 0) return null;
    const best = Math.max(...points.map((p) => p.value));
    const latest = points[points.length - 1].value;
    const first = points[0].value;
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;
    return { best, latest, change, sessions: points.length };
  }, [points]);

  if (initialising) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={280} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Progress
      </Typography>

      <Autocomplete
        options={exercises}
        value={selected}
        onChange={(_, v) => setSelected(v)}
        groupBy={(o) => o.category}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => <TextField {...params} label="Exercise" placeholder="Search your lifts" />}
        sx={{ mb: 2 }}
      />

      {!selected ? (
        <EmptyState
          icon={<ShowChartRounded />}
          title="Pick a lift"
          description="Choose an exercise to see how it has moved over time."
        />
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={metric}
              onChange={(_, v) => v && setMetric(v)}
              sx={{ flex: 1 }}
            >
              {METRICS.map((m) => (
                <ToggleButton key={m.key} value={m.key} sx={{ flex: 1 }}>
                  {m.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={range}
            onChange={(_, v) => v !== null && setRange(v)}
            sx={{ mb: 2, width: '100%' }}
          >
            {RANGES.map((r) => (
              <ToggleButton key={r.key} value={r.key} sx={{ flex: 1 }}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {loading ? (
            <Skeleton variant="rectangular" height={300} />
          ) : points.length === 0 ? (
            <EmptyState
              title="No data in this range"
              description={`Nothing logged for ${selected.name} here. Try a wider range.`}
            />
          ) : (
            <>
              {summary && (
                <Card sx={{ p: 2, mb: 2 }}>
                  <Stack direction="row" spacing={3}>
                    <Stat label="Latest" value={kg(summary.latest)} unit={meta.unit} accent />
                    <Stat label="Best" value={kg(summary.best)} unit={meta.unit} />
                    <Stat
                      label="Change"
                      value={`${summary.change >= 0 ? '+' : ''}${summary.change.toFixed(1)}%`}
                    />
                  </Stack>
                </Card>
              )}

              <Card sx={{ p: 1, pt: 2 }}>
                <LineChart
                  xAxis={[
                    {
                      data: points.map((p) => p.date),
                      scaleType: 'time',
                      valueFormatter: (d) => shortDate(d),
                    },
                  ]}
                  series={[
                    {
                      data: points.map((p) => p.value),
                      label: meta.label,
                      color: ink.accent,
                      showMark: points.length < 40,
                      valueFormatter: (v) => `${kg(v)} ${meta.unit}`,
                    },
                  ]}
                  height={300}
                  margin={{ left: 52, right: 16, top: 16, bottom: 28 }}
                  grid={{ horizontal: true }}
                  // One series, and the metric is already named on the toggle
                  // above — a legend would just repeat it and eat chart height.
                  hideLegend
                  sx={{
                    '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: ink.line },
                    '& .MuiChartsAxis-tickLabel': { fill: ink.dim, fontSize: 11 },
                    '& .MuiChartsGrid-line': { stroke: ink.line },
                  }}
                />
              </Card>

              <SectionHeader>Sessions</SectionHeader>
              <Card>
                {[...points]
                  .reverse()
                  .slice(0, 12)
                  .map((p, i, arr) => {
                    const prev = arr[i + 1];
                    const delta = prev ? p.value - prev.value : 0;
                    return (
                      <Stack
                        key={p.date.getTime()}
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ px: 1.5, py: 1, borderTop: i ? `1px solid ${ink.line}` : 'none' }}
                      >
                        <Label>{shortDate(p.date)}</Label>
                        <Stack direction="row" spacing={1.5} alignItems="baseline">
                          {prev && delta !== 0 && (
                            <Label sx={{ color: delta > 0 ? 'secondary.main' : 'text.secondary' }}>
                              {delta > 0 ? '+' : ''}
                              {kg(delta)}
                            </Label>
                          )}
                          <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {kg(p.value)}
                            <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.72rem', ml: 0.4 }}>
                              {meta.unit}
                            </Typography>
                          </Typography>
                        </Stack>
                      </Stack>
                    );
                  })}
              </Card>
            </>
          )}
        </>
      )}
    </Box>
  );
}
