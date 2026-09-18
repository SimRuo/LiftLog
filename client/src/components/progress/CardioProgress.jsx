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
import { FavoriteRounded } from '@mui/icons-material';
import { cardioApi } from '../../api/cardio';
import { Label, Stat, EmptyState, SectionHeader } from '../ui/Bits';
import { useToast } from '../ui/toast-context';
import { ink } from '../../theme';
import { shortDate, clock, km } from '../../lib/format';
import CircuitSplits from './CircuitSplits';

const RANGES = [
  { key: 90, label: '3M' },
  { key: 180, label: '6M' },
  { key: 365, label: '1Y' },
  { key: 0, label: 'All' },
];

const LAST_KEY = 'liftlog.progress.activity';

/** mm:ss from seconds-per-kilometre. */
const paceText = (secondsPerKm) =>
  `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, '0')}`;

/**
 * Cardio metrics, and the one thing that makes them different from lifting:
 * `lowerIsBetter`. On a pace chart a falling line is an improvement, so the
 * summary has to invert both which extreme counts as "best" and which
 * direction of change gets the accent colour.
 */
const METRICS = [
  {
    key: 'pace',
    label: 'Pace',
    unit: '/km',
    lowerIsBetter: true,
    format: paceText,
    distanceOnly: true,
  },
  { key: 'distance', label: 'Distance', unit: '', lowerIsBetter: false, format: km, distanceOnly: true },
  { key: 'duration', label: 'Time', unit: '', lowerIsBetter: false, format: clock },
  // Circuits only: best total of the day, where a falling line is an improvement.
  { key: 'total', label: 'Total time', unit: '', lowerIsBetter: true, format: clock, circuitOnly: true },
  { key: 'effort', label: 'Effort', unit: '/10', lowerIsBetter: true, format: (v) => v.toFixed(1) },
];

export default function CardioProgress() {
  const toast = useToast();
  const [activities, setActivities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [metric, setMetric] = useState('pace');
  const [range, setRange] = useState(180);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);

  useEffect(() => {
    cardioApi
      .activities()
      .then((list) => {
        setActivities(list);
        const lastId = Number(localStorage.getItem(LAST_KEY));
        // Fall back to whatever was done most recently — the list already
        // arrives in that order.
        setSelected(list.find((a) => a.id === lastId) || list.find((a) => a.lastUsed) || null);
      })
      .catch((err) => toast.error(err.message || 'Could not load cardio activities.'))
      .finally(() => setInitialising(false));
    // toast is stable for the life of the provider
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A time-only activity has no pace or distance to chart, so a metric carried
  // over from a previous selection has to give way.
  const isCircuit = selected?.mode === 'circuit';
  const available = useMemo(() => {
    if (isCircuit) return METRICS.filter((m) => m.circuitOnly || m.key === 'effort');
    return METRICS.filter((m) => !m.circuitOnly && (!m.distanceOnly || selected?.mode === 'distance'));
  }, [selected, isCircuit]);

  useEffect(() => {
    if (!available.some((m) => m.key === metric)) setMetric(available[0]?.key ?? 'duration');
  }, [available, metric]);

  useEffect(() => {
    if (!selected) return;
    localStorage.setItem(LAST_KEY, String(selected.id));
    setLoading(true);
    cardioApi
      .progress(selected.id, metric)
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

  const meta = METRICS.find((m) => m.key === metric) ?? METRICS[2];

  const summary = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((p) => p.value);
    const best = meta.lowerIsBetter ? Math.min(...values) : Math.max(...values);
    const latest = values[values.length - 1];
    const first = values[0];
    const change = first > 0 ? ((latest - first) / first) * 100 : 0;
    // A 4% drop in pace is a 4% improvement; the sign alone would say the opposite.
    const improving = meta.lowerIsBetter ? change < 0 : change > 0;
    return { best, latest, change, improving, sessions: points.length };
  }, [points, meta]);

  if (initialising) return <Skeleton variant="rectangular" height={280} />;

  return (
    <Box>
      <Autocomplete
        options={activities}
        value={selected}
        onChange={(_, v) => setSelected(v)}
        getOptionLabel={(o) => o.name}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        renderInput={(params) => (
          <TextField {...params} label="Activity" placeholder="Search your cardio" />
        )}
        sx={{ mb: 2 }}
      />

      {!selected ? (
        <EmptyState
          icon={<FavoriteRounded />}
          title="Pick an activity"
          description="Choose something you've logged to see how it has moved."
        />
      ) : (
        <>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={metric}
            onChange={(_, v) => v && setMetric(v)}
            sx={{ mb: 2, width: '100%' }}
          >
            {available.map((m) => (
              <ToggleButton key={m.key} value={m.key} sx={{ flex: 1 }}>
                {m.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

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
              description={
                meta.distanceOnly
                  ? `No ${selected.name} sessions here with a distance recorded. Try a wider range.`
                  : `Nothing logged for ${selected.name} here. Try a wider range.`
              }
            />
          ) : (
            <>
              {summary && (
                <Card sx={{ p: 2, mb: 2 }}>
                  <Stack direction="row" spacing={3}>
                    <Stat label="Latest" value={meta.format(summary.latest)} unit={meta.unit} accent />
                    <Stat label="Best" value={meta.format(summary.best)} unit={meta.unit} />
                    <Stat
                      label="Change"
                      value={`${summary.change >= 0 ? '+' : ''}${summary.change.toFixed(1)}%`}
                    />
                  </Stack>
                  {meta.lowerIsBetter && points.length > 1 && (
                    <Typography sx={{ mt: 1, fontSize: '0.74rem', color: 'text.secondary' }}>
                      Lower is better here — {summary.improving ? 'this is going the right way' : 'this is drifting the wrong way'}.
                    </Typography>
                  )}
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
                  yAxis={[{ valueFormatter: (v) => meta.format(v) }]}
                  series={[
                    {
                      data: points.map((p) => p.value),
                      label: meta.label,
                      color: ink.accent,
                      showMark: points.length < 40,
                      valueFormatter: (v) => `${meta.format(v)}${meta.unit}`,
                    },
                  ]}
                  height={300}
                  margin={{ left: 58, right: 16, top: 16, bottom: 28 }}
                  grid={{ horizontal: true }}
                  hideLegend
                  sx={{
                    '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': { stroke: ink.line },
                    '& .MuiChartsAxis-tickLabel': { fill: ink.dim, fontSize: 11 },
                    '& .MuiChartsGrid-line': { stroke: ink.line },
                  }}
                />
              </Card>

              {isCircuit && <CircuitSplits activity={selected} />}

              <SectionHeader>Sessions</SectionHeader>
              <Card>
                {[...points]
                  .reverse()
                  .slice(0, 12)
                  .map((p, i) => (
                    <Stack
                      key={p.date.getTime()}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ px: 1.5, py: 1, borderTop: i ? `1px solid ${ink.line}` : 'none' }}
                    >
                      <Label>{shortDate(p.date)}</Label>
                      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {meta.format(p.value)}
                        <Label component="span" sx={{ ml: 0.5 }}>
                          {meta.unit}
                        </Label>
                      </Typography>
                    </Stack>
                  ))}
              </Card>
            </>
          )}
        </>
      )}
    </Box>
  );
}
